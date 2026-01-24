import mongoose from 'mongoose';
import {
  Conversation,
  IConversation,
  ConversationType,
  Message,
  IMessage,
  MessageType,
  IAttachment,
  ConversationParticipant,
  IConversationParticipant,
  ParticipantRole,
} from '../models';
import { redisService } from './redis.service';
import logger from '../utils/logger';
import { MESSAGES } from '../constants/messages';

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  before?: Date;
  after?: Date;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  type?: MessageType;
  attachments?: IAttachment[];
  replyTo?: string;
  mentions?: string[];
}

/**
 * Create group options
 */
export interface CreateGroupOptions {
  name: string;
  description?: string;
  avatar?: string;
  participantIds: string[];
}

/**
 * User presence info
 */
export interface PresenceInfo {
  isOnline: boolean;
  lastSeen?: Date;
}

/**
 * Conversation with participant info
 */
export interface ConversationWithDetails {
  _id: mongoose.Types.ObjectId;
  type: string;
  name?: string;
  description?: string;
  avatar?: string;
  createdBy: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  admins?: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  metadata?: {
    totalMessages: number;
    pinnedMessages: mongoose.Types.ObjectId[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  participantDetails?: Partial<IConversationParticipant> | null;
  otherParticipants?: Array<{
    _id: mongoose.Types.ObjectId;
    firstName?: string;
    lastName?: string;
    email?: string;
    slug?: string;
  }>;
}

// Redis key patterns
const REDIS_KEYS = {
  TYPING: (conversationId: string, userId: string) => `chat:typing:${conversationId}:${userId}`,
  TYPING_PATTERN: (conversationId: string) => `chat:typing:${conversationId}:*`,
  ONLINE: 'chat:online',
  PRESENCE: (userId: string) => `chat:presence:${userId}`,
  UNREAD: (conversationId: string, userId: string) => `chat:unread:${conversationId}:${userId}`,
};

// TTL values in seconds
const TTL = {
  TYPING: 3,
  PRESENCE: 60,
};

/**
 * Chat Service - Core business logic for chat functionality
 */
class ChatService {
  private static instance: ChatService;

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // =====================
  // CONVERSATION MANAGEMENT
  // =====================

  /**
   * Create a direct (1:1) conversation between two users
   */
  async createDirectConversation(userId1: string, userId2: string): Promise<IConversation> {
    if (userId1 === userId2) {
      throw new Error(MESSAGES.CHAT.CANNOT_MESSAGE_SELF);
    }

    const objectId1 = new mongoose.Types.ObjectId(userId1);
    const objectId2 = new mongoose.Types.ObjectId(userId2);

    // Sort IDs for consistent lookup
    const participants = [objectId1, objectId2].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      type: ConversationType.DIRECT,
      participants: { $all: participants, $size: 2 },
    });

    if (conversation) {
      // Reactivate participant records if they left
      await ConversationParticipant.updateMany(
        { conversationId: conversation._id, userId: { $in: participants } },
        { $set: { isActive: true, leftAt: null } }
      );
      return conversation;
    }

    // Create new conversation
    conversation = await Conversation.create({
      type: ConversationType.DIRECT,
      createdBy: objectId1,
      participants,
      admins: participants,
    });

    // Create participant records
    await ConversationParticipant.insertMany([
      {
        conversationId: conversation._id,
        userId: objectId1,
        role: ParticipantRole.ADMIN,
        joinedBy: objectId1,
      },
      {
        conversationId: conversation._id,
        userId: objectId2,
        role: ParticipantRole.ADMIN,
        joinedBy: objectId1,
      },
    ]);

    return conversation;
  }

  /**
   * Create a group conversation
   */
  async createGroupConversation(
    creatorId: string,
    options: CreateGroupOptions
  ): Promise<IConversation> {
    const { name, description, avatar, participantIds } = options;

    if (!name?.trim()) {
      throw new Error(MESSAGES.CHAT.GROUP_NAME_REQUIRED);
    }

    if (participantIds.length < 2) {
      throw new Error(MESSAGES.CHAT.MIN_PARTICIPANTS);
    }

    const creatorObjectId = new mongoose.Types.ObjectId(creatorId);
    const participantObjectIds = participantIds
      .filter((id) => id !== creatorId)
      .map((id) => new mongoose.Types.ObjectId(id));

    const allParticipants = [creatorObjectId, ...participantObjectIds];

    // Create conversation
    const conversation = await Conversation.create({
      type: ConversationType.GROUP,
      name: name.trim(),
      description: description?.trim(),
      avatar,
      createdBy: creatorObjectId,
      participants: allParticipants,
      admins: [creatorObjectId],
    });

    // Create participant records
    const participantRecords = allParticipants.map((userId) => ({
      conversationId: conversation._id,
      userId,
      role: userId.equals(creatorObjectId) ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
      joinedBy: creatorObjectId,
    }));

    await ConversationParticipant.insertMany(participantRecords);

    // Send system message
    await this.sendSystemMessage(
      conversation._id.toString(),
      creatorId,
      `${creatorId} created the group "${name}"`
    );

    return conversation;
  }

  /**
   * Get a conversation by ID with authorization check
   */
  async getConversation(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithDetails | null> {
    const objectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversation = await Conversation.findOne({
      _id: objectId,
      participants: userObjectId,
      isActive: true,
    }).lean();

    if (!conversation) {
      return null;
    }

    // Get participant details
    const participantDetails = await ConversationParticipant.findOne({
      conversationId: objectId,
      userId: userObjectId,
      isActive: true,
    }).lean();

    // Get other participants' info
    const otherParticipants = await mongoose
      .model('User')
      .find(
        {
          _id: { $in: conversation.participants.filter((p) => !p.equals(userObjectId)) },
        },
        'firstName lastName email slug'
      )
      .lean();

    return {
      _id: conversation._id,
      type: conversation.type,
      name: conversation.name,
      description: conversation.description,
      avatar: conversation.avatar,
      createdBy: conversation.createdBy,
      participants: conversation.participants,
      admins: conversation.admins,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      metadata: conversation.metadata,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participantDetails: participantDetails,
      otherParticipants: otherParticipants as ConversationWithDetails['otherParticipants'],
    };
  }

  /**
   * Get user's conversations list sorted by last message
   */
  async getUserConversations(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<ConversationWithDetails[]> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get participant records
    const participantRecords = await ConversationParticipant.find({
      userId: userObjectId,
      isActive: true,
      isArchived: false,
    })
      .select('conversationId unreadCount isMuted isPinned')
      .lean();

    const conversationIds = participantRecords.map((p) => p.conversationId);

    // Get conversations with sorting
    const conversations = await Conversation.find({
      _id: { $in: conversationIds },
      isActive: true,
    })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Map participant details and other participants
    const result: ConversationWithDetails[] = await Promise.all(
      conversations.map(async (conv) => {
        const participantDetails = participantRecords.find(
          (p) => p.conversationId.toString() === conv._id.toString()
        );

        const otherParticipants = await mongoose
          .model('User')
          .find(
            {
              _id: { $in: conv.participants.filter((p) => !p.equals(userObjectId)) },
            },
            'firstName lastName email slug'
          )
          .lean();

        return {
          _id: conv._id,
          type: conv.type,
          name: conv.name,
          description: conv.description,
          avatar: conv.avatar,
          createdBy: conv.createdBy,
          participants: conv.participants,
          admins: conv.admins,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview,
          metadata: conv.metadata,
          isActive: conv.isActive,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          participantDetails: participantDetails,
          otherParticipants: otherParticipants as ConversationWithDetails['otherParticipants'],
        };
      })
    );

    // Sort by pinned first, then by lastMessageAt
    return result.sort((a, b) => {
      const aPinned = a.participantDetails?.isPinned ? 1 : 0;
      const bPinned = b.participantDetails?.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aTime = a.lastMessageAt?.getTime() || 0;
      const bTime = b.lastMessageAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  /**
   * Add participants to a group conversation
   */
  async addParticipants(conversationId: string, adminId: string, userIds: string[]): Promise<void> {
    const conversation = await this.getConversation(conversationId, adminId);

    if (!conversation) {
      throw new Error(MESSAGES.CHAT.CONVERSATION_NOT_FOUND);
    }

    if (conversation.type === ConversationType.DIRECT) {
      throw new Error('Cannot add participants to a direct conversation');
    }

    // Check admin rights
    const adminObjectId = new mongoose.Types.ObjectId(adminId);
    const isAdmin = conversation.admins?.some((a) => a.equals(adminObjectId));
    if (!isAdmin) {
      throw new Error(MESSAGES.CHAT.NOT_ADMIN);
    }

    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const newParticipants: mongoose.Types.ObjectId[] = [];

    for (const userId of userIds) {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Check if already participant
      const existing = await ConversationParticipant.findOne({
        conversationId: convObjectId,
        userId: userObjectId,
      });

      if (existing) {
        if (existing.isActive) {
          continue; // Already active participant
        }
        // Reactivate
        existing.isActive = true;
        existing.leftAt = undefined;
        existing.joinedAt = new Date();
        existing.joinedBy = adminObjectId;
        await existing.save();
      } else {
        // Create new participant
        await ConversationParticipant.create({
          conversationId: convObjectId,
          userId: userObjectId,
          role: ParticipantRole.MEMBER,
          joinedBy: adminObjectId,
        });
      }

      newParticipants.push(userObjectId);
    }

    // Update conversation participants array
    if (newParticipants.length > 0) {
      await Conversation.findByIdAndUpdate(convObjectId, {
        $addToSet: { participants: { $each: newParticipants } },
      });

      // Send system message
      await this.sendSystemMessage(
        conversationId,
        adminId,
        `${newParticipants.length} participant(s) added to the group`
      );
    }
  }

  /**
   * Remove a participant from a group conversation
   */
  async removeParticipant(conversationId: string, adminId: string, userId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId, adminId);

    if (!conversation) {
      throw new Error(MESSAGES.CHAT.CONVERSATION_NOT_FOUND);
    }

    if (conversation.type === ConversationType.DIRECT) {
      throw new Error('Cannot remove participants from a direct conversation');
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Check admin rights
    const isAdmin = conversation.admins?.some((a) => a.equals(adminObjectId));
    if (!isAdmin) {
      throw new Error(MESSAGES.CHAT.NOT_ADMIN);
    }

    // Cannot remove creator
    if (conversation.createdBy.equals(userObjectId)) {
      throw new Error(MESSAGES.CHAT.CANNOT_REMOVE_ADMIN);
    }

    // Mark participant as inactive
    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      {
        isActive: false,
        leftAt: new Date(),
        removedBy: adminObjectId,
      }
    );

    // Remove from conversation participants array
    await Conversation.findByIdAndUpdate(convObjectId, {
      $pull: { participants: userObjectId, admins: userObjectId },
    });

    // Send system message
    await this.sendSystemMessage(
      conversationId,
      adminId,
      `A participant was removed from the group`
    );
  }

  /**
   * Leave a conversation
   */
  async leaveConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);

    if (!conversation) {
      throw new Error(MESSAGES.CHAT.CONVERSATION_NOT_FOUND);
    }

    if (conversation.type === ConversationType.DIRECT) {
      throw new Error(MESSAGES.CHAT.CANNOT_LEAVE_DIRECT);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Mark participant as inactive
    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      {
        isActive: false,
        leftAt: new Date(),
      }
    );

    // Remove from conversation participants array
    await Conversation.findByIdAndUpdate(convObjectId, {
      $pull: { participants: userObjectId, admins: userObjectId },
    });

    // Send system message
    await this.sendSystemMessage(conversationId, userId, 'A participant left the group');
  }

  /**
   * Update conversation details (name, avatar, description)
   */
  async updateConversation(
    conversationId: string,
    adminId: string,
    updates: { name?: string; description?: string; avatar?: string }
  ): Promise<IConversation> {
    const conversation = await this.getConversation(conversationId, adminId);

    if (!conversation) {
      throw new Error(MESSAGES.CHAT.CONVERSATION_NOT_FOUND);
    }

    if (conversation.type === ConversationType.DIRECT) {
      throw new Error('Cannot update direct conversation details');
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminId);
    const isAdmin = conversation.admins?.some((a) => a.equals(adminObjectId));
    if (!isAdmin) {
      throw new Error(MESSAGES.CHAT.NOT_ADMIN);
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: updateData },
      { new: true }
    );

    return updated!;
  }

  // =====================
  // MESSAGE OPERATIONS
  // =====================

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    options: SendMessageOptions = {}
  ): Promise<IMessage> {
    const { type = MessageType.TEXT, attachments = [], replyTo, mentions = [] } = options;

    // Validate conversation access
    const conversation = await this.getConversation(conversationId, senderId);
    if (!conversation) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    // Validate content
    if (!content?.trim() && attachments.length === 0 && type !== MessageType.SYSTEM) {
      throw new Error(MESSAGES.CHAT.EMPTY_MESSAGE);
    }

    const senderObjectId = new mongoose.Types.ObjectId(senderId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Create message
    const messageData: Partial<IMessage> = {
      conversationId: convObjectId,
      senderId: senderObjectId,
      content: content?.trim() || '',
      type,
      attachments,
      mentions: mentions.map((id) => new mongoose.Types.ObjectId(id)),
    };

    if (replyTo) {
      messageData.replyTo = new mongoose.Types.ObjectId(replyTo);
    }

    const message = await Message.create(messageData);

    // Update conversation
    const preview = this.generateMessagePreview(content, type, attachments);
    await Conversation.findByIdAndUpdate(convObjectId, {
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview,
      $inc: { 'metadata.totalMessages': 1 },
    });

    // Update unread counts for other participants
    await ConversationParticipant.updateMany(
      {
        conversationId: convObjectId,
        userId: { $ne: senderObjectId },
        isActive: true,
      },
      { $inc: { unreadCount: 1 } }
    );

    // Clear typing indicator
    await this.clearTyping(conversationId, senderId);

    // Populate sender info before returning
    await message.populate('senderId', 'firstName lastName slug');

    if (replyTo) {
      await message.populate('replyTo', 'content senderId type');
    }

    return message;
  }

  /**
   * Send a system message
   */
  async sendSystemMessage(
    conversationId: string,
    triggeredBy: string,
    content: string
  ): Promise<IMessage> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const senderObjectId = new mongoose.Types.ObjectId(triggeredBy);

    const message = await Message.create({
      conversationId: convObjectId,
      senderId: senderObjectId,
      content,
      type: MessageType.SYSTEM,
    });

    await Conversation.findByIdAndUpdate(convObjectId, {
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
      lastMessagePreview: content.substring(0, 100),
    });

    return message;
  }

  /**
   * Generate message preview for conversation list
   */
  private generateMessagePreview(
    content: string,
    type: MessageType,
    attachments: IAttachment[]
  ): string {
    switch (type) {
      case MessageType.IMAGE:
        return '📷 Image';
      case MessageType.VIDEO:
        return '🎬 Video';
      case MessageType.AUDIO:
        return '🎵 Audio';
      case MessageType.FILE:
        return `📎 ${attachments[0]?.filename || 'File'}`;
      case MessageType.LOCATION:
        return '📍 Location';
      case MessageType.SYSTEM:
        return content.substring(0, 100);
      default:
        return content.substring(0, 100);
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, userId: string, newContent: string): Promise<IMessage> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    if (!message.senderId.equals(userObjectId)) {
      throw new Error(MESSAGES.CHAT.CANNOT_EDIT_OTHERS_MESSAGE);
    }

    if (message.isDeleted) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    message.content = newContent.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Update conversation preview if this was the last message
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation?.lastMessage?.equals(message._id)) {
      await Conversation.findByIdAndUpdate(message.conversationId, {
        lastMessagePreview: this.generateMessagePreview(
          newContent,
          message.type,
          message.attachments
        ),
      });
    }

    return message;
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    forEveryone: boolean = false
  ): Promise<void> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    if (forEveryone) {
      // Only sender can delete for everyone
      if (!message.senderId.equals(userObjectId)) {
        throw new Error(MESSAGES.CHAT.CANNOT_DELETE_OTHERS_MESSAGE);
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = 'This message was deleted';
      message.attachments = [];
      await message.save();
    } else {
      // Delete only for this user
      await Message.findByIdAndUpdate(msgObjectId, {
        $addToSet: { deletedFor: userObjectId },
      });
    }
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    userId: string,
    options: PaginationOptions = {}
  ): Promise<IMessage[]> {
    const { limit = 50, before, after } = options;

    // Validate access
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Build query
    const query: Record<string, unknown> = {
      conversationId: convObjectId,
      deletedFor: { $ne: userObjectId },
    };

    if (before) {
      query.createdAt = { $lt: before };
    } else if (after) {
      query.createdAt = { $gt: after };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'firstName lastName slug')
      .populate('replyTo', 'content senderId type')
      .populate('mentions', 'firstName lastName slug')
      .lean();

    return messages.reverse();
  }

  // =====================
  // REACTIONS
  // =====================

  /**
   * Add a reaction to a message
   */
  async addReaction(messageId: string, userId: string, emoji: string): Promise<IMessage> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => r.emoji === emoji && r.userId.equals(userObjectId)
    );

    if (existingReaction) {
      return message; // Already reacted
    }

    // Add reaction
    message.reactions.push({
      emoji,
      userId: userObjectId,
      createdAt: new Date(),
    });
    await message.save();

    return message;
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(messageId: string, userId: string, emoji: string): Promise<IMessage> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findByIdAndUpdate(
      msgObjectId,
      {
        $pull: {
          reactions: { emoji, userId: userObjectId },
        },
      },
      { new: true }
    );

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    return message;
  }

  /**
   * Toggle a reaction (add if not exists, remove if exists)
   */
  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ message: IMessage; added: boolean }> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    const existingIndex = message.reactions.findIndex(
      (r) => r.emoji === emoji && r.userId.equals(userObjectId)
    );

    let added: boolean;
    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
      added = false;
    } else {
      message.reactions.push({
        emoji,
        userId: userObjectId,
        createdAt: new Date(),
      });
      added = true;
    }

    await message.save();
    return { message, added };
  }

  // =====================
  // READ RECEIPTS
  // =====================

  /**
   * Mark conversation as read up to a specific message
   * Returns the IDs of messages that were marked as read
   */
  async markAsRead(conversationId: string, userId: string, messageId?: string): Promise<string[]> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Update participant record
    const updateData: Record<string, unknown> = {
      unreadCount: 0,
      lastReadAt: new Date(),
    };

    if (messageId) {
      updateData.lastReadMessageId = new mongoose.Types.ObjectId(messageId);
    }

    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      { $set: updateData }
    );

    // Build filter for messages to mark as read
    // Find messages not sent by this user and not already read by this user
    const baseFilter: Record<string, unknown> = {
      conversationId: convObjectId,
      senderId: { $ne: userObjectId },
    };

    if (messageId) {
      // Get the message to determine its timestamp
      const targetMessage = await Message.findById(messageId);
      if (targetMessage) {
        baseFilter.createdAt = { $lte: targetMessage.createdAt };
      }
    }

    // First, find messages that haven't been read by this user
    const unreadMessages = await Message.find({
      ...baseFilter,
      'readBy.userId': { $ne: userObjectId },
    }).select('_id');

    if (unreadMessages.length === 0) {
      return [];
    }

    const messageIds = unreadMessages.map((m) => m._id);

    // Update read receipts on those messages
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $addToSet: {
          readBy: { userId: userObjectId, readAt: new Date() },
        },
      }
    );

    return messageIds.map((id) => id.toString());
  }

  /**
   * Mark messages as delivered
   */
  async markAsDelivered(messageIds: string[], userId: string): Promise<void> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const msgObjectIds = messageIds.map((id) => new mongoose.Types.ObjectId(id));

    await Message.updateMany(
      {
        _id: { $in: msgObjectIds },
        'deliveredTo.userId': { $ne: userObjectId },
      },
      {
        $addToSet: {
          deliveredTo: { userId: userObjectId, deliveredAt: new Date() },
        },
      }
    );
  }

  /**
   * Mark all undelivered messages in a conversation as delivered for a user
   * Returns the list of message IDs that were marked as delivered
   */
  async markConversationAsDelivered(conversationId: string, userId: string): Promise<string[]> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find all messages not yet delivered to this user
    const undeliveredMessages = await Message.find({
      conversationId: convObjectId,
      senderId: { $ne: userObjectId }, // Don't mark own messages
      'deliveredTo.userId': { $ne: userObjectId },
    }).select('_id');

    if (undeliveredMessages.length === 0) {
      return [];
    }

    const messageIds = undeliveredMessages.map((m) => m._id);

    // Mark them as delivered
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $addToSet: {
          deliveredTo: { userId: userObjectId, deliveredAt: new Date() },
        },
      }
    );

    return messageIds.map((id) => id.toString());
  }

  // =====================
  // MUTE/UNMUTE
  // =====================

  /**
   * Mute a conversation
   */
  async muteConversation(
    conversationId: string,
    userId: string,
    duration?: number // Duration in seconds, undefined = forever
  ): Promise<void> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const updateData: Record<string, unknown> = {
      isMuted: true,
    };

    if (duration) {
      updateData.mutedUntil = new Date(Date.now() + duration * 1000);
    } else {
      updateData.mutedUntil = null;
    }

    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      { $set: updateData }
    );
  }

  /**
   * Unmute a conversation
   */
  async unmuteConversation(conversationId: string, userId: string): Promise<void> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      { $set: { isMuted: false, mutedUntil: null } }
    );
  }

  // =====================
  // ARCHIVE/PIN
  // =====================

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      { $set: { isArchived: true } }
    );
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(conversationId: string, userId: string): Promise<void> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await ConversationParticipant.findOneAndUpdate(
      { conversationId: convObjectId, userId: userObjectId },
      { $set: { isArchived: false } }
    );
  }

  /**
   * Pin/unpin a conversation
   */
  async togglePinConversation(conversationId: string, userId: string): Promise<boolean> {
    const convObjectId = new mongoose.Types.ObjectId(conversationId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const participant = await ConversationParticipant.findOne({
      conversationId: convObjectId,
      userId: userObjectId,
    });

    if (!participant) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    const newPinned = !participant.isPinned;
    participant.isPinned = newPinned;
    participant.pinnedAt = newPinned ? new Date() : undefined;
    await participant.save();

    return newPinned;
  }

  // =====================
  // TYPING INDICATORS
  // =====================

  /**
   * Set typing indicator
   */
  async setTyping(conversationId: string, userId: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      const key = REDIS_KEYS.TYPING(conversationId, userId);
      await redis.setex(key, TTL.TYPING, Date.now().toString());
    } catch (error) {
      logger.warn('Failed to set typing indicator:', error);
    }
  }

  /**
   * Clear typing indicator
   */
  async clearTyping(conversationId: string, userId: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      const key = REDIS_KEYS.TYPING(conversationId, userId);
      await redis.del(key);
    } catch (error) {
      logger.warn('Failed to clear typing indicator:', error);
    }
  }

  /**
   * Get users currently typing in a conversation
   */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    try {
      const redis = redisService.getClient();
      const pattern = REDIS_KEYS.TYPING_PATTERN(conversationId);
      const keys = await redis.keys(pattern);

      return keys.map((key) => {
        const parts = key.split(':');
        return parts[parts.length - 1];
      });
    } catch (error) {
      logger.warn('Failed to get typing users:', error);
      return [];
    }
  }

  // =====================
  // PRESENCE
  // =====================

  /**
   * Set user online status
   */
  async setUserOnline(userId: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      await redis.sadd(REDIS_KEYS.ONLINE, userId);
      await redis.hset(REDIS_KEYS.PRESENCE(userId), {
        isOnline: 'true',
        lastSeen: Date.now().toString(),
      });
    } catch (error) {
      logger.warn('Failed to set user online:', error);
    }
  }

  /**
   * Set user offline status
   */
  async setUserOffline(userId: string): Promise<void> {
    try {
      const redis = redisService.getClient();
      await redis.srem(REDIS_KEYS.ONLINE, userId);
      await redis.hset(REDIS_KEYS.PRESENCE(userId), {
        isOnline: 'false',
        lastSeen: Date.now().toString(),
      });
    } catch (error) {
      logger.warn('Failed to set user offline:', error);
    }
  }

  /**
   * Get presence info for multiple users
   */
  async getUserPresence(userIds: string[]): Promise<Map<string, PresenceInfo>> {
    const result = new Map<string, PresenceInfo>();

    try {
      const redis = redisService.getClient();

      for (const userId of userIds) {
        const data = await redis.hgetall(REDIS_KEYS.PRESENCE(userId));

        if (data && Object.keys(data).length > 0) {
          result.set(userId, {
            isOnline: data.isOnline === 'true',
            lastSeen: data.lastSeen ? new Date(parseInt(data.lastSeen, 10)) : undefined,
          });
        } else {
          result.set(userId, { isOnline: false });
        }
      }
    } catch (error) {
      logger.warn('Failed to get user presence:', error);
    }

    return result;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<string[]> {
    try {
      const redis = redisService.getClient();
      return await redis.smembers(REDIS_KEYS.ONLINE);
    } catch (error) {
      logger.warn('Failed to get online users:', error);
      return [];
    }
  }

  // =====================
  // PIN MESSAGES
  // =====================

  /**
   * Pin a message
   */
  async pinMessage(messageId: string, userId: string): Promise<IMessage> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    // Verify user is participant
    const conversation = await this.getConversation(message.conversationId.toString(), userId);
    if (!conversation) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = userObjectId;
    await message.save();

    // Update conversation pinned messages
    await Conversation.findByIdAndUpdate(message.conversationId, {
      $addToSet: { 'metadata.pinnedMessages': message._id },
    });

    return message;
  }

  /**
   * Unpin a message
   */
  async unpinMessage(messageId: string, userId: string): Promise<IMessage> {
    const msgObjectId = new mongoose.Types.ObjectId(messageId);

    const message = await Message.findById(msgObjectId);

    if (!message) {
      throw new Error(MESSAGES.CHAT.MESSAGE_NOT_FOUND);
    }

    // Verify user is participant
    const conversation = await this.getConversation(message.conversationId.toString(), userId);
    if (!conversation) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    message.isPinned = false;
    message.pinnedAt = undefined;
    message.pinnedBy = undefined;
    await message.save();

    // Update conversation pinned messages
    await Conversation.findByIdAndUpdate(message.conversationId, {
      $pull: { 'metadata.pinnedMessages': message._id },
    });

    return message;
  }

  /**
   * Get pinned messages in a conversation
   */
  async getPinnedMessages(conversationId: string, userId: string): Promise<IMessage[]> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error(MESSAGES.CHAT.NOT_PARTICIPANT);
    }

    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    return Message.find({
      conversationId: convObjectId,
      isPinned: true,
      isDeleted: false,
    })
      .sort({ pinnedAt: -1 })
      .populate('senderId', 'firstName lastName slug')
      .lean();
  }
}

export const chatService = ChatService.getInstance();
export default chatService;

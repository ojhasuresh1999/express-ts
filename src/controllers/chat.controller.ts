import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { chatService, SendMessageOptions, CreateGroupOptions } from '../services/chat.service';
import { socketService } from '../services/socket.service';
import { CHAT_EVENTS_S2C } from '../services/chat.events';
import { MESSAGES } from '../constants/messages';
import { MessageType } from '../models';

/**
 * Extended request with user - using type intersection to avoid interface extension issues
 */
type AuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

/**
 * Chat Controller - REST API handlers
 */
class ChatController {
  // =====================
  // CONVERSATIONS
  // =====================

  /**
   * Create a direct (1:1) conversation
   * POST /api/chat/conversations/direct
   */
  async createDirectConversation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { participantId } = req.body;

      const conversation = await chatService.createDirectConversation(userId, participantId);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_CREATED,
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a group conversation
   * POST /api/chat/conversations/group
   */
  async createGroupConversation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, description, avatar, participantIds } = req.body;

      const options: CreateGroupOptions = {
        name,
        description,
        avatar,
        participantIds,
      };

      const conversation = await chatService.createGroupConversation(userId, options);

      // Notify participants via socket
      const io = socketService.getIO();
      for (const participantId of participantIds) {
        io.to(`user:${participantId}`).emit(CHAT_EVENTS_S2C.CONVERSATION_UPDATED, {
          type: 'created',
          conversation,
        });
      }

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_CREATED,
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's conversations list
   * GET /api/chat/conversations
   */
  async getConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const conversations = await chatService.getUserConversations(userId, { page, limit });

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          conversations,
          pagination: {
            page,
            limit,
            hasMore: conversations.length === limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single conversation
   * GET /api/chat/conversations/:id
   */
  async getConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const conversation = await chatService.getConversation(id, userId);

      if (!conversation) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: MESSAGES.CHAT.CONVERSATION_NOT_FOUND,
        });
        return;
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a conversation
   * PATCH /api/chat/conversations/:id
   */
  async updateConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name, description, avatar } = req.body;

      const conversation = await chatService.updateConversation(id, userId, {
        name,
        description,
        avatar,
      });

      // Notify participants
      const io = socketService.getIO();
      io.to(`conversation:${id}`).emit(CHAT_EVENTS_S2C.CONVERSATION_UPDATED, {
        type: 'updated',
        conversation,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_UPDATED,
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a conversation
   * DELETE /api/chat/conversations/:id
   */
  async leaveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await chatService.leaveConversation(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.LEFT_CONVERSATION,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add participants to a group
   * POST /api/chat/conversations/:id/participants
   */
  async addParticipants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { userIds } = req.body;

      await chatService.addParticipants(id, userId, userIds);

      // Notify new participants
      const io = socketService.getIO();
      const conversation = await chatService.getConversation(id, userId);
      for (const newUserId of userIds) {
        io.to(`user:${newUserId}`).emit(CHAT_EVENTS_S2C.CONVERSATION_UPDATED, {
          type: 'added_to_group',
          conversation,
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.PARTICIPANT_ADDED,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a participant from a group
   * DELETE /api/chat/conversations/:id/participants/:userId
   */
  async removeParticipant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { id, userId } = req.params;

      await chatService.removeParticipant(id, adminId, userId);

      // Notify removed user
      const io = socketService.getIO();
      io.to(`user:${userId}`).emit(CHAT_EVENTS_S2C.CONVERSATION_UPDATED, {
        type: 'removed_from_group',
        conversationId: id,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.PARTICIPANT_REMOVED,
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // MESSAGES
  // =====================

  /**
   * Get messages in a conversation
   * GET /api/chat/conversations/:id/messages
   */
  async getMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before ? new Date(req.query.before as string) : undefined;
      const after = req.query.after ? new Date(req.query.after as string) : undefined;

      const messages = await chatService.getMessages(id, userId, { limit, before, after });

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          messages,
          pagination: {
            limit,
            hasMore: messages.length === limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a message
   * POST /api/chat/conversations/:id/messages
   */
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { content, type, attachments, replyTo, mentions } = req.body;

      const options: SendMessageOptions = {
        type: type as MessageType,
        attachments,
        replyTo,
        mentions,
      };

      const message = await chatService.sendMessage(id, userId, content, options);

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${id}`).emit(CHAT_EVENTS_S2C.MESSAGE_NEW, {
        conversationId: id,
        message,
      });

      // Also emit to user rooms for participants not in conversation room
      const conversation = await chatService.getConversation(id, userId);
      if (conversation?.participants) {
        for (const participantId of conversation.participants) {
          const participantIdStr = participantId.toString();
          if (participantIdStr !== userId) {
            io.to(`user:${participantIdStr}`).emit(CHAT_EVENTS_S2C.MESSAGE_NEW, {
              conversationId: id,
              message,
            });
          }
        }
      }

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: MESSAGES.CHAT.MESSAGE_SENT,
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Edit a message
   * PATCH /api/chat/messages/:id
   */
  async editMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { content } = req.body;

      const message = await chatService.editMessage(id, userId, content);

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.MESSAGE_UPDATED, {
        conversationId: message.conversationId.toString(),
        message,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.MESSAGE_UPDATED,
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a message
   * DELETE /api/chat/messages/:id
   */
  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { forEveryone } = req.body;

      // Get message before deletion for conversation ID
      const Message = (await import('../models')).Message;
      const message = await Message.findById(id);

      if (!message) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: MESSAGES.CHAT.MESSAGE_NOT_FOUND,
        });
        return;
      }

      await chatService.deleteMessage(id, userId, forEveryone);

      if (forEveryone) {
        // Broadcast via socket
        const io = socketService.getIO();
        io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.MESSAGE_DELETED, {
          conversationId: message.conversationId.toString(),
          messageId: id,
          deletedBy: userId,
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.MESSAGE_DELETED,
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // REACTIONS
  // =====================

  /**
   * Add a reaction
   * POST /api/chat/messages/:id/reactions
   */
  async addReaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { emoji } = req.body;

      const message = await chatService.addReaction(id, userId, emoji);

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.REACTION_UPDATED, {
        conversationId: message.conversationId.toString(),
        messageId: id,
        reactions: message.reactions,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.REACTION_ADDED,
        data: { reactions: message.reactions },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a reaction
   * DELETE /api/chat/messages/:id/reactions/:emoji
   */
  async removeReaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id, emoji } = req.params;

      const message = await chatService.removeReaction(id, userId, decodeURIComponent(emoji));

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.REACTION_UPDATED, {
        conversationId: message.conversationId.toString(),
        messageId: id,
        reactions: message.reactions,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.REACTION_REMOVED,
        data: { reactions: message.reactions },
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // MUTE/UNMUTE
  // =====================

  /**
   * Mute a conversation
   * POST /api/chat/conversations/:id/mute
   */
  async muteConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { duration } = req.body;

      await chatService.muteConversation(id, userId, duration);

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_MUTED,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unmute a conversation
   * DELETE /api/chat/conversations/:id/mute
   */
  async unmuteConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await chatService.unmuteConversation(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_UNMUTED,
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // READ & ARCHIVE
  // =====================

  /**
   * Mark conversation as read
   * POST /api/chat/conversations/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { messageId } = req.body;

      await chatService.markAsRead(id, userId, messageId);

      // Broadcast read receipt
      const io = socketService.getIO();
      io.to(`conversation:${id}`).emit(CHAT_EVENTS_S2C.READ_RECEIPT, {
        conversationId: id,
        userId,
        messageId,
        readAt: new Date(),
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.MARKED_AS_READ,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archive a conversation
   * POST /api/chat/conversations/:id/archive
   */
  async archiveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await chatService.archiveConversation(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_ARCHIVED,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unarchive a conversation
   * DELETE /api/chat/conversations/:id/archive
   */
  async unarchiveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await chatService.unarchiveConversation(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.CONVERSATION_UNARCHIVED,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pin/unpin a conversation
   * POST /api/chat/conversations/:id/pin
   */
  async togglePinConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const isPinned = await chatService.togglePinConversation(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: isPinned ? MESSAGES.CHAT.CONVERSATION_PINNED : MESSAGES.CHAT.CONVERSATION_UNPINNED,
        data: { isPinned },
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // PIN MESSAGES
  // =====================

  /**
   * Pin a message
   * POST /api/chat/messages/:id/pin
   */
  async pinMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const message = await chatService.pinMessage(id, userId);

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.MESSAGE_PINNED, {
        conversationId: message.conversationId.toString(),
        message,
        pinnedBy: userId,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.MESSAGE_PINNED,
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unpin a message
   * DELETE /api/chat/messages/:id/pin
   */
  async unpinMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const message = await chatService.unpinMessage(id, userId);

      // Broadcast via socket
      const io = socketService.getIO();
      io.to(`conversation:${message.conversationId}`).emit(CHAT_EVENTS_S2C.MESSAGE_UNPINNED, {
        conversationId: message.conversationId.toString(),
        messageId: id,
        unpinnedBy: userId,
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: MESSAGES.CHAT.MESSAGE_UNPINNED,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pinned messages
   * GET /api/chat/conversations/:id/pinned
   */
  async getPinnedMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const messages = await chatService.getPinnedMessages(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: { messages },
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // PRESENCE
  // =====================

  /**
   * Get online users
   * GET /api/chat/presence/online
   */
  async getOnlineUsers(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlineUsers = await chatService.getOnlineUsers();

      res.status(StatusCodes.OK).json({
        success: true,
        data: { onlineUsers },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();
export default chatController;

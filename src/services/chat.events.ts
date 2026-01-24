import { Socket, Server } from 'socket.io';
import { chatService } from './chat.service';
import { MessageType, IAttachment } from '../models';
import logger from '../utils/logger';

/**
 * Extended socket with user data
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

/**
 * Socket event names - Client to Server
 */
export const CHAT_EVENTS_C2S = {
  JOIN_CONVERSATION: 'chat:join',
  LEAVE_CONVERSATION: 'chat:leave',
  SEND_MESSAGE: 'chat:message:send',
  EDIT_MESSAGE: 'chat:message:edit',
  DELETE_MESSAGE: 'chat:message:delete',
  TYPING_START: 'chat:typing:start',
  TYPING_STOP: 'chat:typing:stop',
  MARK_READ: 'chat:message:read',
  MARK_DELIVERED: 'chat:message:delivered',
  ADD_REACTION: 'chat:reaction:add',
  REMOVE_REACTION: 'chat:reaction:remove',
  TOGGLE_REACTION: 'chat:reaction:toggle',
  GET_PRESENCE: 'chat:presence:get',
  PIN_MESSAGE: 'chat:message:pin',
  UNPIN_MESSAGE: 'chat:message:unpin',
} as const;

/**
 * Socket event names - Server to Client
 */
export const CHAT_EVENTS_S2C = {
  MESSAGE_NEW: 'chat:message:new',
  MESSAGE_UPDATED: 'chat:message:updated',
  MESSAGE_DELETED: 'chat:message:deleted',
  TYPING: 'chat:typing',
  READ_RECEIPT: 'chat:read:receipt',
  DELIVERY_RECEIPT: 'chat:delivery:receipt',
  REACTION_UPDATED: 'chat:reaction:updated',
  PRESENCE: 'chat:presence',
  CONVERSATION_UPDATED: 'chat:conversation:updated',
  USER_JOINED: 'chat:user:joined',
  USER_LEFT: 'chat:user:left',
  ERROR: 'chat:error',
  MESSAGE_PINNED: 'chat:message:pinned',
  MESSAGE_UNPINNED: 'chat:message:unpinned',
} as const;

/**
 * Payload interfaces
 */
interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: MessageType;
  attachments?: IAttachment[];
  replyTo?: string;
  mentions?: string[];
}

interface EditMessagePayload {
  messageId: string;
  content: string;
}

interface DeleteMessagePayload {
  messageId: string;
  forEveryone?: boolean;
}

interface TypingPayload {
  conversationId: string;
}

interface MarkReadPayload {
  conversationId: string;
  messageId?: string;
}

interface MarkDeliveredPayload {
  messageIds: string[];
  conversationId: string;
}

interface ReactionPayload {
  messageId: string;
  emoji: string;
}

interface PresencePayload {
  userIds: string[];
}

interface PinPayload {
  messageId: string;
}

/**
 * Callback response type
 */
interface CallbackResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Register chat event handlers for a socket
 */
export function registerChatEvents(socket: AuthenticatedSocket, io: Server): void {
  const userId = socket.userId;

  if (!userId) {
    logger.warn(`Chat events registration attempted without userId for socket ${socket.id}`);
    return;
  }

  logger.debug(`Registering chat events for user ${userId} on socket ${socket.id}`);

  // Set user online when they connect
  chatService.setUserOnline(userId).catch((err) => {
    logger.error('Failed to set user online:', err);
  });

  // =====================
  // CONVERSATION ROOM MANAGEMENT
  // =====================

  /**
   * Join a conversation room
   */
  socket.on(
    CHAT_EVENTS_C2S.JOIN_CONVERSATION,
    async (conversationId: string, callback?: (response: CallbackResponse) => void) => {
      try {
        // Verify user is participant
        const conversation = await chatService.getConversation(conversationId, userId);

        if (!conversation) {
          callback?.({ success: false, error: 'Not a participant of this conversation' });
          return;
        }

        // Join the room
        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);

        logger.debug(`User ${userId} joined room ${roomName}`);

        // Mark all undelivered messages as delivered
        const deliveredMessageIds = await chatService.markConversationAsDelivered(
          conversationId,
          userId
        );

        // Broadcast delivery receipts to the room
        if (deliveredMessageIds.length > 0) {
          socket.to(roomName).emit(CHAT_EVENTS_S2C.DELIVERY_RECEIPT, {
            conversationId,
            userId,
            messageIds: deliveredMessageIds,
            deliveredAt: new Date(),
          });
        }

        // Notify others in the room
        socket.to(roomName).emit(CHAT_EVENTS_S2C.USER_JOINED, {
          conversationId,
          userId,
          timestamp: new Date(),
        });

        callback?.({ success: true, data: { conversationId, joined: true } });
      } catch (error) {
        logger.error('Error joining conversation:', error);
        callback?.({ success: false, error: 'Failed to join conversation' });
      }
    }
  );

  /**
   * Leave a conversation room
   */
  socket.on(
    CHAT_EVENTS_C2S.LEAVE_CONVERSATION,
    async (conversationId: string, callback?: (response: CallbackResponse) => void) => {
      try {
        const roomName = `conversation:${conversationId}`;
        socket.leave(roomName);

        // Clear typing indicator
        await chatService.clearTyping(conversationId, userId);

        // Notify others
        socket.to(roomName).emit(CHAT_EVENTS_S2C.USER_LEFT, {
          conversationId,
          userId,
          timestamp: new Date(),
        });

        logger.debug(`User ${userId} left room ${roomName}`);
        callback?.({ success: true });
      } catch (error) {
        logger.error('Error leaving conversation:', error);
        callback?.({ success: false, error: 'Failed to leave conversation' });
      }
    }
  );

  // =====================
  // MESSAGING
  // =====================

  /**
   * Send a message
   */
  socket.on(
    CHAT_EVENTS_C2S.SEND_MESSAGE,
    async (payload: SendMessagePayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { conversationId, content, type, attachments, replyTo, mentions } = payload;

        const message = await chatService.sendMessage(conversationId, userId, content, {
          type,
          attachments,
          replyTo,
          mentions,
        });

        // Broadcast to conversation room - all participants in the room will receive this
        const roomName = `conversation:${conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.MESSAGE_NEW, {
          conversationId,
          message,
        });

        callback?.({ success: true, data: { message } });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        logger.error('Error sending message:', error);
        callback?.({ success: false, error: errorMessage });
      }
    }
  );

  /**
   * Edit a message
   */
  socket.on(
    CHAT_EVENTS_C2S.EDIT_MESSAGE,
    async (payload: EditMessagePayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId, content } = payload;

        const message = await chatService.editMessage(messageId, userId, content);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.MESSAGE_UPDATED, {
          conversationId: message.conversationId.toString(),
          message,
        });

        callback?.({ success: true, data: { message } });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
        logger.error('Error editing message:', error);
        callback?.({ success: false, error: errorMessage });
      }
    }
  );

  /**
   * Delete a message
   */
  socket.on(
    CHAT_EVENTS_C2S.DELETE_MESSAGE,
    async (payload: DeleteMessagePayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId, forEveryone = false } = payload;

        // Get message to find conversation
        const mongoose = await import('mongoose');
        const Message = mongoose.model('Message');
        const message = await Message.findById(messageId);

        if (!message) {
          callback?.({ success: false, error: 'Message not found' });
          return;
        }

        await chatService.deleteMessage(messageId, userId, forEveryone);

        if (forEveryone) {
          // Broadcast to conversation room
          const roomName = `conversation:${message.conversationId}`;
          io.to(roomName).emit(CHAT_EVENTS_S2C.MESSAGE_DELETED, {
            conversationId: message.conversationId.toString(),
            messageId,
            deletedBy: userId,
          });
        }

        callback?.({ success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
        logger.error('Error deleting message:', error);
        callback?.({ success: false, error: errorMessage });
      }
    }
  );

  // =====================
  // TYPING INDICATORS
  // =====================

  /**
   * Start typing
   */
  socket.on(CHAT_EVENTS_C2S.TYPING_START, async (payload: TypingPayload) => {
    try {
      const { conversationId } = payload;

      await chatService.setTyping(conversationId, userId);

      // Get current typing users
      const typingUsers = await chatService.getTypingUsers(conversationId);

      // Broadcast to conversation room (except sender)
      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit(CHAT_EVENTS_S2C.TYPING, {
        conversationId,
        typingUsers,
      });
    } catch (error) {
      logger.error('Error setting typing indicator:', error);
    }
  });

  /**
   * Stop typing
   */
  socket.on(CHAT_EVENTS_C2S.TYPING_STOP, async (payload: TypingPayload) => {
    try {
      const { conversationId } = payload;

      await chatService.clearTyping(conversationId, userId);

      // Get current typing users
      const typingUsers = await chatService.getTypingUsers(conversationId);

      // Broadcast to conversation room
      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit(CHAT_EVENTS_S2C.TYPING, {
        conversationId,
        typingUsers,
      });
    } catch (error) {
      logger.error('Error clearing typing indicator:', error);
    }
  });

  // =====================
  // READ RECEIPTS
  // =====================

  /**
   * Mark messages as read
   */
  socket.on(
    CHAT_EVENTS_C2S.MARK_READ,
    async (payload: MarkReadPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { conversationId, messageId } = payload;

        const readMessageIds = await chatService.markAsRead(conversationId, userId, messageId);

        // Broadcast read receipt to conversation room if any messages were marked
        if (readMessageIds.length > 0) {
          const roomName = `conversation:${conversationId}`;
          io.to(roomName).emit(CHAT_EVENTS_S2C.READ_RECEIPT, {
            conversationId,
            userId,
            messageId,
            messageIds: readMessageIds,
            readAt: new Date(),
          });
        }

        callback?.({ success: true, data: { readCount: readMessageIds.length } });
      } catch (error) {
        logger.error('Error marking as read:', error);
        callback?.({ success: false, error: 'Failed to mark as read' });
      }
    }
  );

  /**
   * Mark messages as delivered
   */
  socket.on(
    CHAT_EVENTS_C2S.MARK_DELIVERED,
    async (payload: MarkDeliveredPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageIds, conversationId } = payload;

        await chatService.markAsDelivered(messageIds, userId);

        // Broadcast delivery receipt to conversation room
        const roomName = `conversation:${conversationId}`;
        socket.to(roomName).emit(CHAT_EVENTS_S2C.DELIVERY_RECEIPT, {
          conversationId,
          userId,
          messageIds,
          deliveredAt: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        logger.error('Error marking as delivered:', error);
        callback?.({ success: false, error: 'Failed to mark as delivered' });
      }
    }
  );

  // =====================
  // REACTIONS
  // =====================

  /**
   * Add a reaction
   */
  socket.on(
    CHAT_EVENTS_C2S.ADD_REACTION,
    async (payload: ReactionPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId, emoji } = payload;

        const message = await chatService.addReaction(messageId, userId, emoji);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.REACTION_UPDATED, {
          conversationId: message.conversationId.toString(),
          messageId,
          reactions: message.reactions,
        });

        callback?.({ success: true, data: { reactions: message.reactions } });
      } catch (error) {
        logger.error('Error adding reaction:', error);
        callback?.({ success: false, error: 'Failed to add reaction' });
      }
    }
  );

  /**
   * Remove a reaction
   */
  socket.on(
    CHAT_EVENTS_C2S.REMOVE_REACTION,
    async (payload: ReactionPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId, emoji } = payload;

        const message = await chatService.removeReaction(messageId, userId, emoji);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.REACTION_UPDATED, {
          conversationId: message.conversationId.toString(),
          messageId,
          reactions: message.reactions,
        });

        callback?.({ success: true, data: { reactions: message.reactions } });
      } catch (error) {
        logger.error('Error removing reaction:', error);
        callback?.({ success: false, error: 'Failed to remove reaction' });
      }
    }
  );

  /**
   * Toggle a reaction
   */
  socket.on(
    CHAT_EVENTS_C2S.TOGGLE_REACTION,
    async (payload: ReactionPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId, emoji } = payload;

        const { message, added } = await chatService.toggleReaction(messageId, userId, emoji);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.REACTION_UPDATED, {
          conversationId: message.conversationId.toString(),
          messageId,
          reactions: message.reactions,
          action: added ? 'added' : 'removed',
          userId,
          emoji,
        });

        callback?.({ success: true, data: { reactions: message.reactions, added } });
      } catch (error) {
        logger.error('Error toggling reaction:', error);
        callback?.({ success: false, error: 'Failed to toggle reaction' });
      }
    }
  );

  // =====================
  // PRESENCE
  // =====================

  /**
   * Get presence for specific users
   */
  socket.on(
    CHAT_EVENTS_C2S.GET_PRESENCE,
    async (payload: PresencePayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { userIds } = payload;

        const presence = await chatService.getUserPresence(userIds);

        // Convert Map to object for serialization
        const presenceObj: Record<string, { isOnline: boolean; lastSeen?: Date }> = {};
        presence.forEach((value, key) => {
          presenceObj[key] = value;
        });

        callback?.({ success: true, data: { presence: presenceObj } });
      } catch (error) {
        logger.error('Error getting presence:', error);
        callback?.({ success: false, error: 'Failed to get presence' });
      }
    }
  );

  // =====================
  // PIN MESSAGES
  // =====================

  /**
   * Pin a message
   */
  socket.on(
    CHAT_EVENTS_C2S.PIN_MESSAGE,
    async (payload: PinPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId } = payload;

        const message = await chatService.pinMessage(messageId, userId);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.MESSAGE_PINNED, {
          conversationId: message.conversationId.toString(),
          message,
          pinnedBy: userId,
        });

        callback?.({ success: true, data: { message } });
      } catch (error) {
        logger.error('Error pinning message:', error);
        callback?.({ success: false, error: 'Failed to pin message' });
      }
    }
  );

  /**
   * Unpin a message
   */
  socket.on(
    CHAT_EVENTS_C2S.UNPIN_MESSAGE,
    async (payload: PinPayload, callback?: (response: CallbackResponse) => void) => {
      try {
        const { messageId } = payload;

        const message = await chatService.unpinMessage(messageId, userId);

        // Broadcast to conversation room
        const roomName = `conversation:${message.conversationId}`;
        io.to(roomName).emit(CHAT_EVENTS_S2C.MESSAGE_UNPINNED, {
          conversationId: message.conversationId.toString(),
          messageId,
          unpinnedBy: userId,
        });

        callback?.({ success: true });
      } catch (error) {
        logger.error('Error unpinning message:', error);
        callback?.({ success: false, error: 'Failed to unpin message' });
      }
    }
  );

  // =====================
  // DISCONNECT HANDLER
  // =====================

  socket.on('disconnect', async () => {
    try {
      // Set user offline
      await chatService.setUserOffline(userId);

      // Get user's conversations to broadcast offline status
      const conversations = await chatService.getUserConversations(userId, { limit: 100 });

      for (const conv of conversations) {
        const roomName = `conversation:${conv._id}`;
        socket.to(roomName).emit(CHAT_EVENTS_S2C.PRESENCE, {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      }

      logger.debug(`User ${userId} disconnected and set offline`);
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  });
}

/**
 * Emit to all participants of a conversation
 */
export async function emitToConversation(
  io: Server,
  conversationId: string,
  event: string,
  data: unknown
): Promise<void> {
  const roomName = `conversation:${conversationId}`;
  io.to(roomName).emit(event, data);
}

/**
 * Emit presence update for a user to all their conversations
 */
export async function broadcastPresence(
  io: Server,
  userId: string,
  isOnline: boolean
): Promise<void> {
  try {
    const conversations = await chatService.getUserConversations(userId, { limit: 100 });

    for (const conv of conversations) {
      const roomName = `conversation:${conv._id}`;
      io.to(roomName).emit(CHAT_EVENTS_S2C.PRESENCE, {
        userId,
        isOnline,
        lastSeen: new Date(),
      });
    }
  } catch (error) {
    logger.error('Error broadcasting presence:', error);
  }
}

export default {
  registerChatEvents,
  emitToConversation,
  broadcastPresence,
  CHAT_EVENTS_C2S,
  CHAT_EVENTS_S2C,
};

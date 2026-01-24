import mongoose, { Document, Schema } from 'mongoose';

/**
 * Participant roles in a conversation
 */
export enum ParticipantRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * Notification settings interface
 */
export interface INotificationSettings {
  push: boolean;
  sound: boolean;
  preview: boolean;
}

/**
 * Conversation participant document interface
 */
export interface IConversationParticipant extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: ParticipantRole;
  nickname?: string;
  isMuted: boolean;
  mutedUntil?: Date;
  unreadCount: number;
  lastReadAt?: Date;
  lastReadMessageId?: mongoose.Types.ObjectId;
  notifications: INotificationSettings;
  isArchived: boolean;
  isPinned: boolean;
  pinnedAt?: Date;
  joinedAt: Date;
  joinedBy?: mongoose.Types.ObjectId;
  leftAt?: Date;
  removedBy?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification settings schema
 */
const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    push: {
      type: Boolean,
      default: true,
    },
    sound: {
      type: Boolean,
      default: true,
    },
    preview: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/**
 * Conversation participant schema definition
 */
const conversationParticipantSchema = new Schema<IConversationParticipant>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ParticipantRole),
      default: ParticipantRole.MEMBER,
    },
    nickname: {
      type: String,
      trim: true,
      maxlength: [50, 'Nickname cannot exceed 50 characters'],
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReadAt: {
      type: Date,
    },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    notifications: {
      type: notificationSettingsSchema,
      default: () => ({
        push: true,
        sound: true,
        preview: true,
      }),
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    joinedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    leftAt: {
      type: Date,
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.__v = undefined;
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

// Compound unique index to ensure one participant entry per user per conversation
conversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

// Index for fetching user's conversations with sorting
conversationParticipantSchema.index({ userId: 1, isActive: 1, isPinned: -1 });
conversationParticipantSchema.index({ userId: 1, isArchived: 1 });
conversationParticipantSchema.index({ conversationId: 1, isActive: 1 });

/**
 * Check if mute has expired and auto-unmute
 */
conversationParticipantSchema.methods.checkMuteExpiry = function (): boolean {
  if (this.isMuted && this.mutedUntil && new Date() > this.mutedUntil) {
    this.isMuted = false;
    this.mutedUntil = undefined;
    return true; // Indicates mute was auto-cleared
  }
  return false;
};

/**
 * Increment unread count
 */
conversationParticipantSchema.methods.incrementUnread = async function (): Promise<void> {
  this.unreadCount += 1;
  await this.save();
};

/**
 * Mark conversation as read
 */
conversationParticipantSchema.methods.markAsRead = async function (
  messageId?: mongoose.Types.ObjectId
): Promise<void> {
  this.unreadCount = 0;
  this.lastReadAt = new Date();
  if (messageId) {
    this.lastReadMessageId = messageId;
  }
  await this.save();
};

/**
 * Conversation participant model
 */
const ConversationParticipant = mongoose.model<IConversationParticipant>(
  'ConversationParticipant',
  conversationParticipantSchema
);

export default ConversationParticipant;

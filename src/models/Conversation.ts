import mongoose, { Document, Schema } from 'mongoose';

/**
 * Conversation types
 */
export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

/**
 * Conversation metadata interface
 */
export interface IConversationMetadata {
  totalMessages: number;
  pinnedMessages: mongoose.Types.ObjectId[];
}

/**
 * Conversation document interface
 */
export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: ConversationType;
  name?: string;
  description?: string;
  avatar?: string;
  createdBy: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  metadata: IConversationMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation schema definition
 */
const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Conversation name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    avatar: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      maxlength: 100,
    },
    metadata: {
      totalMessages: {
        type: Number,
        default: 0,
      },
      pinnedMessages: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Message',
        },
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Compound indexes for efficient queries
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ participants: 1, type: 1 });
conversationSchema.index({ createdBy: 1, createdAt: -1 });

// Index for finding direct conversations between two users
conversationSchema.index(
  { type: 1, participants: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'direct' },
  }
);

/**
 * Find or create a direct conversation between two users
 */
conversationSchema.statics.findOrCreateDirect = async function (
  userId1: mongoose.Types.ObjectId,
  userId2: mongoose.Types.ObjectId
): Promise<IConversation> {
  // Sort participant IDs to ensure consistent ordering
  const participants = [userId1, userId2].sort((a, b) => a.toString().localeCompare(b.toString()));

  let conversation = await this.findOne({
    type: ConversationType.DIRECT,
    participants: { $all: participants, $size: 2 },
  });

  if (!conversation) {
    conversation = await this.create({
      type: ConversationType.DIRECT,
      createdBy: userId1,
      participants,
      admins: participants,
    });
  }

  return conversation;
};

/**
 * Conversation model
 */
const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;

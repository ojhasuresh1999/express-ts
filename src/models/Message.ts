import mongoose, { Document, Schema } from 'mongoose';

/**
 * Message types
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  FILE = 'file',
  AUDIO = 'audio',
  LOCATION = 'location',
  SYSTEM = 'system',
}

/**
 * Message delivery status
 */
export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

/**
 * Attachment interface
 */
export interface IAttachment {
  type: 'image' | 'video' | 'file' | 'audio';
  url: string;
  publicId: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  thumbnail?: string;
  duration?: number; // For audio/video
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Reaction interface
 */
export interface IReaction {
  emoji: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

/**
 * Delivery status interface
 */
export interface IDeliveryStatus {
  userId: mongoose.Types.ObjectId;
  deliveredAt: Date;
}

/**
 * Read status interface
 */
export interface IReadStatus {
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

/**
 * Location interface
 */
export interface ILocation {
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * Message document interface
 */
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  type: MessageType;
  attachments: IAttachment[];
  replyTo?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  reactions: IReaction[];
  deliveredTo: IDeliveryStatus[];
  readBy: IReadStatus[];
  location?: ILocation;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedFor: mongoose.Types.ObjectId[];
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attachment schema
 */
const attachmentSchema = new Schema<IAttachment>(
  {
    type: {
      type: String,
      enum: ['image', 'video', 'file', 'audio'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    filename: String,
    size: Number,
    mimeType: String,
    thumbnail: String,
    duration: Number,
    dimensions: {
      width: Number,
      height: Number,
    },
  },
  { _id: false }
);

/**
 * Reaction schema
 */
const reactionSchema = new Schema<IReaction>(
  {
    emoji: {
      type: String,
      required: true,
      maxlength: 10,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Delivery status schema
 */
const deliveryStatusSchema = new Schema<IDeliveryStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Read status schema
 */
const readStatusSchema = new Schema<IReadStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Location schema
 */
const locationSchema = new Schema<ILocation>(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    address: String,
  },
  { _id: false }
);

/**
 * Message schema definition
 */
const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      maxlength: [10000, 'Message content cannot exceed 10000 characters'],
      default: '',
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
      index: true,
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [reactionSchema],
    deliveredTo: [deliveryStatusSchema],
    readBy: [readStatusSchema],
    location: locationSchema,
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: Date,
    pinnedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ mentions: 1, createdAt: -1 });
messageSchema.index({ 'reactions.userId': 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ conversationId: 1, isPinned: 1 });

// Text index for message search
messageSchema.index({ content: 'text' });

/**
 * Pre-save middleware to update edited timestamp
 */
messageSchema.pre('save', function () {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
});

/**
 * Message model
 */
const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;

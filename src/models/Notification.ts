import mongoose, { Document, Schema } from 'mongoose';

/**
 * Notification types
 */
export enum NotificationType {
  SYSTEM = 'system',
  MESSAGE = 'message',
  ALERT = 'alert',
  PROMOTION = 'promotion',
  UPDATE = 'update',
}

/**
 * Notification document interface
 */
export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  imageUrl?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  sentAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification schema definition
 */
const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.SYSTEM,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    imageUrl: {
      type: String,
    },
    actionUrl: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date
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

// Compound index for fetching user notifications
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// TTL index to auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Notification model
 */
const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;

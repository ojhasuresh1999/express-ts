import mongoose, { Document, Schema } from 'mongoose';

/**
 * Device information interface
 */
export interface IDeviceInfo {
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ip: string;
}

/**
 * Session document interface
 */
export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  deviceInfo: IDeviceInfo;
  expiresAt: Date;
  lastActivityAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Device info sub-schema
 */
const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
    deviceName: {
      type: String,
      default: 'Unknown Device',
    },
    deviceType: {
      type: String,
      default: 'unknown',
    },
    browser: {
      type: String,
      default: 'Unknown Browser',
    },
    os: {
      type: String,
      default: 'Unknown OS',
    },
    ip: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Session schema definition
 */
const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: deviceInfoSchema,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.__v = undefined;
        ret.refreshTokenHash = undefined;
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

// Compound index for efficient queries
sessionSchema.index({ userId: 1, isRevoked: 1 });

// TTL index to auto-delete expired sessions (runs every 60 seconds)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Session model
 */
const Session = mongoose.model<ISession>('Session', sessionSchema);

export default Session;

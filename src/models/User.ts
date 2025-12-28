import mongoose, { Document, Schema } from 'mongoose';
import * as argon2 from 'argon2';

/**
 * User roles enum
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

/**
 * User document interface
 */
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
}

/**
 * User schema definition
 */
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.password = undefined;
        ret.__v = undefined;
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function () {
  // Only hash if password was modified
  if (!this.isModified('password')) {
    return;
  }

  // Hash password with argon2id (OWASP recommended)
  this.password = await argon2.hash(this.password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
});

/**
 * Compare password with hashed password
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch {
    return false;
  }
};

/**
 * Get user's full name
 */
userSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

/**
 * User model
 */
const User = mongoose.model<IUser>('User', userSchema);

export default User;

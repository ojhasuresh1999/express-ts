import { Request } from 'express';
import { UserRole } from '../models/User';
import { IDeviceInfo } from '../models/Session';

/**
 * Extended Express Request with user information
 * Note: This should match the global Express augmentation in middlewares/auth.ts
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
  session?: {
    id: string;
  };
  deviceInfo?: IDeviceInfo;
}

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service response type
 */
export type ServiceResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

import { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      isActive: boolean;
    }
  }
}

export {};

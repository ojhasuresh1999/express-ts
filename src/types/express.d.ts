import { UserRole } from '../models/User';
import { ISession } from '../models/Session';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      isActive: boolean;
    }

    interface Request {
      session?: ISession;
    }
  }
}

export {};

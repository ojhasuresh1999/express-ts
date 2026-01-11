import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import config from '../config';
import logger from '../utils/logger';
import { redisService } from './redis.service';
import * as tokenService from './token.service';
import { MESSAGES } from '../constants/messages';

/**
 * Extended socket with user data
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

/**
 * Socket.IO service with Redis adapter for horizontal scaling
 */
class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.IO with HTTP server
   */
  public async initialize(httpServer: HttpServer): Promise<Server> {
    if (this.io) {
      return this.io;
    }

    this.io = new Server(httpServer, {
      path: config.socket.path,
      cors: {
        origin: config.socket.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Set up Redis adapter for horizontal scaling
    try {
      const pubClient = redisService.getPublisher();
      const subClient = redisService.getSubscriber();
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized');
    } catch (error) {
      logger.warn('Redis adapter not available, using default adapter:', error);
    }

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '') ||
          socket.handshake.query.token;

        if (!token) {
          return next(new Error(MESSAGES.SERVER.AUTH_REQUIRED));
        }

        const payload = await tokenService.verifyAccessToken(token);
        socket.userId = payload.userId;
        // Note: sessionId is not in access token, we use userId for room management
        next();
      } catch {
        next(new Error(MESSAGES.AUTH.INVALID_TOKEN));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;

      if (userId) {
        // Join user's personal room for multi-device support
        socket.join(`user:${userId}`);
        logger.debug(`Socket connected: ${socket.id} for user: ${userId}`);
      }

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.debug(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      });

      // Handle custom events
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback({ pong: true, timestamp: Date.now() });
        }
      });
    });

    logger.info('Socket.IO service initialized');
    return this.io;
  }

  /**
   * Get Socket.IO server instance
   */
  public getIO(): Server {
    if (!this.io) {
      throw new Error(MESSAGES.SERVER.SOCKET_NOT_INIT);
    }
    return this.io;
  }

  /**
   * Emit event to specific user (all their devices)
   */
  public emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot emit to user');
      return;
    }
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to specific socket
   */
  public emitToSocket(socketId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot emit to socket');
      return;
    }
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Emit event to all connected clients
   */
  public broadcast(event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot broadcast');
      return;
    }
    this.io.emit(event, data);
  }

  /**
   * Emit event to a specific room
   */
  public emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('Socket.IO not initialized, cannot emit to room');
      return;
    }
    this.io.to(room).emit(event, data);
  }

  /**
   * Get connected sockets count
   */
  public async getConnectedCount(): Promise<number> {
    if (!this.io) return 0;
    const sockets = await this.io.fetchSockets();
    return sockets.length;
  }

  /**
   * Close Socket.IO server
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close(() => {
          this.io = null;
          logger.info('Socket.IO server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const socketService = SocketService.getInstance();
export default socketService;

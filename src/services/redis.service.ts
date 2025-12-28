import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';
import { MESSAGES } from '../constants/messages';

/**
 * Redis client singleton
 */
class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      this.client = new Redis(config.redis.url, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.client.connect();

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
      });

      // Create separate connections for pub/sub (required by Socket.IO adapter)
      this.publisher = this.client.duplicate();
      this.subscriber = this.client.duplicate();

      logger.info('Redis service initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Get Redis client
   */
  public getClient(): Redis {
    if (!this.client) {
      throw new Error(MESSAGES.SERVER.REDIS_CLIENT_NOT_INIT);
    }
    return this.client;
  }

  /**
   * Get publisher client for Socket.IO adapter
   */
  public getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error(MESSAGES.SERVER.REDIS_PUB_NOT_INIT);
    }
    return this.publisher;
  }

  /**
   * Get subscriber client for Socket.IO adapter
   */
  public getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error(MESSAGES.SERVER.REDIS_SUB_NOT_INIT);
    }
    return this.subscriber;
  }

  /**
   * Disconnect Redis
   */
  public async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    logger.info('Redis service disconnected');
  }

  /**
   * Set a key with optional expiry
   */
  public async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    const client = this.getClient();
    if (expirySeconds) {
      await client.setex(key, expirySeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return client.get(key);
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    const client = this.getClient();
    return client.del(key);
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.client?.status === 'ready';
  }
}

export const redisService = RedisService.getInstance();
export default redisService;

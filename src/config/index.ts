import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  env: string;
  port: number;
  host: string;
  api: {
    prefix: string;
    version: string;
  };
  cors: {
    origin: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    format: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password: string | undefined;
  };
  onesignal: {
    appId: string;
    apiKey: string;
  };
  socket: {
    path: string;
    corsOrigin: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  upload: {
    maxImageSizeMB: number;
    maxVideoSizeMB: number;
    maxFileSizeMB: number;
    compressionQuality: number;
    allowedImageTypes: string[];
    allowedVideoTypes: string[];
    allowedDocumentTypes: string[];
    tusChunkSizeMB: number;
  };
  queue: {
    concurrency: number;
    boardPath: string;
    boardAuth: {
      username: string;
      password: string;
    };
  };
  otp: {
    length: number;
    ttlSeconds: number;
    maxAttempts: number;
    cooldownSeconds: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  // host: process.env.HOST || 'localhost',
  host: process.env.HOST || '0.0.0.0',
  api: {
    prefix: process.env.API_PREFIX || '/api',
    version: process.env.API_VERSION || 'v1',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'dev',
  },
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production-min-32-chars',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production-min-32-chars',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  onesignal: {
    appId: process.env.ONESIGNAL_APP_ID || '',
    apiKey: process.env.ONESIGNAL_API_KEY || '',
  },
  socket: {
    path: process.env.SOCKET_PATH || '/socket.io',
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  upload: {
    maxImageSizeMB: parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10),
    maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500', 10),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    compressionQuality: parseInt(process.env.COMPRESSION_QUALITY || '80', 10),
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi'],
    allowedDocumentTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    tusChunkSizeMB: parseInt(process.env.TUS_CHUNK_SIZE_MB || '5', 10),
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    boardPath: process.env.QUEUE_BOARD_PATH || '/admin/queues',
    boardAuth: {
      username: process.env.QUEUE_BOARD_USERNAME || '',
      password: process.env.QUEUE_BOARD_PASSWORD || '',
    },
  },
  otp: {
    length: parseInt(process.env.OTP_LENGTH || '4', 10),
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    cooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS || '60', 10),
  },
};

// Validate required environment variables in production
const validateEnv = (): void => {
  const requiredEnvVars: string[] = [];

  if (config.env === 'production') {
    // Add production-required env vars here
    // requiredEnvVars.push('DATABASE_URL');
  }

  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

validateEnv();

export default config;

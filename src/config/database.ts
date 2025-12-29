/**
 * Database configuration template
 * Uncomment and configure based on your database choice
 */

// PostgreSQL with node-postgres
// import { Pool } from 'pg';
// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// MongoDB with mongoose
import logger from '../utils/logger';
import mongoose from 'mongoose';
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Prisma
// import { PrismaClient } from '@prisma/client';
// export const prisma = new PrismaClient();

export {};

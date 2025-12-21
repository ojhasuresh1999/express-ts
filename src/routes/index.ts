import { Router, type Router as RouterType } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';

const router: RouterType = Router();

// Health check routes (no API prefix for K8s probes)
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

export default router;

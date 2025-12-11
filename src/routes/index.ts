import { Router, type Router as RouterType } from 'express';
import healthRoutes from './health.routes';

const router: RouterType = Router();

// Health check routes (no API prefix for K8s probes)
router.use('/health', healthRoutes);

// API versioned routes
// router.use('/users', userRoutes);
// router.use('/auth', authRoutes);

export default router;

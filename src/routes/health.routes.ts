import { Router, type Router as RouterType } from 'express';
import { getHealth, getReady, getLive } from '../controllers/health.controller';

const router: RouterType = Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', getHealth);

/**
 * @route   GET /health/ready
 * @desc    Kubernetes readiness probe
 * @access  Public
 */
router.get('/ready', getReady);

/**
 * @route   GET /health/live
 * @desc    Kubernetes liveness probe
 * @access  Public
 */
router.get('/live', getLive);

export default router;

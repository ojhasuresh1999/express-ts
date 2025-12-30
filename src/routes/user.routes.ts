import { Router, type Router as RouterType } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares';
import { UserRole } from '../models';

const router: RouterType = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and retrieval
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, userController.getMe);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Update the profile information of the authenticated user.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.patch('/me', authenticate, userController.updateMe);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     description: Retrieve a paginated list of users. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of users with pagination info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 docs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 totalDocs:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pagingCounter:
 *                   type: integer
 *                 hasPrevPage:
 *                   type: boolean
 *                 hasNextPage:
 *                   type: boolean
 *                 prevPage:
 *                   type: integer
 *                 nextPage:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.listUsers
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a user's details by their ID. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.getUserById
);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     description: Update the role of a user. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin, moderator]
 *     responses:
 *       200:
 *         description: User role updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.updateUserRole
);

/**
 * @swagger
 * /users/{id}/deactivate:
 *   post:
 *     summary: Deactivate user account
 *     description: Deactivate a user account. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.deactivateUser
);

/**
 * @swagger
 * /users/{id}/activate:
 *   post:
 *     summary: Activate user account
 *     description: Activate a user account. Admin access required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User activated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.activateUser
);

export default router;

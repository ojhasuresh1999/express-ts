/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         slug:
 *           type: string
 *           description: The unique slug of the user
 *         firstName:
 *           type: string
 *           description: The first name of the user
 *         lastName:
 *           type: string
 *           description: The last name of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         role:
 *           type: string
 *           enum: [user, admin, moderator]
 *           description: The role of the user
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user has verified their email
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was last updated
 *       example:
 *         id: 60d0fe4f5311236168a109ca
 *         firstName: John
 *         lastName: Doe
 *         email: johndoe@example.com
 *         role: user
 *         isActive: true
 *         isEmailVerified: false
 *         createdAt: 2023-03-10T04:05:06.157Z
 *         updatedAt: 2023-03-10T04:05:06.157Z
 *
 *     UserUpdate:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *           description: The first name of the user
 *         lastName:
 *           type: string
 *           description: The last name of the user
 *         email:
 *           type: string
 *           format: email
 *           description: The email of the user
 *
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 *           example: Invalid input
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 *
 *     RegisterInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         firstName:
 *           type: string
 *           example: Suresh
 *         lastName:
 *           type: string
 *           example: Ojha
 *         email:
 *           type: string
 *           format: email
 *           example: suresh.ojha@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: Password@123
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: suresh.ojha@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: Password@123
 *
 *     RefreshTokenInput:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         tokens:
 *           type: object
 *           properties:
 *             access:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *             refresh:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 */
export {};

import { Router, type Router as RouterType } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares';
import { validate } from '../middlewares/validate';
import {
  createDirectConversationValidator,
  createGroupConversationValidator,
  conversationIdValidator,
  messageIdValidator,
  sendMessageValidator,
  editMessageValidator,
  deleteMessageValidator,
  getMessagesValidator,
  addParticipantsValidator,
  removeParticipantValidator,
  updateConversationValidator,
  reactionValidator,
  removeReactionValidator,
  muteConversationValidator,
  markAsReadValidator,
  getConversationsValidator,
} from '../validators/chat.validators';

const router: RouterType = Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time chat API endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Conversation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [direct, group]
 *         name:
 *           type: string
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *         lastMessagePreview:
 *           type: string
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         conversationId:
 *           type: string
 *         senderId:
 *           type: string
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [text, image, video, file, audio, location, system]
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *         reactions:
 *           type: array
 *           items:
 *             type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// =====================
// CONVERSATION ROUTES
// =====================

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get(
  '/conversations',
  authenticate,
  validate(getConversationsValidator),
  chatController.getConversations.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/direct:
 *   post:
 *     summary: Create a direct (1:1) conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *             properties:
 *               participantId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conversation created
 */
router.post(
  '/conversations/direct',
  authenticate,
  validate(createDirectConversationValidator),
  chatController.createDirectConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/group:
 *   post:
 *     summary: Create a group conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - participantIds
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Group created
 */
router.post(
  '/conversations/group',
  authenticate,
  validate(createGroupConversationValidator),
  chatController.createGroupConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   get:
 *     summary: Get a conversation by ID
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation details
 */
router.get(
  '/conversations/:id',
  authenticate,
  validate(conversationIdValidator),
  chatController.getConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   patch:
 *     summary: Update a conversation (group only)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversation updated
 */
router.patch(
  '/conversations/:id',
  authenticate,
  validate(updateConversationValidator),
  chatController.updateConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   delete:
 *     summary: Leave a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left conversation
 */
router.delete(
  '/conversations/:id',
  authenticate,
  validate(conversationIdValidator),
  chatController.leaveConversation.bind(chatController)
);

// =====================
// PARTICIPANT ROUTES
// =====================

/**
 * @swagger
 * /api/chat/conversations/{id}/participants:
 *   post:
 *     summary: Add participants to a group
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants added
 */
router.post(
  '/conversations/:id/participants',
  authenticate,
  validate(addParticipantsValidator),
  chatController.addParticipants.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/participants/{userId}:
 *   delete:
 *     summary: Remove a participant from a group
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participant removed
 */
router.delete(
  '/conversations/:id/participants/:userId',
  authenticate,
  validate(removeParticipantValidator),
  chatController.removeParticipant.bind(chatController)
);

// =====================
// MESSAGE ROUTES
// =====================

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get(
  '/conversations/:id/messages',
  authenticate,
  validate(getMessagesValidator),
  chatController.getMessages.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, video, file, audio, location]
 *               attachments:
 *                 type: array
 *               replyTo:
 *                 type: string
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post(
  '/conversations/:id/messages',
  authenticate,
  validate(sendMessageValidator),
  chatController.sendMessage.bind(chatController)
);

/**
 * @swagger
 * /api/chat/messages/{id}:
 *   patch:
 *     summary: Edit a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message updated
 */
router.patch(
  '/messages/:id',
  authenticate,
  validate(editMessageValidator),
  chatController.editMessage.bind(chatController)
);

/**
 * @swagger
 * /api/chat/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forEveryone:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Message deleted
 */
router.delete(
  '/messages/:id',
  authenticate,
  validate(deleteMessageValidator),
  chatController.deleteMessage.bind(chatController)
);

// =====================
// REACTION ROUTES
// =====================

/**
 * @swagger
 * /api/chat/messages/{id}/reactions:
 *   post:
 *     summary: Add a reaction to a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction added
 */
router.post(
  '/messages/:id/reactions',
  authenticate,
  validate(reactionValidator),
  chatController.addReaction.bind(chatController)
);

/**
 * @swagger
 * /api/chat/messages/{id}/reactions/{emoji}:
 *   delete:
 *     summary: Remove a reaction from a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: emoji
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reaction removed
 */
router.delete(
  '/messages/:id/reactions/:emoji',
  authenticate,
  validate(removeReactionValidator),
  chatController.removeReaction.bind(chatController)
);

// =====================
// MUTE/ARCHIVE/PIN ROUTES
// =====================

/**
 * @swagger
 * /api/chat/conversations/{id}/mute:
 *   post:
 *     summary: Mute a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: integer
 *                 description: Duration in seconds
 *     responses:
 *       200:
 *         description: Conversation muted
 */
router.post(
  '/conversations/:id/mute',
  authenticate,
  validate(muteConversationValidator),
  chatController.muteConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/mute:
 *   delete:
 *     summary: Unmute a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation unmuted
 */
router.delete(
  '/conversations/:id/mute',
  authenticate,
  validate(conversationIdValidator),
  chatController.unmuteConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/read:
 *   post:
 *     summary: Mark conversation as read
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.post(
  '/conversations/:id/read',
  authenticate,
  validate(markAsReadValidator),
  chatController.markAsRead.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/archive:
 *   post:
 *     summary: Archive a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation archived
 */
router.post(
  '/conversations/:id/archive',
  authenticate,
  validate(conversationIdValidator),
  chatController.archiveConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/archive:
 *   delete:
 *     summary: Unarchive a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation unarchived
 */
router.delete(
  '/conversations/:id/archive',
  authenticate,
  validate(conversationIdValidator),
  chatController.unarchiveConversation.bind(chatController)
);

/**
 * @swagger
 * /api/chat/conversations/{id}/pin:
 *   post:
 *     summary: Toggle pin conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pin status toggled
 */
router.post(
  '/conversations/:id/pin',
  authenticate,
  validate(conversationIdValidator),
  chatController.togglePinConversation.bind(chatController)
);

// =====================
// PINNED MESSAGES ROUTES
// =====================

/**
 * @swagger
 * /api/chat/conversations/{id}/pinned:
 *   get:
 *     summary: Get pinned messages in a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of pinned messages
 */
router.get(
  '/conversations/:id/pinned',
  authenticate,
  validate(conversationIdValidator),
  chatController.getPinnedMessages.bind(chatController)
);

/**
 * @swagger
 * /api/chat/messages/{id}/pin:
 *   post:
 *     summary: Pin a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message pinned
 */
router.post(
  '/messages/:id/pin',
  authenticate,
  validate(messageIdValidator),
  chatController.pinMessage.bind(chatController)
);

/**
 * @swagger
 * /api/chat/messages/{id}/pin:
 *   delete:
 *     summary: Unpin a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message unpinned
 */
router.delete(
  '/messages/:id/pin',
  authenticate,
  validate(messageIdValidator),
  chatController.unpinMessage.bind(chatController)
);

// =====================
// PRESENCE ROUTES
// =====================

/**
 * @swagger
 * /api/chat/presence/online:
 *   get:
 *     summary: Get online users
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of online user IDs
 */
router.get('/presence/online', authenticate, chatController.getOnlineUsers.bind(chatController));

export default router;

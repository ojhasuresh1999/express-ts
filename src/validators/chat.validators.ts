import { body, param, query } from 'express-validator';

/**
 * Validate create direct conversation
 */
export const createDirectConversationValidator = [
  body('participantId')
    .notEmpty()
    .withMessage('Participant ID is required')
    .isMongoId()
    .withMessage('Invalid participant ID format'),
];

/**
 * Validate create group conversation
 */
export const createGroupConversationValidator = [
  body('name')
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  body('participantIds')
    .isArray({ min: 2 })
    .withMessage('At least 2 participants are required for a group'),
  body('participantIds.*').isMongoId().withMessage('Invalid participant ID format'),
];

/**
 * Validate conversation ID parameter
 */
export const conversationIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
];

/**
 * Validate message ID parameter
 */
export const messageIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('Message ID is required')
    .isMongoId()
    .withMessage('Invalid message ID format'),
];

/**
 * Validate send message
 */
export const sendMessageValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  body('content')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Message content cannot exceed 10000 characters'),
  body('type')
    .optional()
    .isIn(['text', 'image', 'video', 'file', 'audio', 'location'])
    .withMessage('Invalid message type'),
  body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  body('attachments.*.type')
    .optional()
    .isIn(['image', 'video', 'file', 'audio'])
    .withMessage('Invalid attachment type'),
  body('attachments.*.url').optional().isURL().withMessage('Attachment URL must be valid'),
  body('attachments.*.publicId')
    .optional()
    .isString()
    .withMessage('Attachment publicId must be a string'),
  body('replyTo').optional().isMongoId().withMessage('Invalid reply message ID format'),
  body('mentions').optional().isArray().withMessage('Mentions must be an array'),
  body('mentions.*').optional().isMongoId().withMessage('Invalid mention user ID format'),
];

/**
 * Validate edit message
 */
export const editMessageValidator = [
  param('id')
    .notEmpty()
    .withMessage('Message ID is required')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
];

/**
 * Validate delete message
 */
export const deleteMessageValidator = [
  param('id')
    .notEmpty()
    .withMessage('Message ID is required')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  body('forEveryone').optional().isBoolean().withMessage('forEveryone must be a boolean'),
];

/**
 * Validate get messages query
 */
export const getMessagesValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('before').optional().isISO8601().withMessage('Before must be a valid ISO date'),
  query('after').optional().isISO8601().withMessage('After must be a valid ISO date'),
];

/**
 * Validate add participants
 */
export const addParticipantsValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  body('userIds').isArray({ min: 1 }).withMessage('At least one user ID is required'),
  body('userIds.*').isMongoId().withMessage('Invalid user ID format'),
];

/**
 * Validate remove participant
 */
export const removeParticipantValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
];

/**
 * Validate update conversation
 */
export const updateConversationValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
];

/**
 * Validate reaction
 */
export const reactionValidator = [
  param('id')
    .notEmpty()
    .withMessage('Message ID is required')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  body('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters'),
];

/**
 * Validate remove reaction
 */
export const removeReactionValidator = [
  param('id')
    .notEmpty()
    .withMessage('Message ID is required')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  param('emoji').notEmpty().withMessage('Emoji is required'),
];

/**
 * Validate mute conversation
 */
export const muteConversationValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  body('duration')
    .optional()
    .isInt({ min: 60, max: 31536000 })
    .withMessage('Duration must be between 60 seconds and 1 year'),
];

/**
 * Validate mark as read
 */
export const markAsReadValidator = [
  param('id')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  body('messageId').optional().isMongoId().withMessage('Invalid message ID format'),
];

/**
 * Validate get conversations query
 */
export const getConversationsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('archived').optional().isBoolean().withMessage('Archived must be a boolean'),
];

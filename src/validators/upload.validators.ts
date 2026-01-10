import { body, param, query } from 'express-validator';

// Validate upload parameters
export const uploadImageValidation = [
  body('folder')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Folder name must be between 1 and 100 characters'),
  body('quality')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quality must be between 1 and 100'),
  body('maxWidth')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max width must be between 1 and 10000'),
  body('maxHeight')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max height must be between 1 and 10000'),
  body('format')
    .optional()
    .isIn(['jpeg', 'png', 'webp', 'avif'])
    .withMessage('Format must be one of: jpeg, png, webp, avif'),
  body('compress').optional().isBoolean().withMessage('Compress must be a boolean'),
];

export const uploadVideoValidation = [
  body('folder')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Folder name must be between 1 and 100 characters'),
];

export const deleteMediaValidation = [
  param('publicId')
    .notEmpty()
    .withMessage('Public ID is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Public ID must be between 1 and 255 characters'),
  query('resourceType')
    .optional()
    .isIn(['image', 'video', 'raw'])
    .withMessage('Resource type must be one of: image, video, raw'),
];

export const getMediaInfoValidation = [
  param('publicId').notEmpty().withMessage('Public ID is required').isString().trim(),
  query('resourceType')
    .optional()
    .isIn(['image', 'video', 'raw'])
    .withMessage('Resource type must be one of: image, video, raw'),
];

export const getUploadStatusValidation = [
  param('uploadId').notEmpty().withMessage('Upload ID is required').isString().trim(),
];

export default {
  uploadImageValidation,
  uploadVideoValidation,
  deleteMediaValidation,
  getMediaInfoValidation,
  getUploadStatusValidation,
};

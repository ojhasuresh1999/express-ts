import { body } from 'express-validator';

/**
 * Registration validation rules
 */
export const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
];

/**
 * Login validation rules
 */
export const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Refresh token validation rules
 */
export const refreshTokenValidator = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

/**
 * Send OTP validation rules
 */
export const sendOtpValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('purpose')
    .notEmpty()
    .withMessage('Purpose is required')
    .isIn(['REGISTRATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'LOGIN_VERIFICATION'])
    .withMessage('Invalid OTP purpose'),

  body('userName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('User name cannot exceed 100 characters'),
];

/**
 * Verify OTP validation rules
 */
export const verifyOtpValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4-6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  body('purpose')
    .notEmpty()
    .withMessage('Purpose is required')
    .isIn(['REGISTRATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'LOGIN_VERIFICATION'])
    .withMessage('Invalid OTP purpose'),
];

/**
 * Forgot password validation rules
 */
export const forgotPasswordValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/**
 * Reset password validation rules
 */
export const resetPasswordValidator = [
  body('verificationToken').notEmpty().withMessage('Verification token is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
];

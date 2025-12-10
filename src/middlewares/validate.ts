import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiError } from '../utils/ApiError';

/**
 * Validation middleware factory
 * Runs validations and checks for errors
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for errors
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const formattedErrors = errors.array().map((err) => ({
      field: 'path' in err ? err.path : undefined,
      message: err.msg as string,
    }));

    next(ApiError.badRequest('Validation failed', formattedErrors));
  };
};

export default validate;

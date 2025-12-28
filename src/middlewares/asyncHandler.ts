import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper to catch promise rejections
 * Eliminates the need for try-catch blocks in async route handlers
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;

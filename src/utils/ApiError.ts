import { StatusCodes } from 'http-status-codes';

interface ErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    details?: ErrorDetail[],
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string, details?: ErrorDetail[]): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message, true, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  static unprocessableEntity(message: string, details?: ErrorDetail[]): ApiError {
    return new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, message, true, details);
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, false);
  }
}

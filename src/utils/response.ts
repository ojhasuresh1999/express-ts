import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

interface SuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
  stack?: string;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Send a success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = StatusCodes.OK,
  meta?: SuccessResponse<T>['meta']
): Response<ApiResponse<T>> => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
): Response<ApiResponse<T>> => {
  return sendSuccess(res, data, message, StatusCodes.CREATED);
};

/**
 * Send a no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(StatusCodes.NO_CONTENT).send();
};

/**
 * Send an error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  errors?: ErrorResponse['errors'],
  stack?: string
): Response<ErrorResponse> => {
  const response: ErrorResponse = {
    success: false,
    message,
  };

  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  if (stack && process.env.NODE_ENV === 'development') {
    response.stack = stack;
  }

  return res.status(statusCode).json(response);
};

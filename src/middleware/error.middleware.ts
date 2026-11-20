import type {
  ErrorRequestHandler,
  RequestHandler,
} from "express";

import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// Handles requests for routes that do not exist.
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

// Handles errors from the entire Express application.
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  // If response headers have already been sent,
  // let Express handle the remaining error.
  if (res.headersSent) {
    return next(error);
  }

  // Identify known application errors.
  const isApiError = error instanceof ApiError;

  const statusCode = isApiError ? error.statusCode : 500;

  // Never expose unexpected internal errors to clients.
  const message = isApiError
    ? error.message
    : "Internal server error";

  // Record the error for debugging.
  logger.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    "Request failed"
  );

  res.status(statusCode).json({
    success: false,
    message,
  });
};
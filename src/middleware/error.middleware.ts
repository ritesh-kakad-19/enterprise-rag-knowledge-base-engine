import type {
  ErrorRequestHandler,
  RequestHandler,
} from "express";

import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import multer from "multer";

// Handles requests for routes that do not exist.
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

// Handles errors from the entire Express application.
export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {
  if (res.headersSent) return next(error);

  const isApiError = error instanceof ApiError;
  const isMulterError = error instanceof multer.MulterError;

  let statusCode = 500;
  let message = "Internal server error";

  if (isApiError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (isMulterError) {
    // Convert Multer errors into meaningful HTTP responses.
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        statusCode = 413;
        message = "File exceeds the maximum allowed size of 10 MB";
        break;

      case "LIMIT_FILE_COUNT":
        statusCode = 400;
        message = "Only one file can be uploaded at a time";
        break;

      case "LIMIT_UNEXPECTED_FILE":
        statusCode = 400;
        message = "Unexpected file field. Use the 'document' field";
        break;

      default:
        statusCode = 400;
        message = "Invalid file upload request";
    }
  }

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
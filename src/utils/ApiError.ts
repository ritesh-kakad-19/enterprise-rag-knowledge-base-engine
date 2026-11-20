// This creates a consistent application error instead of returning random error responses.
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintain the correct prototype chain.
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = "ApiError";

    // Capture the stack trace for debugging.
    Error.captureStackTrace(this, this.constructor);
  }
}
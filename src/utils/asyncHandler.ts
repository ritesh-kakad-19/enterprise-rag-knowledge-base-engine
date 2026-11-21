import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

// Type for asynchronous Express controllers
type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

// Converts async errors into Express error middleware calls
export const asyncHandler = (
  controller: AsyncController
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
};
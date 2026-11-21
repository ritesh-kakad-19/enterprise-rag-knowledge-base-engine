import type {
  RequestHandler,
} from "express";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

import type { UserRole } from "../modules/auth/auth.service.js";

// Information extracted from a valid JWT
export interface AuthUser {
  id: string;
  role: UserRole;
}

// Verify whether the request has a valid JWT
export const authenticate: RequestHandler = (
  req,
  res,
  next
) => {
  const authorization = req.headers.authorization;

  // Check whether Authorization header exists
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  // Extract token from Authorization header
  const token = authorization.split(" ")[1];

  if (!token) {
    return next(new ApiError(401, "Authentication token missing"));
  }

  try {
    // Verify token signature and expiration
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof decoded === "string" ||
      !decoded.sub ||
      (decoded.role !== "admin" && decoded.role !== "member")
    ) {
      return next(new ApiError(401, "Invalid authentication token"));
    }

    // Store authenticated user information for later middleware/routes
    res.locals.authUser = {
      id: decoded.sub,
      role: decoded.role,
    } satisfies AuthUser;

    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

// Check whether the authenticated user has the required role
export const requireRole = (
  requiredRole: UserRole
): RequestHandler => {
  return (_req, res, next) => {
    const user = res.locals.authUser as AuthUser | undefined;

    if (!user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (user.role !== requiredRole) {
      return next(new ApiError(403, "You do not have permission"));
    }

    next();
  };
};
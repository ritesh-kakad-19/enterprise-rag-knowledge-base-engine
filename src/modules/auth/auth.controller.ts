import type { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import {
  registerSchema,
  loginSchema,
} from "./auth.validation.js";

import {
  registerUser,
  loginUser,
  generateAccessToken,
} from "./auth.service.js";

// Register controller
export const register = asyncHandler(async (req: Request, res: Response) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    throw new ApiError(
      400,
      validation.error.issues[0]?.message ?? "Invalid registration data"
    );
  }

  const user = await registerUser(validation.data);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      user,
    },
  });
});

// Login controller
export const login = asyncHandler(async (req: Request, res: Response) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    throw new ApiError(
      400,
      validation.error.issues[0]?.message ?? "Invalid login data"
    );
  }

  const user = await loginUser(validation.data);

  const token = generateAccessToken(user);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user,
      accessToken: token,
      tokenType: "Bearer",
      expiresIn: 900,
    },
  });
});
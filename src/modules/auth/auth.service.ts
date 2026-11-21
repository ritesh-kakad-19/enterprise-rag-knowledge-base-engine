import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool from "../../config/database.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

import type {
  RegisterInput,
  LoginInput,
} from "./auth.validation.js";

// Allowed user roles
export type UserRole = "admin" | "member";

// Public user information
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date;
}

// Register a new user
export const registerUser = async (
  input: RegisterInput
): Promise<User> => {
  // Convert password into a secure hash
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const result = await pool.query<User>(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [input.name, input.email, passwordHash]
    );

    return result.rows[0];
  } catch (error: unknown) {
    // PostgreSQL error code 23505 means unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ApiError(409, "Email is already registered");
    }

    throw error;
  }
};

// Authenticate an existing user
export const loginUser = async (
  input: LoginInput
): Promise<User> => {
  const result = await pool.query<User & { password_hash: string }>(
    `SELECT id, name, email, password_hash, role, created_at
     FROM users
     WHERE email = $1`,
    [input.email]
  );

  const user = result.rows[0];

  // Use the same error for unknown email and wrong password
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Compare entered password with stored hash
  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash
  );

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Never return password_hash to the controller
  const { password_hash, ...safeUser } = user;

  return safeUser;
};

// Generate JWT access token
export const generateAccessToken = (user: User): string => {
  return jwt.sign(
    {
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: 15 * 60, // 15 minutes
    }
  );
};
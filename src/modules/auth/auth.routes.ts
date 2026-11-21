import { Router } from "express";

import {
  register,
  login,
} from "./auth.controller.js";

import {
  authenticate,
  requireRole,
} from "../../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected route: requires valid JWT
router.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated user details",
    data: {
      user: res.locals.authUser,
    },
  });
});

// Admin-only route
router.get(
  "/admin",
  authenticate,
  requireRole("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome, admin!",
    });
  }
);

export default router;
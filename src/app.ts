import express from "express";
import logger from "./utils/logger.js";
import {errorHandler, notFoundHandler} from "./middleware/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";

// Create an Express application instance.
const app = express();

// Parse incoming JSON request bodies.
app.use(express.json({ limit: "1mb" }));

// Log basic incoming request information.
app.use((req, _res, next) => {
  logger.info(
    {
      method: req.method,
      url: req.originalUrl,
    },
    "Incoming request"
  );

  next();
});

// Basic route to verify that the backend is running.
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Enterprise RAG Knowledge Base API is running",
  });
});

// Health-check route for monitoring server availability.
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRoutes);

// Handle all unknown routes.
app.use(notFoundHandler);

// Centralized error handler must be registered last.
app.use(errorHandler);

export default app;

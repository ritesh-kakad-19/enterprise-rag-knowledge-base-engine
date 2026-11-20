import pino from "pino";
import { env } from "../config/env.js";

// Use readable logs during development.
// Production logs remain structured JSON.
const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined;

const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",

  // Never accidentally write API keys or passwords into logs.
  redact: [
    "password",
    "token",
    "authorization",
    "apiKey",
    "GEMINI_API_KEY",
  ],

  ...(transport && { transport }),
});

export default logger;
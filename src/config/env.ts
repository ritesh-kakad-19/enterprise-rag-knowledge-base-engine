import "dotenv/config";
import { z } from "zod";

// Define the required environment variables and their types.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),

  GEMINI_API_KEY: z.string().min(1, "Gemini API key is required"),

  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),

  GEMINI_EMBEDDING_MODEL: z
    .string()
    .default("gemini-embedding-001"),

  DATABASE_URL: z
    .string()
    .url("Invalid database connection URL"),

  JWT_ACCESS_SECRET: z
  .string()
  .min(32, "JWT secret must contain at least 32 characters"),

  // Document chunking configuration
  CHUNK_SIZE_CHARS: z.coerce.number().int().min(500).max(10000).default(2000),

  CHUNK_OVERLAP_CHARS: z.coerce.number().int().min(0).max(2000).default(200),

  MIN_CHUNK_SIZE_CHARS: z.coerce.number().int().min(50).max(2000).default(100),

  GEMINI_EMBEDDING_DIMENSIONS: z.coerce
  .number()
  .int()
  .min(1)
  .max(3072)
  .default(768),

}).refine(
  (config) => config.CHUNK_OVERLAP_CHARS < config.CHUNK_SIZE_CHARS,
  {
    message: "Chunk overlap must be smaller than chunk size",
    path: ["CHUNK_OVERLAP_CHARS"],
  }
);

// Validate process.env against our schema.
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  // Display configuration errors without exposing secret values.
  console.error(z.prettifyError(result.error));

  process.exit(1);
}

// Export validated and typed environment variables.
export const env = result.data;
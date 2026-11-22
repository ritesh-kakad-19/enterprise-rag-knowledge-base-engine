import { unlink } from "node:fs/promises";

import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";

// Defines the structure of a document record returned by PostgreSQL.
export interface DocumentRecord {
  id: string;
  user_id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: string;
  status: "uploaded" | "processing" | "processed" | "failed";
  created_at: Date;
}

// Removes the uploaded file if saving its metadata fails.
// This prevents orphan files from accumulating in storage.
const cleanupUploadedFile = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;

    // Ignore the error if the file has already been removed.
    if (fsError.code !== "ENOENT") {
      logger.error(
        { err: error, filePath },
        "Failed to clean up uploaded file"
      );
    }
  }
};

// Saves document metadata in PostgreSQL.
export const saveDocumentMetadata = async (
  file: Express.Multer.File,
  userId: string
): Promise<DocumentRecord> => {
  try {
    const result = await pool.query<DocumentRecord>(
      `
      INSERT INTO documents (
        user_id,
        original_filename,
        stored_filename,
        mime_type,
        file_size
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        original_filename,
        stored_filename,
        mime_type,
        file_size::text AS file_size,
        status,
        created_at
      `,
      [
        userId,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
      ]
    );

    // Ensure that PostgreSQL returned the inserted document.
    const document = result.rows[0];

    if (!document) {
      throw new Error("Document metadata was not returned after insertion");
    }

    return document;
  } catch (error) {
    // If the database operation fails, remove the uploaded file.
    await cleanupUploadedFile(file.path);

    throw error;
  }
};

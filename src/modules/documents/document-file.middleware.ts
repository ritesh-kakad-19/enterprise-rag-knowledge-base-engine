import type { Request, Response, NextFunction } from "express";
import type { RequestHandler } from "express";

import { fileTypeFromFile } from "file-type";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import logger from "../../utils/logger.js";

// Define the document formats supported by our application.
const ALLOWED_DOCUMENTS = {
  ".pdf": {
    extension: "pdf",
    mimeType: "application/pdf",
  },

  ".docx": {
    extension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },

  ".txt": {
    extension: "txt",
    mimeType: "text/plain",
  },
} as const;

// Remove an uploaded file when validation fails.
// This prevents rejected files from accumulating in storage.
const cleanupUploadedFile = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;

    // Ignore the error if the file has already been removed.
    if (fsError.code !== "ENOENT") {
      logger.error(
        { err: error, filePath },
        "Failed to remove rejected upload"
      );
    }
  }
};

// Validate plain text files separately because file-type
// does not detect text-based formats.
const validateTextFile = async (filePath: string): Promise<void> => {
  const content = await readFile(filePath);

  // Empty documents are not useful for our RAG pipeline.
  if (content.length === 0) {
    throw new ApiError(400, "Empty files are not allowed");
  }

  // Reject files containing null bytes.
  // Null bytes are common in binary files.
  if (content.includes(0)) {
    throw new ApiError(400, "Invalid text file content");
  }

  try {
    // Verify that the content is valid UTF-8 text.
    // The fatal option rejects invalid UTF-8 sequences.
    const decoder = new TextDecoder("utf-8", { fatal: true });

    decoder.decode(content);
  } catch {
    throw new ApiError(400, "Text files must contain valid UTF-8 content");
  }
};

// Main document validation middleware.
export const validateDocumentFile: RequestHandler = asyncHandler(
  async (req: Request, _res: Response, _next: NextFunction) => {
    const file = req.file;

    // Ensure the user actually uploaded a file.
    if (!file) {
      throw new ApiError(
        400,
        "Please upload a document using the 'document' field"
      );
    }

    try {
      // STEP 1: Validate original filename length.
      if (file.originalname.length > 255) {
        throw new ApiError(400, "Filename is too long");
      }

      // STEP 2: Check the original file extension.
      const extension = path.extname(file.originalname).toLowerCase();

      const expectedDocument =
        ALLOWED_DOCUMENTS[
          extension as keyof typeof ALLOWED_DOCUMENTS
        ];

      if (!expectedDocument) {
        throw new ApiError(
          400,
          "Unsupported file type. Only PDF, DOCX and TXT are allowed"
        );
      }

      // STEP 3: Check the client-provided MIME type.
      // MIME types are not trusted; this is only a consistency check.
      const allowedMimeTypes = [
        expectedDocument.mimeType,
        "application/octet-stream",
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new ApiError(400, "File MIME type does not match its extension");
      }

      // STEP 4: Validate actual file content.
      if (extension === ".txt") {
        // Text files do not have a standard magic-byte signature.
        await validateTextFile(file.path);
      } else {
        // Detect actual binary file format from its contents.
        const detectedType = await fileTypeFromFile(file.path);

        if (!detectedType) {
          throw new ApiError(400, "Unable to identify the uploaded file");
        }

        // Compare detected extension with the claimed extension.
        if (detectedType.ext !== expectedDocument.extension) {
          throw new ApiError(
            400,
            "File content does not match the provided file extension"
          );
        }
      }

      // File passed all validation checks.
      logger.info(
        {
          originalFilename: file.originalname,
          size: file.size,
          extension,
        },
        "Document file validation successful"
      );

      // File validation succeeded. Continue to the controller.
      _next();
    } catch (error) {
      // Delete the file if any validation check fails.
      await cleanupUploadedFile(file.path);

      // Forward the original error to centralized error handling.
      throw error;
    }
  }
);
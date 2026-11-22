import type { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import logger from "../../utils/logger.js";

import { saveDocumentMetadata } from "./document.service.js";
import type { AuthUser } from "../../middleware/auth.middleware.js";

// Handles document upload requests.
export const uploadDocument = asyncHandler(
  async (req: Request, res: Response) => {
    // Step 1: Get the uploaded file.
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "Please upload a document");
    }

    // Step 2: Get authenticated user information.
    // This information was added by the authentication middleware.
    const authUser = res.locals.authUser as AuthUser | undefined;

    if (!authUser) {
      throw new ApiError(401, "Authentication required");
    }

    // Step 3: Save document metadata in PostgreSQL.
    const document = await saveDocumentMetadata(file, authUser.id);

    // Step 4: Log successful upload.
    logger.info(
      {
        documentId: document.id,
        userId: authUser.id,
        filename: document.original_filename,
      },
      "Document uploaded successfully"
    );

    // Step 5: Return response to the client.
    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        document,
      },
    });
  }
);
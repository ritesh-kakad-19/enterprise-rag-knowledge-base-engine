import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";

import upload from "../../config/multer.js";

import { validateDocumentFile } from "./document-file.middleware.js";
import { uploadDocument } from "./document.controller.js";

const router = Router();

// Upload a document.
//
// Middleware execution order:
// 1. authenticate: Verify the user's JWT.
// 2. upload.single: Receive one file using the "document" field.
// 3. validateDocumentFile: Validate the actual file content.
// 4. uploadDocument: Save document metadata in PostgreSQL.
router.post(
  "/upload",
  authenticate,
  upload.single("document"),
  validateDocumentFile,
  uploadDocument
);

export default router;
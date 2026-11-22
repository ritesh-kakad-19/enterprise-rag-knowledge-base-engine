import multer from "multer";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

// Resolve the upload directory from the project root.
// This avoids depending on the directory from which Node.js was started.
const uploadDir = resolve(process.cwd(), "storage", "uploads");

// Create the upload directory if it doesn't already exist.
// recursive: true also creates missing parent directories.
mkdirSync(uploadDir, { recursive: true });

// Configure where and how uploaded files are stored.
const storage = multer.diskStorage({

  // Specify the destination directory.
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },

  // Generate a unique filename for every uploaded file.
  filename: (_req, _file, callback) => {

    // Generate a random UUID instead of trusting the original filename.
    const uniqueFilename = randomUUID();

    callback(null, uniqueFilename);
  },
});

// Configure Multer.
const upload = multer({

  // Use disk storage instead of keeping uploaded files in memory.
  storage,

  // Configure upload restrictions.
  limits: {

    // Maximum file size: 10 MB.
    fileSize: 10 * 1024 * 1024,

    // Allow only one file per request.
    files: 1,
  },
});

export default upload;
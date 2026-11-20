import dotenv from "dotenv";
import app from "./app.js";
import { env } from "./config/env.js";
import logger from "./utils/logger.js";

// Start the Express server using validated configuration.
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    "Server started successfully"
  );
});

// Handle server startup errors.
server.on("error", (error) => {
  logger.fatal({ err: error }, "Server startup failed");
  process.exit(1);
});

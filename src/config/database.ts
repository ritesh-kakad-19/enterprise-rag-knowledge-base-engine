import pg from "pg";

import { env } from "./env.js";
import logger from "../utils/logger.js";

const { Pool } = pg;

// Pool manages multiple database connections.
// This avoids creating a new connection for every query.
const pool = new Pool({
  connectionString: env.DATABASE_URL,

  // Maximum number of connections in the pool
  max: 10,

  // Close idle connections after 30 seconds
  idleTimeoutMillis: 30000,

  // Wait maximum 5 seconds for a connection
  connectionTimeoutMillis: 5000,
});

// Log unexpected errors from idle database connections
pool.on("error", (error) => {
  logger.error(
    { err: error },
    "Unexpected PostgreSQL pool error"
  );
});

export default pool;
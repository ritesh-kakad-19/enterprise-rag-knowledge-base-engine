import pool from "../config/database.js";
import logger from "../utils/logger.js";

async function testDatabase() {
  try {
    // Check whether Node.js can communicate with PostgreSQL
    const connectionResult = await pool.query(
      "SELECT NOW() AS current_time"
    );

    logger.info(
      { databaseTime: connectionResult.rows[0].current_time },
      "Database connection successful"
    );

    // Enable pgvector in the current database
    await pool.query(
      "CREATE EXTENSION IF NOT EXISTS vector"
    );

    logger.info("pgvector extension enabled");

    // Test whether PostgreSQL understands the vector data type
    const vectorResult = await pool.query(
      "SELECT '[1,2,3]'::vector AS sample_vector"
    );

    logger.info(
      { vector: vectorResult.rows[0].sample_vector },
      "pgvector test successful"
    );
  } catch (error) {
    logger.error(
      { err: error },
      "Database test failed"
    );

    process.exitCode = 1;
  } finally {
    // Close the connection pool after testing
    await pool.end();
  }
}

testDatabase();
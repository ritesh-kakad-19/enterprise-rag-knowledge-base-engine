/**
 * Represents a vector formatted for PostgreSQL pgvector.
 *
 * Example:
 * "[0.12,-0.45,0.78]"
 *
 * This is a string representation of a vector,
 * not a normal JavaScript number array.
 */
export type PgVectorLiteral = string & {
  readonly __pgVectorLiteral: unique symbol;
};
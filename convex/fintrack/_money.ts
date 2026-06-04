import { ConvexError } from "convex/values";

export function validateCents(value: number, field: string): void {
  if (!Number.isFinite(value))
    throw new ConvexError(`${field}: not finite`);
  if (!Number.isInteger(value))
    throw new ConvexError(`${field}: must be integer (cents), got ${value}`);
  // Check magnitude — applies to both positive and negative values
  if (Math.abs(value) > 9_999_999_999)
    throw new ConvexError(`${field}: exceeds maximum ($99,999,999.99)`);
}

export function validatePositiveCents(value: number, field: string): void {
  validateCents(value, field);
  if (value < 0) throw new ConvexError(`${field}: must be >= 0`);
}

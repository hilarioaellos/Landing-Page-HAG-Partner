import { ConvexError } from "convex/values";

export function validateCurrencyCode(code: string): string {
  const normalized = code.toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(normalized))
    throw new ConvexError("currencyCode must be a 3-letter ISO code (e.g. USD, MXN, EUR)");
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: normalized });
  } catch {
    throw new ConvexError(`"${normalized}" is not a valid ISO 4217 currency code`);
  }
  return normalized;
}

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

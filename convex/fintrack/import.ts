import { ConvexError } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { validateCents } from "./_money";

const BATCH_SIZE = 50;

// Parses YYYY-MM-DD or MM/DD/YYYY. Frontend normalizes DD/MM/YYYY → YYYY-MM-DD before sending.
// Rejects unknown formats and calendar rollovers.
// Uses new Date(y, m, d) (local midnight) to avoid UTC timezone shifts.
function parseDateSafe(raw: string): number {
  const s = raw.trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
      throw new ConvexError(`Invalid date: ${raw}`);
    return date.getTime();
  }

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (usMatch) {
    const m = parseInt(usMatch[1], 10);
    const d = parseInt(usMatch[2], 10);
    const y = parseInt(usMatch[3], 10);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
      throw new ConvexError(`Invalid date: ${raw}`);
    return date.getTime();
  }

  throw new ConvexError(
    `Unsupported date format: "${raw}". Expected YYYY-MM-DD or MM/DD/YYYY.`
  );
}

// Web Crypto API — available in Convex V8 runtime
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SkippedRow = {
  date: string;
  description: string;
  amountCents: number;
  type: string;
  reason: "duplicate" | "transfer_match";
};

const csvRowValidator = v.object({
  date: v.string(),        // YYYY-MM-DD or MM/DD/YYYY
  description: v.string(),
  amountCents: v.number(), // absolute value — sign derived from type
  type: v.union(v.literal("income"), v.literal("expense")),
});

export const batchImport = action({
  args: {
    accountId: v.id("fintrack_accounts"),
    currencyCode: v.string(),
    rows: v.array(csvRowValidator),
  },
  handler: async (ctx, { accountId, currencyCode, rows }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: 401, message: "Not authenticated" });

    // Validate ALL dates upfront — prevents partial imports if any date is invalid.
    // Any throw here aborts before the first mutation runs.
    for (let i = 0; i < rows.length; i++) {
      try {
        parseDateSafe(rows[i].date);
      } catch (e) {
        throw new ConvexError(
          `Row ${i + 1}: ${e instanceof ConvexError ? e.message : "invalid date"}`
        );
      }
    }

    // Server-side hash computation — never trust client hash
    const rowsWithHashes = await Promise.all(
      rows.map(async (row) => {
        const storedAmount =
          row.type === "expense"
            ? -Math.abs(row.amountCents)
            : Math.abs(row.amountCents);
        const normalizedDesc = row.description.trim().toLowerCase();
        const hash = await sha256Hex(
          `${accountId}|${row.date}|${storedAmount}|${normalizedDesc}`
        );
        return { ...row, amountCents: storedAmount, importHash: hash };
      })
    );

    let imported = 0;
    const skippedRows: SkippedRow[] = [];

    let partialError: string | undefined;

    for (let i = 0; i < rowsWithHashes.length; i += BATCH_SIZE) {
      const batch = rowsWithHashes.slice(i, i + BATCH_SIZE);
      try {
        const result = await ctx.runMutation(
          internal.fintrack.import.importBatch,
          { userId, accountId, currencyCode, rows: batch }
        );
        imported += result.imported;
        skippedRows.push(...result.skippedRows);
      } catch (err) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(rowsWithHashes.length / BATCH_SIZE);
        const msg = err instanceof Error ? err.message : "unknown error";
        partialError = `Batch ${batchNum}/${totalBatches} failed: ${msg}`;
        break;
      }
    }

    return { imported, skipped: skippedRows.length, skippedRows, partialError };
  },
});

export const importBatch = internalMutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("fintrack_accounts"),
    currencyCode: v.string(),
    rows: v.array(
      v.object({
        date: v.string(),
        description: v.string(),
        amountCents: v.number(), // already signed (negative for expense)
        type: v.union(v.literal("income"), v.literal("expense")),
        importHash: v.string(),
      })
    ),
  },
  handler: async (ctx, { userId, accountId, currencyCode, rows }) => {
    const account = await ctx.db.get(accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });

    let totalDelta = 0;
    let imported = 0;
    const skippedRows: SkippedRow[] = [];

    for (const row of rows) {
      validateCents(row.amountCents, "amountCents");

      // 1. Hash deduplication — same CSV row imported before
      const duplicate = await ctx.db
        .query("fintrack_transactions")
        .withIndex("by_import_hash", (q) =>
          q.eq("userId", userId).eq("importHash", row.importHash)
        )
        .first();

      if (duplicate) {
        skippedRows.push({ date: row.date, description: row.description, amountCents: row.amountCents, type: row.type, reason: "duplicate" });
        continue;
      }

      // 2. Transfer match — skip CSV rows that are the bank side of a manual transfer.
      //    Covers BOTH sides:
      //    - importing CSV of destination: t.transferToAccountId === accountId
      //    - importing CSV of source:      t.accountId === accountId
      const dateTs = parseDateSafe(row.date);
      const windowStart = dateTs - 86_400_000; // -1 day
      const windowEnd   = dateTs + 86_400_000; // +1 day

      const nearbyTransactions = await ctx.db
        .query("fintrack_transactions")
        .withIndex("by_date", (q) =>
          q.eq("userId", userId).gte("date", windowStart).lte("date", windowEnd)
        )
        .collect();

      const transferMatch = nearbyTransactions.find(
        (t) =>
          t.type === "transfer" &&
          Math.abs(t.amountCents) === Math.abs(row.amountCents) &&
          (t.transferToAccountId === accountId || t.accountId === accountId)
      );

      if (transferMatch) {
        skippedRows.push({ date: row.date, description: row.description, amountCents: row.amountCents, type: row.type, reason: "transfer_match" });
        continue;
      }

      await ctx.db.insert("fintrack_transactions", {
        userId,
        accountId,
        amountCents: row.amountCents,
        currencyCode,
        type: row.type,
        date: dateTs,
        notes: row.description,
        source: "csv",
        isReconciled: false,
        importHash: row.importHash,
      });

      totalDelta += row.amountCents;
      imported++;
    }

    if (totalDelta !== 0) {
      await ctx.db.patch(accountId, {
        balanceCents: account.balanceCents + totalDelta,
      });
    }

    return { imported, skippedRows };
  },
});

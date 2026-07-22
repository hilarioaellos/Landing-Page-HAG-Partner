import { internalMutation } from "../_generated/server";

// One-time migration: copies legacy amount fields to the new *Cents names.
// Safe to run multiple times (idempotent).
// Delete this file after confirming migration is complete.

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let subFixed = 0;
    let recFixed = 0;
    let payFixed = 0;

    // fintrack_subscriptions: backfill amountCents, remove legacy amount
    const subs = await ctx.db.query("fintrack_subscriptions").collect();
    for (const doc of subs) {
      const raw = doc as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (raw.amount !== undefined && doc.amountCents === undefined)
        patch.amountCents = raw.amount as number;
      if (raw.amount !== undefined)
        patch.amount = undefined; // removes field from document
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(doc._id, patch);
        subFixed++;
      }
    }

    // fintrack_receivables: backfill *Cents, remove legacy fields
    const recs = await ctx.db.query("fintrack_receivables").collect();
    for (const doc of recs) {
      const raw = doc as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (raw.originalAmount !== undefined && doc.originalAmountCents === undefined)
        patch.originalAmountCents = raw.originalAmount as number;
      if (raw.outstandingBalance !== undefined && doc.outstandingBalanceCents === undefined)
        patch.outstandingBalanceCents = raw.outstandingBalance as number;
      if (raw.originalAmount !== undefined) patch.originalAmount = undefined;
      if (raw.outstandingBalance !== undefined) patch.outstandingBalance = undefined;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(doc._id, patch);
        recFixed++;
      }
    }

    // fintrack_receivable_payments: backfill amountCents, remove legacy amount
    const payments = await ctx.db.query("fintrack_receivable_payments").collect();
    for (const doc of payments) {
      const raw = doc as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (raw.amount !== undefined && doc.amountCents === undefined)
        patch.amountCents = raw.amount as number;
      if (raw.amount !== undefined)
        patch.amount = undefined;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(doc._id, patch);
        payFixed++;
      }
    }

    return { subFixed, recFixed, payFixed };
  },
});

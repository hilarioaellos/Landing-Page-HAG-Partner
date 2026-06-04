import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";
import { validateCents } from "./_money";

export const listByAccount = query({
  args: { accountId: v.id("fintrack_accounts") },
  handler: async (ctx, { accountId }) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (!account.isActive)
      throw new ConvexError({ code: 403, message: "Account is archived" });
    return ctx.db
      .query("fintrack_reconciliations")
      .withIndex("by_account_date", (q) => q.eq("accountId", accountId))
      .order("desc")
      .take(20);
  },
});

export const create = mutation({
  args: {
    accountId: v.id("fintrack_accounts"),
    bankBalanceCents: v.number(),
    date: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { accountId, bankBalanceCents, date, notes }) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(accountId);
    if (!account || account.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    if (!account.isActive)
      throw new ConvexError({ code: 403, message: "Account is archived" });
    validateCents(bankBalanceCents, "bankBalanceCents");
    if (!Number.isFinite(date) || date <= 0)
      throw new ConvexError("date must be a valid timestamp");

    const systemBalanceCents = account.balanceCents;
    const differenceCents = bankBalanceCents - systemBalanceCents;
    const status = differenceCents === 0 ? "completed" : "discrepancy";

    return ctx.db.insert("fintrack_reconciliations", {
      userId,
      accountId,
      date,
      systemBalanceCents,
      bankBalanceCents,
      differenceCents,
      status,
      notes: notes?.trim() || undefined,
    });
  },
});

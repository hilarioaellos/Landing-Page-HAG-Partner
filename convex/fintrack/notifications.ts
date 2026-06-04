import { ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

export const listUnread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("isRead", false))
      .order("desc")
      .take(20);
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const unread = await ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("isRead", false))
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});

export const markRead = mutation({
  args: { id: v.id("fintrack_notifications") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const notif = await ctx.db.get(id);
    if (!notif || notif.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.patch(id, { isRead: true });
  },
});

export const checkPaymentDueDates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const todayDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    const allCards = await ctx.db.query("fintrack_credit_cards").collect();

    for (const card of allCards) {
      // Fix 4: skip cards linked to inactive or missing accounts
      const account = await ctx.db.get(card.accountId);
      if (!account || account.userId !== card.userId || !account.isActive) continue;

      // Fix 1: compute dueDate first — typeKey must be keyed on the actual due date,
      // not today's year/month, to avoid duplicates when the cron runs near month boundary.
      const dueDate = new Date(year, month, card.paymentDueDay);
      if (card.paymentDueDay < todayDay) dueDate.setMonth(dueDate.getMonth() + 1);
      const typeKey = `payment_due_${card._id}_${dueDate.getFullYear()}_${dueDate.getMonth()}`;

      const daysUntilDue =
        card.paymentDueDay >= todayDay
          ? card.paymentDueDay - todayDay
          : Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);

      if (daysUntilDue > 5) continue;

      const existing = await ctx.db
        .query("fintrack_notifications")
        .withIndex("by_user", (q) => q.eq("userId", card.userId))
        .filter((q) => q.eq(q.field("type"), typeKey))
        .first();

      if (existing) continue;

      const message =
        daysUntilDue === 0
          ? `${account.name} payment is due today`
          : `${account.name} payment due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;

      await ctx.db.insert("fintrack_notifications", {
        userId: card.userId,
        type: typeKey,
        message,
        dueDate: dueDate.getTime(),
        isRead: false,
        severity:
          daysUntilDue === 0 ? "urgent" : daysUntilDue <= 2 ? "warning" : "info",
      });
    }
  },
});

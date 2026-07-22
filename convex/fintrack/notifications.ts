import { ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./_auth";

export const listUnread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .order("desc")
      .take(10);
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ConvexError("limit must be an integer between 1 and 100");
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const unread = await ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();
    return { unreadCount: unread.length };
  },
});

export const markAsRead = mutation({
  args: { id: v.id("fintrack_notifications") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get(id);
    if (!notification || notification.userId !== userId)
      throw new ConvexError({ code: 403, message: "Forbidden" });
    await ctx.db.patch(id, { isRead: true });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const unread = await ctx.db
      .query("fintrack_notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("isRead", false))
      .take(200);
    for (const notif of unread) {
      await ctx.db.patch(notif._id, { isRead: true });
    }
    return { markedCount: unread.length };
  },
});

export const checkPaymentDueDates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const todayDay = today.getDate();

    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      const cards = await ctx.db
        .query("fintrack_credit_cards")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const card of cards) {
        if (card.paymentDueDay === todayDay) {
          const account = await ctx.db.get(card.accountId);
          if (!account) continue;

          await ctx.db.insert("fintrack_notifications", {
            userId: user._id,
            type: "payment_due",
            message: account.name,
            dueDate: today.getTime(),
            isRead: false,
            severity: "urgent",
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});

// Deletes read notifications older than 30 days, in batches of 500.
// Called by the weekly cron in crons.ts.
export const purgeReadNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    // Query all read notifications (no user filter needed for maintenance job).
    // Use _creationTime as a proxy when createdAt is not set on older documents.
    const batch = await ctx.db
      .query("fintrack_notifications")
      .filter((q) => q.eq(q.field("isRead"), true))
      .take(500);
    let deleted = 0;
    for (const notif of batch) {
      const ts = notif.createdAt ?? notif._creationTime;
      if (ts < cutoff) {
        await ctx.db.delete(notif._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

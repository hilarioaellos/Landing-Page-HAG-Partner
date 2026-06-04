import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { validateCents } from "./_money";

export async function applyBalanceDelta(
  ctx: MutationCtx,
  accountId: Id<"fintrack_accounts">,
  userId: Id<"users">,
  deltaCents: number
): Promise<void> {
  validateCents(deltaCents, "deltaCents");
  const account = await ctx.db.get(accountId);
  if (!account) throw new ConvexError({ code: 404, message: "Account not found" });
  if (account.userId !== userId) throw new ConvexError({ code: 403, message: "Forbidden" });
  await ctx.db.patch(accountId, { balanceCents: account.balanceCents + deltaCents });
}

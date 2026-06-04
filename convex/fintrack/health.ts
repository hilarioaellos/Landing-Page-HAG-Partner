import { query } from "../_generated/server";
import { requireUserId } from "./_auth";

export const ping = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return { ok: true, userId };
  },
});

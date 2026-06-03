import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const submitContactForm = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { name, email, message }) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      throw new ConvexError({ code: 400, message: "Name must be between 2 and 100 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new ConvexError({ code: 400, message: "Invalid email address" });
    }
    if (trimmedMessage.length < 8 || trimmedMessage.length > 2000) {
      throw new ConvexError({ code: 400, message: "Message must be between 8 and 2000 characters" });
    }

    await ctx.db.insert("contact_leads", {
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      status: "new",
    });
  },
});

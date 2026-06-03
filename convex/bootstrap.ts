import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";

export const isAvailable = query({
  args: {},
  handler: async (ctx) => {
    const hasAdmin = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("role"), "super_admin"))
      .first();
    return hasAdmin === null;
  },
});

export const resetAll = mutation({
  args: {},
  handler: async (ctx) => {
    const deleteAll = async (tableName: string) => {
      const rows = await (ctx.db.query as any)(tableName).collect();
      await Promise.all(rows.map((r: any) => ctx.db.delete(r._id)));
      return rows.length;
    };

    const counts = {
      profiles: await deleteAll("profiles"),
      organizations: await deleteAll("organizations"),
      authAccounts: await deleteAll("authAccounts"),
      authSessions: await deleteAll("authSessions"),
      authVerificationCodes: await deleteAll("authVerificationCodes"),
      users: await deleteAll("users"),
    };

    return counts;
  },
});

export const createSuperAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, firstName, lastName }) => {
    const existing = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("role"), "super_admin"))
      .first();
    if (existing) throw new Error("Super admin already exists");

    const passwordHash = await new Scrypt().hash(password);

    // Create org
    let org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "hag-partner"))
      .first();
    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: "HAG Partner LLC",
        slug: "hag-partner",
        plan: "enterprise",
        isActive: true,
      });
      org = await ctx.db.get(orgId);
    }

    // Create user
    const userId = await ctx.db.insert("users", {
      email: email.toLowerCase(),
    });

    // Create auth account (password provider format)
    await (ctx.db as any).insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email.toLowerCase(),
      secret: passwordHash,
    });

    // Create super_admin profile
    await ctx.db.insert("profiles", {
      userId,
      orgId: org!._id,
      role: "super_admin",
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      isActive: true,
    });

    return { email: email.toLowerCase(), orgName: org!.name };
  },
});

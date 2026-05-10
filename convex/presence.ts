import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';

async function meOrNull(ctx: QueryCtx | MutationCtx) {
  const ident = await ctx.auth.getUserIdentity();
  if (!ident) return null;
  return ctx.db
    .query('users')
    .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
    .unique();
}

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await meOrNull(ctx);
    if (!me) return;
    const now = Date.now();
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user', q => q.eq('userId', me._id))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { lastSeen: now });
    else          await ctx.db.insert('presence', { userId: me._id, lastSeen: now });
  },
});

export const onlineCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90_000;
    const rows = await ctx.db.query('presence').collect();
    return rows.filter(r => r.lastSeen >= cutoff).length;
  },
});

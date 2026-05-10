import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

async function meOrThrow(ctx: any) {
  const ident = await ctx.auth.getUserIdentity();
  if (!ident) throw new Error('Not signed in');
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk', (q: any) => q.eq('clerkId', ident.subject))
    .unique();
  if (!user) throw new Error('User not synced yet');
  return user;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!user) return null;
    const row = await ctx.db
      .query('keybinds')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .unique();
    return row?.bindings ?? null;
  },
});

export const save = mutation({
  args: { bindings: v.any() },
  handler: async (ctx, { bindings }) => {
    const user = await meOrThrow(ctx);
    const existing = await ctx.db
      .query('keybinds')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .unique();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { bindings, updatedAt: now });
    else          await ctx.db.insert('keybinds', { userId: user._id, bindings, updatedAt: now });
  },
});

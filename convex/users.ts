import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const upsertFromClerk = mutation({
  args: {
    clerkId:   v.string(),
    username:  v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, username, avatarUrl }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { username, avatarUrl, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('users', {
      clerkId, username, avatarUrl,
      elo: 1000, kills: 0, deaths: 0, wins: 0, losses: 0, matches: 0,
      createdAt: now, updatedAt: now,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;
    return await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
  },
});

export const byUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) =>
    ctx.db.query('users').withIndex('by_username', q => q.eq('username', username)).unique(),
});

export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');

    const trimmed = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
      throw new Error('3–16 chars, letters/numbers/underscore only');
    }

    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not synced yet');

    if (me.username === trimmed) return me._id;

    const taken = await ctx.db
      .query('users')
      .withIndex('by_username', q => q.eq('username', trimmed))
      .unique();
    if (taken && taken._id !== me._id) throw new Error('Username taken');

    await ctx.db.patch(me._id, { username: trimmed, updatedAt: Date.now() });
    return me._id;
  },
});

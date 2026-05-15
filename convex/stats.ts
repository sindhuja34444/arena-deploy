import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const global = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    const matches = await ctx.db.query('matches').collect();
    const kills = users.reduce((sum, u) => sum + (u.kills || 0), 0);
    return {
      players: users.length,
      matches: matches.length,
      kills,
    };
  },
});

/**
 * Called from the client (bots or PVP) to increment the authenticated
 * player's kills, deaths, wins, losses, and matches after a round/game ends.
 */
export const reportGameStats = mutation({
  args: {
    kills:   v.number(),
    deaths:  v.number(),
    wins:    v.optional(v.number()),
    losses:  v.optional(v.number()),
    matches: v.optional(v.number()),
  },
  handler: async (ctx, { kills, deaths, wins, losses, matches }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!user) return null;

    const patch: Record<string, number> = {
      kills:     user.kills + kills,
      deaths:    user.deaths + deaths,
      updatedAt: Date.now(),
    };
    if (wins)    patch.wins    = user.wins    + wins;
    if (losses)  patch.losses  = user.losses  + losses;
    if (matches) patch.matches = user.matches + matches;

    // ELO: +2 per kill, +5 per win
    let eloChange = kills * 2;
    if (wins) eloChange += wins * 5;
    if (eloChange > 0) patch.elo = user.elo + eloChange;

    await ctx.db.patch(user._id, patch);
    return user._id;
  },
});

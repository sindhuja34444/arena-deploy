import { v } from 'convex/values';
import { query } from './_generated/server';

export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const rows = await ctx.db
      .query('users')
      .withIndex('by_elo')
      .order('desc')
      .take(Math.min(limit, 100));
    return rows.map(u => ({
      username: u.username,
      elo:      u.elo,
      kills:    u.kills,
      deaths:   u.deaths,
      wins:     u.wins,
    }));
  },
});

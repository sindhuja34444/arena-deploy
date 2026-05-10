import { query } from './_generated/server';

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

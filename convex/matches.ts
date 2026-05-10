import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const start = mutation({
  args: {
    mode:     v.union(v.literal('bots'), v.literal('pvp'), v.literal('zones')),
    roomCode: v.optional(v.string()),
    players:  v.array(v.id('users')),
  },
  handler: async (ctx, { mode, roomCode, players }) => {
    return await ctx.db.insert('matches', {
      mode, roomCode, players,
      duration: 0,
      startedAt: Date.now(),
    });
  },
});

export const end = mutation({
  args: {
    matchId:  v.id('matches'),
    winnerId: v.optional(v.id('users')),
    duration: v.number(),
  },
  handler: async (ctx, { matchId, winnerId, duration }) => {
    const m = await ctx.db.get(matchId);
    if (!m) throw new Error('match not found');
    await ctx.db.patch(matchId, { winnerId, duration, endedAt: Date.now() });

    for (const pid of m.players) {
      const u = await ctx.db.get(pid);
      if (!u) continue;
      const isWinner = winnerId === pid;
      await ctx.db.patch(pid, {
        matches: u.matches + 1,
        wins:    u.wins   + (isWinner ? 1 : 0),
        losses:  u.losses + (isWinner ? 0 : 1),
        elo:     u.elo    + (isWinner ? 25 : -15),
        updatedAt: Date.now(),
      });
    }
  },
});

export const recordKill = mutation({
  args: {
    matchId:   v.id('matches'),
    shooterId: v.id('users'),
    victimId:  v.id('users'),
    weapon:    v.string(),
    headshot:  v.boolean(),
  },
  handler: async (ctx, { matchId, shooterId, victimId, weapon, headshot }) => {
    await ctx.db.insert('matchEvents', {
      matchId, type: 'kill',
      shooterId, victimId, weapon, headshot,
      ts: Date.now(),
    });
    const shooter = await ctx.db.get(shooterId);
    const victim  = await ctx.db.get(victimId);
    if (shooter) await ctx.db.patch(shooterId, { kills: shooter.kills + 1, updatedAt: Date.now() });
    if (victim)  await ctx.db.patch(victimId,  { deaths: victim.deaths + 1, updatedAt: Date.now() });
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) =>
    ctx.db.query('matches').withIndex('by_endedAt').order('desc').take(limit),
});

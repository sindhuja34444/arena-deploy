import { v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';

const ONLINE_WINDOW_MS = 90_000; // online if heartbeat within 90s

async function meOrThrow(ctx: QueryCtx | MutationCtx) {
  const ident = await ctx.auth.getUserIdentity();
  if (!ident) throw new Error('Not signed in');
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
    .unique();
  if (!user) throw new Error('Profile not synced');
  return user;
}

function pair(a: Id<'users'>, b: Id<'users'>): [Id<'users'>, Id<'users'>] {
  return a < b ? [a, b] : [b, a];
}

async function findFriendship(ctx: QueryCtx, x: Id<'users'>, y: Id<'users'>) {
  const [a, b] = pair(x, y);
  return ctx.db
    .query('friendships')
    .withIndex('by_pair', q => q.eq('a', a).eq('b', b))
    .unique();
}

async function isOnline(ctx: QueryCtx, userId: Id<'users'>): Promise<boolean> {
  const row = await ctx.db
    .query('presence')
    .withIndex('by_user', q => q.eq('userId', userId))
    .unique();
  if (!row) return false;
  return Date.now() - row.lastSeen < ONLINE_WINDOW_MS;
}

// ── Public queries ─────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await meOrThrow(ctx).catch(() => null);
    if (!me) return { friends: [], pendingIncoming: [], pendingOutgoing: [] };

    const asA = await ctx.db.query('friendships').withIndex('by_a', q => q.eq('a', me._id)).collect();
    const asB = await ctx.db.query('friendships').withIndex('by_b', q => q.eq('b', me._id)).collect();
    const all = [...asA, ...asB];

    const friends = [];
    const pendingIncoming = [];
    const pendingOutgoing = [];

    for (const f of all) {
      const otherId = f.a === me._id ? f.b : f.a;
      const other = await ctx.db.get(otherId);
      if (!other) continue;
      const summary = {
        friendshipId: f._id,
        userId: other._id,
        username: other.username,
        avatarUrl: other.avatarUrl,
        elo: other.elo,
        online: await isOnline(ctx, other._id),
      };
      if (f.status === 'accepted') friends.push(summary);
      else if (f.status === 'pending') {
        if (f.requesterId === me._id) pendingOutgoing.push(summary);
        else                          pendingIncoming.push(summary);
      }
    }

    friends.sort((x, y) => Number(y.online) - Number(x.online) || x.username.localeCompare(y.username));
    return { friends, pendingIncoming, pendingOutgoing };
  },
});

export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const me = await meOrThrow(ctx).catch(() => null);
    if (!me) return [];
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];

    const exact = await ctx.db
      .query('users')
      .withIndex('by_username', q2 => q2.eq('username', trimmed))
      .unique();

    let results = exact ? [exact] : [];
    if (results.length < 8) {
      const all = await ctx.db.query('users').take(80);
      const lower = trimmed.toLowerCase();
      const more = all.filter(u =>
        u._id !== me._id &&
        u.username.toLowerCase().includes(lower) &&
        !results.find(r => r._id === u._id),
      ).slice(0, 8);
      results = [...results, ...more];
    }
    results = results.filter(u => u._id !== me._id);

    const out = [];
    for (const u of results) {
      const f = await findFriendship(ctx, me._id, u._id);
      out.push({
        userId: u._id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        elo: u.elo,
        online: await isOnline(ctx, u._id),
        relation: f
          ? f.status === 'accepted'
            ? 'friend'
            : (f.requesterId === me._id ? 'outgoing' : 'incoming')
          : 'none',
      });
    }
    return out;
  },
});

// ── Mutations ─────────────────────────────────────────────────

export const sendRequest = mutation({
  args: { targetUsername: v.string() },
  handler: async (ctx, { targetUsername }) => {
    const me = await meOrThrow(ctx);
    const target = await ctx.db
      .query('users')
      .withIndex('by_username', q => q.eq('username', targetUsername.trim()))
      .unique();
    if (!target) throw new Error('User not found');
    if (target._id === me._id) throw new Error('Cannot add yourself');

    const existing = await findFriendship(ctx, me._id, target._id);
    if (existing) {
      if (existing.status === 'accepted') throw new Error('Already friends');
      if (existing.status === 'pending')  throw new Error('Request pending');
      throw new Error('Cannot send request');
    }
    const [a, b] = pair(me._id, target._id);
    const now = Date.now();
    return ctx.db.insert('friendships', {
      a, b,
      status: 'pending',
      requesterId: me._id,
      createdAt: now, updatedAt: now,
    });
  },
});

export const accept = mutation({
  args: { friendshipId: v.id('friendships') },
  handler: async (ctx, { friendshipId }) => {
    const me = await meOrThrow(ctx);
    const f = await ctx.db.get(friendshipId);
    if (!f) throw new Error('Request not found');
    if (f.status !== 'pending') throw new Error('Not pending');
    if (f.a !== me._id && f.b !== me._id) throw new Error('Not yours');
    if (f.requesterId === me._id) throw new Error('Cannot accept own request');
    await ctx.db.patch(friendshipId, { status: 'accepted', updatedAt: Date.now() });
  },
});

export const decline = mutation({
  args: { friendshipId: v.id('friendships') },
  handler: async (ctx, { friendshipId }) => {
    const me = await meOrThrow(ctx);
    const f = await ctx.db.get(friendshipId);
    if (!f) return;
    if (f.a !== me._id && f.b !== me._id) throw new Error('Not yours');
    await ctx.db.delete(friendshipId);
  },
});

export const remove = mutation({
  args: { friendshipId: v.id('friendships') },
  handler: async (ctx, { friendshipId }) => {
    const me = await meOrThrow(ctx);
    const f = await ctx.db.get(friendshipId);
    if (!f) return;
    if (f.a !== me._id && f.b !== me._id) throw new Error('Not yours');
    await ctx.db.delete(friendshipId);
  },
});

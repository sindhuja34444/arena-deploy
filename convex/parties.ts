import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/** Get or create the current user's party. */
export const myParty = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) return null;

    // Find party where I'm host or member
    const hosted = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (hosted) {
      const members = await Promise.all(
        hosted.members.map(id => ctx.db.get(id))
      );
      return {
        partyId: hosted._id,
        hostId: hosted.hostId,
        readyMembers: hosted.readyMembers,
        matchCode: hosted.matchCode || null,
        members: members.filter(Boolean).map(u => ({
          userId: u!._id,
          username: u!.username,
          avatarUrl: u!.avatarUrl,
          elo: u!.elo,
        })),
      };
    }

    // Check if I'm a member of someone else's party
    const allParties = await ctx.db.query('parties').collect();
    for (const p of allParties) {
      if (p.members.includes(me._id)) {
        const members = await Promise.all(
          p.members.map(id => ctx.db.get(id))
        );
        return {
          partyId: p._id,
          hostId: p.hostId,
          readyMembers: p.readyMembers,
          matchCode: p.matchCode || null,
          members: members.filter(Boolean).map(u => ({
            userId: u!._id,
            username: u!.username,
            avatarUrl: u!.avatarUrl,
            elo: u!.elo,
          })),
        };
      }
    }

    return null;
  },
});

/** Get pending invites for the current user. */
export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return [];
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) return [];

    const invites = await ctx.db
      .query('partyInvites')
      .withIndex('by_to', q => q.eq('toId', me._id).eq('status', 'pending'))
      .collect();

    const result = [];
    for (const inv of invites) {
      const from = await ctx.db.get(inv.fromId);
      if (from) {
        result.push({
          inviteId: inv._id,
          fromUsername: from.username,
          fromAvatarUrl: from.avatarUrl,
        });
      }
    }
    return result;
  },
});

/** Send a party invite to a friend by username. Creates party if needed. */
export const invite = mutation({
  args: { targetUsername: v.string() },
  handler: async (ctx, { targetUsername }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    const target = await ctx.db
      .query('users')
      .withIndex('by_username', q => q.eq('username', targetUsername))
      .unique();
    if (!target) throw new Error('User not found');
    if (target._id === me._id) throw new Error('Cannot invite yourself');

    // Find or create my party
    let party = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (!party) {
      const partyId = await ctx.db.insert('parties', {
        hostId: me._id,
        members: [me._id],
        readyMembers: [],
        createdAt: Date.now(),
      });
      party = (await ctx.db.get(partyId))!;
    }

    // Check if already invited
    const existing = await ctx.db
      .query('partyInvites')
      .withIndex('by_party', q => q.eq('partyId', party!._id))
      .collect();
    const alreadyPending = existing.find(
      i => i.toId === target._id && i.status === 'pending'
    );
    if (alreadyPending) throw new Error('Invite already sent');

    // Already in party
    if (party!.members.includes(target._id)) throw new Error('Already in your party');

    await ctx.db.insert('partyInvites', {
      partyId: party!._id,
      fromId: me._id,
      toId: target._id,
      status: 'pending',
      createdAt: Date.now(),
    });

    return party!._id;
  },
});

/** Accept a party invite. */
export const acceptInvite = mutation({
  args: { inviteId: v.id('partyInvites') },
  handler: async (ctx, { inviteId }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    const inv = await ctx.db.get(inviteId);
    if (!inv || inv.toId !== me._id || inv.status !== 'pending') {
      throw new Error('Invalid invite');
    }

    await ctx.db.patch(inviteId, { status: 'accepted' });

    const party = await ctx.db.get(inv.partyId);
    if (!party) throw new Error('Party not found');

    // Leave any existing party I'm hosting
    const myParty = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (myParty && myParty._id !== party._id) {
      await ctx.db.delete(myParty._id);
    }

    // Add me to the party
    if (!party.members.includes(me._id)) {
      await ctx.db.patch(party._id, {
        members: [...party.members, me._id],
      });
    }

    return party._id;
  },
});

/** Decline a party invite. */
export const declineInvite = mutation({
  args: { inviteId: v.id('partyInvites') },
  handler: async (ctx, { inviteId }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    const inv = await ctx.db.get(inviteId);
    if (!inv || inv.toId !== me._id || inv.status !== 'pending') {
      throw new Error('Invalid invite');
    }

    await ctx.db.patch(inviteId, { status: 'declined' });
  },
});

/** Leave the current party. */
export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    // If I'm the host, disband the party
    const hosted = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (hosted) {
      // Delete all pending invites
      const invites = await ctx.db
        .query('partyInvites')
        .withIndex('by_party', q => q.eq('partyId', hosted._id))
        .collect();
      for (const inv of invites) await ctx.db.delete(inv._id);
      await ctx.db.delete(hosted._id);
      return;
    }

    // If I'm a member, remove myself
    const allParties = await ctx.db.query('parties').collect();
    for (const p of allParties) {
      if (p.members.includes(me._id)) {
        await ctx.db.patch(p._id, {
          members: p.members.filter(id => id !== me._id),
        });
        return;
      }
    }
  },
});

/** Toggle ready status for the current user in their party. */
export const setReady = mutation({
  args: { ready: v.boolean() },
  handler: async (ctx, { ready }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    // Find my party
    let party = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (!party) {
      const allParties = await ctx.db.query('parties').collect();
      party = allParties.find(p => p.members.includes(me._id)) || null;
    }
    if (!party) throw new Error('Not in a party');

    const readyMembers = party.readyMembers || [];
    if (ready && !readyMembers.includes(me._id)) {
      await ctx.db.patch(party._id, {
        readyMembers: [...readyMembers, me._id],
      });
    } else if (!ready && readyMembers.includes(me._id)) {
      await ctx.db.patch(party._id, {
        readyMembers: readyMembers.filter(id => id !== me._id),
      });
    }
  },
});

/** Leader starts the match — sets matchCode so all members auto-redirect. */
export const startMatch = mutation({
  args: { matchCode: v.string() },
  handler: async (ctx, { matchCode }) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error('Not signed in');
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) throw new Error('Profile not found');

    const party = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (!party) throw new Error('Not a party leader');

    await ctx.db.patch(party._id, { matchCode });
  },
});

/** Clear the matchCode so returning members stay in the lobby. */
export const clearMatch = mutation({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return;
    const me = await ctx.db
      .query('users')
      .withIndex('by_clerk', q => q.eq('clerkId', ident.subject))
      .unique();
    if (!me) return;

    // Find my party (as host or member)
    let party = await ctx.db
      .query('parties')
      .withIndex('by_host', q => q.eq('hostId', me._id))
      .unique();
    if (!party) {
      const allParties = await ctx.db.query('parties').collect();
      party = allParties.find(p => p.members.includes(me._id)) || null;
    }
    if (!party) return;

    // Clear matchCode and reset ready states
    await ctx.db.patch(party._id, {
      matchCode: undefined,
      readyMembers: [],
    });
  },
});

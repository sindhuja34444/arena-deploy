import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId:   v.string(),
    username:  v.string(),
    avatarUrl: v.optional(v.string()),
    elo:       v.number(),
    kills:     v.number(),
    deaths:    v.number(),
    wins:      v.number(),
    losses:    v.number(),
    matches:   v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk',    ['clerkId'])
    .index('by_username', ['username'])
    .index('by_elo',      ['elo']),

  matches: defineTable({
    mode:      v.union(v.literal('bots'), v.literal('pvp'), v.literal('zones')),
    roomCode:  v.optional(v.string()),
    players:   v.array(v.id('users')),
    winnerId:  v.optional(v.id('users')),
    duration:  v.number(),
    startedAt: v.number(),
    endedAt:   v.optional(v.number()),
  })
    .index('by_endedAt', ['endedAt'])
    .index('by_room',    ['roomCode']),

  matchEvents: defineTable({
    matchId:   v.id('matches'),
    type:      v.union(
      v.literal('kill'),
      v.literal('death'),
      v.literal('zoneCapture'),
      v.literal('matchStart'),
      v.literal('matchEnd'),
    ),
    shooterId: v.optional(v.id('users')),
    victimId:  v.optional(v.id('users')),
    weapon:    v.optional(v.string()),
    headshot:  v.optional(v.boolean()),
    ts:        v.number(),
  })
    .index('by_match', ['matchId']),

  keybinds: defineTable({
    userId:    v.id('users'),
    bindings:  v.any(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId']),

  // Stored as ordered pair (a < b lex) so we can index lookup by either side.
  friendships: defineTable({
    a:           v.id('users'),
    b:           v.id('users'),
    status:      v.union(v.literal('pending'), v.literal('accepted'), v.literal('blocked')),
    requesterId: v.id('users'),
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index('by_a',     ['a', 'status'])
    .index('by_b',     ['b', 'status'])
    .index('by_pair',  ['a', 'b']),

  presence: defineTable({
    userId:   v.id('users'),
    lastSeen: v.number(),
  })
    .index('by_user', ['userId']),

  parties: defineTable({
    hostId:       v.id('users'),
    members:      v.array(v.id('users')),
    readyMembers: v.optional(v.array(v.id('users'))),
    matchCode:    v.optional(v.string()),
    createdAt:    v.number(),
  })
    .index('by_host', ['hostId']),

  partyInvites: defineTable({
    partyId:   v.id('parties'),
    fromId:    v.id('users'),
    toId:      v.id('users'),
    status:    v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
    createdAt: v.number(),
  })
    .index('by_to', ['toId', 'status'])
    .index('by_party', ['partyId']),
});

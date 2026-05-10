# Arena FPS

Browser-based tactical FPS — Three.js + Socket.IO, Vite multi-page, Clerk auth, Convex DB.

## Stack

- **Vite** — multi-page bundler
- **Three.js r128** (CDN) — rendering
- **Socket.IO 4.7** (CDN, PVP only) — netcode → `arena-fps-server.onrender.com`
- **Clerk** — auth (`@clerk/clerk-js`)
- **Convex** — players, matches, leaderboard, keybinds

## Pages

| Route    | File                        | Auth |
|----------|-----------------------------|------|
| `/`      | `src/index.html`            | open |
| `/menu`  | `src/menu/index.html`       | required |
| `/lobby` | `src/lobby/index.html`      | required |
| `/pvp`   | `src/pvp/index.html`        | required |
| `/bots`  | `src/bots/index.html`       | open |

## First-time setup

```bash
npm install
cp .env.example .env       # fill in keys
```

### Convex

```bash
npx convex dev             # picks/creates project, writes VITE_CONVEX_URL
```

In Clerk dashboard → JWT Templates → create template named `convex`:
- Issuer: your Clerk domain
- Claims: `{ "aud": "convex" }`

Add to `.env`:
```
CLERK_JWT_ISSUER_DOMAIN=https://<your-app>.clerk.accounts.dev
```

Then push functions:
```bash
npx convex deploy
```

### Dev

```bash
npm run dev                # http://localhost:5173
```

## Deploy

### Vercel
```bash
vercel
```
Set env vars in Vercel dashboard:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`

### Cloudflare Pages
- Connect repo → build cmd `npm run build`, output `dist`
- Same env vars

### Convex
```bash
npx convex deploy --prod
```

## Socket server

Lives in a separate repo (`arena-fps-server`, deployed on Render). To add JWT verification:

```js
io.use(async (socket, next) => {
  const { token } = socket.handshake.auth;
  if (!token) return next();      // allow anon during transition
  const verified = await verifyClerkJWT(token);
  socket.user = verified;
  next();
});
```

## Layout

```
arena-deploy/
├── src/
│   ├── index.html              # landing
│   ├── menu/, lobby/, pvp/, bots/
│   ├── landing/                # css + js for landing
│   └── shared/                 # auth.js, convex.js
├── public/
│   ├── audio/                  # rifle, shotgun, reload sfx
│   ├── assets/                 # higgsfield-generated images
│   └── _redirects              # CF Pages clean URLs
├── convex/                     # schema + functions
├── vite.config.js              # multi-page build
├── vercel.json                 # vercel rewrites
└── wrangler.toml               # cf pages config
```

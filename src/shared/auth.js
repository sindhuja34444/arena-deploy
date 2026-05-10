import { Clerk } from '@clerk/clerk-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let clerkInstance = null;
let initPromise = null;

export async function initClerk() {
  if (clerkInstance) return clerkInstance;
  if (initPromise) return initPromise;
  if (!PUBLISHABLE_KEY) throw new Error('VITE_CLERK_PUBLISHABLE_KEY missing');

  initPromise = (async () => {
    const c = new Clerk(PUBLISHABLE_KEY);
    await c.load();
    clerkInstance = c;
    return c;
  })();
  return initPromise;
}

export function getClerk() { return clerkInstance; }

export function currentUser() {
  return clerkInstance?.user || null;
}

export async function getToken(template = 'convex') {
  if (!clerkInstance?.session) return null;
  return clerkInstance.session.getToken({ template });
}

export function signIn({ redirectUrl } = {}) {
  if (!clerkInstance) throw new Error('Clerk not initialised');
  clerkInstance.openSignIn({ afterSignInUrl: redirectUrl, afterSignUpUrl: redirectUrl });
}

export function signOut() { return clerkInstance?.signOut(); }

/** Gate a page: redirect to landing if not signed in. Resolves with user. */
export async function requireAuth(redirectIfAnon = '/') {
  const c = await initClerk();
  if (!c.user) { location.href = redirectIfAnon; return null; }
  return c.user;
}

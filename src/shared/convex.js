import { ConvexClient } from 'convex/browser';
import { getToken, getClerk } from './auth.js';

const URL = import.meta.env.VITE_CONVEX_URL;
let client = null;

export function getConvex() {
  if (client) return client;
  if (!URL) return null;
  client = new ConvexClient(URL);
  // Bridge Clerk -> Convex auth
  client.setAuth(async () => {
    try { return await getToken('convex'); }
    catch { return null; }
  });
  // Re-fetch token whenever Clerk session changes
  const c = getClerk?.();
  c?.addListener?.(() => client.setAuth(async () => getToken('convex').catch(() => null)));
  return client;
}

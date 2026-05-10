import { initClerk, signIn, currentUser } from '../shared/auth.js';
import { getConvex } from '../shared/convex.js';
import { api } from '../../convex/_generated/api.js';

// ── Animated grid bg ─────────────────────────────────────────────────────
(() => {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, off = 0;
  const G = 56;
  function size(){ W = c.width = innerWidth; H = c.height = innerHeight; }
  size(); addEventListener('resize', size);
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
    const ox = off % G;
    for (let x = -G+ox; x < W+G; x += G) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = -G+ox; y < H+G; y += G) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(204,34,34,0.35)'; ctx.lineWidth = 1;
    for (let i = -H; i < W+H; i += G*5) {
      ctx.beginPath(); ctx.moveTo(i+off*0.3, 0); ctx.lineTo(i+H+off*0.3, H); ctx.stroke();
    }
    off += 0.4;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Auth wiring ──────────────────────────────────────────────────────────
const playButtons = ['btn-play', 'btn-play-2'].map(id => document.getElementById(id));
const signInBtn   = document.getElementById('btn-signin');

async function boot() {
  try {
    const clerk = await initClerk();
    const update = () => {
      const u = currentUser();
      if (u) {
        signInBtn.textContent = u.firstName || u.username || 'Profile';
        signInBtn.onclick = () => clerk.openUserProfile();
      } else {
        signInBtn.textContent = 'Sign in';
        signInBtn.onclick = () => signIn();
      }
    };
    clerk.addListener(update); update();

    playButtons.forEach(b => b && (b.onclick = () => {
      if (currentUser()) location.href = '/menu/';
      else signIn({ redirectUrl: '/menu/' });
    }));
  } catch (e) {
    console.warn('Clerk init skipped:', e?.message || e);
    playButtons.forEach(b => b && (b.onclick = () => location.href = '/menu/'));
    signInBtn.onclick = () => alert('Auth not configured');
  }
}
boot();

// ── Leaderboard + stats from Convex ──────────────────────────────────────
async function loadLeaderboard() {
  const lb = document.getElementById('lb-list');
  try {
    const convex = getConvex();
    if (!convex) throw new Error('no convex url');
    const [top, stats] = await Promise.all([
      convex.query(api.leaderboard.top, { limit: 10 }),
      convex.query(api.stats.global, {}),
    ]);
    if (!top || !top.length) {
      lb.innerHTML = '<li class="lb-empty">No matches yet — be first.</li>';
    } else {
      lb.innerHTML = top.map((u, i) => `
        <li>
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${escapeHtml(u.username || 'anon')}</span>
          <span class="lb-elo">${u.elo} ELO</span>
        </li>
      `).join('');
    }
    if (stats) {
      document.getElementById('stat-players').textContent = fmt(stats.players);
      document.getElementById('stat-matches').textContent = fmt(stats.matches);
      document.getElementById('stat-kills').textContent   = fmt(stats.kills);
    }
  } catch (e) {
    console.warn('Convex skipped:', e?.message || e);
    lb.innerHTML = '<li class="lb-empty">Leaderboard offline</li>';
  }
}
loadLeaderboard();

function fmt(n) { return new Intl.NumberFormat().format(n || 0); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

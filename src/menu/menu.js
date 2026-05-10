import { getConvex } from '../shared/convex.js';
import { api } from '../../convex/_generated/api.js';

// ── State ──────────────────────────────────────────────
let activeTab    = 'play';
let activeMode   = 'bots';
let activeSocial = 'friends';
let listeningKb  = null;

// ── Auth wait ──────────────────────────────────────────
async function waitForAuth(maxMs = 8000) {
  const start = Date.now();
  while (!window.__arenaAuth && Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 100));
  }
  return window.__arenaAuth;
}

// ── Tabs ───────────────────────────────────────────────
const eyebrow = document.getElementById('section-eyebrow');
const tabLabels = { play: 'Play', career: 'Career', loadout: 'Loadout', social: 'Social', settings: 'Settings' };
function setTab(name) {
  activeTab = name;
  document.querySelectorAll('.halo-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.halo-submenu').forEach(p =>
    p.classList.toggle('hidden', p.dataset.panel !== name));
  eyebrow.textContent = (tabLabels[name] || name).toUpperCase();
  if (name === 'social') refreshFriends();
}
document.getElementById('tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.halo-tab');
  if (t) setTab(t.dataset.tab);
});

// ── Mode + play ───────────────────────────────────────
document.querySelectorAll('[data-action]').forEach(b => {
  b.addEventListener('click', () => {
    const a = b.dataset.action;
    if (b.disabled) return;
    if (a === 'invite') { openInvite(); return; }
    if (a === 'mode-bots') {
      setActiveItem(b);
      activeMode = 'bots';
      document.getElementById('play-tagline').textContent = 'Solo training. No login pressure. Survive the waves.';
    }
    if (a === 'mode-pvp') {
      setActiveItem(b);
      activeMode = 'pvp';
      document.getElementById('play-tagline').textContent = '1v1 ranked. Server-authoritative hits. Pure aim.';
    }
  });
});
function setActiveItem(el) {
  el.parentElement.querySelectorAll('.halo-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}
function play() {
  if (activeMode === 'bots') location.href = '/bots/';
  else if (activeMode === 'pvp') location.href = '/lobby/';
}
document.getElementById('btn-play').onclick = play;

// ── Esc stack ──────────────────────────────────────────
const escOverlay    = document.getElementById('esc-overlay');
const inviteOverlay = document.getElementById('invite-overlay');
const kbOverlay     = document.getElementById('kb-overlay');

function escAction() {
  if (listeningKb) { listeningKb = null; renderKb(); return; }
  if (kbOverlay.classList.contains('show'))     { kbOverlay.classList.remove('show'); return; }
  if (inviteOverlay.classList.contains('show')) { inviteOverlay.classList.remove('show'); return; }
  if (escOverlay.classList.contains('show'))    { escOverlay.classList.remove('show'); return; }
  if (activeTab !== 'play') { setTab('play'); return; }
  escOverlay.classList.add('show');
}
document.getElementById('esc-cancel').onclick  = () => escOverlay.classList.remove('show');
document.getElementById('esc-confirm').onclick = () => location.href = '/';

document.addEventListener('keydown', (e) => {
  if (listeningKb && e.code !== 'Escape') {
    e.preventDefault();
    currentBinds[listeningKb] = e.code;
    listeningKb = null; renderKb(); saveLocalBinds();
    return;
  }
  if (e.code === 'Escape') { e.preventDefault(); escAction(); return; }
  // Don't intercept when typing in inputs
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Enter' && activeTab === 'play') { e.preventDefault(); play(); return; }
  if (e.code === 'KeyQ') { e.preventDefault(); cycleTab(-1); return; }
  if (e.code === 'KeyE') { e.preventDefault(); cycleTab( 1); return; }
});
function cycleTab(dir) {
  const tabs = ['play','career','loadout','social','settings'];
  const i = tabs.indexOf(activeTab);
  setTab(tabs[(i + dir + tabs.length) % tabs.length]);
}

// ── Invite ─────────────────────────────────────────────
const inviteCodeEl = document.getElementById('invite-code');
const inviteLinkEl = document.getElementById('invite-link');
function genCode() { return Math.floor(Math.random() * 9000 + 1000).toString(); }
function refreshInvite() {
  const code = genCode();
  inviteCodeEl.textContent = code;
  inviteLinkEl.textContent = `${location.origin}/lobby/?code=${code}`;
}
function openInvite() { refreshInvite(); inviteOverlay.classList.add('show'); }
document.getElementById('invite-close').onclick = () => inviteOverlay.classList.remove('show');
document.getElementById('invite-regen').onclick = refreshInvite;
document.getElementById('invite-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkEl.textContent);
    toast('Link copied', 'success');
    document.getElementById('invite-copy').textContent = '✓ Copied';
    setTimeout(() => document.getElementById('invite-copy').textContent = 'Copy Link', 1500);
  } catch { toast('Copy failed — select manually', 'error'); }
};

// ── Toast ──────────────────────────────────────────────
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'halo-toast ' + kind;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Keybinds ───────────────────────────────────────────
const DEFAULT_BINDS = {
  moveForward:'KeyW', moveBack:'KeyS', moveLeft:'KeyA', moveRight:'KeyD',
  jump:'Space', sprint:'ShiftLeft', reload:'KeyR',
  weapon1:'Digit1', weapon2:'Digit2',
  ability:'KeyF', heal:'KeyQ', pickup:'KeyE',
};
const BIND_LABELS = {
  moveForward:'Move Forward', moveBack:'Move Back',
  moveLeft:'Move Left', moveRight:'Move Right',
  jump:'Jump', sprint:'Sprint', reload:'Reload',
  weapon1:'Weapon 1 — Rifle', weapon2:'Weapon 2 — Shotgun',
  ability:'Armour Ability', heal:'Heal (PVP)', pickup:'Pick Up Shield',
};
function loadBinds() {
  try { return { ...DEFAULT_BINDS, ...JSON.parse(localStorage.getItem('arenaKeybinds') || '{}') }; }
  catch { return { ...DEFAULT_BINDS }; }
}
function saveLocalBinds() { localStorage.setItem('arenaKeybinds', JSON.stringify(currentBinds)); }
function codeLabel(c) {
  if (!c) return '?';
  return c.replace('Key','').replace('Digit','')
    .replace('ShiftLeft','L-SHIFT').replace('ShiftRight','R-SHIFT')
    .replace('Space','SPACE').replace('ControlLeft','L-CTRL').replace('ControlRight','R-CTRL')
    .replace('AltLeft','L-ALT').replace('AltRight','R-ALT')
    .replace('Tab','TAB').replace('CapsLock','CAPS').toUpperCase();
}
let currentBinds = loadBinds();
const kbGrid = document.getElementById('kb-grid');
function renderKb() {
  kbGrid.innerHTML = '';
  for (const [action, code] of Object.entries(currentBinds)) {
    const lbl = document.createElement('div');
    lbl.className = 'halo-kb-action';
    lbl.textContent = BIND_LABELS[action] || action;
    kbGrid.appendChild(lbl);
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'halo-kb-key';
    if (listeningKb === action) { box.classList.add('listening'); box.textContent = '...'; }
    else                          box.textContent = codeLabel(code);
    box.onclick = () => { listeningKb = action; renderKb(); };
    kbGrid.appendChild(box);
  }
}
renderKb();
document.getElementById('open-kb').onclick = () => { renderKb(); kbOverlay.classList.add('show'); };
document.getElementById('kb-close').onclick = () => kbOverlay.classList.remove('show');
document.getElementById('kb-reset').onclick = () => { currentBinds = { ...DEFAULT_BINDS }; saveLocalBinds(); renderKb(); };
document.getElementById('kb-save').onclick  = () => { saveLocalBinds(); kbOverlay.classList.remove('show'); toast('Keybinds saved', 'success'); };

// ── News card → quick PVP ──────────────────────────────
document.getElementById('news-card').onclick = () => {
  activeMode = 'pvp';
  setTab('play');
  const pvpItem = document.querySelector('[data-action="mode-pvp"]');
  if (pvpItem) setActiveItem(pvpItem);
};

// ── Social: friends, requests, search ──────────────────
document.querySelectorAll('.halo-subtab').forEach(b => {
  b.addEventListener('click', () => {
    activeSocial = b.dataset.subtab;
    document.querySelectorAll('.halo-subtab').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('[data-subpanel]').forEach(p =>
      p.classList.toggle('hidden', p.dataset.subpanel !== activeSocial));
  });
});
document.getElementById('friends-shortcut').onclick = () => {
  setTab('social');
  const reqsBtn = document.querySelector('[data-subtab="requests"]');
  if (parseInt(document.getElementById('req-count').textContent || '0') > 0) reqsBtn.click();
};

const friendsList  = document.getElementById('friends-list');
const requestsList = document.getElementById('requests-list');
const searchInput  = document.getElementById('search-input');
const searchAddBtn = document.getElementById('search-add');
const searchStatus = document.getElementById('search-status');
const searchResults= document.getElementById('search-results');

function avatarHTML(u, online) {
  const cls = 'halo-avatar' + (online ? ' online' : '');
  if (u.avatarUrl) return `<div class="${cls}"><img src="${u.avatarUrl}" alt=""></div>`;
  return `<div class="${cls}">${(u.username || '?').slice(0,1).toUpperCase()}</div>`;
}

function renderFriendRow(u, actions = '') {
  return `
    <div class="halo-list-row" data-user="${u.userId}">
      ${avatarHTML(u, u.online)}
      <div class="halo-list-meta">
        <div class="halo-list-name">${escapeHtml(u.username)}</div>
        <div class="halo-list-sub">${u.online ? 'Online' : 'Offline'} · ${u.elo} ELO</div>
      </div>
      <div class="halo-list-actions">${actions}</div>
    </div>
  `;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function refreshFriends() {
  const convex = getConvex();
  if (!convex) return;
  try {
    const data = await convex.query(api.friends.list, {});
    const onlineCount = data.friends.filter(f => f.online).length;
    document.getElementById('friend-count').textContent = data.friends.length;
    document.getElementById('req-count').textContent    = data.pendingIncoming.length;
    document.getElementById('online-friends').textContent = `${onlineCount} online`;
    const badge = document.getElementById('online-badge');
    const totalBadge = data.pendingIncoming.length;
    if (totalBadge > 0) {
      badge.hidden = false;
      badge.textContent = totalBadge > 9 ? '9+' : String(totalBadge);
    } else { badge.hidden = true; }

    if (!data.friends.length) {
      friendsList.innerHTML = '<div class="halo-list-empty">No friends yet — add one in the Add tab.</div>';
    } else {
      friendsList.innerHTML = data.friends.map(f => renderFriendRow(f, `
        <button class="halo-btn" data-act="invite" data-name="${escapeHtml(f.username)}">Invite</button>
        <button class="halo-btn danger" data-act="remove" data-id="${f.friendshipId}">×</button>
      `)).join('');
    }

    if (!data.pendingIncoming.length) {
      requestsList.innerHTML = '<div class="halo-list-empty">No incoming requests.</div>';
    } else {
      requestsList.innerHTML = data.pendingIncoming.map(f => renderFriendRow(f, `
        <button class="halo-btn primary" data-act="accept"  data-id="${f.friendshipId}">Accept</button>
        <button class="halo-btn"         data-act="decline" data-id="${f.friendshipId}">Decline</button>
      `)).join('');
    }
  } catch (e) { console.warn('friends list', e?.message); }
}

// Friend row actions
document.body.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const convex = getConvex();
  if (!convex) return;
  const act = btn.dataset.act;
  try {
    if (act === 'accept') {
      await convex.mutation(api.friends.accept, { friendshipId: btn.dataset.id });
      toast('Friend added', 'success');
    } else if (act === 'decline' || act === 'remove') {
      await convex.mutation(act === 'decline' ? api.friends.decline : api.friends.remove,
                            { friendshipId: btn.dataset.id });
      toast(act === 'decline' ? 'Request declined' : 'Friend removed');
    } else if (act === 'invite') {
      // Generate code, set in invite overlay, copy
      const code = genCode();
      const url  = `${location.origin}/lobby/?code=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        toast(`Invite link copied — share with ${btn.dataset.name}`, 'success');
      } catch { openInvite(); }
    } else if (act === 'send-request') {
      await convex.mutation(api.friends.sendRequest, { targetUsername: btn.dataset.name });
      toast(`Request sent to ${btn.dataset.name}`, 'success');
      runSearch();
    }
    refreshFriends();
  } catch (err) {
    toast(err.message?.replace(/^.*Error: /, '') || 'Failed', 'error');
  }
});

// Search
let searchTimer;
searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});
searchAddBtn?.addEventListener('click', async () => {
  const name = searchInput.value.trim();
  if (!name) return;
  const convex = getConvex();
  if (!convex) return;
  try {
    await convex.mutation(api.friends.sendRequest, { targetUsername: name });
    toast(`Request sent to ${name}`, 'success');
    searchInput.value = '';
    searchResults.innerHTML = '';
    refreshFriends();
  } catch (e) { toast(e.message?.replace(/^.*Error: /, '') || 'Failed', 'error'); }
});

async function runSearch() {
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.innerHTML = ''; searchStatus.textContent = ''; return; }
  const convex = getConvex();
  if (!convex) return;
  searchStatus.textContent = 'Searching…';
  try {
    const rows = await convex.query(api.friends.search, { q });
    searchStatus.textContent = rows.length ? '' : 'No matches';
    searchResults.innerHTML = rows.map(u => {
      let action = '';
      if (u.relation === 'none')      action = `<button class="halo-btn primary" data-act="send-request" data-name="${escapeHtml(u.username)}">Add</button>`;
      else if (u.relation === 'outgoing') action = `<span class="halo-list-sub">Pending…</span>`;
      else if (u.relation === 'incoming') action = `<span class="halo-list-sub">Accept above</span>`;
      else                                action = `<span class="halo-list-sub">Friend</span>`;
      return renderFriendRow(u, action);
    }).join('');
  } catch (e) { searchStatus.textContent = 'Search failed'; }
}

// ── Profile + name editing + Convex stats ─────────────
const nameInput   = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name');
const nameHint    = document.getElementById('name-hint');

function applyName(name) {
  if (!name) return;
  document.getElementById('profile-name').textContent = name;
  const av = document.getElementById('profile-avatar');
  if (av && !av.querySelector('img')) av.textContent = name.slice(0, 1).toUpperCase();
  if (!nameInput.value) nameInput.value = name;
}
applyName(localStorage.getItem('arenaPlayerName') || '');

let originalName = nameInput.value;
function valid(v) { return /^[A-Za-z0-9_]{3,16}$/.test(v); }
function refreshSaveBtn() {
  const v = nameInput.value.trim();
  saveNameBtn.disabled = !valid(v) || v === originalName;
}
nameInput?.addEventListener('input', refreshSaveBtn);
saveNameBtn.onclick = async () => {
  const v = nameInput.value.trim();
  if (!valid(v)) return;
  saveNameBtn.disabled = true;
  saveNameBtn.textContent = 'Saving…';
  try {
    const convex = getConvex();
    if (!convex) throw new Error('Convex not configured');
    await convex.mutation(api.users.setUsername, { username: v });
    localStorage.setItem('arenaPlayerName', v);
    applyName(v); originalName = v;
    toast('Name saved', 'success');
  } catch (e) {
    toast(e.message?.replace(/^.*Error: /, '') || 'Save failed', 'error');
  } finally {
    saveNameBtn.textContent = 'Save';
    refreshSaveBtn();
  }
};

async function bootProfile() {
  const auth = await waitForAuth();
  if (!auth) { console.warn('No auth'); return; }
  const name = auth.username;
  applyName(name);
  originalName = name;
  refreshSaveBtn();
  if (auth.user.imageUrl) {
    document.getElementById('profile-avatar').innerHTML = `<img src="${auth.user.imageUrl}" alt="">`;
  }
  document.getElementById('account-email').textContent = auth.user.primaryEmailAddress?.emailAddress || '—';
  document.getElementById('signout').onclick   = () => auth.clerk.signOut().then(() => location.href = '/');
  document.getElementById('profile-btn').onclick = () => auth.clerk.openUserProfile();

  try {
    const convex = getConvex();
    if (!convex) return;
    const me = await convex.query(api.users.me, {});
    if (!me) return;
    if (me.username && me.username !== name) {
      applyName(me.username); originalName = me.username; refreshSaveBtn();
      localStorage.setItem('arenaPlayerName', me.username);
    }
    const kd = me.deaths > 0 ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2);
    const wr = me.matches > 0 ? Math.round((me.wins / me.matches) * 100) + '%' : '0%';
    document.getElementById('profile-elo').textContent = `${me.elo} ELO`;
    document.getElementById('c-kills').textContent  = me.kills.toLocaleString();
    document.getElementById('c-deaths').textContent = me.deaths.toLocaleString();
    document.getElementById('c-kd').textContent     = kd;
    document.getElementById('c-elo').textContent    = me.elo;
    document.getElementById('c-wins').textContent   = me.wins.toLocaleString();
    document.getElementById('c-wr').textContent     = wr;

    refreshFriends();
    startHeartbeat();
    startOnlineCount();
  } catch (e) { console.warn('profile load', e?.message); }
}
bootProfile();

// ── Presence heartbeat (30s) + global online count ────
function startHeartbeat() {
  const convex = getConvex();
  if (!convex) return;
  const beat = () => convex.mutation(api.presence.heartbeat, {}).catch(() => {});
  beat();
  setInterval(beat, 30_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
}
function startOnlineCount() {
  const convex = getConvex();
  if (!convex) return;
  const tick = async () => {
    try {
      const n = await convex.query(api.presence.onlineCount, {});
      document.getElementById('online-count').textContent = `${n.toLocaleString()} online`;
    } catch {}
  };
  tick();
  setInterval(tick, 30_000);
}

setTab('play');

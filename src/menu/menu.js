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
  if (currentPartyId && activeMode === 'bots') {
    toast('Bots mode not supported in a party', 'error');
    return;
  }
  if (currentPartyId && activeMode === 'pvp') {
    // Check if all members are ready before starting
    const playBtn = document.getElementById('btn-play');
    if (playBtn.style.opacity === '0.4') {
      toast('Waiting for party members to ready up', 'error');
      return;
    }
    // Leader starts the match — write matchCode to Convex so members auto-join
    const code = 'party-' + currentPartyId.slice(-8);
    const convex = getConvex();
    if (convex) {
      convex.mutation(api.parties.startMatch, { matchCode: code })
        .then(() => { location.href = `/pvp/?code=${code}`; })
        .catch(e => toast(e.message?.replace(/^.*Error: /, '') || 'Failed to start', 'error'));
    } else {
      location.href = `/pvp/?code=${code}`;
    }
    return;
  }
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
  if (document.getElementById('social-sidebar').classList.contains('open')) { document.getElementById('social-sidebar').classList.remove('open'); return; }
  if (escOverlay.classList.contains('show'))    { escOverlay.classList.remove('show'); return; }
  if (activeTab !== 'play') { setTab('play'); return; }
  escOverlay.classList.add('show');
}
document.getElementById('esc-cancel').onclick  = () => escOverlay.classList.remove('show');
document.getElementById('esc-confirm').onclick = () => location.href = '/';

// Capture mouse buttons for keybind rebinding
document.addEventListener('mousedown', (e) => {
  if (!listeningKb) return;
  if (!document.getElementById('kb-overlay').classList.contains('show')) return;
  e.preventDefault();
  e.stopPropagation();
  currentBinds[listeningKb] = 'Mouse' + e.button;
  listeningKb = null; renderKb(); saveLocalBinds();
}, true);

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
document.getElementById('topright-invite').onclick = () => {
  document.getElementById('social-sidebar').classList.toggle('open');
  refreshFriends();
};
document.getElementById('social-sidebar-close').onclick = () => {
  document.getElementById('social-sidebar').classList.remove('open');
};
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

// ── Loadout selection ───────────────────────────────────
const WEAPON_INFO = {
  rifle:   { name: 'Rifle',   damage: '25',    ammo: '30', reload: '1.8s', fire: 'Semi-auto', type: 'Assault Rifle' },
  smg:     { name: 'SMG',     damage: '14',    ammo: '35', reload: '1.5s', fire: 'Full-auto', type: 'Submachine Gun' },
  shotgun: { name: 'Shotgun', damage: '21×5',  ammo: '6',  reload: '1.6s', fire: 'Pump',      type: 'Shotgun' },
  sniper:  { name: 'Sniper',  damage: '150',   ammo: '3',  reload: '2.8s', fire: 'Bolt-action', type: 'Sniper Rifle' },
};

function initLoadoutUI() {
  const slot1 = localStorage.getItem('arenaLoadoutSlot1') || 'rifle';
  const slot2 = localStorage.getItem('arenaLoadoutSlot2') || 'shotgun';

  // Highlight saved selections
  document.querySelectorAll('.loadout-card').forEach(card => {
    const s = card.dataset.slot;
    const w = card.dataset.weapon;
    card.classList.toggle('selected', (s === '1' && w === slot1) || (s === '2' && w === slot2));
  });

  // Show detail for slot 1 weapon initially
  showWeaponDetail(slot1);

  // Click handlers
  document.querySelectorAll('.loadout-card').forEach(card => {
    card.addEventListener('click', () => {
      const slot = card.dataset.slot;
      const weapon = card.dataset.weapon;

      // Don't allow same weapon in both slots
      const otherSlot = slot === '1' ? '2' : '1';
      const otherWeapon = localStorage.getItem(slot === '1' ? 'arenaLoadoutSlot2' : 'arenaLoadoutSlot1') || (otherSlot === '1' ? 'rifle' : 'shotgun');
      if (weapon === otherWeapon) {
        toast('Already equipped in the other slot', 'error');
        return;
      }

      // Save
      localStorage.setItem(slot === '1' ? 'arenaLoadoutSlot1' : 'arenaLoadoutSlot2', weapon);

      // Update selection visuals for this slot
      document.querySelectorAll(`.loadout-card[data-slot="${slot}"]`).forEach(c =>
        c.classList.toggle('selected', c.dataset.weapon === weapon));

      showWeaponDetail(weapon);
      toast(`Slot ${slot}: ${WEAPON_INFO[weapon].name}`, 'success');
    });

    // Hover to preview detail
    card.addEventListener('mouseenter', () => showWeaponDetail(card.dataset.weapon));
  });
}

function showWeaponDetail(weapon) {
  const info = WEAPON_INFO[weapon];
  if (!info) return;
  document.getElementById('loadout-detail-name').textContent = info.name;
  document.getElementById('loadout-detail-stats').innerHTML = `
    <div>TYPE <span class="stat-val">${info.type}</span></div>
    <div>FIRE <span class="stat-val">${info.fire}</span></div>
    <div>DAMAGE <span class="stat-val">${info.damage}</span></div>
    <div>MAGAZINE <span class="stat-val">${info.ammo} RDS</span></div>
    <div>RELOAD <span class="stat-val">${info.reload}</span></div>
  `;
}

initLoadoutUI();

// ── Keybinds ───────────────────────────────────────────
const DEFAULT_BINDS = {
  moveForward:'KeyW', moveBack:'KeyS', moveLeft:'KeyA', moveRight:'KeyD',
  jump:'Space', sprint:'ShiftLeft', reload:'KeyR', slide:'KeyX',
  shoot:'Mouse0', ads:'Mouse2',
  weapon1:'Digit1', weapon2:'Digit2',
  ability:'KeyF', heal:'KeyQ', pickup:'KeyE',
};
const BIND_LABELS = {
  moveForward:'Move Forward',
  moveBack:'Move Back',
  moveLeft:'Move Left',
  moveRight:'Move Right',
  jump:'Jump',
  sprint:'Sprint',
  slide:'Slide / Crouch',
  shoot:'Shoot',
  ads:'Aim Down Sights',
  reload:'Reload',
  weapon1:'Primary Weapon',
  weapon2:'Secondary Weapon',
  ability:'Armour Ability',
  heal:'Heal',
  pickup:'Interact / Pick Up',
};
function loadBinds() {
  try { return { ...DEFAULT_BINDS, ...JSON.parse(localStorage.getItem('arenaKeybinds') || '{}') }; }
  catch { return { ...DEFAULT_BINDS }; }
}
function saveLocalBinds() { localStorage.setItem('arenaKeybinds', JSON.stringify(currentBinds)); }
function codeLabel(c) {
  if (!c) return '?';
  if (c === 'Mouse0') return 'MOUSE 1';
  if (c === 'Mouse1') return 'MOUSE 3';
  if (c === 'Mouse2') return 'MOUSE 2';
  if (c === 'Mouse3') return 'MOUSE 4';
  if (c === 'Mouse4') return 'MOUSE 5';
  return c.replace('Key','').replace('Digit','')
    .replace('ShiftLeft','L-SHIFT').replace('ShiftRight','R-SHIFT')
    .replace('Space','SPACE').replace('ControlLeft','L-CTRL').replace('ControlRight','R-CTRL')
    .replace('AltLeft','L-ALT').replace('AltRight','R-ALT')
    .replace('Tab','TAB').replace('CapsLock','CAPS').toUpperCase();
}
let currentBinds = loadBinds();
const kbGrid = document.getElementById('kb-grid');

const KB_CATEGORIES = [
  { label: 'Movement', actions: ['moveForward','moveBack','moveLeft','moveRight','jump','sprint','slide'] },
  { label: 'Combat', actions: ['shoot','ads','reload','weapon1','weapon2'] },
  { label: 'Abilities', actions: ['ability','heal','pickup'] },
];

function renderKb() {
  kbGrid.innerHTML = '';
  for (const cat of KB_CATEGORIES) {
    const header = document.createElement('div');
    header.className = 'halo-kb-category';
    header.textContent = cat.label;
    kbGrid.appendChild(header);
    const spacer = document.createElement('div');
    spacer.className = 'halo-kb-category-spacer';
    kbGrid.appendChild(spacer);

    for (const action of cat.actions) {
      const code = currentBinds[action];
      if (code === undefined) continue;
      const lbl = document.createElement('div');
      lbl.className = 'halo-kb-action';
      lbl.textContent = BIND_LABELS[action] || action;
      kbGrid.appendChild(lbl);
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'halo-kb-key';
      if (listeningKb === action) { box.classList.add('listening'); box.textContent = 'PRESS KEY / CLICK...'; }
      else box.textContent = codeLabel(code);
      box.onclick = () => { listeningKb = action; renderKb(); };
      kbGrid.appendChild(box);
    }
  }
}
renderKb();
document.getElementById('open-kb').onclick = () => { renderKb(); kbOverlay.classList.add('show'); };
document.getElementById('kb-close').onclick = () => kbOverlay.classList.remove('show');
document.getElementById('kb-reset').onclick = () => { currentBinds = { ...DEFAULT_BINDS }; saveLocalBinds(); renderKb(); };
document.getElementById('kb-save').onclick  = () => { saveLocalBinds(); kbOverlay.classList.remove('show'); toast('Keybinds saved', 'success'); };

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
  document.getElementById('social-sidebar').classList.add('open');
  refreshFriends();
};
// Showcase plus buttons → open social sidebar
document.getElementById('showcase-plus-left').onclick = () => {
  document.getElementById('social-sidebar').classList.add('open');
  refreshFriends();
};
document.getElementById('showcase-plus-right').onclick = () => {
  document.getElementById('social-sidebar').classList.add('open');
  refreshFriends();
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
      <div class="halo-list-row-top">
        ${avatarHTML(u, u.online)}
        <div class="halo-list-meta">
          <div class="halo-list-name">${escapeHtml(u.username)}</div>
          <div class="halo-list-sub">${u.online ? 'Online' : 'Offline'} · ${u.elo} ELO</div>
        </div>
      </div>
      ${actions ? `<div class="halo-list-actions">${actions}</div>` : ''}
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
      // Send a party invite to the friend via Convex
      try {
        await convex.mutation(api.parties.invite, { targetUsername: btn.dataset.name });
        toast(`Invite sent to ${btn.dataset.name}`, 'success');
      } catch (err) {
        toast(err.message?.replace(/^.*Error: /, '') || 'Invite failed', 'error');
      }
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
  // Update center showcase
  const showcaseName = document.getElementById('showcase-name');
  const showcaseInitial = document.getElementById('showcase-initial');
  if (showcaseName) showcaseName.textContent = name;
  if (showcaseInitial && !document.getElementById('showcase-avatar').querySelector('img')) {
    showcaseInitial.textContent = name.slice(0, 1).toUpperCase();
  }
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
    document.getElementById('showcase-avatar').innerHTML = `<img src="${auth.user.imageUrl}" alt="">`;
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

// ── Party system — poll for invites & party state ─────
let currentPartyId = null;
let currentInviteId = null;

async function pollParty() {
  const convex = getConvex();
  if (!convex) return;
  try {
    // Check for incoming invites
    const invites = await convex.query(api.parties.myInvites, {});
    const notif = document.getElementById('invite-notification');
    if (invites.length > 0 && !currentInviteId) {
      const inv = invites[0];
      currentInviteId = inv.inviteId;
      document.getElementById('invite-notif-text').textContent = `${inv.fromUsername} invited you to party`;
      notif.style.display = 'flex';
    } else if (invites.length === 0) {
      currentInviteId = null;
      notif.style.display = 'none';
    }

    // Check party state
    const party = await convex.query(api.parties.myParty, {});
    const leaveBtn = document.getElementById('leave-room-btn');
    const readyBtn = document.getElementById('ready-btn');
    const plusLeft = document.getElementById('showcase-plus-left');
    const plusRight = document.getElementById('showcase-plus-right');
    const myName = localStorage.getItem('arenaPlayerName') || '';

    if (party && party.members.length > 1) {
      currentPartyId = party.partyId;
      leaveBtn.style.display = 'block';

      const others = party.members.filter(m => m.username !== myName);
      const showcase = document.getElementById('player-showcase');
      const crownEl = document.getElementById('showcase-crown');
      const readyMembers = party.readyMembers || [];

      // Determine if I'm the leader (host)
      const meEntry = party.members.find(m => m.username === myName);
      const iAmLeader = meEntry && meEntry.userId === party.hostId;
      const iAmReady = meEntry && readyMembers.includes(meEntry.userId);

      // Show crown on my card if I'm the leader
      if (crownEl) crownEl.style.display = iAmLeader ? 'block' : 'none';

      // Hide Drop In for non-leaders; show ready button instead
      const playBtn = document.getElementById('btn-play');
      if (iAmLeader) {
        readyBtn.style.display = 'none';
        playBtn.style.display = '';
      } else {
        readyBtn.style.display = 'block';
        readyBtn.textContent = iAmReady ? '✕ Cancel' : 'Ready Up';
        readyBtn.classList.toggle('is-ready', iAmReady);
        playBtn.style.display = 'none';
        const tag = document.getElementById('showcase-tag');
        if (tag) tag.textContent = iAmReady ? 'Ready for combat' : 'Standing by';
      }

      // Auto-redirect non-leaders when leader starts the match
      if (!iAmLeader && party.matchCode) {
        location.href = `/pvp/?code=${party.matchCode}`;
        return;
      }

      // Check if all non-host members are ready (for leader's Drop In button)
      const nonHostMembers = party.members.filter(m => m.userId !== party.hostId);
      const allReady = nonHostMembers.length > 0 && nonHostMembers.every(m => readyMembers.includes(m.userId));
      if (iAmLeader && !allReady) {
        playBtn.style.opacity = '0.4';
        playBtn.title = 'Waiting for party members to ready up';
      } else {
        playBtn.style.opacity = '1';
        playBtn.title = '';
      }

      // Build a fingerprint to detect if members changed (avoid DOM rebuild flicker)
      const slotFingerprint = others.map(m => m.userId).join(',');
      const existingSlots = document.querySelectorAll('.party-slot');
      const existingFingerprint = Array.from(existingSlots).map(el => el.dataset.userId || '').join(',');

      if (slotFingerprint !== existingFingerprint) {
        // Members changed — rebuild slots
        existingSlots.forEach(el => el.remove());

        others.forEach((m, i) => {
          const side = i === 0 ? 'left' : 'right';
          const plusBtn = i === 0 ? plusLeft : plusRight;
          if (plusBtn) plusBtn.style.display = 'none';

          const isLeader = m.userId === party.hostId;
          const memberReady = readyMembers.includes(m.userId);
          const slot = document.createElement('div');
          slot.className = `party-slot ${side}`;
          slot.dataset.userId = m.userId;
          slot.innerHTML = `
            <div class="party-slot-avatar" style="position:relative;">
              ${isLeader ? '<span class="leader-crown">👑</span>' : ''}
              ${m.avatarUrl
                ? `<img src="${m.avatarUrl}" alt="">`
                : `<span class="ps-initial">${(m.username || '?').slice(0,1).toUpperCase()}</span>`
              }
            </div>
            <div class="party-slot-name">${escapeHtml(m.username)}</div>
            <div class="party-slot-tag">${isLeader ? '★ LEADER · ' : ''}${m.elo} ELO</div>
            ${!isLeader ? `<div class="party-slot-ready ${memberReady ? 'is-ready' : 'not-ready'}">${memberReady ? '✓ READY' : '○ NOT READY'}</div>` : ''}
          `;
          showcase.appendChild(slot);
        });
      } else {
        // Same members — just update ready status text in place (no flicker)
        existingSlots.forEach(el => {
          const uid = el.dataset.userId;
          const m = others.find(o => o.userId === uid);
          if (!m) return;
          const isLeader = m.userId === party.hostId;
          if (isLeader) return;
          const readyEl = el.querySelector('.party-slot-ready');
          if (!readyEl) return;
          const memberReady = readyMembers.includes(m.userId);
          readyEl.className = `party-slot-ready ${memberReady ? 'is-ready' : 'not-ready'}`;
          readyEl.textContent = memberReady ? '✓ READY' : '○ NOT READY';
        });
      }

      // Hide remaining + if both slots filled
      if (others.length >= 2) {
        if (plusLeft) plusLeft.style.display = 'none';
        if (plusRight) plusRight.style.display = 'none';
      } else if (others.length === 1) {
        const remainingPlus = others[0] ? plusRight : plusLeft;
        if (remainingPlus) remainingPlus.style.display = 'flex';
      }
    } else {
      currentPartyId = null;
      leaveBtn.style.display = 'none';
      readyBtn.style.display = 'none';
      // Remove party slots
      document.querySelectorAll('.party-slot').forEach(el => el.remove());
      // Reset play button
      const playBtn = document.getElementById('btn-play');
      playBtn.style.opacity = '1';
      playBtn.style.display = '';
      playBtn.title = '';
      // Hide crown when not in a party
      const crownEl = document.getElementById('showcase-crown');
      if (crownEl) crownEl.style.display = 'none';
      // Show both + icons again
      if (plusLeft) plusLeft.style.display = 'flex';
      if (plusRight) plusRight.style.display = 'flex';
    }
  } catch (e) { /* silent */ }
}

// Accept/decline invite buttons
document.getElementById('invite-accept-btn').onclick = async () => {
  if (!currentInviteId) return;
  const convex = getConvex();
  if (!convex) return;
  try {
    await convex.mutation(api.parties.acceptInvite, { inviteId: currentInviteId });
    toast('Joined party!', 'success');
    currentInviteId = null;
    document.getElementById('invite-notification').style.display = 'none';
    pollParty();
  } catch (e) { toast(e.message?.replace(/^.*Error: /, '') || 'Failed', 'error'); }
};

document.getElementById('invite-decline-btn').onclick = async () => {
  if (!currentInviteId) return;
  const convex = getConvex();
  if (!convex) return;
  try {
    await convex.mutation(api.parties.declineInvite, { inviteId: currentInviteId });
    currentInviteId = null;
    document.getElementById('invite-notification').style.display = 'none';
  } catch (e) { /* silent */ }
};

// Leave room button
document.getElementById('leave-room-btn').onclick = async () => {
  const convex = getConvex();
  if (!convex) return;
  try {
    await convex.mutation(api.parties.leave, {});
    toast('Left the room');
    pollParty();
  } catch (e) { toast('Failed to leave', 'error'); }
};

// Ready button toggle
let myReadyState = false;
function playReadySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    g.connect(ctx.destination);
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 660;
    o1.connect(g); o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.1);
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 880;
    o2.connect(g); o2.start(ctx.currentTime + 0.08); o2.stop(ctx.currentTime + 0.2);
    const o3 = ctx.createOscillator();
    o3.type = 'sine'; o3.frequency.value = 1100;
    o3.connect(g); o3.start(ctx.currentTime + 0.15); o3.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
}
function playCancelSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    g.connect(ctx.destination);
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 550;
    o1.connect(g); o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.1);
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 380;
    o2.connect(g); o2.start(ctx.currentTime + 0.07); o2.stop(ctx.currentTime + 0.18);
  } catch (e) { /* silent */ }
}
document.getElementById('ready-btn').onclick = async () => {
  const convex = getConvex();
  if (!convex) return;
  myReadyState = !myReadyState;
  const btn = document.getElementById('ready-btn');
  const tag = document.getElementById('showcase-tag');
  if (myReadyState) {
    playReadySound();
    btn.textContent = '✕ Cancel';
    btn.classList.add('is-ready');
    if (tag) tag.textContent = 'Ready for combat';
  } else {
    playCancelSound();
    btn.textContent = 'Ready Up';
    btn.classList.remove('is-ready');
    if (tag) tag.textContent = 'Standing by';
  }
  // Pop animation
  btn.classList.remove('pop');
  void btn.offsetWidth; // reflow to restart animation
  btn.classList.add('pop');
  try {
    await convex.mutation(api.parties.setReady, { ready: myReadyState });
    pollParty();
  } catch (e) {
    myReadyState = !myReadyState;
    btn.textContent = myReadyState ? '✕ Cancel' : 'Ready Up';
    btn.classList.toggle('is-ready', myReadyState);
    toast('Failed to update ready state', 'error');
  }
};

// Poll every 3 seconds for party updates
setInterval(pollParty, 3000);
// Initial poll after auth loads
setTimeout(pollParty, 2000);
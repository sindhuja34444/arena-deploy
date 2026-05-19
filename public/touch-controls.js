/**
 * ARENA FPS — Mobile Touch Controls
 * Auto-detects touch devices. Does nothing on desktop.
 */
(function() {
  'use strict';

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouchDevice) return;

  // Force viewport for mobile
  let vpMeta = document.querySelector('meta[name="viewport"]');
  if (vpMeta) {
    vpMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  }

  // Prevent zoom/scroll
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
  document.addEventListener('gesturechange', function(e) { e.preventDefault(); });

  // ─── INJECT CSS ─────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    html, body { overflow: hidden !important; position: fixed !important; width: 100% !important; height: 100% !important; }

    #touch-ui {
      position: fixed; inset: 0; z-index: 900;
      pointer-events: none;
    }
    #touch-ui > * { pointer-events: auto; }

    .tu-joy-area {
      position: absolute; bottom: 10px; left: 10px;
      width: 160px; height: 160px;
      border-radius: 50%;
      background: rgba(255,255,255,0.03);
      border: 1.5px solid rgba(255,255,255,0.1);
      touch-action: none;
    }
    .tu-joy-knob {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%);
      width: 56px; height: 56px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      border: 2px solid rgba(255,255,255,0.35);
    }

    .tu-look-area {
      position: absolute; top: 0; right: 0;
      width: 60%; height: 65%;
      touch-action: none;
    }

    .tu-btn {
      position: absolute;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Courier New', monospace;
      user-select: none; -webkit-user-select: none;
      touch-action: none;
    }

    .tu-fire {
      bottom: 24px; right: 20px;
      width: 72px; height: 72px;
      background: rgba(255,50,50,0.15);
      border: 2.5px solid rgba(255,50,50,0.6);
      font-size: 10px; letter-spacing: 2px; color: rgba(255,80,80,0.9);
    }
    .tu-fire.pressed { background: rgba(255,50,50,0.45); transform: scale(0.9); }

    .tu-ads {
      bottom: 110px; right: 20px;
      width: 52px; height: 52px;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.25);
      font-size: 14px;
    }
    .tu-ads.pressed { background: rgba(68,170,255,0.3); border-color: #44aaff; }

    .tu-jump {
      bottom: 110px; right: 84px;
      width: 48px; height: 48px;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.2);
      font-size: 13px;
    }
    .tu-jump.pressed { background: rgba(255,255,255,0.2); }

    .tu-reload {
      bottom: 180px; right: 50px;
      width: 40px; height: 40px;
      background: rgba(255,200,0,0.06);
      border: 1.5px solid rgba(255,200,0,0.3);
      font-size: 9px; color: rgba(255,200,0,0.8);
    }

    .tu-slide {
      bottom: 24px; left: 180px;
      width: 44px; height: 44px;
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(255,255,255,0.2);
      font-size: 8px; color: rgba(255,255,255,0.6);
    }

    .tu-pause {
      top: 10px; right: 10px;
      width: 36px; height: 36px;
      background: rgba(0,0,0,0.5);
      border: 1.5px solid rgba(255,255,255,0.3);
      font-size: 14px; color: #fff;
      z-index: 910;
    }

    .tu-weps {
      position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 4px;
    }
    .tu-wep {
      width: 38px; height: 30px; border-radius: 4px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; color: rgba(255,255,255,0.6);
      font-family: 'Courier New', monospace;
      touch-action: none; user-select: none;
    }
    .tu-wep.sel { border-color: rgba(200,80,80,0.7); color: #fff; background: rgba(200,80,80,0.12); }

    /* Pause overlay */
    .tu-pause-overlay {
      position: fixed; inset: 0; z-index: 2000;
      display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 14px;
      background: rgba(0,0,0,0.85);
      font-family: 'Courier New', monospace;
    }
    .tu-pause-overlay.open { display: flex; }
    .tu-pause-overlay h2 { font-size: 24px; letter-spacing: 6px; color: #fff; margin-bottom: 20px; }
    .tu-pause-btn {
      background: transparent; border: 1px solid rgba(255,255,255,0.3);
      color: #fff; font-family: 'Courier New', monospace;
      font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
      padding: 12px 40px; width: 220px; text-align: center;
      touch-action: none; user-select: none;
    }
    .tu-pause-btn.red { border-color: rgba(255,60,60,0.4); color: rgba(255,100,100,0.85); }

    /* Mobile HUD scaling */
    @media (max-width: 900px), (pointer: coarse) {
      #lock-overlay { display: none !important; }
      #minimap-wrap { width: 90px !important; height: 90px !important; top: 6px !important; left: 6px !important; }
      #minimap { width: 90px !important; height: 90px !important; }

      /* Move health/shield stacked above inventory at bottom center */
      #hud { 
        position: fixed !important;
        bottom: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        flex-direction: column !important; 
        align-items: center !important; 
        padding: 0 !important;
        gap: 2px !important;
        width: auto !important;
        right: auto !important;
      }
      #health-block {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        align-items: center !important;
        order: -1 !important;
      }
      .stat-row { gap: 4px !important; }
      .stat-bar-outer { width: 130px !important; height: 14px !important; }
      .stat-bar-text { font-size: 9px !important; padding: 0 4px !important; }
      .stat-icon { font-size: 11px !important; width: 12px !important; }

      /* Keep inventory visible, tappable, below health bars */
      #inventory {
        display: flex !important;
        position: relative !important;
        bottom: auto !important;
        left: auto !important;
        transform: none !important;
        gap: 4px !important;
        margin-top: 2px !important;
      }
      .inv-slot {
        width: 64px !important; height: 38px !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      .inv-slot svg, .inv-slot img { width: 56px !important; height: 26px !important; }
      .inv-key { display: none !important; }
      .inv-label { display: none !important; }

      /* Hide ability slot and score on mobile */
      #ability-slot { display: none !important; }
      #score-block { 
        position: fixed !important;
        top: 6px !important;
        right: 50px !important;
        font-size: 10px !important;
      }
      #points-num { font-size: 18px !important; }
      #kills-num { font-size: 14px !important; }
      #points-label, #kills-label { font-size: 7px !important; }

      #top-bar { top: 6px !important; gap: 10px !important; }
      #top-bar * { font-size: 10px !important; }
      #killfeed { bottom: auto !important; top: 40px !important; right: 6px !important; }
      .kill-entry { font-size: 8px !important; padding: 2px 5px !important; }
      #ammo-row { 
        position: fixed !important;
        bottom: 50px !important;
        right: 20px !important;
        z-index: 50 !important;
      }
      #crosshair { width: 20px !important; height: 20px !important; }

      /* Hide the touch weapon buttons since inventory is tappable */
      .tu-weps { display: none !important; }
    }
  `;
  document.head.appendChild(css);

  // ─── BUILD UI ───────────────────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.innerHTML = `
    <div class="tu-joy-area" id="tu-joy"><div class="tu-joy-knob" id="tu-knob"></div></div>
    <div class="tu-look-area" id="tu-look"></div>
    <div class="tu-btn tu-fire" id="tu-fire">FIRE</div>
    <div class="tu-btn tu-ads" id="tu-ads">🎯</div>
    <div class="tu-btn tu-jump" id="tu-jump">⬆</div>
    <div class="tu-btn tu-reload" id="tu-reload">R</div>
    <div class="tu-btn tu-slide" id="tu-slide">⬇</div>
    <div class="tu-btn tu-pause" id="tu-pause">⏸</div>
  `;
  document.body.appendChild(ui);

  // Pause overlay
  const pauseOvl = document.createElement('div');
  pauseOvl.className = 'tu-pause-overlay';
  pauseOvl.innerHTML = `<h2>PAUSED</h2><div class="tu-pause-btn" id="tu-resume">▶ RESUME</div><div class="tu-pause-btn red" id="tu-leave">✕ LEAVE MATCH</div>`;
  document.body.appendChild(pauseOvl);

  // ─── HELPERS ────────────────────────────────────────────────────────────
  function getState() { return (typeof state !== 'undefined') ? state : null; }
  function getKB() { return window.KB || { moveForward:'KeyW', moveBack:'KeyS', moveLeft:'KeyA', moveRight:'KeyD', jump:'Space', sprint:'ShiftLeft', reload:'KeyR', slide:'KeyX', weapon1:'Digit1', weapon2:'Digit2' }; }

  // ─── JOYSTICK ───────────────────────────────────────────────────────────
  const joyEl = document.getElementById('tu-joy');
  const knob = document.getElementById('tu-knob');
  let joyId = null, joyCX = 0, joyCY = 0;

  joyEl.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const r = joyEl.getBoundingClientRect();
    joyCX = r.left + r.width/2;
    joyCY = r.top + r.height/2;
    moveJoy(t.clientX, t.clientY);
  });

  function moveJoy(x, y) {
    const dx = x - joyCX, dy = y - joyCY;
    const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 60);
    const a = Math.atan2(dy, dx);
    const kx = Math.cos(a)*dist, ky = Math.sin(a)*dist;
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const mag = dist/60;
    const nx = Math.cos(a)*mag, ny = Math.sin(a)*mag;
    const s = getState(); if (!s) return;
    const kb = getKB();
    s.keys[kb.moveForward] = ny < -0.25;
    s.keys[kb.moveBack] = ny > 0.25;
    s.keys[kb.moveLeft] = nx < -0.25;
    s.keys[kb.moveRight] = nx > 0.25;
    s.keys[kb.sprint] = mag > 0.85;
  }

  function resetJoy() {
    knob.style.transform = 'translate(-50%,-50%)';
    const s = getState(); if (!s) return;
    const kb = getKB();
    s.keys[kb.moveForward] = false;
    s.keys[kb.moveBack] = false;
    s.keys[kb.moveLeft] = false;
    s.keys[kb.moveRight] = false;
    s.keys[kb.sprint] = false;
  }

  // ─── LOOK ──────────────────────────────────────────────────────────────
  const lookEl = document.getElementById('tu-look');
  let lookId = null, lx = 0, ly = 0;

  lookEl.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    lookId = t.identifier;
    lx = t.clientX; ly = t.clientY;
  });

  // ─── GLOBAL TOUCH MOVE/END ──────────────────────────────────────────────
  document.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) moveJoy(t.clientX, t.clientY);
      if (t.identifier === lookId) {
        const s = getState(); if (!s) continue;
        s.yaw -= (t.clientX - lx) * 0.003;
        s.pitch -= (t.clientY - ly) * 0.003;
        s.pitch = Math.max(-1.4, Math.min(1.4, s.pitch));
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; resetJoy(); }
      if (t.identifier === lookId) { lookId = null; }
    }
  });
  document.addEventListener('touchcancel', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; resetJoy(); }
      if (t.identifier === lookId) { lookId = null; }
    }
  });

  // ─── BUTTONS ────────────────────────────────────────────────────────────
  function btn(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('pressed'); onDown(); });
    el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('pressed'); if (onUp) onUp(); });
    el.addEventListener('touchcancel', e => { el.classList.remove('pressed'); if (onUp) onUp(); });
  }

  // Fire
  let fireInt = null;
  btn('tu-fire',
    () => {
      const s = getState(); if (s) s.mouseButtons[0] = true;
      if (typeof shoot === 'function') shoot();
      fireInt = setInterval(() => { if (typeof shoot === 'function' && typeof currentWeapon !== 'undefined' && currentWeapon.auto) shoot(); }, 90);
    },
    () => {
      const s = getState(); if (s) s.mouseButtons[0] = false;
      clearInterval(fireInt);
    }
  );

  // ADS
  btn('tu-ads',
    () => { const s = getState(); if (s) s.mouseButtons[2] = true; },
    () => { const s = getState(); if (s) s.mouseButtons[2] = false; }
  );

  // Jump
  btn('tu-jump',
    () => { const s = getState(); if (s) s.keys[getKB().jump] = true; },
    () => { const s = getState(); if (s) s.keys[getKB().jump] = false; }
  );

  // Reload (tap)
  btn('tu-reload', () => {
    const s = getState(); if (s) { s.keys[getKB().reload] = true; setTimeout(() => s.keys[getKB().reload] = false, 120); }
  });

  // Slide
  btn('tu-slide',
    () => { const s = getState(); if (s) s.keys[getKB().slide] = true; },
    () => { const s = getState(); if (s) s.keys[getKB().slide] = false; }
  );

  // ─── INVENTORY TAP TO SWITCH ────────────────────────────────────────────
  // Make inventory slots tappable on mobile to switch weapons
  setTimeout(() => {
    const slot1 = document.getElementById('inv-slot-1');
    const slot2 = document.getElementById('inv-slot-2');
    if (slot1) {
      slot1.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const s = getState(); if (s) { s.keys[getKB().weapon1] = true; setTimeout(() => s.keys[getKB().weapon1] = false, 120); }
      });
    }
    if (slot2) {
      slot2.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const s = getState(); if (s) { s.keys[getKB().weapon2] = true; setTimeout(() => s.keys[getKB().weapon2] = false, 120); }
      });
    }
  }, 1000);

  // ─── PAUSE ──────────────────────────────────────────────────────────────
  btn('tu-pause', () => {
    pauseOvl.classList.add('open');
    ui.style.display = 'none';
    const s = getState(); if (s) { s.keys = {}; s.mouseButtons = {}; }
  });

  document.getElementById('tu-resume').addEventListener('touchstart', e => {
    e.preventDefault();
    pauseOvl.classList.remove('open');
    ui.style.display = 'block';
  });

  document.getElementById('tu-leave').addEventListener('touchstart', e => {
    e.preventDefault();
    window.location.href = '/menu/';
  });

  // ─── POINTER LOCK OVERRIDE ──────────────────────────────────────────────
  // Mobile doesn't use pointer lock — fake it so game logic works
  HTMLElement.prototype.requestPointerLock = function() {};
  Object.defineProperty(document, 'pointerLockElement', {
    get() {
      const s = getState();
      return (s && s.running) ? document.getElementById('canvas') : null;
    },
    configurable: true
  });

  // Hide lock overlay
  setTimeout(() => {
    const lo = document.getElementById('lock-overlay');
    if (lo) lo.style.display = 'none';
  }, 300);

  console.log('[ARENA] Touch controls active');
})();

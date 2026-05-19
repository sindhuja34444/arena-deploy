/**
 * ARENA FPS — Mobile Touch Controls
 * 
 * Drop-in module that detects touch devices and overlays virtual controls.
 * Feeds into the existing state.keys / state.mouseButtons / state.yaw / state.pitch system.
 * 
 * Usage: Include this script after the game script. It auto-initializes on touch devices.
 * On desktop, it does nothing.
 */
(function() {
  'use strict';

  // Only activate on touch devices
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouchDevice) return;

  // Prevent default touch behaviors (scroll, zoom)
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  // ─── CSS ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #touch-controls {
      position: fixed; inset: 0; z-index: 1000;
      pointer-events: none;
      display: block;
    }
    #touch-controls * { pointer-events: auto; }

    /* Left joystick */
    .tc-joystick-zone {
      position: absolute; bottom: 20px; left: 20px;
      width: 180px; height: 180px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      border: 2px solid rgba(255,255,255,0.12);
    }
    .tc-joystick-base {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 80px; height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 2px solid rgba(255,255,255,0.2);
    }
    .tc-joystick-thumb {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 50px; height: 50px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      border: 2px solid rgba(255,255,255,0.4);
      transition: none;
    }

    /* Right look zone (invisible, covers right half) */
    .tc-look-zone {
      position: absolute; top: 0; right: 0;
      width: 55%; height: 70%;
      /* No visual — just captures touch for camera */
    }

    /* Fire button */
    .tc-btn-fire {
      position: absolute; bottom: 60px; right: 30px;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: rgba(255,60,60,0.2);
      border: 3px solid rgba(255,60,60,0.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; letter-spacing: 2px; color: rgba(255,100,100,0.9);
      font-family: 'Courier New', monospace; text-transform: uppercase;
      user-select: none; -webkit-user-select: none;
    }
    .tc-btn-fire.active {
      background: rgba(255,60,60,0.5);
      border-color: #ff4444;
      transform: scale(0.92);
    }

    /* ADS button */
    .tc-btn-ads {
      position: absolute; bottom: 160px; right: 30px;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 2px solid rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      user-select: none; -webkit-user-select: none;
    }
    .tc-btn-ads.active {
      background: rgba(68,170,255,0.3);
      border-color: #44aaff;
    }

    /* Jump button */
    .tc-btn-jump {
      position: absolute; bottom: 160px; right: 100px;
      width: 52px; height: 52px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 2px solid rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      user-select: none; -webkit-user-select: none;
    }
    .tc-btn-jump.active {
      background: rgba(255,255,255,0.2);
      border-color: #fff;
    }

    /* Reload button */
    .tc-btn-reload {
      position: absolute; bottom: 230px; right: 60px;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(255,204,0,0.08);
      border: 2px solid rgba(255,204,0,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; letter-spacing: 1px; color: rgba(255,204,0,0.8);
      font-family: 'Courier New', monospace;
      user-select: none; -webkit-user-select: none;
    }

    /* Weapon switch buttons */
    .tc-weapons {
      position: absolute; bottom: 8px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 6px;
    }
    .tc-btn-weapon {
      width: 44px; height: 36px;
      border-radius: 4px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; letter-spacing: 1px; color: rgba(255,255,255,0.6);
      font-family: 'Courier New', monospace;
      user-select: none; -webkit-user-select: none;
    }
    .tc-btn-weapon.active {
      border-color: rgba(200,80,80,0.7);
      background: rgba(200,80,80,0.15);
      color: #fff;
    }

    /* Slide button */
    .tc-btn-slide {
      position: absolute; bottom: 60px; left: 210px;
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 2px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; color: rgba(255,255,255,0.6);
      font-family: 'Courier New', monospace;
      user-select: none; -webkit-user-select: none;
    }

    /* Sprint indicator on joystick edge */
    .tc-sprint-ring {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 160px; height: 160px;
      border-radius: 50%;
      border: 1px dashed rgba(255,255,255,0.1);
      pointer-events: none;
    }

    /* Hide desktop-only elements on mobile */
    @media (pointer: coarse) {
      #lock-overlay { display: none !important; }
      #pause-overlay .pause-sub { display: none; }
    }

    /* Pause button (top-right) */
    .tc-btn-pause {
      position: absolute; top: 12px; right: 12px;
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      user-select: none; -webkit-user-select: none;
      z-index: 1001;
    }
    .tc-btn-pause:active {
      background: rgba(255,255,255,0.15);
      border-color: #fff;
    }

    /* Mobile pause menu */
    .tc-pause-menu {
      position: fixed; inset: 0; z-index: 2000;
      display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      background: rgba(0,0,0,0.85);
      font-family: 'Courier New', monospace;
    }
    .tc-pause-menu.show { display: flex; }
    .tc-pause-menu h2 {
      font-size: 28px; letter-spacing: 8px; color: #fff;
      text-transform: uppercase; margin-bottom: 24px;
    }
    .tc-pause-menu-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff; font-family: 'Courier New', monospace;
      font-size: 14px; letter-spacing: 3px; text-transform: uppercase;
      padding: 14px 48px; cursor: pointer; width: 240px; text-align: center;
      user-select: none; -webkit-user-select: none;
    }
    .tc-pause-menu-btn:active {
      background: rgba(255,255,255,0.1);
      border-color: #fff;
    }
    .tc-pause-menu-btn.danger {
      border-color: rgba(255,60,60,0.4);
      color: rgba(255,100,100,0.85);
    }
    .tc-pause-menu-btn.danger:active {
      background: rgba(255,40,40,0.1);
      border-color: #ff4444;
    }

    /* Scale HUD for mobile */
    @media (max-width: 768px) {
      #minimap-wrap { width: 100px !important; height: 100px !important; top: 8px !important; left: 8px !important; }
      #minimap { width: 100px !important; height: 100px !important; }
      #hud { padding: 0 12px !important; bottom: 100px !important; }
      .stat-bar-outer { width: 140px !important; height: 20px !important; }
      .stat-bar-text { font-size: 11px !important; }
      #inventory { display: none !important; }
      #ability-slot { display: none !important; }
      #score-block { display: none !important; }
      #top-bar { top: 8px !important; }
      #killfeed { bottom: auto !important; top: 50px !important; right: 8px !important; }
      .kill-entry { font-size: 9px !important; padding: 3px 6px !important; }
    }
  `;
  document.head.appendChild(style);

  // ─── HTML ───────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'touch-controls';
  container.innerHTML = `
    <div class="tc-btn-pause" id="tc-pause">⏸</div>
    <div class="tc-joystick-zone" id="tc-joy-zone">
      <div class="tc-sprint-ring"></div>
      <div class="tc-joystick-base">
        <div class="tc-joystick-thumb" id="tc-joy-thumb"></div>
      </div>
    </div>
    <div class="tc-look-zone" id="tc-look-zone"></div>
    <div class="tc-btn-fire" id="tc-fire">FIRE</div>
    <div class="tc-btn-ads" id="tc-ads">🎯</div>
    <div class="tc-btn-jump" id="tc-jump">⬆</div>
    <div class="tc-btn-reload" id="tc-reload">R</div>
    <div class="tc-btn-slide" id="tc-slide">⬇</div>
    <div class="tc-weapons">
      <div class="tc-btn-weapon active" id="tc-wep1">1</div>
      <div class="tc-btn-weapon" id="tc-wep2">2</div>
    </div>
  `;
  document.body.appendChild(container);

  // ─── PAUSE MENU ─────────────────────────────────────────────────────────
  const pauseMenu = document.createElement('div');
  pauseMenu.className = 'tc-pause-menu';
  pauseMenu.innerHTML = `
    <h2>Paused</h2>
    <div class="tc-pause-menu-btn" id="tc-resume-btn">▶ Resume</div>
    <div class="tc-pause-menu-btn danger" id="tc-leave-btn">✕ Leave Match</div>
  `;
  document.body.appendChild(pauseMenu);

  let tcPaused = false;
  const pauseBtn = document.getElementById('tc-pause');
  const resumeBtn = document.getElementById('tc-resume-btn');
  const leaveBtn = document.getElementById('tc-leave-btn');

  pauseBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    tcPaused = true;
    pauseMenu.classList.add('show');
    container.style.display = 'none';
    if (typeof gamePaused !== 'undefined') window.gamePaused = true;
    if (typeof state !== 'undefined') {
      state.keys = {};
      state.mouseButtons = {};
    }
  });

  resumeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    tcPaused = false;
    pauseMenu.classList.remove('show');
    container.style.display = 'block';
    if (typeof gamePaused !== 'undefined') window.gamePaused = false;
  });

  leaveBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    window.location.href = '/menu/';
  });

  // ─── STATE ──────────────────────────────────────────────────────────────
  const joyZone = document.getElementById('tc-joy-zone');
  const joyThumb = document.getElementById('tc-joy-thumb');
  const lookZone = document.getElementById('tc-look-zone');
  const fireBtn = document.getElementById('tc-fire');
  const adsBtn = document.getElementById('tc-ads');
  const jumpBtn = document.getElementById('tc-jump');
  const reloadBtn = document.getElementById('tc-reload');
  const slideBtn = document.getElementById('tc-slide');
  const wep1Btn = document.getElementById('tc-wep1');
  const wep2Btn = document.getElementById('tc-wep2');

  let joyTouchId = null;
  let lookTouchId = null;
  let joyCenter = { x: 0, y: 0 };
  let lastLookPos = { x: 0, y: 0 };

  const LOOK_SENSITIVITY = 0.004;
  const JOY_RADIUS = 60;
  const SPRINT_THRESHOLD = 0.85; // joystick pushed > 85% = sprint

  // ─── JOYSTICK ───────────────────────────────────────────────────────────
  joyZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joyTouchId = touch.identifier;
    const rect = joyZone.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystick(touch.clientX, touch.clientY);
  });

  document.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyTouchId) {
        updateJoystick(touch.clientX, touch.clientY);
      }
      if (touch.identifier === lookTouchId) {
        updateLook(touch.clientX, touch.clientY);
      }
    }
  });

  document.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyTouchId) {
        joyTouchId = null;
        resetJoystick();
      }
      if (touch.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  });

  function updateJoystick(tx, ty) {
    const dx = tx - joyCenter.x;
    const dy = ty - joyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOY_RADIUS);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clamped;
    const thumbY = Math.sin(angle) * clamped;
    joyThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

    // Normalize to -1..1
    const nx = (clamped / JOY_RADIUS) * Math.cos(angle);
    const ny = (clamped / JOY_RADIUS) * Math.sin(angle);
    const magnitude = clamped / JOY_RADIUS;

    // Map to WASD keys
    if (typeof state !== 'undefined' && state.keys) {
      const KB = window.KB || { moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', sprint: 'ShiftLeft' };
      state.keys[KB.moveForward] = ny < -0.3;
      state.keys[KB.moveBack] = ny > 0.3;
      state.keys[KB.moveLeft] = nx < -0.3;
      state.keys[KB.moveRight] = nx > 0.3;
      // Sprint when joystick pushed to edge
      state.keys[KB.sprint] = magnitude > SPRINT_THRESHOLD;
    }
  }

  function resetJoystick() {
    joyThumb.style.transform = 'translate(-50%, -50%)';
    if (typeof state !== 'undefined' && state.keys) {
      const KB = window.KB || { moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', sprint: 'ShiftLeft' };
      state.keys[KB.moveForward] = false;
      state.keys[KB.moveBack] = false;
      state.keys[KB.moveLeft] = false;
      state.keys[KB.moveRight] = false;
      state.keys[KB.sprint] = false;
    }
  }

  // ─── LOOK (Camera) ──────────────────────────────────────────────────────
  lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    lookTouchId = touch.identifier;
    lastLookPos = { x: touch.clientX, y: touch.clientY };
  });

  function updateLook(tx, ty) {
    const dx = tx - lastLookPos.x;
    const dy = ty - lastLookPos.y;
    lastLookPos = { x: tx, y: ty };

    if (typeof state !== 'undefined') {
      state.yaw -= dx * LOOK_SENSITIVITY;
      state.pitch -= dy * LOOK_SENSITIVITY;
      state.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, state.pitch));
    }
  }

  // ─── FIRE BUTTON ────────────────────────────────────────────────────────
  let fireInterval = null;

  fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fireBtn.classList.add('active');
    if (typeof state !== 'undefined') state.mouseButtons = state.mouseButtons || {};
    if (typeof state !== 'undefined') state.mouseButtons[0] = true;
    // Trigger first shot
    if (typeof shoot === 'function') shoot();
    // Auto-fire for automatic weapons
    fireInterval = setInterval(() => {
      if (typeof currentWeapon !== 'undefined' && currentWeapon.auto) {
        if (typeof shoot === 'function') shoot();
      }
    }, 80);
  });

  fireBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    fireBtn.classList.remove('active');
    if (typeof state !== 'undefined' && state.mouseButtons) state.mouseButtons[0] = false;
    clearInterval(fireInterval);
  });

  // ─── ADS BUTTON ─────────────────────────────────────────────────────────
  adsBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    adsBtn.classList.add('active');
    if (typeof state !== 'undefined' && state.mouseButtons) state.mouseButtons[2] = true;
  });

  adsBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    adsBtn.classList.remove('active');
    if (typeof state !== 'undefined' && state.mouseButtons) state.mouseButtons[2] = false;
  });

  // ─── JUMP BUTTON ────────────────────────────────────────────────────────
  jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jumpBtn.classList.add('active');
    const KB = window.KB || { jump: 'Space' };
    if (typeof state !== 'undefined') state.keys[KB.jump] = true;
  });

  jumpBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    jumpBtn.classList.remove('active');
    const KB = window.KB || { jump: 'Space' };
    if (typeof state !== 'undefined') state.keys[KB.jump] = false;
  });

  // ─── RELOAD BUTTON ──────────────────────────────────────────────────────
  reloadBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const KB = window.KB || { reload: 'KeyR' };
    if (typeof state !== 'undefined') state.keys[KB.reload] = true;
    setTimeout(() => { if (typeof state !== 'undefined') state.keys[KB.reload] = false; }, 100);
  });

  // ─── SLIDE BUTTON ───────────────────────────────────────────────────────
  slideBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const KB = window.KB || { slide: 'KeyX' };
    if (typeof state !== 'undefined') state.keys[KB.slide] = true;
  });

  slideBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    const KB = window.KB || { slide: 'KeyX' };
    if (typeof state !== 'undefined') state.keys[KB.slide] = false;
  });

  // ─── WEAPON SWITCH ──────────────────────────────────────────────────────
  wep1Btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const KB = window.KB || { weapon1: 'Digit1' };
    if (typeof state !== 'undefined') state.keys[KB.weapon1] = true;
    setTimeout(() => { if (typeof state !== 'undefined') state.keys[KB.weapon1] = false; }, 100);
    wep1Btn.classList.add('active');
    wep2Btn.classList.remove('active');
  });

  wep2Btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const KB = window.KB || { weapon2: 'Digit2' };
    if (typeof state !== 'undefined') state.keys[KB.weapon2] = true;
    setTimeout(() => { if (typeof state !== 'undefined') state.keys[KB.weapon2] = false; }, 100);
    wep2Btn.classList.add('active');
    wep1Btn.classList.remove('active');
  });

  // ─── PREVENT POINTER LOCK ON MOBILE ─────────────────────────────────────
  // Override requestPointerLock to no-op on touch devices
  const origRequestPointerLock = HTMLElement.prototype.requestPointerLock;
  HTMLElement.prototype.requestPointerLock = function() {
    // Skip pointer lock on mobile — touch controls handle input
    return;
  };

  // Make the game think pointer is always locked (so movement/shooting works)
  Object.defineProperty(document, 'pointerLockElement', {
    get: function() {
      if (typeof state !== 'undefined' && state.running) {
        return document.getElementById('canvas');
      }
      return null;
    }
  });

  // ─── AUTO-START ON MOBILE ───────────────────────────────────────────────
  // Hide the lock overlay and start screens that require click-to-lock
  setTimeout(() => {
    const lockOverlay = document.getElementById('lock-overlay');
    if (lockOverlay) lockOverlay.style.display = 'none';
  }, 500);

  console.log('Touch controls initialized');
})();

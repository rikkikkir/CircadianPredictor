// tau-explorer.js — Interactive tau discovery via draggable drift actogram
// Passes 1-5: functional → canvas → draggable thread → sky colors → spring physics
'use strict';
window.CP = window.CP || {};

CP.tauExplorer = (() => {

  // ── State ────────────────────────────────────────────────────────────────────
  const ROWS       = 14;   // days shown
  const ROW_H      = 16;   // px per row
  const LW         = 36;   // left label margin
  const DRAG_RADIUS = 14;  // px hitbox around thread

  let _canvas      = null;
  let _ctx         = null;
  let _sleepH      = 8.0;      // hours of sleep (slider)
  let _targetDrift = 1.0;      // hours/day (drag target)
  let _dispDrift   = 1.0;      // hours/day (spring display value)
  let _velocity    = 0;        // spring velocity
  let _dragging    = false;
  let _dragStartX  = 0;
  let _dragStartDrift = 0;
  let _hasInteracted = false;
  let _animRunning = false;
  let _starPat     = null;
  let _sunCache    = null;     // cached {sunrise, sunset} for today
  let _onApply     = null;     // callback(tau, awakeH)

  // ── Math ─────────────────────────────────────────────────────────────────────
  function tauFromDrift(driftH) { return 24 + driftH; }
  function clamp(v, lo, hi)     { return Math.max(lo, Math.min(hi, v)); }

  // x position of a sleep block's left edge for row i
  function blockX(i, W) {
    return LW + ((_targetDrift * i) % 24) / 24 * (W - LW);
  }

  // x using the spring display value (for smooth animation)
  function blockXDisp(i, W) {
    return LW + ((_dispDrift * i) % 24) / 24 * (W - LW);
  }

  // ── Star tile pattern ─────────────────────────────────────────────────────────
  function buildStarPattern(ctx) {
    const tile = document.createElement('canvas');
    tile.width = 22; tile.height = 22;
    const sc = tile.getContext('2d');
    sc.lineJoin = 'round'; sc.lineCap = 'round';
    const s1 = [[11,3.7],[12.9,8.4],[17.8,8.7],[13.7,12.0],[15.2,16.9],[11,14.2],[6.7,16.7],[8.2,12.1],[4.2,8.9],[9.1,8.5]];
    const s2 = [[10.8,4.1],[12.7,8.7],[17.6,9.1],[13.5,12.3],[15.0,17.1],[10.8,14.5],[6.5,17.0],[8.0,12.4],[4.0,9.2],[8.9,8.8]];
    sc.strokeStyle = 'rgba(140,215,200,0.85)'; sc.lineWidth = 1.15;
    sc.beginPath(); s1.forEach(([x,y],i) => i===0?sc.moveTo(x,y):sc.lineTo(x,y)); sc.closePath(); sc.stroke();
    sc.strokeStyle = 'rgba(140,215,200,0.35)'; sc.lineWidth = 0.7;
    sc.beginPath(); s2.forEach(([x,y],i) => i===0?sc.moveTo(x,y):sc.lineTo(x,y)); sc.closePath(); sc.stroke();
    return ctx.createPattern(tile, 'repeat');
  }

  // ── Canvas draw ───────────────────────────────────────────────────────────────
  function draw() {
    if (!_canvas || !_ctx) return;
    const W = _canvas.width, H = _canvas.height;
    const DW = W - LW;
    const ctx = _ctx;

    // Background
    ctx.fillStyle = '#131820';
    ctx.fillRect(0, 0, W, H);

    const sun = _sunCache || { sunrise: 6, sunset: 20 };

    for (let i = 0; i < ROWS; i++) {
      const y = i * ROW_H;

      // Sky gradient — 0.5h resolution slivers
      const STEP = 0.5;
      for (let h = 0; h < 24; h += STEP) {
        const col = CP.sky.skyColorAt(h + STEP/2, sun.sunrise, sun.sunset);
        ctx.fillStyle = col;
        ctx.fillRect(LW + (h/24)*DW, y, (STEP/24)*DW + 1, ROW_H);
      }

      // Daylight band overlay
      ctx.fillStyle = 'rgba(255,200,60,0.08)';
      ctx.fillRect(LW + (sun.sunrise/24)*DW, y, (sun.sunset-sun.sunrise)/24*DW, ROW_H);

      // Sleep block
      const bx    = blockXDisp(i, W);
      const bw    = Math.max(2, (_sleepH / 24) * DW);

      // Handle wrap-around
      const wrapped = bx + bw > W;
      if (wrapped) {
        const w1 = W - bx, w2 = bw - w1;
        ctx.fillStyle = 'rgba(28,31,74,0.88)';
        ctx.fillRect(bx, y, w1, ROW_H - 1);
        if (_starPat) { ctx.fillStyle = _starPat; ctx.fillRect(bx, y, w1, ROW_H - 1); }
        ctx.fillStyle = 'rgba(28,31,74,0.88)';
        ctx.fillRect(LW, y, w2, ROW_H - 1);
        if (_starPat) { ctx.fillStyle = _starPat; ctx.fillRect(LW, y, w2, ROW_H - 1); }
      } else {
        ctx.fillStyle = 'rgba(28,31,74,0.88)';
        ctx.fillRect(bx, y, bw, ROW_H - 1);
        if (_starPat) { ctx.fillStyle = _starPat; ctx.fillRect(bx, y, bw, ROW_H - 1); }
      }

      // Row date label
      if (i % 2 === 0) {
        const labelDate = new Date(Date.now() - (ROWS - 1 - i) * 86400000);
        const lbl = `${labelDate.getMonth()+1}/${labelDate.getDate()}`;
        ctx.fillStyle = 'rgba(160,154,142,0.7)';
        ctx.font = '8px Inter,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(lbl, LW - 2, y + ROW_H * 0.75);
      }
    }

    // Vertical 6h grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    [0,6,12,18,24].forEach(h => {
      const x = LW + (h/24)*DW;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    });

    // Gold thread — draw with glow when dragging
    const points = [];
    for (let i = 0; i < ROWS; i++) {
      const x = blockXDisp(i, W);
      const y = i * ROW_H + ROW_H * 0.5;
      points.push([x, y]);
    }

    if (_dragging) {
      ctx.save();
      ctx.shadowBlur  = 10;
      ctx.shadowColor = '#c9a84c';
      ctx.strokeStyle = 'rgba(201,168,76,0.4)';
      ctx.lineWidth   = 4;
      ctx.beginPath();
      points.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth   = _dragging ? 2 : 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    points.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    ctx.stroke();

    // Drag handle at bottom of thread
    const [hx, hy] = points[ROWS - 1];
    ctx.beginPath();
    ctx.arc(hx, hy, _dragging ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = _dragging ? '#e8c978' : '#c9a84c';
    ctx.fill();
    if (!_dragging) {
      ctx.strokeStyle = 'rgba(201,168,76,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Hour labels at top
    ctx.fillStyle = 'rgba(160,154,142,0.6)';
    ctx.font = '8px Inter,sans-serif';
    ctx.textAlign = 'center';
    [['Midn',0],['6A',6],['Noon',12],['6P',18]].forEach(([lbl,h]) => {
      ctx.fillText(lbl, LW + (h/24)*DW, H - 3);
    });
  }

  // ── Spring animation loop ─────────────────────────────────────────────────────
  function tick() {
    const STIFFNESS = 0.12;
    const DAMPING   = 0.82;

    const force  = (_targetDrift - _dispDrift) * STIFFNESS;
    _velocity    = (_velocity + force) * DAMPING;
    _dispDrift  += _velocity;

    draw();
    updateReadout();

    const settled = Math.abs(_targetDrift - _dispDrift) < 0.001 && Math.abs(_velocity) < 0.0005;
    if (!settled) {
      requestAnimationFrame(tick);
    } else {
      _dispDrift   = _targetDrift;
      _velocity    = 0;
      _animRunning = false;
      draw();
      updateReadout();
    }
  }

  function startAnim() {
    if (_animRunning) return;
    _animRunning = true;
    requestAnimationFrame(tick);
  }

  // ── Readout update ────────────────────────────────────────────────────────────
  function updateReadout() {
    const tau      = tauFromDrift(_dispDrift);
    const driftMin = Math.round(_dispDrift * 60);
    const tauEl    = document.getElementById('exp-tau-val');
    const driftEl  = document.getElementById('exp-drift-val');
    if (tauEl)   tauEl.textContent  = tau.toFixed(2);
    if (driftEl) driftEl.textContent = driftMin;
  }

  // ── Drag helpers ──────────────────────────────────────────────────────────────
  function getCanvasX(e) {
    const rect = _canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }

  function distToThread(mx) {
    if (!_canvas) return Infinity;
    const W = _canvas.width;
    // Check distance to any point on the thread
    for (let i = 0; i < ROWS; i++) {
      const tx = blockXDisp(i, W);
      if (Math.abs(mx - tx) < DRAG_RADIUS) return i;
    }
    return -1;
  }

  function onPointerDown(e) {
    const mx = getCanvasX(e);
    if (distToThread(mx) >= 0) {
      _dragging      = true;
      _dragStartX    = mx;
      _dragStartDrift = _targetDrift;
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    if (!_dragging) {
      // Cursor hint
      const mx = getCanvasX(e);
      if (_canvas) _canvas.style.cursor = distToThread(mx) >= 0 ? 'ew-resize' : 'default';
      return;
    }
    e.preventDefault();
    const mx = getCanvasX(e);
    const W  = _canvas.width;
    // Δx pixels → Δhours over 13 rows
    const deltaDrift = (mx - _dragStartX) * (24 / (W - LW)) / (ROWS - 1);
    _targetDrift = clamp(_dragStartDrift + deltaDrift, 0, 3.0);

    if (!_hasInteracted) {
      _hasInteracted = true;
      const applyBtn = document.getElementById('exp-apply');
      if (applyBtn) {
        applyBtn.style.opacity    = '1';
        applyBtn.style.transform  = 'translateY(0)';
        applyBtn.style.pointerEvents = 'auto';
      }
    }

    _dispDrift   = _targetDrift;
    _velocity    = 0;
    draw();
    updateReadout();
  }

  function onPointerUp() {
    if (!_dragging) return;
    _dragging = false;
    if (_canvas) _canvas.style.cursor = 'default';
    startAnim(); // spring settle
  }

  // ── Pinch → sleep duration (mobile) ──────────────────────────────────────────
  let _pinchStartDist = null;
  let _pinchStartSleep = null;

  function pinchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      _pinchStartDist  = pinchDist(e);
      _pinchStartSleep = _sleepH;
    } else {
      onPointerDown(e);
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && _pinchStartDist !== null) {
      const scale = pinchDist(e) / _pinchStartDist;
      _sleepH = clamp(_pinchStartSleep * scale, 4, 16);
      // Sync slider
      const slider = document.getElementById('exp-sleep');
      if (slider) slider.value = _sleepH;
      _updateSleepLabel();
      draw();
      e.preventDefault();
    } else {
      onPointerMove(e);
    }
  }

  function onTouchEnd(e) {
    _pinchStartDist = null;
    onPointerUp();
  }

  // ── Sleep label ───────────────────────────────────────────────────────────────
  function _updateSleepLabel() {
    const el = document.getElementById('exp-sleep-lbl');
    if (el) el.textContent = CP.calc.fmtHM(_sleepH);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init(onApplyCallback) {
    _onApply = onApplyCallback || null;
    _canvas  = document.getElementById('explorer-canvas');
    if (!_canvas) return;

    _ctx = _canvas.getContext('2d');

    // Size canvas to its CSS container
    function resize() {
      const wrap = _canvas.parentElement;
      const w = Math.min(wrap.clientWidth || 360, 560);
      _canvas.width  = w;
      _canvas.height = ROWS * ROW_H + 16; // +16 for hour labels
    }
    resize();
    new ResizeObserver(resize).observe(_canvas.parentElement);

    // Build star pattern
    _starPat = buildStarPattern(_ctx);

    // Cache sun times (today, user location)
    const settings = CP.store.getSettings();
    _sunCache = CP.sky.sunTimes(new Date(), settings.lat, settings.lng);

    // Initial values
    _targetDrift = 1.0;
    _dispDrift   = 1.0;
    _sleepH      = clamp(CP.calc.awakeFromTau(tauFromDrift(1.0)) - 0, 4, 16);
    // Better default: use stored tau if available
    const stored = CP.store.getSettings();
    if (stored.tau && stored.tau >= 24) {
      _targetDrift = stored.tau - 24;
      _dispDrift   = _targetDrift;
    }
    _sleepH = clamp(stored.tau ? (stored.tau - stored.awakeH) : 8, 4, 16);

    // Sync slider
    const slider = document.getElementById('exp-sleep');
    if (slider) {
      slider.value = _sleepH;
      slider.addEventListener('input', e => {
        _sleepH = parseFloat(e.target.value);
        _updateSleepLabel();
        draw();
      });
    }
    _updateSleepLabel();

    // Canvas events — mouse
    _canvas.addEventListener('mousedown',  onPointerDown, { passive: false });
    _canvas.addEventListener('mousemove',  onPointerMove, { passive: true  });
    _canvas.addEventListener('mouseup',    onPointerUp);
    _canvas.addEventListener('mouseleave', onPointerUp);

    // Canvas events — touch
    _canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    _canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    _canvas.addEventListener('touchend',   onTouchEnd,   { passive: true  });

    // Apply button
    const applyBtn = document.getElementById('exp-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const tau    = tauFromDrift(_targetDrift);
        const awakeH = CP.calc.awakeFromTau(tau);
        CP.store.saveSettings({ tau, awakeH, tauLocked: true });
        if (_onApply) _onApply(tau, awakeH);
        // Visual confirmation
        const orig = applyBtn.textContent;
        applyBtn.textContent = '✓ Applied!';
        applyBtn.style.background = '#2d3070';
        applyBtn.style.color = '#c9a84c';
        setTimeout(() => {
          applyBtn.textContent = orig;
          applyBtn.style.background = '';
          applyBtn.style.color = '';
        }, 2000);
      });
    }

    draw();
    updateReadout();
  }

  return { init };

})();

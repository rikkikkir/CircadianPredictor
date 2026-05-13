// actogram.js — canvas actogram visualization
// Ported and adapted from rikkikkir.github.io/circadian/
'use strict';
window.CP = window.CP || {};

CP.actogram = (() => {

  const ACTO_ZOOM = [2, 3, 4, 5, 6, 8, 10, 14, 18];
  let _zoomIdx  = 3;
  let _rows     = null;
  let _canvas   = null;
  let _mini     = null;
  let _scroll   = null;
  let _anchorMs = null;
  let _tauH     = null;
  let _lat      = null;
  let _lng      = null;

  // ── Build row data from sleep log entries ────────────────────────────────────
  function buildRows(entries) {
    const byDate = {};

    for (const e of entries) {
      if (!e.end) continue; // skip ongoing

      const start = e.start, end = e.end;
      const d0 = CP.sky.localDateStr(start);
      const d1 = CP.sky.localDateStr(end);
      const h0 = CP.sky.localHour(start);
      const h1 = CP.sky.localHour(end);

      if (!byDate[d0]) byDate[d0] = { segs: [] };
      if (!byDate[d1]) byDate[d1] = { segs: [] };

      if (e.type === 'sleepless') continue; // mark the day but no block

      if (d0 === d1) {
        byDate[d0].segs.push({ h0, h1, id: e.id });
      } else {
        byDate[d0].segs.push({ h0, h1: 24, id: e.id });
        byDate[d1].segs.push({ h0: 0, h1, id: e.id });
      }
    }

    const allDates = Object.keys(byDate).sort();
    if (!allDates.length) return [];

    // Start 30 days ago or at earliest entry, whichever is later
    const todayStr = CP.sky.localDateStr(Date.now());
    const thirtyAgo = CP.sky.localDateStr(Date.now() - 30 * 86400000);
    const startStr = allDates.length ? allDates[0] < thirtyAgo ? allDates[0] : thirtyAgo : thirtyAgo;

    const rows = [];
    let cur = startStr;
    while (cur <= todayStr) {
      const [yr, mo, dy] = cur.split('-').map(Number);
      const d = new Date(yr, mo - 1, dy);
      rows.push({ date: cur, d, segs: (byDate[cur] || {}).segs || [] });
      const next = new Date(yr, mo - 1, dy + 1);
      cur = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
    }
    return rows;
  }

  // ── Draw the main actogram canvas ────────────────────────────────────────────
  function draw() {
    if (!_rows || !_canvas || !_scroll) return;
    const rowH = ACTO_ZOOM[_zoomIdx];
    const W    = _scroll.clientWidth || 600;
    const LW   = 44, DW = W - LW;
    _canvas.width  = W;
    _canvas.height = _rows.length * rowH;

    const ctx = _canvas.getContext('2d');
    ctx.fillStyle = '#f4f0e8';
    ctx.fillRect(0, 0, W, _canvas.height);

    // Star tile pattern for sleep blocks
    const starTile = document.createElement('canvas');
    starTile.width = 22; starTile.height = 22;
    const sc = starTile.getContext('2d');
    sc.lineJoin = 'round'; sc.lineCap = 'round';
    const star1 = [[11,3.7],[12.9,8.4],[17.8,8.7],[13.7,12.0],[15.2,16.9],[11,14.2],[6.7,16.7],[8.2,12.1],[4.2,8.9],[9.1,8.5]];
    const star2 = [[10.8,4.1],[12.7,8.7],[17.6,9.1],[13.5,12.3],[15.0,17.1],[10.8,14.5],[6.5,17.0],[8.0,12.4],[4.0,9.2],[8.9,8.8]];
    sc.strokeStyle = 'rgba(140,215,200,0.85)'; sc.lineWidth = 1.15;
    sc.beginPath(); star1.forEach(([x,y],i) => i===0?sc.moveTo(x,y):sc.lineTo(x,y)); sc.closePath(); sc.stroke();
    sc.strokeStyle = 'rgba(140,215,200,0.35)'; sc.lineWidth = 0.7;
    sc.beginPath(); star2.forEach(([x,y],i) => i===0?sc.moveTo(x,y):sc.lineTo(x,y)); sc.closePath(); sc.stroke();
    const sleepPat = ctx.createPattern(starTile, 'repeat');

    // Vertical grid lines at 6h intervals
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.5;
    [0,6,12,18,24].forEach(h => {
      const x = LW + (h/24)*DW;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,_canvas.height); ctx.stroke();
    });

    // 6h labels at top
    if (rowH >= 5) {
      ctx.fillStyle = '#999'; ctx.font = `9px Inter,sans-serif`; ctx.textAlign = 'center';
      ['Midn','6A','Noon','6P','Midn'].forEach((lbl,i) => {
        ctx.fillText(lbl, LW + (i*6/24)*DW, 9);
      });
    }

    const todayStr = CP.sky.localDateStr(Date.now());
    ctx.textAlign = 'right';

    for (let i = 0; i < _rows.length; i++) {
      const row = _rows[i];
      const y = i * rowH;

      // Today highlight
      if (row.date === todayStr) {
        ctx.fillStyle = '#ede8de';
        ctx.fillRect(LW, y, DW, rowH);
      }

      // Date label on 1st and 15th
      const dom = row.d.getDate();
      if (dom === 1 || dom === 15) {
        const fs = Math.max(7, Math.min(rowH - 1, 9));
        ctx.fillStyle = '#888'; ctx.font = `${fs}px Inter,sans-serif`;
        ctx.fillText(`${row.d.getMonth()+1}/${dom}`, LW - 2, y + rowH * 0.8);
      }

      // Daylight band
      const { sunrise, sunset } = CP.sky.sunTimes(row.d, _lat, _lng);
      ctx.fillStyle = 'rgba(255,190,50,0.13)';
      ctx.fillRect(LW + (sunrise/24)*DW, y, (sunset-sunrise)/24*DW, rowH);

      // Sleep blocks (base navy)
      ctx.fillStyle = 'rgba(28,31,74,0.85)';
      for (const seg of row.segs) {
        const x0  = LW + (seg.h0/24)*DW;
        const segW = Math.max(1, (seg.h1-seg.h0)/24*DW);
        ctx.fillRect(x0, y + 0.5, segW, Math.max(1, rowH-1));
      }
      // Star overlay
      ctx.fillStyle = sleepPat;
      for (const seg of row.segs) {
        const x0  = LW + (seg.h0/24)*DW;
        const segW = Math.max(1, (seg.h1-seg.h0)/24*DW);
        ctx.fillRect(x0, y + 0.5, segW, Math.max(1, rowH-1));
      }

      // Natural thread (gold vertical line)
      if (_anchorMs && _tauH) {
        const ntMs = CP.calc.naturalThreadWake(_anchorMs, _tauH, row.d.getTime() + 12*3600000);
        if (ntMs) {
          const ntH = CP.sky.localHour(ntMs);
          const ntX = LW + (ntH/24)*DW;
          ctx.fillStyle = 'rgba(201,168,76,0.78)';
          ctx.fillRect(ntX - 1, y, 2, rowH);
        }
      }
    }

    drawMinimap();
    updateMinimapVP();
  }

  // ── Minimap ──────────────────────────────────────────────────────────────────
  function drawMinimap() {
    if (!_rows || !_mini) return;
    const W = (_mini.parentElement || {}).clientWidth || 600;
    _mini.width = W; _mini.height = 70;
    const LW = 44, DW = W - LW;
    const rowH = Math.max(0.3, 70 / _rows.length);
    const ctx = _mini.getContext('2d');
    ctx.fillStyle = '#e8e2d6';
    ctx.fillRect(0, 0, W, 70);

    for (let i = 0; i < _rows.length; i++) {
      const row = _rows[i];
      const y = i * rowH;
      ctx.fillStyle = 'rgba(45,48,112,0.65)';
      for (const seg of row.segs) {
        ctx.fillRect(LW+(seg.h0/24)*DW, y, Math.max(0.5,(seg.h1-seg.h0)/24*DW), Math.max(0.5,rowH));
      }
      if (_anchorMs && _tauH) {
        const ntMs = CP.calc.naturalThreadWake(_anchorMs, _tauH, row.d.getTime() + 12*3600000);
        if (ntMs) {
          const ntH = CP.sky.localHour(ntMs);
          ctx.fillStyle = 'rgba(201,168,76,0.55)';
          ctx.fillRect(LW+(ntH/24)*DW - 0.5, y, 1, Math.max(0.5,rowH));
        }
      }
    }
  }

  function updateMinimapVP() {
    const vp = document.getElementById('mini-vp');
    if (!vp || !_scroll || !_canvas || !_mini) return;
    const sf = _scroll.scrollTop  / _canvas.height;
    const vf = _scroll.clientHeight / _canvas.height;
    vp.style.top    = (sf * 70).toFixed(1) + 'px';
    vp.style.height = Math.max(2, vf * 70).toFixed(1) + 'px';
  }

  // ── Setup events ─────────────────────────────────────────────────────────────
  function setupEvents() {
    if (!_scroll || !_canvas || !_mini) return;

    _scroll.addEventListener('scroll', updateMinimapVP, { passive: true });
    _mini.addEventListener('click', e => {
      const rect = _mini.getBoundingClientRect();
      const frac = (e.clientY - rect.top) / 70;
      _scroll.scrollTop = frac * _canvas.height - _scroll.clientHeight / 2;
    });

    // Zoom controls
    document.getElementById('acto-zoom-in')?.addEventListener('click', () => {
      if (_zoomIdx < ACTO_ZOOM.length - 1) {
        const ratio = _scroll.scrollTop / _canvas.height;
        _zoomIdx++;
        const lbl = document.getElementById('acto-zoom-lbl');
        if (lbl) lbl.textContent = ACTO_ZOOM[_zoomIdx] + 'px/row';
        draw();
        _scroll.scrollTop = ratio * _canvas.height;
      }
    });
    document.getElementById('acto-zoom-out')?.addEventListener('click', () => {
      if (_zoomIdx > 0) {
        const ratio = _scroll.scrollTop / _canvas.height;
        _zoomIdx--;
        const lbl = document.getElementById('acto-zoom-lbl');
        if (lbl) lbl.textContent = ACTO_ZOOM[_zoomIdx] + 'px/row';
        draw();
        _scroll.scrollTop = ratio * _canvas.height;
      }
    });

    // Resize observer
    new ResizeObserver(() => {
      const ratio = _canvas.height ? _scroll.scrollTop / _canvas.height : 1;
      draw();
      _scroll.scrollTop = ratio * _canvas.height;
    }).observe(_scroll);
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function init(canvasId, scrollId, miniId) {
    _canvas = document.getElementById(canvasId);
    _scroll = document.getElementById(scrollId);
    _mini   = document.getElementById(miniId);
    setupEvents();
    // Scroll to bottom (most recent)
    setTimeout(() => {
      if (_scroll && _canvas) _scroll.scrollTop = _canvas.height;
    }, 100);
  }

  function render(entries, anchorMs, tauH, lat, lng) {
    _anchorMs = anchorMs;
    _tauH     = tauH;
    _lat      = lat ?? 40.0;
    _lng      = lng ?? -75.0;
    _rows     = buildRows(entries);
    draw();
    // Scroll to bottom after render
    setTimeout(() => {
      if (_scroll && _canvas) _scroll.scrollTop = _canvas.height;
    }, 50);
  }

  function getRowCount() { return _rows ? _rows.length : 0; }

  return { init, render, getRowCount };

})();

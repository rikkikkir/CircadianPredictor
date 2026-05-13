// wheel.js — SVG circadian wheel visualization
// Ported and polished from rikkikkir.github.io/circadian-wheel/
'use strict';
window.CP = window.CP || {};

CP.wheel = (() => {

  // SVG coordinate system: center (220,220), viewBox "-20 -20 480 480"
  const CX = 220, CY = 220;
  const PI_R  = 5;   // inner radius (center hole)
  const PO_R  = 168; // pie outer radius
  const OCR1  = 174; // outer clock ring inner edge
  const OCR2  = 190; // outer clock ring outer edge
  const HAND_R = 205; // hand length

  let _liveTimer = null;

  // ── SVG path helpers ─────────────────────────────────────────────────────────
  function pol(deg, r) {
    const rad = deg * Math.PI / 180;
    return [+(CX + r * Math.sin(rad)).toFixed(2), +(CY - r * Math.cos(rad)).toFixed(2)];
  }

  function arcSeg(a1, a2, ri, ro) {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1o,y1o] = pol(a1,ro), [x2o,y2o] = pol(a2,ro);
    const [x1i,y1i] = pol(a1,ri), [x2i,y2i] = pol(a2,ri);
    return `M ${x1o} ${y1o} A ${ro} ${ro} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`;
  }

  function sector(a1, a2, ri, ro) {
    const large = (a2 - a1) >= 180 ? 1 : 0;
    const [x1o,y1o] = pol(a1,ro), [x2o,y2o] = pol(a2-0.01,ro);
    const [x1i,y1i] = pol(a1,ri), [x2i,y2i] = pol(a2-0.01,ri);
    return `M ${x1o} ${y1o} A ${ro} ${ro} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`;
  }

  // ── Draw outer clock ring (maps personal cycle onto 24h sky) ─────────────────
  function drawOuterClock(svgId, anchorMs, tauH, lat, lng) {
    const g = document.getElementById(svgId + '-outer-clock');
    if (!g) return;
    const DEG = 360 / tauH;
    const wakeHour = CP.sky.localHour(anchorMs);
    const { sunrise, sunset } = CP.sky.sunTimes(new Date(anchorMs), lat, lng);

    let html = '';
    const STEP = 0.25;
    for (let n = 0; n < tauH; n += STEP) {
      const clockH = ((wakeHour + n + STEP/2) % 24 + 24) % 24;
      const col = CP.sky.skyColorAt(clockH, sunrise, sunset);
      const a1 = n * DEG, a2 = Math.min(n + STEP, tauH) * DEG;
      html += `<path d="${arcSeg(a1, a2, OCR1, OCR2)}" fill="${col}"/>`;
    }

    html += `<circle cx="${CX}" cy="${CY}" r="${OCR1}" fill="none" stroke="#333" stroke-width="0.5"/>`;
    html += `<circle cx="${CX}" cy="${CY}" r="${OCR2}" fill="none" stroke="#333" stroke-width="0.5"/>`;

    // Tick marks
    for (let n = 0; n <= Math.ceil(tauH); n++) {
      const isMaj = n % 2 === 0;
      const ang = n * DEG;
      const [x1,y1] = pol(ang, OCR2);
      const [x2,y2] = pol(ang, OCR2 + (isMaj ? 8 : 4));
      html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isMaj?'#505050':'#333'}" stroke-width="${isMaj?1:0.5}"/>`;
    }

    // Clock-time labels every 2 personal hours
    for (let n = 0; n <= Math.floor(tauH); n += 2) {
      let label, fontSize, fillColor, fontWeight;
      if (n === 0) {
        label = _ringLabel(anchorMs);
        fontSize = '8'; fillColor = '#c9a84c'; fontWeight = '600';
      } else {
        const clockH = ((wakeHour + n) % 24 + 24) % 24;
        const isNoon = Math.abs(clockH - 12) < 0.5;
        const isMidn = clockH < 0.5 || clockH > 23.5;
        if (isNoon) {
          label = 'Noon'; fontSize = '7.5'; fillColor = '#c9a84c'; fontWeight = '600';
        } else if (isMidn) {
          label = 'Midn'; fontSize = '7.5'; fillColor = '#c9a84c'; fontWeight = '600';
        } else {
          const ch = Math.round(clockH);
          const h12 = ch % 12 || 12;
          label = h12 + (ch < 12 ? 'A' : 'P');
          fontSize = '8.5'; fillColor = '#606060'; fontWeight = '400';
        }
      }
      const [lx,ly] = pol(n * DEG, OCR2 + 17);
      html += `<text x="${lx}" y="${ly}" font-size="${fontSize}" fill="${fillColor}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${label}</text>`;
    }

    // Sunrise / Sunset labels
    [[((sunrise - wakeHour) % 24 + 24) % 24, 'Sunrise'],
     [((sunset  - wakeHour) % 24 + 24) % 24, 'Sunset']].forEach(([n, lbl]) => {
      if (n < tauH) {
        const [lx,ly] = pol(n * DEG, OCR2 + 17);
        html += `<text x="${lx}" y="${ly}" font-size="7" fill="#c49820" font-weight="500" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${lbl}</text>`;
      }
    });

    // Wake tick
    const [wt1x,wt1y] = pol(0, OCR1-1), [wt2x,wt2y] = pol(0, OCR2+1);
    html += `<line x1="${wt1x}" y1="${wt1y}" x2="${wt2x}" y2="${wt2y}" stroke="rgba(201,168,76,0.5)" stroke-width="1.5"/>`;

    g.innerHTML = html;
  }

  function _ringLabel(ms) {
    const s = new Date(ms).toLocaleTimeString('en-US',
      { hour:'numeric', minute:'2-digit', hour12:true });
    const [timePart, period] = s.split(' ');
    const suf = (period||'')[0]||'';
    const [h, m] = timePart.split(':');
    if (h==='12'&&m==='00') return period==='PM' ? 'Noon' : 'Midn';
    return m==='00' ? `${h}${suf}` : `${h}:${m}${suf}`;
  }

  // ── Draw pie chart (personal cycle segments with sky colors) ─────────────────
  function drawPieChart(svgId, anchorMs, tauH, awakeH, lat, lng) {
    const g = document.getElementById(svgId + '-pie');
    if (!g) return;
    const DEG = 360 / tauH;
    const { h_into, wakeMs } = CP.calc.cyclePos(anchorMs, tauH, awakeH);
    const wakeHour = CP.sky.localHour(wakeMs);
    const { sunrise, sunset } = CP.sky.sunTimes(new Date(wakeMs), lat, lng);

    const segs = [
      { type: 'waking',   hours: 1.0 },
      { type: 'open',     hours: awakeH - 2.0 },
      { type: 'winddown', hours: 1.0 },
      { type: 'sleep',    hours: tauH - awakeH },
    ];

    let html = '';
    let cumH = 0;
    let sleepLabelAngle = null;
    const STEP = 0.25;

    for (const seg of segs) {
      const segStart = cumH, segEnd = cumH + seg.hours;
      const dFull = sector(segStart * DEG, segEnd * DEG, PI_R, PO_R);

      // Sub-slice at 0.25h for accurate sky color
      let h = segStart;
      while (h < segEnd) {
        const hNext  = Math.min(h + STEP, segEnd);
        const midH   = (h + hNext) / 2;
        const clockH = ((wakeHour + midH) % 24 + 24) % 24;
        html += `<path d="${sector(h*DEG, hNext*DEG, PI_R, PO_R)}" fill="${CP.sky.skyColorAt(clockH, sunrise, sunset)}" stroke="none"/>`;
        h = hNext;
      }

      if (seg.type === 'sleep') {
        html += `<path d="${dFull}" fill="url(#wheel-sleep-stars)" stroke="none"/>`;
        sleepLabelAngle = (segStart + segEnd) / 2 * DEG;
      }
      html += `<path d="${dFull}" fill="none" stroke="#1a1a1a" stroke-width="0.5"/>`;
      cumH = segEnd;
    }

    if (sleepLabelAngle !== null) {
      const [lx, ly] = pol(sleepLabelAngle, 90);
      const sa = `x="${lx}" y="${ly}" font-size="26" font-weight="700" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" letter-spacing="2"`;
      html += `<text ${sa} fill="none" stroke="#06090f" stroke-width="5" stroke-linejoin="round">Sleep</text>`;
      html += `<text ${sa} fill="#c49820">Sleep</text>`;
    }

    g.innerHTML = html;
  }

  // ── Update live hand + stats card ────────────────────────────────────────────
  function updateLive(svgId, statsId, anchorMs, tauH, awakeH) {
    if (!anchorMs) return;
    const { h_into, wakeMs, sleepMs, nwakeMs, asleep } = CP.calc.cyclePos(anchorMs, tauH, awakeH);

    // Hand position
    const rAngle = (h_into / tauH) * 360;
    const rRad   = rAngle * Math.PI / 180;
    const dx = Math.sin(rRad), dy = -Math.cos(rRad);
    const hx = (CX + HAND_R * dx).toFixed(1);
    const hy = (CY + HAND_R * dy).toFixed(1);

    const hl = document.getElementById(svgId + '-hand');
    if (hl) { hl.setAttribute('x2', hx); hl.setAttribute('y2', hy); }

    const lbl = document.getElementById(svgId + '-now-lbl');
    if (lbl) {
      lbl.setAttribute('x', (CX + (HAND_R+20) * dx).toFixed(1));
      lbl.setAttribute('y', (CY + (HAND_R+20) * dy).toFixed(1));
      lbl.textContent = CP.calc.fmtCompact(Date.now());
    }

    // Stats card
    const statsEl = document.getElementById(statsId);
    if (statsEl) {
      const { fmtTime, fmtHM } = CP.calc;
      if (asleep) {
        statsEl.innerHTML =
          `<div class="nc-row"><span class="nc-lbl">Rest window opened</span><span class="nc-val">${fmtTime(sleepMs)}</span></div>` +
          `<div class="nc-row"><span class="nc-lbl">Next wake (est.)</span><span class="nc-val">${fmtTime(nwakeMs)}</span></div>` +
          `<div class="nc-row"><span class="nc-lbl">In rest window for</span><span class="nc-val">${fmtHM(h_into - awakeH)}</span></div>`;
      } else {
        statsEl.innerHTML =
          `<div class="nc-row"><span class="nc-lbl">Awake since</span><span class="nc-val">${fmtTime(wakeMs)}</span></div>` +
          `<div class="nc-row"><span class="nc-lbl">Rest window opens</span><span class="nc-val">${fmtTime(sleepMs)}</span></div>` +
          `<div class="nc-row"><span class="nc-lbl">${fmtHM(h_into)} into cycle</span><span class="nc-val">${fmtTime(nwakeMs)} next wake</span></div>`;
      }
    }
  }

  // ── Full render ──────────────────────────────────────────────────────────────
  function render(svgId, statsId, anchorMs, tauH, awakeH, lat, lng) {
    if (!anchorMs) return;
    drawOuterClock(svgId, anchorMs, tauH, lat, lng);
    drawPieChart(svgId, anchorMs, tauH, awakeH, lat, lng);
    updateLive(svgId, statsId, anchorMs, tauH, awakeH);
  }

  // Start live update loop (15-minute interval)
  function startLive(svgId, statsId, anchorMs, tauH, awakeH) {
    if (_liveTimer) clearInterval(_liveTimer);
    _liveTimer = setInterval(() => updateLive(svgId, statsId, anchorMs, tauH, awakeH), 900000);
  }

  function stopLive() {
    if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; }
  }

  return { render, startLive, stopLive, updateLive };

})();

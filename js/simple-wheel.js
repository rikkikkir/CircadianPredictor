// simple-wheel.js — Simplified two-arc status wheel + data card
// Matches the "Right Now" layout from the screenshot reference.
'use strict';
window.CP = window.CP || {};

CP.simpleWheel = (() => {

  const CX = 200, CY = 200;
  const R_OUT  = 178;  // outer radius of ring
  const R_IN   = 118;  // inner radius of thick sleeping arc
  const R_HAND = 106;  // hand length
  const R_TICK_OUT = 183;
  const R_TICK_IN  = 173;
  const R_LABEL    = 196;

  let _liveTimer = null;

  // ── Polar helper ──────────────────────────────────────────────────────────────
  function pol(deg, r) {
    const rad = deg * Math.PI / 180;
    return [+(CX + r * Math.sin(rad)).toFixed(2), +(CY - r * Math.cos(rad)).toFixed(2)];
  }

  // Arc path for a donut sector (a1→a2 clockwise, ri to ro)
  function donutArc(a1, a2, ri, ro) {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1o,y1o] = pol(a1, ro), [x2o,y2o] = pol(a2 - 0.001, ro);
    const [x1i,y1i] = pol(a1, ri), [x2i,y2i] = pol(a2 - 0.001, ri);
    return `M ${x1o} ${y1o} A ${ro} ${ro} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`;
  }

  // Stroke-only arc path
  function strokeArc(a1, a2, r) {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1,y1] = pol(a1, r), [x2,y2] = pol(a2 - 0.001, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  // ── Draw the SVG wheel ────────────────────────────────────────────────────────
  function draw(svgId, anchorMs, tauH, awakeH) {
    const svg = document.getElementById(svgId);
    if (!svg || !anchorMs) return;

    const { h_into, wakeMs, sleepMs, nwakeMs, asleep, cycleN } =
      CP.calc.cyclePos(anchorMs, tauH, awakeH);

    const sleepDeg  = (awakeH  / tauH) * 360;  // where sleep starts (degrees)
    const nowDeg    = (h_into  / tauH) * 360;  // current hand position

    let html = '';

    // ── Background circle ──────────────────────────────────────────────────────
    html += `<circle cx="${CX}" cy="${CY}" r="${R_OUT}" fill="#1a1e28"/>`;

    // ── AWAKE arc — thin outline ring ──────────────────────────────────────────
    html += `<path d="${strokeArc(0, sleepDeg, (R_OUT + R_IN) / 2)}" fill="none" stroke="rgba(160,154,142,0.18)" stroke-width="${R_OUT - R_IN}"/>`;

    // ── SLEEPING arc — thick navy donut ───────────────────────────────────────
    html += `<path d="${donutArc(sleepDeg, 360, R_IN, R_OUT)}" fill="rgba(38,44,100,0.92)"/>`;

    // ── Outer ring border ─────────────────────────────────────────────────────
    html += `<circle cx="${CX}" cy="${CY}" r="${R_OUT}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    html += `<circle cx="${CX}" cy="${CY}" r="${R_IN}"  fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;

    // ── Hour tick marks ───────────────────────────────────────────────────────
    for (let h = 0; h < tauH; h += 1) {
      const deg = (h / tauH) * 360;
      const isMaj = h % 4 === 0;
      const [x1,y1] = pol(deg, R_TICK_IN  - (isMaj ? 3 : 0));
      const [x2,y2] = pol(deg, R_TICK_OUT + (isMaj ? 2 : 0));
      html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isMaj ? 'rgba(160,154,142,0.55)' : 'rgba(160,154,142,0.22)'}" stroke-width="${isMaj ? 1 : 0.5}"/>`;
    }

    // ── Hour labels (every 4h) ─────────────────────────────────────────────────
    for (let h = 4; h < tauH; h += 4) {
      if (Math.abs(h - awakeH) < 1) continue; // skip if near Sleep label
      const deg = (h / tauH) * 360;
      const [lx, ly] = pol(deg, R_LABEL + 10);
      html += `<text x="${lx}" y="${ly}" font-size="10" fill="rgba(160,154,142,0.65)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${h}h</text>`;
    }

    // ── Wake label (top) ───────────────────────────────────────────────────────
    html += `<text x="${CX}" y="14" font-size="11" font-weight="600" fill="#c9a84c" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">Wake</text>`;
    html += `<text x="${CX}" y="27" font-size="9" fill="rgba(201,168,76,0.6)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">Hour 0</text>`;
    // Gold tick at top
    html += `<line x1="${CX}" y1="${CY - R_IN}" x2="${CX}" y2="${CY - R_OUT - 4}" stroke="#c9a84c" stroke-width="2"/>`;

    // ── Sleep label (at sleep transition point) ────────────────────────────────
    const [slx, sly] = pol(sleepDeg, R_OUT + 22);
    html += `<text x="${slx}" y="${sly - 5}" font-size="11" font-weight="600" fill="#6070c0" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">Sleep</text>`;
    html += `<text x="${slx}" y="${sly + 8}" font-size="9" fill="rgba(96,112,192,0.7)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">~hr ${awakeH.toFixed(1)}</text>`;

    // ── AWAKE / SLEEPING zone labels ───────────────────────────────────────────
    // Awake label: midpoint of awake arc
    const awakeMidDeg = sleepDeg / 2;
    const [alx, aly] = pol(awakeMidDeg, (R_IN + R_OUT) / 2 + 4);
    html += `<text x="${alx}" y="${aly}" font-size="9" fill="rgba(160,154,142,0.5)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" letter-spacing="2">AWAKE</text>`;

    // Sleeping label: midpoint of sleeping arc
    const sleepMidDeg = sleepDeg + (360 - sleepDeg) / 2;
    const [blx, bly] = pol(sleepMidDeg, (R_IN + R_OUT) / 2);
    html += `<text x="${blx}" y="${bly}" font-size="9" fill="rgba(120,132,200,0.55)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" letter-spacing="2">SLEEPING</text>`;

    // ── Current position hand ──────────────────────────────────────────────────
    const [hx, hy] = pol(nowDeg, R_HAND);
    const [hox, hoy] = pol(nowDeg, 18); // short opposite stub
    const handColor = asleep ? '#5060c0' : '#ff2d78';
    html += `<line x1="${hox}" y1="${hoy}" x2="${hx}" y2="${hy}" stroke="${handColor}" stroke-width="2.5" stroke-linecap="round"/>`;
    html += `<circle cx="${hx}" cy="${hy}" r="5" fill="${handColor}"/>`;
    html += `<circle cx="${CX}" cy="${CY}" r="6" fill="${handColor}" opacity="0.8"/>`;

    // ── Center text ────────────────────────────────────────────────────────────
    const hh = Math.floor(h_into), mm = Math.round((h_into - hh) * 60);
    const hourStr = mm === 0 ? `Hour ${hh}` : `Hour ${hh}.${String(mm).padStart(2,'0')}`;
    html += `<text x="${CX}" y="${CY - 16}" font-size="18" font-weight="700" fill="${asleep ? '#8090d0' : '#f3efe2'}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${hourStr}</text>`;
    html += `<text x="${CX}" y="${CY + 3}"  font-size="10" fill="rgba(160,154,142,0.7)" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">personal hour</text>`;
    html += `<text x="${CX}" y="${CY + 18}" font-size="10" fill="${asleep ? 'rgba(120,132,200,0.8)' : 'rgba(160,154,142,0.6)'}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${asleep ? 'sleeping' : 'awake'}</text>`;

    svg.innerHTML = html;
  }

  // ── Update data card ──────────────────────────────────────────────────────────
  function updateCard(anchorMs, tauH, awakeH, name, pronoun) {
    if (!anchorMs) return;
    const { h_into, wakeMs, sleepMs, nwakeMs, asleep, cycleN } =
      CP.calc.cyclePos(anchorMs, tauH, awakeH);

    const displayName = name || 'The individual';
    const subj = pronoun === 'she' ? 'She' : pronoun === 'he' ? 'He' : 'They';
    const poss = pronoun === 'she' ? 'Her' : pronoun === 'he' ? 'His' : 'Their';

    // Personal hour display
    const hh = Math.floor(h_into), mm = Math.round((h_into - hh) * 60);
    const personalHourStr = mm > 0 ? `${hh}h ${mm}m of ${tauH}h` : `${hh}h of ${tauH}h`;

    // Cycle progress (0–1)
    const progress = (h_into / tauH) * 100;

    // Next event
    const nextEventMs  = asleep ? nwakeMs : sleepMs;
    const nextEventLbl = asleep ? 'NEXT WAKE' : 'REST WINDOW';
    const nextTimeStr  = CP.calc.fmtTime(nextEventMs);
    const timeUntilMs  = nextEventMs - Date.now();
    const timeUntilH   = timeUntilMs / 3600000;
    const untilStr     = timeUntilH > 0 ? `in ${CP.calc.fmtHM(timeUntilH)}` : 'soon';

    // Timezone label
    const tzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName:'short' })
                     .split(' ').pop();

    // Narrative sentence
    let sentence;
    if (asleep) {
      sentence = `<strong>${displayName} is currently sleeping.</strong> ${subj} is expected to wake around ${nextTimeStr} ${tzAbbr}. ${poss} next personal day begins then.`;
    } else {
      const remaining = CP.calc.fmtHM(awakeH - h_into);
      sentence = `<strong>${displayName} is currently awake.</strong> ${hh}h ${mm}m into ${poss.toLowerCase()} personal day. Rest window opens around ${nextTimeStr} ${tzAbbr} — in ${remaining}.`;
    }

    // Fill card elements
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    setT('sw-personal-hour',  personalHourStr);
    setT('sw-cycle-num',      `Cycle ${cycleN} since anchor`);
    setT('sw-event-label',    nextEventLbl);
    setT('sw-next-time',      nextTimeStr + ' ' + tzAbbr);
    setT('sw-until',          untilStr);
    set ('sw-narrative',      sentence);

    const bar = document.getElementById('sw-progress-bar');
    if (bar) bar.style.width = progress.toFixed(1) + '%';

    const barLbl = document.getElementById('sw-progress-lbl');
    if (barLbl) barLbl.textContent = `Cycle progress · ${tauH}h personal day`;
  }

  // ── Full render ──────────────────────────────────────────────────────────────
  function render(svgId, anchorMs, tauH, awakeH, name, pronoun) {
    if (!anchorMs) return;
    draw(svgId, anchorMs, tauH, awakeH);
    updateCard(anchorMs, tauH, awakeH, name, pronoun);
  }

  // ── Live loop ─────────────────────────────────────────────────────────────────
  function startLive(svgId, anchorMs, tauH, awakeH, name, pronoun) {
    if (_liveTimer) clearInterval(_liveTimer);
    _liveTimer = setInterval(() => render(svgId, anchorMs, tauH, awakeH, name, pronoun), 60000);
  }
  function stopLive() { if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; } }

  return { render, startLive, stopLive };
})();

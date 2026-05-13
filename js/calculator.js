// calculator.js — tau calculation and cycle prediction
'use strict';
window.CP = window.CP || {};

CP.calc = (() => {

  // Calculate tau from consecutive wake-time intervals.
  // Returns { tau, n, confidence } or null if insufficient data.
  function calcTau(entries) {
    const wakes = entries
      .filter(e => e.type === 'sleep' && e.end !== null)
      .map(e => e.end)
      .sort((a, b) => a - b);

    if (wakes.length < 4) return null;

    // Collect single-cycle inter-wake intervals (10–38h = plausibly one cycle)
    const deltas = [];
    for (let i = 1; i < wakes.length; i++) {
      const delta = (wakes[i] - wakes[i-1]) / 3600000;
      if (delta >= 10 && delta <= 38) deltas.push(delta);
    }

    if (deltas.length < 3) return null;

    const tau = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((acc, d) => acc + (d - tau) ** 2, 0) / deltas.length;
    const std = Math.sqrt(variance);

    // Confidence: lower std = higher confidence (rough heuristic)
    const confidence = Math.max(0, Math.min(1, 1 - std / 4));

    return {
      tau: Math.max(23.0, Math.min(27.0, tau)),
      n: deltas.length,
      confidence,
      std,
    };
  }

  // Given an anchor wake time and tau, find the predicted wake time
  // closest to targetMs (±0.5 cycle).
  function naturalThreadWake(anchorMs, tauH, targetMs) {
    if (!anchorMs || !tauH) return null;
    const TAU_MS = tauH * 3600000;
    const elapsed = targetMs - anchorMs;
    const cycleN = Math.round(elapsed / TAU_MS);
    return anchorMs + cycleN * TAU_MS;
  }

  // Current cycle position.
  function cyclePos(anchorMs, tauH, awakeH, nowMs) {
    nowMs = nowMs ?? Date.now();
    const TAU_MS   = tauH * 3600000;
    const elapsed  = nowMs - anchorMs;
    const cycleN   = Math.floor(elapsed / TAU_MS);
    const h_into   = (((elapsed % TAU_MS) / 3600000) + tauH) % tauH;
    const wakeMs   = anchorMs + cycleN * TAU_MS;
    const sleepMs  = wakeMs + awakeH * 3600000;
    const nwakeMs  = sleepMs + (tauH - awakeH) * 3600000;
    return { cycleN, h_into, wakeMs, sleepMs, nwakeMs, asleep: h_into >= awakeH };
  }

  // Build forecast items for the next `days` calendar days.
  // Returns array of { dayMs, wakeMs, sleepMs, conf, cycleN }
  function buildForecast(anchorMs, tauH, awakeH, days) {
    days = days ?? 7;
    const TAU_MS   = tauH * 3600000;
    const AWAKE_MS = awakeH * 3600000;

    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const results = [];

    for (let day = 0; day < days; day++) {
      const dayMs  = todayMs + day * 86400000;
      const dayEnd = dayMs + 86400000;

      // Find all cycle wake events that touch this calendar day
      const startN = Math.floor((dayMs - anchorMs) / TAU_MS) - 1;
      for (let c = startN; c <= startN + 3; c++) {
        const wakeMs  = anchorMs + c * TAU_MS;
        const sleepMs = wakeMs + AWAKE_MS;
        // Clip to day
        if (sleepMs < dayMs || wakeMs > dayEnd) continue;

        const conf = day < 3 ? 'high' : day < 5 ? 'med' : 'low';
        results.push({ dayMs, wakeMs, sleepMs, conf, cycleN: c });
      }
    }
    return results;
  }

  // Auto-compute awakeH from tau (same formula as original wheel project)
  function awakeFromTau(tau) {
    if (tau <= 24.2) return 16.0;
    if (tau >= 25.0) return 13.4;
    const t = (tau - 24.2) / 0.8;
    return 16.0 + t * (13.4 - 16.0);
  }

  // Format hours as "Xh Ym"
  function fmtHM(h) {
    const hh = Math.floor(Math.abs(h));
    const mm = Math.round((Math.abs(h) - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
  }

  // Format ms timestamp as local 12h time
  function fmtTime(ms) {
    const s = new Date(ms).toLocaleTimeString('en-US',
      { hour:'numeric', minute:'2-digit', hour12:true });
    if (s === '12:00 PM') return 'Noon';
    if (s === '12:00 AM') return 'Midnight';
    return s;
  }

  // Format ms timestamp as compact local time (e.g. "2:30p")
  function fmtCompact(ms) {
    const s = new Date(ms).toLocaleTimeString('en-US',
      { hour:'numeric', minute:'2-digit', hour12:true });
    const [timePart, period] = s.split(' ');
    const suf = (period || '')[0] || '';
    const [h, m] = timePart.split(':');
    if (h === '12' && m === '00') return period === 'PM' ? 'Noon' : 'Midn';
    return m === '00' ? `${h}${suf}` : `${h}:${m}${suf}`;
  }

  return { calcTau, naturalThreadWake, cyclePos, buildForecast, awakeFromTau, fmtHM, fmtTime, fmtCompact };

})();

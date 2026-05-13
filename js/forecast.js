// forecast.js — 7-day forecast grid visualization
// Ported and adapted from rikkikkir.github.io/circadian/
'use strict';
window.CP = window.CP || {};

CP.forecast = (() => {

  function render(containerId, anchorMs, tauH, awakeH, lat, lng) {
    const el = document.getElementById(containerId);
    if (!el || !anchorMs) return;

    lat = lat ?? 40.0; lng = lng ?? -75.0;
    const TAU_MS   = tauH * 3600000;
    const AWAKE_MS = awakeH * 3600000;
    const todayMs  = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

    const rows = [];

    for (let day = 0; day < 7; day++) {
      const dayMs  = todayMs + day * 86400000;
      const dayEnd = dayMs + 86400000;
      const dayDate = new Date(dayMs);
      const isToday = day === 0;

      const dayLabel = dayDate.toLocaleDateString('en-US', {
        weekday:'short', month:'short', day:'numeric'
      });

      const confClass = day < 3 ? 'conf-high' : day < 5 ? 'conf-med' : 'conf-low';
      const { sunrise, sunset } = CP.sky.sunTimes(dayDate, lat, lng);
      const srPct = (sunrise/24*100).toFixed(2);
      const ssPct = (sunset/24*100).toFixed(2);
      const skyBg = CP.sky.skyGradientCSS(sunrise, sunset);

      const sleepBlks = [], wakeBlks = [];
      const startN = Math.floor((dayMs - anchorMs) / TAU_MS) - 1;

      for (let c = startN; c <= startN + 3; c++) {
        const wMs  = anchorMs + c * TAU_MS;
        const sMs  = wMs + AWAKE_MS;
        const eMs  = sMs + (tauH - awakeH) * 3600000;

        // Wake window
        const wk0 = Math.max(wMs, dayMs), wk1 = Math.min(sMs, dayEnd);
        if (wk1 > wk0) {
          const left  = ((wk0-dayMs)/86400000*100).toFixed(3);
          const width = ((wk1-wk0)/86400000*100).toFixed(3);
          const wLabel = _fmtHour(wMs);
          wakeBlks.push(`<div class="fc-wake-blk ${confClass}" style="left:${left}%;width:${width}%" title="Awake ${wLabel}"></div>`);
          // Wake time label
          const wPct = ((wMs-dayMs)/86400000*100).toFixed(3);
          if (wMs >= dayMs && wMs < dayEnd) {
            wakeBlks.push(`<div class="fc-wake-lbl ${confClass}" style="left:${wPct}%">${wLabel}</div>`);
          }
        }

        // Sleep window
        const sl0 = Math.max(sMs, dayMs), sl1 = Math.min(eMs, dayEnd);
        if (sl1 > sl0) {
          const left  = ((sl0-dayMs)/86400000*100).toFixed(3);
          const width = ((sl1-sl0)/86400000*100).toFixed(3);
          sleepBlks.push(`<div class="fc-sleep-blk ${confClass}" style="left:${left}%;width:${width}%"></div>`);
        }
      }

      const nowLine = isToday
        ? `<div class="fc-now-line" id="fc-now-line"></div>`
        : '';

      rows.push(`
        <div class="fc-row${isToday?' fc-today':''}">
          <div class="fc-row-lbl">${dayLabel}</div>
          <div class="fc-timeline" style="background:${skyBg}">
            ${wakeBlks.join('')}${sleepBlks.join('')}
            <div class="fc-sun-tick" style="left:${srPct}%" title="Sunrise"></div>
            <div class="fc-sun-tick" style="left:${ssPct}%" title="Sunset"></div>
            ${nowLine}
          </div>
        </div>`);
    }

    el.innerHTML = rows.join('\n');

    // Position now-line
    _updateNowLine();
    setInterval(_updateNowLine, 60000);
  }

  function _fmtHour(ms) {
    return new Date(ms).toLocaleTimeString('en-US',
      { hour:'numeric', minute:'2-digit', hour12:true });
  }

  function _updateNowLine() {
    const nl = document.getElementById('fc-now-line');
    if (!nl) return;
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const pct = ((now - startOfDay) / 86400000 * 100).toFixed(3);
    nl.style.left = pct + '%';
  }

  return { render };

})();

// export.js — CSV, JSON, ICS, and print exports
'use strict';
window.CP = window.CP || {};

CP.export = (() => {

  function _download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function _fmtDatetime(ms) {
    return new Date(ms).toLocaleString('en-US', {
      month:'short', day:'numeric', year:'numeric',
      hour:'numeric', minute:'2-digit', hour12:true
    });
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────
  function exportCSV(entries) {
    const lines = ['Type,Start,End,Duration (h),Note'];
    for (const e of entries) {
      const dur = e.end ? ((e.end - e.start) / 3600000).toFixed(2) : '';
      const note = (e.note || '').replace(/"/g, '""');
      lines.push([
        e.type,
        e.start ? `"${_fmtDatetime(e.start)}"` : '',
        e.end   ? `"${_fmtDatetime(e.end)}"` : '',
        dur,
        note ? `"${note}"` : '',
      ].join(','));
    }
    _download(lines.join('\n'), 'sleep-log.csv', 'text/csv');
  }

  // ── JSON ─────────────────────────────────────────────────────────────────────
  function exportJSON(entries, settings) {
    const payload = {
      exported: new Date().toISOString(),
      settings,
      entries,
    };
    _download(JSON.stringify(payload, null, 2), 'circadian-data.json', 'application/json');
  }

  // ── ICS calendar ─────────────────────────────────────────────────────────────
  function exportICS(anchorMs, tauH, awakeH, days) {
    days = days ?? 14;
    const forecast = CP.calc.buildForecast(anchorMs, tauH, awakeH, days);
    if (!forecast.length) { alert('No forecast data to export.'); return; }

    function icsDate(ms) {
      return new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    const events = forecast.map((item, i) => {
      const uid = `cp-${item.cycleN}-${Date.now()}@circadianpredictor`;
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${icsDate(Date.now())}`,
        `DTSTART:${icsDate(item.sleepMs)}`,
        `DTEND:${icsDate(item.sleepMs + (tauH - awakeH) * 3600000)}`,
        `SUMMARY:Rest window (Cycle ${item.cycleN})`,
        `DESCRIPTION:Predicted rest window based on tau=${tauH.toFixed(2)}h cycle.`,
        'END:VEVENT',
      ].join('\r\n');
    });

    const wake_events = forecast.map((item, i) => {
      const uid = `cp-wake-${item.cycleN}-${Date.now()}@circadianpredictor`;
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${icsDate(Date.now())}`,
        `DTSTART:${icsDate(item.wakeMs)}`,
        `DTEND:${icsDate(item.sleepMs)}`,
        `SUMMARY:Awake window (Cycle ${item.cycleN})`,
        `DESCRIPTION:Predicted awake window. Tau=${tauH.toFixed(2)}h.`,
        'END:VEVENT',
      ].join('\r\n');
    });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CircadianPredictor//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Circadian Forecast',
      ...events,
      ...wake_events,
      'END:VCALENDAR',
    ].join('\r\n');

    _download(ics, 'circadian-forecast.ics', 'text/calendar');
  }

  // ── Print (actogram) ─────────────────────────────────────────────────────────
  function printActogram() {
    // Switch to History panel first, then print
    const btn = document.querySelector('[data-panel="history"]');
    if (btn) btn.click();
    setTimeout(() => window.print(), 300);
  }

  // ── Share URL ────────────────────────────────────────────────────────────────
  function shareURL(anchorMs, tauH, awakeH) {
    if (!anchorMs) return null;
    return location.origin + location.pathname +
      `#t=${anchorMs}&tau=${tauH}&awake=${awakeH}`;
  }

  function copyShareURL(anchorMs, tauH, awakeH, btnEl) {
    const url = shareURL(anchorMs, tauH, awakeH);
    if (!url) { alert('Set your wake time first.'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (btnEl) {
          const orig = btnEl.textContent;
          btnEl.textContent = '✓ Copied!';
          setTimeout(() => btnEl.textContent = orig, 2000);
        }
      });
    }
  }

  return { exportCSV, exportJSON, exportICS, printActogram, shareURL, copyShareURL };

})();

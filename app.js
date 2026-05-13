// app.js — main application controller
'use strict';

(function () {
  // ── State ─────────────────────────────────────────────────────────────────────
  let _settings  = null;
  let _entries   = null;
  let _anchorMs  = null;
  let _tauH      = null;
  let _awakeH    = null;

  // ── Boot ──────────────────────────────────────────────────────────────────────
  function init() {
    _settings = CP.store.getSettings();
    _entries  = CP.store.getEntries();

    // Try to load state from URL hash first
    _loadFromHash();

    // Resolve effective tau and anchor
    _refreshDerived();

    // Init visualizations
    CP.actogram.init('acto-canvas', 'acto-scroll', 'mini-canvas');

    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    // Render initial panel
    const hash = location.hash;
    let startPanel = 'now';
    if (hash && !hash.startsWith('#t=')) {
      const p = hash.slice(1);
      if (['now','history','forecast','log','settings'].includes(p)) startPanel = p;
    }
    showPanel(startPanel);

    // Init settings form
    _initSettingsForm();

    // Tap buttons
    document.getElementById('btn-going-sleep')?.addEventListener('click', onGoingToSleep);
    document.getElementById('btn-just-woke')?.addEventListener('click',   onJustWoke);
    document.getElementById('btn-sleepless')?.addEventListener('click',   onSleepless);

    // Narrative form (manual anchor)
    document.getElementById('wake-date')?.addEventListener('change', onNarrativeChange);
    document.getElementById('wake-time')?.addEventListener('change', onNarrativeChange);

    // Share button
    document.getElementById('share-btn')?.addEventListener('click', () => {
      CP.export.copyShareURL(_anchorMs, _tauH, _awakeH, document.getElementById('share-btn'));
    });

    // Edit modal
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    document.getElementById('modal-save')?.addEventListener('click', saveModal);

    // Export buttons
    document.getElementById('btn-export-csv') ?.addEventListener('click', () => CP.export.exportCSV(_entries));
    document.getElementById('btn-export-json')?.addEventListener('click', () => CP.export.exportJSON(_entries, _settings));
    document.getElementById('btn-export-ics') ?.addEventListener('click', () => CP.export.exportICS(_anchorMs, _tauH, _awakeH));
    document.getElementById('btn-export-ics-settings')?.addEventListener('click', () => CP.export.exportICS(_anchorMs, _tauH, _awakeH));
    document.getElementById('btn-print')      ?.addEventListener('click', CP.export.printActogram);
    document.getElementById('btn-clear-data') ?.addEventListener('click', onClearData);

    // Tau Explorer
    CP.tauExplorer.init((tau, awakeH) => {
      _refreshDerived();
      renderAll();
    });

    // Geolocation
    CP.sky.tryGeolocation(async (lat, lng) => {
      const name = await CP.sky.reverseGeocode(lat, lng);
      _settings = CP.store.saveSettings({ lat, lng, locationName: name });
      _updateLocationDisplay(name);
      _refreshDerived();
      renderAll();
    });
  }

  // ── Derive effective tau and anchor from entries + settings ───────────────────
  function _refreshDerived() {
    _entries = CP.store.getEntries();
    _settings = CP.store.getSettings();

    // Tau: auto-calc if not locked
    if (!_settings.tauLocked) {
      const calc = CP.calc.calcTau(_entries);
      if (calc) {
        _tauH   = calc.tau;
        _awakeH = CP.calc.awakeFromTau(_tauH);
        // Update settings without locking
        CP.store.saveSettings({ tau: _tauH, awakeH: _awakeH });
      } else {
        _tauH   = _settings.tau;
        _awakeH = _settings.awakeH;
      }
    } else {
      _tauH   = _settings.tau;
      _awakeH = _settings.awakeH;
    }

    // Anchor: most recent confirmed wake, or settings.anchorMs, or null
    const lastWake = CP.store.getLastWakeMs();
    _anchorMs = lastWake || _settings.anchorMs || null;
  }

  // ── URL hash state ───────────────────────────────────────────────────────────
  function _loadFromHash() {
    const hash = location.hash.slice(1);
    if (!hash || !hash.startsWith('t=')) return;
    const p = new URLSearchParams(hash);
    const t = parseInt(p.get('t'), 10);
    const tau = parseFloat(p.get('tau'));
    const awake = parseFloat(p.get('awake'));
    if (t && isFinite(t)) {
      CP.store.saveSettings({ anchorMs: t });
      if (!isNaN(tau) && tau >= 23 && tau <= 27) {
        CP.store.saveSettings({ tau, tauLocked: true });
        if (!isNaN(awake) && awake > 4) {
          CP.store.saveSettings({ awakeH: awake });
        }
      }
    }
  }

  // ── Panel switching ──────────────────────────────────────────────────────────
  function showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    const panel = document.getElementById('panel-' + name);
    if (panel) panel.classList.add('active');

    // Render the newly visible panel
    _refreshDerived();
    switch (name) {
      case 'now':      renderNow();      break;
      case 'history':  renderHistory();  break;
      case 'forecast': renderForecast(); break;
      case 'log':      renderLog();      break;
      case 'settings': renderSettings(); break;
    }
  }

  // ── Render functions ─────────────────────────────────────────────────────────
  function renderAll() {
    const active = document.querySelector('.panel.active');
    if (active) showPanel(active.id.replace('panel-', ''));
  }

  function renderNow() {
    const ongoing = CP.store.getOngoingEntry();

    // Wheel section
    const wheelSection = document.getElementById('wheel-section');
    const noPrompt     = document.getElementById('no-state-prompt');

    if (_anchorMs) {
      if (wheelSection) wheelSection.style.display = '';
      if (noPrompt)     noPrompt.style.display     = 'none';
      CP.wheel.render('wheel-svg', 'stats-card', _anchorMs, _tauH, _awakeH,
        _settings.lat, _settings.lng);
      CP.wheel.startLive('wheel-svg', 'stats-card', _anchorMs, _tauH, _awakeH);
    } else {
      if (wheelSection) wheelSection.style.display = 'none';
      if (noPrompt)     noPrompt.style.display     = '';
    }

    // Tau strip — show calculated value or "not yet calculated"
    const tauStrip = document.getElementById('tau-strip-val');
    const hasCalc  = CP.calc.calcTau(_entries) !== null;
    if (tauStrip) {
      if (hasCalc) {
        tauStrip.textContent = `${_tauH.toFixed(2)}h`;
        tauStrip.title = 'Auto-calculated from your logged wake times';
      } else if (_settings.tauLocked) {
        tauStrip.textContent = `${_tauH.toFixed(2)}h (manual)`;
        tauStrip.title = 'Manually set in Settings';
      } else {
        tauStrip.textContent = '— log 4+ wake times to calculate';
        tauStrip.title = 'Default 25.4h used until enough data is logged';
        tauStrip.style.fontSize = '.72rem';
      }
    }

    // Ongoing badge
    const badge = document.getElementById('ongoing-badge');
    if (badge) {
      if (ongoing) {
        badge.style.display = '';
        const dur = (Date.now() - ongoing.start) / 3600000;
        badge.querySelector('.ongoing-text').textContent = `Sleeping · ${CP.calc.fmtHM(dur)} so far`;
      } else {
        badge.style.display = 'none';
      }
    }

    // Tap buttons
    // "I Just Woke Up" shows when: (a) there's an ongoing sleep entry to close,
    // OR (b) there's no anchor yet — new user needs this to set their first anchor.
    const btnSleep = document.getElementById('btn-going-sleep');
    const btnWake  = document.getElementById('btn-just-woke');
    const isNew    = !_anchorMs && !ongoing;

    if (ongoing) {
      // Currently sleeping — only show wake button
      if (btnSleep) btnSleep.style.display = 'none';
      if (btnWake)  btnWake.style.display  = '';
    } else if (isNew) {
      // Brand new user — show BOTH so they can set their first anchor
      if (btnSleep) btnSleep.style.display = '';
      if (btnWake)  btnWake.style.display  = '';
    } else {
      // Has history, currently awake — show sleep button
      if (btnSleep) btnSleep.style.display = '';
      if (btnWake)  btnWake.style.display  = 'none';
    }

    // Restore narrative form if anchor set
    if (_anchorMs) _restoreNarrativeForm(_anchorMs);
  }

  function renderHistory() {
    const emptyEl = document.getElementById('acto-empty');
    if (_entries.length === 0) {
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    CP.actogram.render(_entries, _anchorMs, _tauH, _settings.lat, _settings.lng);
  }

  function renderForecast() {
    const emptyEl = document.getElementById('fc-empty');
    if (!_anchorMs) {
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    CP.forecast.render('forecast-rows', _anchorMs, _tauH, _awakeH, _settings.lat, _settings.lng);
  }

  function renderLog() {
    const container = document.getElementById('log-entries');
    const emptyEl   = document.getElementById('log-empty');
    if (!container) return;

    const sorted = [..._entries].sort((a, b) => b.start - a.start);

    if (!sorted.length) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    container.innerHTML = sorted.map(e => {
      const isOngoing = !e.end;
      const dur = (e.end && e.start) ? (e.end - e.start) / 3600000 : null;
      const typeLabel = isOngoing ? 'ongoing' : e.type;

      const startStr = e.start ? CP.calc.fmtTime(e.start) : '—';
      const endStr   = e.end   ? CP.calc.fmtTime(e.end)   : '—';
      const durStr   = dur !== null ? `${CP.calc.fmtHM(dur)}` : isOngoing ? 'Ongoing' : '—';

      const dateStr = e.start
        ? new Date(e.start).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
        : '—';

      return `<div class="log-entry" data-id="${e.id}">
        <div class="log-entry-header">
          <div>
            <div class="log-entry-times">${dateStr} · ${startStr} → ${endStr}</div>
            <div class="log-entry-dur">${durStr}</div>
          </div>
          <span class="log-entry-type ${typeLabel}">${typeLabel}</span>
        </div>
        ${e.note ? `<div class="log-entry-note">"${_esc(e.note)}"</div>` : ''}
        <div class="log-actions">
          <button class="log-btn" onclick="CP.app.openEdit('${e.id}')">Edit</button>
          <button class="log-btn" onclick="CP.app.openNote('${e.id}')">Note</button>
          <button class="log-btn del" onclick="CP.app.deleteEntry('${e.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderSettings() {
    const tauDisplay = document.getElementById('tau-display');
    if (tauDisplay) {
      const calc = CP.calc.calcTau(_entries);
      tauDisplay.textContent = _tauH.toFixed(2) + 'h';
      const noteEl = document.getElementById('tau-calc-note');
      if (noteEl) {
        if (calc && !_settings.tauLocked) {
          noteEl.textContent = `Auto-calculated from ${calc.n} wake intervals. Confidence: ${Math.round(calc.confidence*100)}%.`;
        } else if (_settings.tauLocked) {
          noteEl.textContent = 'Manually set. Turn off lock to auto-calculate from log.';
        } else {
          noteEl.textContent = `Need at least 4 logged wake times to auto-calculate. Currently ${_entries.filter(e=>e.end).length} entries.`;
        }
      }
    }

    const tauInput = document.getElementById('settings-tau');
    if (tauInput) tauInput.value = _tauH.toFixed(1);

    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach(c => c.classList.toggle('active', Math.abs(parseFloat(c.dataset.tau) - _tauH) < 0.01));

    const awakeSlider = document.getElementById('awake-slider');
    if (awakeSlider) awakeSlider.value = _awakeH;
    _updateSleepLabels();

    const lockBtn = document.getElementById('tau-lock-btn');
    if (lockBtn) lockBtn.textContent = _settings.tauLocked ? '🔒 Locked (click to auto)' : '🔓 Auto (click to lock)';

    _updateLocationDisplay(_settings.locationName);
  }

  // ── Settings form init ────────────────────────────────────────────────────────
  function _initSettingsForm() {
    const tauInput = document.getElementById('settings-tau');
    if (tauInput) {
      tauInput.addEventListener('change', e => {
        const tau = parseFloat(e.target.value);
        if (isNaN(tau) || tau < 23 || tau > 27) return;
        _settings = CP.store.saveSettings({ tau, tauLocked: true, awakeH: CP.calc.awakeFromTau(tau) });
        _refreshDerived();
        renderSettings();
        renderAll();
      });
    }

    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tau = parseFloat(btn.dataset.tau);
        _settings = CP.store.saveSettings({ tau, tauLocked: true, awakeH: CP.calc.awakeFromTau(tau) });
        _refreshDerived();
        renderSettings();
        renderAll();
      });
    });

    document.getElementById('awake-slider')?.addEventListener('input', e => {
      const awakeH = parseFloat(e.target.value);
      _settings = CP.store.saveSettings({ awakeH });
      _awakeH = awakeH;
      _updateSleepLabels();
    });
    document.getElementById('awake-slider')?.addEventListener('change', () => renderAll());

    document.getElementById('tau-lock-btn')?.addEventListener('click', () => {
      _settings = CP.store.saveSettings({ tauLocked: !_settings.tauLocked });
      _refreshDerived();
      renderSettings();
      renderAll();
    });
  }

  function _updateSleepLabels() {
    const awakeL = document.getElementById('awake-label');
    const sleepL = document.getElementById('sleep-label');
    if (awakeL) awakeL.textContent = `Awake ${CP.calc.fmtHM(_awakeH)}`;
    if (sleepL) sleepL.textContent = `Sleep ${CP.calc.fmtHM(_tauH - _awakeH)}`;
  }

  function _updateLocationDisplay(name) {
    const el = document.getElementById('location-display');
    if (el) el.textContent = name || `${_settings.lat.toFixed(1)}°, ${_settings.lng.toFixed(1)}°`;
  }

  // ── Narrative form ────────────────────────────────────────────────────────────
  function onNarrativeChange() {
    const dateVal = document.getElementById('wake-date')?.value;
    const timeVal = document.getElementById('wake-time')?.value;
    if (!dateVal || !timeVal) return;
    const ms = new Date(`${dateVal}T${timeVal}:00`).getTime();
    if (!isFinite(ms)) return;
    _settings = CP.store.saveSettings({ anchorMs: ms });
    _refreshDerived();
    renderNow();
  }

  function _restoreNarrativeForm(ms) {
    const p = CP.sky.localParts(ms);
    const dateStr = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
    const timeStr = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    const dateEl = document.getElementById('wake-date');
    const timeEl = document.getElementById('wake-time');
    if (dateEl && !dateEl.value) dateEl.value = dateStr;
    if (timeEl && !timeEl.value) timeEl.value = timeStr;
  }

  // ── Tap actions ───────────────────────────────────────────────────────────────
  function onGoingToSleep() {
    const id = CP.store.newId();
    CP.store.addEntry({ id, type: 'sleep', start: Date.now(), end: null, note: '' });
    _refreshDerived();
    renderNow();
  }

  function onJustWoke() {
    const ongoing = CP.store.getOngoingEntry();
    if (!ongoing) return;
    const now = Date.now();
    CP.store.updateEntry(ongoing.id, { end: now });
    _settings = CP.store.saveSettings({ anchorMs: now });
    _refreshDerived();
    renderNow();
  }

  function onSleepless() {
    const now = Date.now();
    const id  = CP.store.newId();
    CP.store.addEntry({ id, type: 'sleepless', start: now, end: now, note: '' });
    _refreshDerived();
    renderLog();
  }

  // ── Log actions ───────────────────────────────────────────────────────────────
  let _editId = null;

  function openEdit(id) {
    _editId = id;
    const entry = CP.store.getEntries().find(e => e.id === id);
    if (!entry) return;

    const modal = document.getElementById('edit-modal');
    const mTitle = document.getElementById('modal-title');
    if (mTitle) mTitle.textContent = 'Edit Sleep Entry';

    // Populate start/end
    const startEl = document.getElementById('modal-start');
    const endEl   = document.getElementById('modal-end');
    const noteEl  = document.getElementById('modal-note');

    if (startEl && entry.start) {
      const p = CP.sky.localParts(entry.start);
      startEl.value = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }
    if (endEl && entry.end) {
      const p = CP.sky.localParts(entry.end);
      endEl.value = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }
    if (noteEl) noteEl.value = entry.note || '';

    if (modal) modal.classList.add('open');
  }

  function openNote(id) {
    _editId = id;
    const entry = CP.store.getEntries().find(e => e.id === id);
    if (!entry) return;

    const modal = document.getElementById('edit-modal');
    const mTitle = document.getElementById('modal-title');
    if (mTitle) mTitle.textContent = 'Add Note';

    const startEl = document.getElementById('modal-start');
    const endEl   = document.getElementById('modal-end');
    const noteEl  = document.getElementById('modal-note');

    if (startEl && entry.start) {
      const p = CP.sky.localParts(entry.start);
      startEl.value = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }
    if (endEl && entry.end) {
      const p = CP.sky.localParts(entry.end);
      endEl.value = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }
    if (noteEl) noteEl.value = entry.note || '';

    if (modal) modal.classList.add('open');
  }

  function closeModal() {
    _editId = null;
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('open');
  }

  function saveModal() {
    if (!_editId) return;
    const startEl = document.getElementById('modal-start');
    const endEl   = document.getElementById('modal-end');
    const noteEl  = document.getElementById('modal-note');

    const patch = {};
    if (startEl?.value) {
      const ms = new Date(startEl.value).getTime();
      if (isFinite(ms)) patch.start = ms;
    }
    if (endEl?.value) {
      const ms = new Date(endEl.value).getTime();
      if (isFinite(ms)) patch.end = ms;
    }
    if (noteEl) patch.note = noteEl.value.trim();

    CP.store.updateEntry(_editId, patch);
    closeModal();
    _refreshDerived();
    renderLog();
    renderNow();
  }

  function deleteEntry(id) {
    if (!confirm('Delete this sleep entry?')) return;
    CP.store.deleteEntry(id);
    _refreshDerived();
    renderLog();
    renderNow();
  }

  function onClearData() {
    if (!confirm('Delete ALL sleep data? This cannot be undone.')) return;
    CP.store.clearEntries();
    CP.store.saveSettings({ anchorMs: null });
    _refreshDerived();
    renderAll();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Public surface (for inline onclick) ─────────────────────────────────────
  window.CP = window.CP || {};
  CP.app = { openEdit, openNote, deleteEntry };

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

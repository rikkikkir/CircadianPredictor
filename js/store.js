// store.js — localStorage CRUD for sleep entries and settings
'use strict';
window.CP = window.CP || {};

CP.store = (() => {

  const ENTRIES_KEY  = 'cp_entries_v1';
  const SETTINGS_KEY = 'cp_settings_v1';

  const DEFAULT_SETTINGS = {
    tau:       25.4,
    awakeH:    13.4,
    anchorMs:  null,
    tauLocked: false,
    lat:       40.0,
    lng:      -75.0,
    locationName: null,
    name:      '',
    pronoun:   'they',
  };

  // ── Entries ──────────────────────────────────────────────────────────────────

  function getEntries() {
    try {
      return JSON.parse(localStorage.getItem(ENTRIES_KEY)) || [];
    } catch { return []; }
  }

  function saveEntries(entries) {
    try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)); } catch {}
  }

  function addEntry(entry) {
    const entries = getEntries();
    entries.push(entry);
    saveEntries(entries);
    return entry.id;
  }

  function updateEntry(id, patch) {
    const entries = getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    entries[idx] = { ...entries[idx], ...patch };
    saveEntries(entries);
    return true;
  }

  function deleteEntry(id) {
    const entries = getEntries().filter(e => e.id !== id);
    saveEntries(entries);
  }

  function clearEntries() {
    saveEntries([]);
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  function saveSettings(patch) {
    const current = getSettings();
    const updated = { ...current, ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch {}
    return updated;
  }

  // ── Derived helpers ──────────────────────────────────────────────────────────

  // Returns the most recent wake time (entry.end) or null
  function getLastWakeMs() {
    const entries = getEntries()
      .filter(e => e.type === 'sleep' && e.end !== null)
      .sort((a, b) => b.end - a.end);
    return entries.length ? entries[0].end : null;
  }

  // Returns the in-progress entry (end === null) or null
  function getOngoingEntry() {
    const entries = getEntries();
    return entries.find(e => e.end === null) || null;
  }

  // Unique ID
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return {
    getEntries, addEntry, updateEntry, deleteEntry, clearEntries,
    getSettings, saveSettings,
    getLastWakeMs, getOngoingEntry, newId,
  };

})();

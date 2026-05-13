# CircadianPredictor — Requirements & Goals

A web app for people with Non-24-Hour Sleep-Wake Disorder and related free-running
circadian rhythms. Built for an underserved community that currently has no mainstream
tools designed for their needs.

---

## Core Sleep Tracking

- **R1** One-tap sleep start / wake-up logging — no forms, just a button
- **R2** Sleepless night logging — log a night without sleep
- **R3** Per-entry notes — attach text to any sleep entry to explain irregularities,
  stress events, travel, schedule forcing, etc.
- **R4** Manual entry editing — correct start/end times after the fact
- **R5** LocalStorage persistence — no account, no server, works offline

---

## Prediction & Calculation

- **R6** Auto-calculate personal tau (cycle length) from logged history via averaging
  consecutive wake-time intervals — minimum 4 entries required
- **R7** Projected "natural thread" visible on charts — gold line showing where sleep
  would be predicted to fall based on the user's tau
- **R8** 7-day forward forecast with confidence fading — days 1–3 solid, 4–5 medium,
  6–7 lighter — because tau uncertainty compounds
- **R9** "Start Day" indicator — shows hours elapsed in current cycle and time until
  next predicted sleep window ("rest window opens in X")

---

## Visualizations

- **R10** **Circadian Wheel** — the centerpiece. Wake anchored at 12 o'clock,
  sky-color outer ring (18-stop realistic sky gradient), live pink hand showing
  current cycle position, stats card below wheel. Updates every 15 minutes.
- **R11** **Actogram** — historical sleep calendar showing blocks of sleep plotted
  on a 0–24h timeline, one row per day. The characteristic rightward diagonal drift
  of Non-24 is clearly visible. Canvas-based, zoomable.
- **R12** Gold "natural thread" on actogram — predicted wake time per day as a thin
  vertical line, showing when the user *would* wake on pure free-run
- **R13** Sunrise/sunset markers on wheel and actogram — so users can see how their
  cycle relates to daylight
- **R14** 7-day forecast grid — calendar-style rows with sleep blocks color-coded by
  confidence, sky gradient background

---

## Export & Sharing

- **R15** Share-by-URL — encode wheel state (anchor + tau + awake hours) in URL hash;
  paste to text a caregiver or partner
- **R16** Print/PDF export of actogram — formatted for medical appointments; helps
  doctors see the Non-24 drift pattern at a glance
- **R17** Data export as CSV and JSON — for spreadsheets, doctors, or import into
  future versions
- **R18** .ics calendar export of 7-day forecast — import predicted sleep/wake times
  into any calendar app

---

## Accessibility & Platform

- **R19** Semantic HTML with ARIA labels — screen reader / VoiceOver compatibility
- **R20** Web-first — works on iOS Safari, Android Chrome, desktop browsers; no app
  install required
- **R21** Dark theme with sufficient contrast — the sky palette is optimized for dark
  environments, especially useful for people who are often awake at night

---

## Future Versions (V2+)

The following were requested by users but are out of scope for V1:

- **F1** Wearable device integration — Oura, Fitbit, Apple Health, Google Fit — with
  auto-import and manual override
- **F2** Automated caregiver email — scheduled daily send of sleep-wake prediction
  to a trusted person (requires backend)
- **F3** Medication/supplement tracker that drifts with predicted circadian schedule —
  shifting reminders + log of what was taken; nothing like this exists anywhere
- **F4** Multi-user / account system — cloud sync across devices
- **F5** Android / iOS native app
- **F6** Partially free-running and quickening-rollover pattern support — for people
  whose cycle isn't stable
- **F7** "Meal time" scheduler based on circadian position — when to eat relative to
  your personal cycle, not the clock

---

## Design Philosophy

This app exists for a tiny, nearly invisible, and virtually unserved community.
The people using it are often awake at 3 AM, have been dismissed by doctors, and
struggle to explain their condition to employers and family. Every design decision
should serve these users:

- Use their language ("rest window", "cycle position", "tau"), not clinical jargon
- Make the beautiful sky visualization the hero — it communicates intuitively what
  a spreadsheet cannot
- Make doctor-export a first-class feature, not an afterthought
- Default to grace when data is missing — don't break, prompt gently

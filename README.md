# Circadian Predictor

Sleep tracking and cycle forecasting for Non-24-Hour Sleep-Wake Disorder and
free-running circadian rhythms.

**Live:** [rikkikkir.github.io/CircadianPredictor](https://rikkikkir.github.io/CircadianPredictor)

---

## What it does

People with Non-24-Hour Sleep-Wake Disorder have an internal clock that runs longer
than 24 hours — sleep drifts forward each day. This app helps them:

- **Track** sleep with one tap (start/end)
- **Visualize** their cycle on a sky-colored wheel
- **See** their drift pattern on an actogram (historical calendar)
- **Forecast** the next 7 days based on their measured tau
- **Export** charts and data for doctor appointments

---

## Features (V1)

| Feature | Status |
|---------|--------|
| One-tap sleep/wake logging | ✅ |
| Sleepless night logging | ✅ |
| Per-entry notes | ✅ |
| Circadian wheel (sky color, live hand) | ✅ |
| Personal tau auto-calculation | ✅ |
| Historical actogram (canvas, zoomable) | ✅ |
| 7-day forecast grid | ✅ |
| Share-by-URL | ✅ |
| CSV / JSON export | ✅ |
| .ics calendar export | ✅ |
| Print-for-doctor | ✅ |
| VoiceOver / ARIA labels | ✅ |
| Works offline (localStorage) | ✅ |

---

## Tech

- Vanilla JavaScript — no frameworks, no build step
- SVG for wheel and forecast
- Canvas for actogram
- LocalStorage for all data
- Spencer equations for accurate sunrise/sunset
- 18-stop sky color gradient for realistic atmospheric colors

---

## Requirements

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full feature list and roadmap.

---

## Related projects

- [Circadian Wheel](https://rikkikkir.github.io/circadian-wheel/) — standalone wheel calculator
- [Rikki's Personal Tracker](https://rikkikkir.github.io/circadian/) — personal dashboard with Oura Ring integration

---

Built by [Rikki Delaine](https://github.com/rikkikkir) — for the Non-24 community.

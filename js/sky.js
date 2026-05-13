// sky.js — sky color gradient + Spencer solar equations
// Shared by wheel, actogram, and forecast modules.

'use strict';
window.CP = window.CP || {};

CP.sky = (() => {

  // ── Time helpers ─────────────────────────────────────────────────────────────
  const _tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function _localFmt(tz) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false
    });
  }
  const _fmt = _localFmt(_tz);

  function localParts(ms) {
    const p = {};
    _fmt.formatToParts(new Date(ms)).forEach(({type, value}) => {
      if (type !== 'literal') p[type] = +value;
    });
    if (p.hour === 24) p.hour = 0;
    return p;
  }

  function localHour(ms) {
    const { hour, minute, second } = localParts(ms);
    return hour + minute / 60 + second / 3600;
  }

  function localDateStr(ms) {
    const { year, month, day } = localParts(ms);
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function tzOffsetHours(d) {
    const u = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const l = new Date(d.toLocaleString('en-US', { timeZone: _tz }));
    return (l - u) / 3600000;
  }

  // ── Spencer solar equations ──────────────────────────────────────────────────
  function sunTimes(dateObj, lat, lng) {
    lat = lat ?? 40.0;
    lng = lng ?? -75.0;
    const y   = dateObj.getFullYear();
    const doy = Math.round((dateObj - new Date(y, 0, 1)) / 86400000) + 1;
    const latR = lat * Math.PI / 180;
    const B    = 2 * Math.PI * (doy - 1) / 365;
    const decl = 0.006918 - 0.399912*Math.cos(B) + 0.070257*Math.sin(B)
               - 0.006758*Math.cos(2*B) + 0.000907*Math.sin(2*B);
    const haR  = Math.acos(Math.max(-1, Math.min(1, -Math.tan(latR) * Math.tan(decl))));
    const haH  = haR * 12 / Math.PI;
    const eot  = 229.18 * (0.000075 + 0.001868*Math.cos(B) - 0.032077*Math.sin(B)
                          - 0.014615*Math.cos(2*B) - 0.04089*Math.sin(2*B));
    const utcOff  = tzOffsetHours(dateObj);
    const lonCorr = (lng - utcOff * 15) / 15;
    const noon    = 12 - lonCorr - eot / 60;
    return { sunrise: noon - haH, sunset: noon + haH };
  }

  // ── Sky color at a given clock hour ──────────────────────────────────────────
  function skyColorAt(clockH, sunrise, sunset) {
    const stops = [
      [0,                              [4,9,24]     ],
      [sunrise - 1.5,                  [4,9,24]     ],
      [sunrise - 1.0,                  [8,15,38]    ],
      [sunrise - 0.5,                  [16,10,54]   ],
      [sunrise - 0.15,                 [38,22,64]   ],
      [sunrise,                        [122,90,16]  ],
      [sunrise + 0.4,                  [196,152,32] ],
      [sunrise + 1.2,                  [58,104,152] ],
      [Math.min(sunrise + 2.2, (sunrise+sunset)/2), [42,86,144] ],
      [Math.max(sunset  - 2.2, (sunrise+sunset)/2), [42,86,144] ],
      [sunset  - 1.2,                  [58,104,152] ],
      [sunset  - 0.4,                  [196,152,32] ],
      [sunset,                         [122,90,16]  ],
      [sunset  + 0.15,                 [38,22,64]   ],
      [sunset  + 0.5,                  [16,10,54]   ],
      [sunset  + 1.0,                  [8,15,38]    ],
      [sunset  + 1.5,                  [4,9,24]     ],
      [24,                             [4,9,24]     ],
    ];
    const cl = stops.map(([x,c]) => [Math.max(0, Math.min(24, x)), c]);
    cl.sort((a,b) => a[0] - b[0]);
    const hc = Math.max(0, Math.min(23.99, clockH));
    for (let i = 0; i < cl.length - 1; i++) {
      if (hc >= cl[i][0] && hc <= cl[i+1][0]) {
        const sp = cl[i+1][0] - cl[i][0];
        const t  = sp > 0 ? (hc - cl[i][0]) / sp : 0;
        const [r1,g1,b1] = cl[i][1], [r2,g2,b2] = cl[i+1][1];
        return `rgb(${Math.round(r1+t*(r2-r1))},${Math.round(g1+t*(g2-g1))},${Math.round(b1+t*(b2-b1))})`;
      }
    }
    return 'rgb(4,9,24)';
  }

  // CSS linear-gradient string for a full 0–24h timeline row
  function skyGradientCSS(sunrise, sunset) {
    const stops = [
      [0,           '#040918'],
      [sunrise-1.5, '#040918'],
      [sunrise-1.0, '#080f26'],
      [sunrise-0.5, '#100a36'],
      [sunrise-0.15,'#261640'],
      [sunrise,     '#7a5a10'],
      [sunrise+0.4, '#c49820'],
      [sunrise+1.2, '#3a6898'],
      [Math.min(sunrise+2.2,(sunrise+sunset)/2), '#2a5690'],
      [Math.max(sunset-2.2, (sunrise+sunset)/2), '#2a5690'],
      [sunset-1.2,  '#3a6898'],
      [sunset-0.4,  '#c49820'],
      [sunset,      '#7a5a10'],
      [sunset+0.15, '#261640'],
      [sunset+0.5,  '#100a36'],
      [sunset+1.0,  '#080f26'],
      [sunset+1.5,  '#040918'],
      [24,          '#040918'],
    ];
    const clamped = stops.map(([h,c]) => [Math.max(0, Math.min(24, h)), c]);
    clamped.sort((a,b) => a[0]-b[0]);
    const deduped = clamped.filter((p,i) => i===0 || p[0] > clamped[i-1][0] + 0.05);
    return `linear-gradient(to right,${deduped.map(([h,c]) => `${c} ${(h/24*100).toFixed(1)}%`).join(',')})`;
  }

  // ── Geolocation ──────────────────────────────────────────────────────────────
  async function reverseGeocode(lat, lng) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!r.ok) throw new Error();
      const { address: a = {} } = await r.json();
      const place = a.city || a.town || a.village || a.hamlet || a.county || '';
      const state = a.state || '';
      return place && state ? `${place}, ${state}` : place || state ||
             `${Math.abs(lat).toFixed(1)}°${lat>=0?'N':'S'}`;
    } catch {
      return `${Math.abs(lat).toFixed(1)}°${lat>=0?'N':'S'}, ${Math.abs(lng).toFixed(1)}°${lng>=0?'E':'W'}`;
    }
  }

  function tryGeolocation(onSuccess) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => onSuccess(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { timeout: 5000, maximumAge: 3600000 }
    );
  }

  return { sunTimes, skyColorAt, skyGradientCSS, localHour, localDateStr, localParts, reverseGeocode, tryGeolocation };

})();

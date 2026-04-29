// ==UserScript==
// @name         TORN CITY Flight Visualiser
// @namespace    sanxion.tc.flightvisualiser
// @version      42.0.0
// @license      MIT
// @description  Real-time animated flight visualiser for Torn City. SVG world map, curved animated flight path, plane animation, ATC commentary and live flight stats.
// @author       Sanxion [2987640]
// @match        https://www.torn.com/page.php?sid=travel*
// @updateURL    https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @downloadURL  https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @connect      api.torn.com
// @connect      c.statcounter.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     DESTINATIONS  (Torn City canon names — no "New York")
  ───────────────────────────────────────────────────────────── */

  const MAP_W = 1000;
  const MAP_H = 500;

  const DESTS = {
    torn: { label:'Torn City', country:'USA', city:'Torn City', lat:40.71, lon:-74.01, col:'#ff4444' },
    mexico: { label:'Mexico', country:'Mexico', city:'Ciudad Juarez', lat:31.73, lon:-106.49, col:'#ff8800' },
    caymans: { label:'Cayman Islands', country:'Cayman Islands', city:'George Town', lat:19.30, lon:-81.37, col:'#ffcc00' },
    canada: { label:'Canada', country:'Canada', city:'Toronto', lat:44.5, lon:-83.5, col:'#ff44cc' },
    hawaii: { label:'Hawaii', country:'USA', city:'Honolulu', lat:21.31, lon:-157.83, col:'#00ffcc' },
    uk: { label:'United Kingdom', country:'United Kingdom', city:'London', lat:51.51, lon:-0.13, col:'#4488ff' },
    argentina: { label:'Argentina', country:'Argentina', city:'Buenos Aires', lat:-34.61, lon:-58.38, col:'#44ffaa' },
    switzerland: { label:'Switzerland', country:'Switzerland', city:'Zurich', lat:47.38, lon:8.54, col:'#aa44ff' },
    japan: { label:'Japan', country:'Japan', city:'Tokyo', lat:35.69, lon:139.69, col:'#ff4488' },
    china: { label:'China', country:'China', city:'Beijing', lat:39.91, lon:116.39, col:'#ff8844' },
    uae: { label:'UAE', country:'United Arab Emirates', city:'Dubai', lat:25.20, lon:55.27, col:'#44ccff' },
    southafrica: { label:'South Africa', country:'South Africa', city:'Johannesburg', lat:-26.20, lon:28.04, col:'#88ff44' },
  };

  /* ─────────────────────────────────────────────────────────────
     BASE DURATIONS ms (standard ticket)
  ───────────────────────────────────────────────────────────── */

  const BASE_DUR = {
    torn_mexico:5400000, torn_caymans:4500000, torn_canada:2700000, torn_hawaii:14400000,
    torn_uk:10800000, torn_argentina:14400000, torn_switzerland:12600000,
    torn_japan:25200000, torn_china:25200000, torn_uae:21600000, torn_southafrica:25200000,
  };

  /* ─────────────────────────────────────────────────────────────
     TICKET TYPES  (per Torn City wiki)
     Standard    = Jumbo Jet   (max alt 32,000 ft)
     Business    = Jumbo Jet   (max alt 32,000 ft)
     Private     = Private Plane (max alt 32,000 ft)
     Airstrip    = Private Plane single-prop (max alt 12,000 ft)
  ───────────────────────────────────────────────────────────── */

  const TICKETS = {
    standard: { label:'Standard', plane:'jumbo', size:'large', mult:1.00, fuel:42000, speed:545, maxAlt:32000, col:'#aaaaaa' },
    business: { label:'Business Class', plane:'jumbo', size:'large', mult:1.15, fuel:47000, speed:575, maxAlt:32000, col:'#4488ff' },
    private: { label:'Private Plane', plane:'private_plane', size:'small', mult:1.80, fuel:18000, speed:480, maxAlt:32000, col:'#ff6644' },
    airstrip: { label:'Airstrip', plane:'prop_plane', size:'small', mult:1.60, fuel:6000, speed:180, maxAlt:12000, col:'#88ff44' },
  };

  /* ─────────────────────────────────────────────────────────────
     FLIGHT PHASES
  ───────────────────────────────────────────────────────────── */

  const PHASE_CFG = {
    ready: { label:'READY', col:'#6699aa' },
    takeoff: { label:'TAKE-OFF', col:'#ffcc44' },
    inflight: { label:'IN FLIGHT', col:'#44ccff' },
    descent: { label:'DESCENT', col:'#ffaa44' },
    landing: { label:'LANDING', col:'#ff8844' },
    arrived: { label:'LANDED', col:'#44ff88' },
    airport_closed: { label:'AIRPORT CLOSED', col:'#ff3333' },
  };

  const WEATHER = ['clear skies','partly cloudy','overcast','light rain','warm and humid','cool and breezy','sunny with light winds','scattered showers'];
  const rndW = () => WEATHER[Math.floor(Math.random() * WEATHER.length)];

  /* ─────────────────────────────────────────────────────────────
     COMMENTARY  (keyed by phase; each fn(params)->string)
     No duplicates — each phase fires exactly once per flight.
  ───────────────────────────────────────────────────────────── */

  // ── INFLIGHT POOLS — split by plane size ──────────────────────
  // Fixed messages always shown at start of inflight phase
  const INFLIGHT_FIXED_START_LARGE = [
    p => `Levelling off at ${p.maxAlt.toLocaleString()} feet. Weather good. All clear.`,
    () => 'Seatbelt sign has been turned off.',
    p => `${p.name} stretches in their seat ready for the flight ahead.`,
  ];
  const INFLIGHT_FIXED_START_SMALL = [
    p => `Levelling off at ${p.maxAlt.toLocaleString()} feet. Weather good. All clear.`,
    () => 'A jet flies past, upside down.',
  ];
  // Fixed messages always shown at end of inflight phase
  const INFLIGHT_FIXED_END = [
    p => `Cruising at ${p.speed} mph. Estimated arrival: ${p.eta}.`,
    p => `Arrival time about ${p.arrivalTime}.`,
  ];
  // Random pool for large planes — subset picked each flight
  const INFLIGHT_RANDOM_LARGE = [
    () => 'A baby starts crying across the aisle.',
    () => 'Another small plane flies past, the pilot lunatic eyed and looking crazy.',
    () => 'An indistinct shape walks down the aisle, grey coloured, but no discernable features.',
    () => 'Chedburn flies past.',
    p => `${p.name}'s seat gets constantly kicked from behind by a small child.`,
    () => 'A burning smell eminates from the aircon system.',
    () => 'Several passengers look particularly stark, raving, mad.',
    () => 'A couple a few rows back start fighting each other.',
    () => 'The passenger in front is a horse.',
    () => "Someone starts shouting, 'I'm sick of these m*fucking snakes on this m*fucking plane.'",
    () => 'Outside the window, a shadowy figure smashes up the wing.',
    () => 'A Canadian guy stares wide-eyed at the destruction to the wing.',
    () => 'WARNING: Flight proximity alert!',
    () => 'ATC stand by, unsure of error reason.',
    () => 'A jet flies past upside down — turbulence rocks the plane.',
  ];
  // Random pool for small planes — subset picked each flight
  const INFLIGHT_RANDOM_SMALL = [
    () => 'Up here, the sun shines brightly.',
    () => 'The engine hums steadily.',
    () => 'WARNING: Flight proximity alert!',
    () => 'ATC stand by, unsure of error reason.',
    p => `${p.name} does a loop the loop, here we go!`,
    () => 'A jet flies past — turbulence rocks the plane.',
  ];

  // Helper — returns the right commentary array based on plane size
  const isSmallPlane = () => TICKETS[S.ticket]?.size === 'small';

  const COMMENTARY = {
    ready_large: [
      () => 'Tower, pre-flight checks complete.',
      p => `Flight requesting clearance for take-off from ${p.src} Airport.`,
      () => 'Ladies and gentlemen, we are ready for take off.',
    ],
    ready_small: [
      p => `${p.name} requesting clearance for take-off from ${p.src} Airport.`,
      p => `Preflight checks confirmed. ${p.name}.`,
      () => 'Ready for instructions.',
    ],
    takeoff_large: [
      () => 'Cabin crew, cross-check ready for departure.',
      () => 'The airplane picks up speed.',
      () => 'The airplane leaves the ground.',
      () => 'Sit back and relax.',
      p => `Climbing to ${p.maxAlt.toLocaleString()} feet.`,
    ],
    takeoff_small: [
      p => `ATC: ${p.name}, you are cleared for take-off. Runway 1C. Proceed.`,
      () => 'Tower, increasing speed, throttle engaged.',
      p => `Climbing to ${p.maxAlt.toLocaleString()} feet.`,
    ],
    turbulence: [
      () => 'Slight turbulence — nothing to worry about.',
    ],
    descent_large: [
      () => 'Cabin crew, prepare for descent.',
      () => 'Miss Mile High Club pops her head up from behind a seat near the front.',
      () => 'Someone honks up their in-flight meal.',
      () => 'Please fasten your seatbelts.',
      () => 'Thank you for flying with us.',
      p => `Weather in ${p.dst} is ${rndW()}. Have a nice day.`,
      p => `${p.name} checks their weapons ready for plane disembarkation.`,
    ],
    descent_small: [
      () => 'Radar shows a clear descent vector.',
      p => `${p.name} flicks a few switches, initiating descent.`,
      p => `${p.name} requesting clearance into ${p.dst}.`,
      () => 'ATC: Confirmed, follow pre-planned flight path.',
      p => `Weather in ${p.dst} is ${rndW()}. Have a nice day.`,
      p => `${p.name} checks their weapons ready for plane disembarkation.`,
    ],
    landing_large: [
      () => 'Ladies and gentleman, we are close to landing. Please put seat backs in the upright position.',
      () => 'This is your captain speaking, burp, oops there goes the... click.',
      () => 'The to-ing and fro-ing of the plane is unnerving.',
      () => 'Yes, weapons look good and oiled.',
    ],
    landing_small: [
      () => 'Slight turbulence, but not too bad.',
      () => 'Approach is clear, no crosswind.',
      () => 'Yes, weapons look good and oiled.',
      () => "You can't wait to get out of this thing.",
    ],
    arrived: [
      () => '*Screech of tyres on tarmac.*',
      p => `Arrival confirmed at ${p.dst}.`,
      p => p.isTornCity
        ? 'Welcome to Torn City, please enjoy your stay, however long it will be. Stay safe. Thank you.'
        : 'Remember: due to current circumstances, it is advisable to get your business done, and then leave the country. Thank you.',
      p => p.isTornCity ? 'Right, back to business.' : null,
    ],
    return_start: [
      () => 'Refuel complete. Taxiing to runway. Have a nice flight.',
      p => `ATC: ${p.name}, you are cleared for take-off. Runway 2A. Proceed.`,
      () => 'Wheels up. Heading home.',
    ],
  };

  // Get commentary for size-dependent phases
  // Null entries in arrived are filtered (e.g. 'Right, back to business' only for Torn City)
  function getComm(phase, small) {
    const key = `${phase}_${small ? 'small' : 'large'}`;
    const arr = COMMENTARY[key] || COMMENTARY[phase] || [];
    return arr.filter(fn => fn !== null);
  }

  /* ─────────────────────────────────────────────────────────────
     STATE  — persisted via GM_setValue
  ───────────────────────────────────────────────────────────── */

  let S = {
    src:'torn', dst:null, depTime:null, arrTime:null,
    ticket:'standard', player:'Pilot', flying:false, isReturn:false,
    prevPhase:'', phasesTriggered:{}, turbTriggered:false, halfwayFired:false,
    log:[], px:20, py:60, pw:680, ph_panel:520, min:false, page:'main', apiKey:'',
    previewDst:null, inflightSchedule:null, planeScale:100, inflightLogStart:null, diagnostics:null, airportClosed:false,
  };

  const saveS = () => {
    try {
      GM_setValue('tcfv_v3', JSON.stringify({
        src:S.src, dst:S.dst, depTime:S.depTime, arrTime:S.arrTime,
        ticket:S.ticket, player:S.player, flying:S.flying, isReturn:S.isReturn,
        prevPhase:S.prevPhase, phasesTriggered:S.phasesTriggered, turbTriggered:S.turbTriggered, halfwayFired:S.halfwayFired,
        log:S.log.slice(-30), px:S.px, py:S.py, pw:S.pw, ph_panel:S.ph_panel,
        min:S.min, apiKey:S.apiKey, previewDst:S.previewDst, inflightSchedule:S.inflightSchedule, planeScale:S.planeScale, inflightLogStart:S.inflightLogStart, diagnostics:S.diagnostics, airportClosed:S.airportClosed,
      }));
    } catch(e) {}
  };

  const loadS = () => {
    try {
      const r = GM_getValue('tcfv_v3', null);
      if (r) Object.assign(S, JSON.parse(r));
      if (!S.phasesTriggered) S.phasesTriggered = {};
      if (!S.inflightSchedule) S.inflightSchedule = null;
      if (S.halfwayFired === undefined) S.halfwayFired = false;
      if (!S.planeScale) S.planeScale = 100;
      if (S.inflightLogStart === undefined) S.inflightLogStart = null;
    } catch(e) {}
  };

  /* ─────────────────────────────────────────────────────────────
     GEOMETRY
  ───────────────────────────────────────────────────────────── */

  const toXY = (lon, lat) => ({
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  });

  const haversine = (a, b) => {
    const R = 3958.8, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*r) * Math.cos(b.lat*r) * Math.sin(dLon/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
  };

  const getDur = (sk, dk, tk) => {
    const b = BASE_DUR[`${sk}_${dk}`] || BASE_DUR[`${dk}_${sk}`] || 7200000;
    return Math.round(b / (TICKETS[tk]?.mult || 1));
  };

  const buildBez = (sk, dk) => {
    const s = toXY(DESTS[sk].lon, DESTS[sk].lat);
    const d = toXY(DESTS[dk].lon, DESTS[dk].lat);
    const sag = Math.abs(d.x - s.x) * 0.22 + Math.abs(d.y - s.y) * 0.08;
    const c = { x:(s.x+d.x)/2, y:Math.max(8,(s.y+d.y)/2 - sag) };
    return { s, d, c };
  };

  const bPt = (t, s, c, d) => ({
    x: (1-t)**2*s.x + 2*(1-t)*t*c.x + t**2*d.x,
    y: (1-t)**2*s.y + 2*(1-t)*t*c.y + t**2*d.y,
  });

  const bAng = (t, s, c, d) => Math.atan2(
    2*(1-t)*(c.y-s.y) + 2*t*(d.y-c.y),
    2*(1-t)*(c.x-s.x) + 2*t*(d.x-c.x)
  ) * 180 / Math.PI;

  /* ─────────────────────────────────────────────────────────────
     FLIGHT CALCULATORS
  ───────────────────────────────────────────────────────────── */

  const getPhase = p => {
    if (!S.flying) return 'ready';
    if (p < 0.05) return 'takeoff';
    if (p < 0.75) return 'inflight';
    if (p < 0.90) return 'descent';
    if (p < 0.98) return 'landing';
    return 'arrived';
  };

  // timeLeftMs optional — when supplied, altitude drops to 0 at 60s before landing
  const getAlt = (p, timeLeftMs) => {
    const maxAlt = TICKETS[S.ticket]?.maxAlt || 32000;
    if (!S.flying || p <= 0) return 0;
    if (p < 0.05) return Math.round(maxAlt * (p / 0.05));
    if (p < 0.75) return maxAlt;
    if (timeLeftMs !== undefined && timeLeftMs <= 60000) return 0;
    return Math.max(0, Math.round(maxAlt * (1 - (p - 0.75) / 0.23)));
  };

  const getSpd = (p, mx) => {
    if (!S.flying || p <= 0) return 0;
    if (p < 0.05) return Math.round(mx * (p / 0.05));
    if (p < 0.90) return mx;
    if (p < 0.98) return Math.round(mx * (1 - (p - 0.90) / 0.08));
    return 0;
  };

  const getFuel = (p, tk) => Math.max(0, Math.round((TICKETS[tk]?.fuel || 42000) * (1 - Math.max(0, p))));

  const fmtTime = ms => {
    if (ms <= 0) return 'Arrived';
    const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
    return h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : m > 0 ? `${m}m ${String(ss).padStart(2,'0')}s` : `${ss}s`;
  };

  /* ─────────────────────────────────────────────────────────────
     MAP VIEWPORT ZOOM — zooms SVG viewBox to frame the route
  ───────────────────────────────────────────────────────────── */

  function getZoomedViewBox(sk, dk) {
    if (!sk || !dk) return `0 0 ${MAP_W} ${MAP_H}`;
    const s = toXY(DESTS[sk].lon, DESTS[sk].lat);
    const d = toXY(DESTS[dk].lon, DESTS[dk].lat);

    // Scale padding to route length so short routes zoom in closer
    const routeW = Math.abs(d.x - s.x);
    const routeH = Math.abs(d.y - s.y);
    const routeSpan = Math.sqrt(routeW * routeW + routeH * routeH);
    // Minimum span of 120px so very close routes still zoom in tightly
    const minSpan = 120;
    const effectiveSpan = Math.max(routeSpan, minSpan);
    const pad = Math.max(40, effectiveSpan * 0.35);

    let minX = Math.min(s.x, d.x) - pad;
    let maxX = Math.max(s.x, d.x) + pad;
    let minY = Math.min(s.y, d.y) - pad;
    let maxY = Math.max(s.y, d.y) + pad;
    // Clamp to map bounds
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(MAP_W, maxX);
    maxY = Math.min(MAP_H, maxY);
    // Enforce minimum viewbox so dots are readable
    const MIN_VW = 160;
    if (maxX - minX < MIN_VW) {
      const cx = (minX + maxX) / 2;
      minX = Math.max(0, cx - MIN_VW / 2);
      maxX = Math.min(MAP_W, cx + MIN_VW / 2);
    }
    // Maintain 2:1 aspect ratio
    const vw = maxX - minX, vh = maxY - minY;
    if (vw / vh < 2) {
      const extra = (vh * 2 - vw) / 2;
      minX = Math.max(0, minX - extra);
      maxX = Math.min(MAP_W, maxX + extra);
    }
    return `${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`;
  }

  /* ─────────────────────────────────────────────────────────────
     SVG WORLD MAP  (detailed coastline polygons, equirectangular)
  ───────────────────────────────────────────────────────────── */

  function buildMapSVG() {
    let dots = '';
    for (const [key, d] of Object.entries(DESTS)) {
      const { x, y } = toXY(d.lon, d.lat);
      const right = x < MAP_W * 0.55, lx = right ? 12 : -12, anc = right ? 'start' : 'end';
      dots += `<g id="tcfv-dot-${key}" class="dest-dot" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
  <circle class="dot-glow" r="10" fill="${d.col}" opacity="0.08"/>
  <circle class="dot-ring" r="5.5" fill="none" stroke="${d.col}" stroke-width="0.8" opacity="0.4"/>
  <circle class="dot-core" r="3.5" fill="${d.col}" opacity="0.85"/>
  <circle r="1.4" fill="#fff"/>
  <text class="dot-lbl" x="${lx}" y="4" font-size="9" fill="${d.col}" text-anchor="${anc}" font-family="Courier New,monospace" opacity="0.7" style="pointer-events:none">${d.city}</text>
</g>`;
    }

    return `<defs>
  <radialGradient id="og" cx="50%" cy="45%" r="65%">
    <stop offset="0%" stop-color="#0c2040"/>
    <stop offset="100%" stop-color="#05101a"/>
  </radialGradient>
  <filter id="gl" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glb" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
    <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.5)"/>
  </marker>
</defs>
<rect width="${MAP_W}" height="${MAP_H}" fill="url(#og)"/>
<!-- Graticule -->
<line x1="0" y1="${((90/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((90/180)*MAP_H).toFixed(0)}" stroke="#0d2035" stroke-width="1"/>
<line x1="${(MAP_W/2).toFixed(0)}" y1="0" x2="${(MAP_W/2).toFixed(0)}" y2="${MAP_H}" stroke="#0d2035" stroke-width="0.6"/>
<line x1="0" y1="${((66.5/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((66.5/180)*MAP_H).toFixed(0)}" stroke="#0c2a18" stroke-width="0.6" stroke-dasharray="6,6"/>
<line x1="0" y1="${((113.5/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((113.5/180)*MAP_H).toFixed(0)}" stroke="#0c2a18" stroke-width="0.6" stroke-dasharray="6,6"/>
<!-- ── NORTH AMERICA ── -->
<polygon points="130,64 171,41 253,34 306,36 349,45 388,65 391,89 376,114 360,137 370,170 348,208 318,235 289,255 260,272 232,260 203,235 175,215 149,185 130,143 119,105" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<!-- Alaska -->
<polygon points="34,64 87,47 114,59 107,82 67,91 29,81" fill="#1a4418" stroke="#2a6030" stroke-width="0.8"/>
<!-- Aleutians (simplified) -->
<ellipse cx="20" cy="105" rx="18" ry="4" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<!-- Greenland -->
<polygon points="334,23 383,15 411,33 398,64 352,71 329,51" fill="#22503a" stroke="#2e6c40" stroke-width="0.8"/>
<!-- Baja + Central America -->
<polygon points="170,174 193,196 185,238 165,254 148,225 163,190" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="218,235 253,258 246,279 228,285 204,266 200,245" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- Caribbean islands -->
<ellipse cx="294" cy="240" rx="17" ry="7" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<ellipse cx="256" cy="248" rx="7" ry="4" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- ── SOUTH AMERICA ── -->
<polygon points="237,254 280,242 338,249 373,277 385,326 367,380 338,412 296,420 261,398 242,350 234,303" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<polygon points="237,254 266,244 271,262 251,269 234,264" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- Falkland Islands -->
<ellipse cx="289" cy="415" rx="9" ry="5" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- ── EUROPE ── -->
<polygon points="444,60 483,46 530,41 573,50 602,64 608,84 587,101 556,111 516,107 480,97 447,82" fill="#1a4418" stroke="#2a6030" stroke-width="1"/>
<polygon points="444,82 481,77 484,115 461,129 435,110" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- Scandinavia -->
<polygon points="491,42 523,28 561,34 570,50 548,60 506,58" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- British Isles -->
<polygon points="454,67 482,60 489,80 474,88 452,81" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<ellipse cx="462" cy="58" rx="10" ry="6" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- Italy -->
<polygon points="519,101 539,95 545,116 536,138 521,141 513,123" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<!-- Iberian Peninsula -->
<polygon points="444,82 480,76 486,116 461,129 434,111" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<!-- Greece -->
<polygon points="573,102 590,97 588,115 574,118 565,109" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- ── AFRICA ── -->
<polygon points="470,143 524,131 602,130 659,155 683,200 666,257 628,302 587,335 540,351 496,325 469,283 462,236 469,188" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<!-- Horn of Africa -->
<polygon points="659,207 689,199 695,228 668,237 649,222" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- Madagascar -->
<polygon points="622,294 643,285 651,317 634,330 614,313" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- ── MIDDLE EAST ── -->
<polygon points="590,139 671,130 713,148 723,193 692,217 642,210 604,185" fill="#1a4418" stroke="#2a6030" stroke-width="0.8"/>
<!-- Turkey -->
<polygon points="578,103 647,94 668,109 663,129 598,136 572,120" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- ── ASIA ── -->
<polygon points="575,46 697,29 822,33 905,50 933,90 928,131 892,156 875,178 834,189 780,185 740,148 694,140 639,145 614,136 584,119 578,88" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<!-- Indian Subcontinent -->
<polygon points="656,147 722,140 750,162 745,231 710,248 676,229 649,190" fill="#1a4418" stroke="#2a6030" stroke-width="0.7"/>
<ellipse cx="744" cy="246" rx="8" ry="11" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- SE Asia / Indochina -->
<polygon points="736,148 793,139 820,164 797,197 757,201 736,178" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<!-- Malaysia / Indonesia (simplified) -->
<polygon points="793,202 832,192 848,210 826,225 798,218" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="836,220 877,215 890,234 862,244 838,235" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- Japan -->
<polygon points="869,113 892,107 906,132 891,152 872,145" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="888,96 907,91 918,110 904,118 887,112" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- Korean Peninsula -->
<polygon points="841,115 858,109 862,133 848,139 837,128" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- Taiwan -->
<polygon points="839,181 850,175 855,192 845,198" fill="#1a4418" stroke="#2a6030" stroke-width="0.3"/>
<!-- Philippines (simplified) -->
<ellipse cx="862" cy="196" rx="9" ry="14" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- ── AUSTRALIA ── -->
<polygon points="782,285 875,264 933,286 941,334 904,361 851,375 789,350 770,313" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<!-- Tasmania -->
<ellipse cx="875" cy="380" rx="12" ry="10" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- New Zealand -->
<polygon points="934,338 952,328 958,352 945,362 930,353" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="940,364 955,357 962,378 950,388 936,377" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<!-- ── ANTARCTICA ── -->
<rect x="0" y="${MAP_H - 24}" width="${MAP_W}" height="24" fill="#1a3a26" opacity="0.7"/>
<!-- Dynamic layers (drawn on top of land) -->
<g id="tcfv-pathg"></g>
${dots}
<g id="tcfv-planeg"></g>`;
  }

  /* ─────────────────────────────────────────────────────────────
     ANIMATED DASH OFFSET
  ───────────────────────────────────────────────────────────── */

  let dashAnimId = null;
  let dashOffset = 0;

  function startDashAnim() {
    if (dashAnimId) cancelAnimationFrame(dashAnimId);
    const step = () => {
      dashOffset = (dashOffset + 0.4) % 20;
      const ahead = document.getElementById('tcfv-route-ahead');
      if (ahead) ahead.style.strokeDashoffset = -dashOffset;
      dashAnimId = requestAnimationFrame(step);
    };
    dashAnimId = requestAnimationFrame(step);
  }

  function stopDashAnim() {
    if (dashAnimId) { cancelAnimationFrame(dashAnimId); dashAnimId = null; }
  }

  // Pre-computed bezier point array for current route (cached to avoid recalc every frame)
  let _pathPts = null;
  let _pathKey = '';

  function getPathPts(sk, dk) {
    const key = `${sk}-${dk}`;
    if (_pathKey === key && _pathPts) return _pathPts;
    const { s, d, c } = buildBez(sk, dk);
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const p = bPt(i / 120, s, c, d);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    _pathPts = pts;
    _pathKey = key;
    return pts;
  }

  /* ─────────────────────────────────────────────────────────────
     DRAW FLIGHT PATH  — solid trail behind plane, dashes ahead
  ───────────────────────────────────────────────────────────── */

  function drawPath(sk, dk) {
    const g = document.getElementById('tcfv-pathg');
    if (!g) return;
    if (!sk || !dk || sk === dk) {
      g.innerHTML = '';
      stopDashAnim();
      _pathPts = null;
      _pathKey = '';
      return;
    }
    const pts = getPathPts(sk, dk);
    const col = TICKETS[S.ticket]?.col || '#fff';
    const { s } = buildBez(sk, dk);
    const { d } = buildBez(sk, dk);
    // Initially draw full path as dashes (progress=0). updatePathProgress() splits it when flying.
    g.innerHTML = `
<polyline id="tcfv-route-trail" points="${pts[0]}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
<polyline id="tcfv-route-ahead" points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="12,8" stroke-linecap="round" opacity="0.55"/>
<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="5" fill="${DESTS[sk]?.col||'#fff'}" opacity="0.9" filter="url(#gl)"/>
<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="5" fill="${DESTS[dk]?.col||'#fff'}" opacity="0.9" filter="url(#gl)"/>`;
    startDashAnim();
  }

  // Called every tick to split the path at the plane's current position
  function updatePathProgress(progress, sk, dk) {
    if (!sk || !dk || sk === dk) return;
    const trail = document.getElementById('tcfv-route-trail');
    const ahead = document.getElementById('tcfv-route-ahead');
    if (!trail || !ahead) return;
    const pts = getPathPts(sk, dk);
    const N = pts.length - 1;
    // Split index based on progress
    const splitIdx = Math.max(0, Math.min(N, Math.round(progress * N)));
    // Trail: solid line from start to plane position
    const trailPts = pts.slice(0, splitIdx + 1);
    const aheadPts = pts.slice(splitIdx);
    if (trailPts.length >= 2) trail.setAttribute('points', trailPts.join(' '));
    else trail.setAttribute('points', pts[0] + ' ' + pts[0]);
    if (aheadPts.length >= 2) ahead.setAttribute('points', aheadPts.join(' '));
    else ahead.setAttribute('points', pts[N] + ' ' + pts[N]);
  }

  function drawPlane(progress, sk, dk) {
    const g = document.getElementById('tcfv-planeg');
    if (!g) return;
    if (!sk || !dk || sk === dk) { g.innerHTML = ''; return; }
    const { s, d, c } = buildBez(sk, dk);
    const t = Math.max(0.001, Math.min(0.999, progress));
    const pos = bPt(t, s, c, d), ang = bAng(t, s, c, d);
    const plane = TICKETS[S.ticket]?.plane || 'jumbo';
    const scale = (S.planeScale || 100) / 100;

    // Top-down airplane silhouette — white fill, black stroke, transparent background
    // Sized to be smaller than the destination dots (dot-core r=3.5, dot-ring r=5.5)
    let svgShape;
    if (plane === 'jumbo') {
      // Wide-body top-down: broad fuselage, swept wings, horizontal stabiliser
      svgShape = `
  <ellipse cx="0" cy="0" rx="1.5" ry="4.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-2 -6.5,1 -5.5,2 0,-0.5 5.5,2 6.5,1" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2.5,4.5 -2,5 0,3.5 2,5 2.5,4.5" fill="white" stroke="black" stroke-width="0.6"/>`;
    } else if (plane === 'private_plane') {
      // Slim private jet: narrow fuselage, swept wings, delta tail
      svgShape = `
  <ellipse cx="0" cy="0" rx="1" ry="4" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-1.5 -5,1.5 -4.5,2.5 0,0.5 4.5,2.5 5,1.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2,4 -1.5,4.5 0,3.25 1.5,4.5 2,4" fill="white" stroke="black" stroke-width="0.6"/>`;
    } else {
      // Single-prop: straight wings, prop crossbar at nose
      svgShape = `
  <ellipse cx="0" cy="0.5" rx="1" ry="3.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="-4.5,-0.5 -4,0.5 4,0.5 4.5,-0.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -1.5,4 -1,4.5 0,3.25 1,4.5 1.5,4" fill="white" stroke="black" stroke-width="0.6"/>
  <line x1="-1.5" y1="-4" x2="1.5" y2="-4" stroke="black" stroke-width="1.2" stroke-linecap="round"/>`;
    }

    // Rotation: bAng gives tangent angle where 0°=right, 90°=down (SVG convention).
    // The plane nose points up (-y = -90°). Adding 90° corrects this so nose aligns with travel direction.
    const rotAngle = ang + 90;

    g.innerHTML = `<g transform="translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${rotAngle.toFixed(1)}) scale(${scale})">
  <g filter="url(#gl)">${svgShape}
  </g>
</g>`;
  }

  /* ─────────────────────────────────────────────────────────────
     HIGHLIGHT SELECTED DOTS
  ───────────────────────────────────────────────────────────── */

  function highlightDots(srcK, dstK) {
    for (const key of Object.keys(DESTS)) {
      const isSelected = key === srcK || key === dstK;
      const dotG = document.getElementById(`tcfv-dot-${key}`);
      if (!dotG) continue;
      const core = dotG.querySelector('.dot-core');
      const glow = dotG.querySelector('.dot-glow');
      const lbl = dotG.querySelector('.dot-lbl');
      const ring = dotG.querySelector('.dot-ring');
      if (isSelected) {
        if (core) { core.setAttribute('r','5'); core.setAttribute('opacity','1'); }
        if (glow) { glow.setAttribute('r','16'); glow.setAttribute('opacity','0.28'); }
        if (lbl) { lbl.setAttribute('opacity','1'); lbl.setAttribute('font-size','11'); lbl.setAttribute('font-weight','bold'); }
        if (ring) { ring.setAttribute('opacity','1'); ring.setAttribute('stroke-width','1.4'); }
      } else {
        if (core) { core.setAttribute('r','3.5'); core.setAttribute('opacity','0.85'); }
        if (glow) { glow.setAttribute('r','10'); glow.setAttribute('opacity','0.08'); }
        if (lbl) { lbl.setAttribute('opacity','0.7'); lbl.setAttribute('font-size','9'); lbl.setAttribute('font-weight','normal'); }
        if (ring) { ring.setAttribute('opacity','0.4'); ring.setAttribute('stroke-width','0.8'); }
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     ELEMENT CACHE
  ───────────────────────────────────────────────────────────── */

  let el = {};

  /* ─────────────────────────────────────────────────────────────
     STATS UPDATE
  ───────────────────────────────────────────────────────────── */

  function updateStats(progress, timeLeftMs) {
    if (!el.status) return;
    const phase = getPhase(progress);
    const src = DESTS[S.src], dst = S.dst ? DESTS[S.dst] : (S.previewDst ? DESTS[S.previewDst] : null);
    const tkt = TICKETS[S.ticket] || TICKETS.standard;
    const totalDist = src && dst ? haversine(src, dst) : 0;
    let distRem;
    if (S.flying && timeLeftMs !== undefined && timeLeftMs <= 60000 && totalDist > 0) {
      // Smoothly interpolate from ~5 miles down to 0 over final 60 seconds
      distRem = Math.max(0, Math.round(5 * (timeLeftMs / 60000)));
    } else if (S.flying && progress > 0 && progress < 1 && totalDist > 0) {
      distRem = Math.round(totalDist * (1 - progress));
    } else {
      distRem = totalDist;
    }
    const ph = PHASE_CFG[phase] || PHASE_CFG.ready;

    el.status.textContent = ph.label;
    el.status.style.color = ph.col;
    el.destname.textContent = dst ? `${dst.city}, ${dst.country}` : '—';
    el.dist.textContent = totalDist > 0 ? `${distRem.toLocaleString()} mi` : '— mi';

    const dstKey = S.flying ? S.dst : S.previewDst;
    const srcKey = S.src;
    const dur = (srcKey && dstKey) ? getDur(srcKey, dstKey, S.ticket) : 0;
    el.eta.textContent = S.flying && timeLeftMs > 0 ? fmtTime(timeLeftMs) : (dur > 0 ? fmtTime(dur) : '—');

    el.alt.textContent = `${getAlt(progress, timeLeftMs).toLocaleString()} ft`;
    el.spd.textContent = `${getSpd(progress, tkt.speed)} mph`;
    el.fuel.textContent = `${getFuel(Math.max(0, progress), S.ticket).toLocaleString()} lbs`;
    el.tkt.textContent = tkt.label;
  }

  /* ─────────────────────────────────────────────────────────────
     COMMENTARY — fires once per phase, persists across refresh
  ───────────────────────────────────────────────────────────── */

  let phRunId = {};

  function addLog(text) {
    // While airport is closed, only allow airport-related messages
    // This blocks stale setTimeout callbacks from in-progress phase commentary
    if (S.airportClosed && !text.includes('Airport')) return;
    S.log.push(text);
    if (S.log.length > 30) S.log.shift();
    renderLog();
  }

  function renderLog() {
    if (!el.log) return;
    // On refresh during inflight, show only inflight+ messages (not takeoff/ready)
    const startIdx = (S.flying && S.inflightLogStart !== null) ? S.inflightLogStart : 0;
    const lines = S.log.slice(startIdx).slice(-8);
    el.log.innerHTML = lines.map((t, i) => {
      // Entries prefixed with '\x01' are pre-sanitised HTML — render as-is
      const isHtml = t.startsWith('\x01');
      const content = isHtml ? t.slice(1) : t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      return `<div class="tl${i === lines.length-1 ? ' tln' : ''}">&rsaquo; ${content}</div>`;
    }).join('');
    el.log.scrollTop = el.log.scrollHeight;
  }

  // Fire commentary messages for a phase, staggered — only once per flight per phase
  function triggerComm(phase, params) {
    if (S.phasesTriggered[phase]) return; // already fired this phase this flight
    S.phasesTriggered[phase] = true;
    saveS();
    const msgs = getComm(phase, params.isSmall);
    if (!msgs || !msgs.length) return;
    const rid = (phRunId[phase] = (phRunId[phase] || 0) + 1);
    msgs.forEach((fn, i) => {
      setTimeout(() => {
        if (phRunId[phase] === rid) {
          const msg = fn(params);
          if (msg) addLog(msg);
        }
      }, i * 3800);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     FLIGHT LOOP
  ───────────────────────────────────────────────────────────── */

  /* ─────────────────────────────────────────────────────────────
     INFLIGHT RANDOM SCHEDULER
     Picks a random subset of funny messages and spaces them
     evenly across the full inflight period. Persists to storage
     so a page refresh shows the same messages without repeats.
  ───────────────────────────────────────────────────────────── */

  function buildInflightSchedule() {
    if (S.inflightSchedule) return; // already built for this flight
    const total = S.arrTime - S.depTime;
    const inflightStart = S.depTime + total * 0.05;
    const inflightEnd = S.depTime + total * 0.75;
    const duration = inflightEnd - inflightStart;
    const small = TICKETS[S.ticket]?.size === 'small';
    const fixedStart = small ? INFLIGHT_FIXED_START_SMALL : INFLIGHT_FIXED_START_LARGE;
    const randomPool = small ? INFLIGHT_RANDOM_SMALL : INFLIGHT_RANDOM_LARGE;

    // Pick 3–5 random messages from the pool (never more than pool size)
    const poolSize = randomPool.length;
    const pickCount = Math.min(poolSize, 3 + Math.floor(Math.random() * 3));
    const indices = Array.from({ length: poolSize }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosen = indices.slice(0, pickCount).sort((a, b) => a - b);

    // Build schedule — fixed-start messages at beginning, random in middle, fixed-end near end
    const schedule = [];
    const fixedStartCount = fixedStart.length;
    const fixedEndCount = INFLIGHT_FIXED_END.length;
    const totalSlots = fixedStartCount + pickCount + fixedEndCount;
    const slotSize = duration / (totalSlots + 1);

    let slot = 1;
    // Fixed start messages
    for (let i = 0; i < fixedStartCount; i++) {
      schedule.push({ pool:'fixed_start', idx:i, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }
    // Random pool messages
    for (const idx of chosen) {
      schedule.push({ pool:'random', idx, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }
    // Fixed end messages
    for (let i = 0; i < fixedEndCount; i++) {
      schedule.push({ pool:'fixed_end', idx:i, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }

    S.inflightSchedule = schedule;
    saveS();
  }

  let loopTmr = null;
  let _noRaceCount = 0;
  let turbFired = false;

  function startLoop() {
    if (loopTmr) clearTimeout(loopTmr);
    tick();
  }

  function tick() {
    // Airport closed check — runs regardless of flying state
    // Use textContent (not innerText) — catches text in hidden/transitioning SPA elements
    const bodyText = document.body ? (document.body.textContent || '') : '';
    const RACE_STRING = 'You are currently in a race, you must leave or wait';
    const raceTextPresent = bodyText.includes(RACE_STRING);
    if (raceTextPresent) {
      _noRaceCount = 0;
      if (!S.airportClosed) {
        S.airportClosed = true;
        // Append airport message — keep existing commentary visible
        commentaryQueue = [];
        draining = false;
        const am = '\x01Airport closed — you are in a <a href="https://www.torn.com/page.php?sid=racing" target="_blank" style="color:#ff6666;text-decoration:underline">race</a>.';
        if (!S.log.includes(am)) {
          S.log.push(am);
          recentMessages.push('airport closed');
          renderLog();
        }
        saveS();
      }
      if (el.status) {
        el.status.textContent = PHASE_CFG.airport_closed.label;
        el.status.style.color = PHASE_CFG.airport_closed.col;
      }
      loopTmr = setTimeout(tick, 1500);
      return;
    }
    // Race text NOT found — 2 consecutive clear ticks before declaring re-opened
    if (S.airportClosed) {
      _noRaceCount = (_noRaceCount || 0) + 1;
      if (_noRaceCount >= 2) {
        S.airportClosed = false;
        _noRaceCount = 0;
        addLog('Airport has re-opened.');
        saveS();
      } else {
        if (el.status) {
          el.status.textContent = PHASE_CFG.airport_closed.label;
          el.status.style.color = PHASE_CFG.airport_closed.col;
        }
        loopTmr = setTimeout(tick, 1500);
        return;
      }
    }

    if (!S.flying || !S.dst) {
      updateStats(0, 0);
      loopTmr = setTimeout(tick, 2000);
      return;
    }

    const now = Date.now();
    const total = S.arrTime - S.depTime;
    const elapsed = now - S.depTime;
    const progress = Math.min(1, Math.max(0, elapsed / total));
    const timeLeft = Math.max(0, S.arrTime - now);
    const phase = getPhase(progress);
    const altNow = getAlt(progress, timeLeft);

    const arrDate = new Date(S.arrTime);
    const arrivalTime = `${String(arrDate.getHours()).padStart(2,'0')}:${String(arrDate.getMinutes()).padStart(2,'0')}`;

    const params = {
      name: S.player,
      src: DESTS[S.src]?.city || 'the airport',
      dst: DESTS[S.dst]?.city || 'your destination',
      eta: fmtTime(timeLeft),
      speed: TICKETS[S.ticket]?.speed || 545,
      maxAlt: TICKETS[S.ticket]?.maxAlt || 32000,
      arrivalTime,
      isTornCity: S.dst === 'torn',
      isSmall: TICKETS[S.ticket]?.size === 'small',
    };

    // Phase transition commentary (fires only once per phase)
    // Note: 'landing' phase commentary is handled separately via landing_screech at 60s mark
    // Note: 'inflight' phase is handled by the random scheduler below
    // Note: 'arrived' phase is handled manually below to ensure messages are saved before state resets
    if (phase !== S.prevPhase) {
      S.prevPhase = phase;
      if (phase !== 'landing' && phase !== 'inflight' && phase !== 'arrived') triggerComm(phase, params);
      if (phase === 'inflight') {
        // Mark as triggered so triggerComm won't double-fire, build schedule
        S.phasesTriggered.inflight = true;
        // Record log index so refresh only shows inflight messages, not takeoff
        if (S.inflightLogStart === null) {
          S.inflightLogStart = S.log.length;
          saveS();
        }
        buildInflightSchedule();
      }

      if (phase === 'arrived') {
        // Handle arrived manually: log all messages with staggered delays,
        // then reset state ONLY after the last message has been logged and saved.
        S.phasesTriggered.arrived = true;
        const arrivedFns = COMMENTARY.arrived;
        const capturedParams = Object.assign({}, params); // snapshot before any state change
        arrivedFns.forEach((fn, i) => {
          setTimeout(() => {
            const msg = fn(capturedParams);
            if (msg) addLog(msg);
            if (i === arrivedFns.length - 1) {
              // All arrived messages are now in the log — safe to reset and save
              const newSrc = S.dst;
              S.flying = false;
              S.src = newSrc;
              S.dst = null;
              S.phasesTriggered = {};
              S.inflightSchedule = null;
              turbFired = false;
              saveS();
              drawPath(null, null);
              drawPlane(0, S.src, S.src);
              highlightDots(S.src, null);
              updateStats(0, 0);
            }
          }, i * 3800);
        });
        // Keep ticking slowly until state has fully reset
        loopTmr = setTimeout(tick, arrivedFns.length * 3800 + 2500);
        return;
      }
    }

    // Fire scheduled inflight messages
    if (phase === 'inflight' && S.inflightSchedule) {
      const small = TICKETS[S.ticket]?.size === 'small';
      const fixedStart = small ? INFLIGHT_FIXED_START_SMALL : INFLIGHT_FIXED_START_LARGE;
      const randomPool = small ? INFLIGHT_RANDOM_SMALL : INFLIGHT_RANDOM_LARGE;
      let scheduleChanged = false;
      for (const item of S.inflightSchedule) {
        if (!item.fired && now >= item.fireAt) {
          item.fired = true;
          scheduleChanged = true;
          let fn;
          if (item.pool === 'fixed_start') fn = fixedStart[item.idx];
          else if (item.pool === 'fixed_end') fn = INFLIGHT_FIXED_END[item.idx];
          else fn = randomPool[item.idx];
          if (fn) addLog(fn(params));
        }
      }
      if (scheduleChanged) saveS();
    }

    // Halfway message — fires once at 50% progress during inflight, branched by plane size
    if (!S.halfwayFired && progress >= 0.5 && phase === 'inflight') {
      S.halfwayFired = true;
      const minsLeft = Math.round(timeLeft / 60000);
      const small = TICKETS[S.ticket]?.size === 'small';
      if (small) {
        addLog('Halfway there.');
        setTimeout(() => {
          addLog(`Probably land at ${arrivalTime}, which is about ${minsLeft} minutes time.`);
          saveS();
        }, 2000);
      } else {
        addLog('Ladies and gentlemen, we are now halfway.');
        setTimeout(() => {
          addLog(`We are expected to land at ${arrivalTime}, which is in about ${minsLeft} minutes time.`);
          saveS();
        }, 2000);
      }
      saveS();
    }
    if (!S.turbTriggered && (phase === 'inflight' || phase === 'descent') && Math.random() < 0.003) {
      S.turbTriggered = true;
      triggerComm('turbulence', params);
      saveS();
    }

    // Screech of tyres fires when altitude hits 0 — 60 seconds before end of flight
    if (timeLeft <= 60000 && S.flying && !S.phasesTriggered.landing_screech) {
      S.phasesTriggered.landing_screech = true;
      triggerComm('landing', params);
      saveS();
    }

    updateStats(progress, timeLeft);
    drawPlane(progress, S.src, S.dst);
    updatePathProgress(progress, S.src, S.dst);
    loopTmr = setTimeout(tick, 1000);
  }

  /* ─────────────────────────────────────────────────────────────
     BUILD HUD
  ───────────────────────────────────────────────────────────── */

  function buildHUD() {
    const panel = document.createElement('div');
    panel.id = 'tcfv';
    panel.style.width = S.pw + 'px';
    panel.style.height = S.ph_panel + 'px';

    panel.innerHTML = `
<div id="tcfv-hdr">
  <span id="tcfv-title">&#9992;&nbsp;TORN CITY FLIGHT VISUALISER</span>
  <div id="tcfv-hbtns">
    <button class="thb ta" id="thb-main" title="Flight View">&#9992;</button>
    <button class="thb" id="thb-diag" title="Diagnostics">&#9874;</button>
    <button class="thb" id="thb-set" title="API Settings">&#9881;</button>
    <button class="thb" id="thb-more" title="General Setting">&#9965;</button>
    <button class="thb" id="thb-radar" title="Overlay">&#9685;</button>
    <button class="thb" id="thb-cred" title="Credits">&#9733;</button>
    <button class="thb" id="thb-min" title="Minimise">&#8212;</button>
  </div>
</div>
<div id="tcfv-bod">

  <div id="tcfv-main" class="tcfv-pg">
    <div id="tcfv-mapbox">
      <svg id="tcfv-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${buildMapSVG()}</svg>
    </div>
    <div id="tcfv-lower">
      <div id="tcfv-stats">
        <div class="ts"><span class="tsl">Status</span>   <span class="tsv" id="ts-status">READY</span></div>
        <div class="ts"><span class="tsl">Destination</span> <span class="tsv" id="ts-destname">&#8212;</span></div>
        <div class="ts"><span class="tsl">Distance</span> <span class="tsv" id="ts-dist">&#8212; mi</span></div>
        <div class="ts"><span class="tsl">ETA</span>      <span class="tsv" id="ts-eta">&#8212;</span></div>
        <div class="ts"><span class="tsl">Altitude</span> <span class="tsv" id="ts-alt">0 ft</span></div>
        <div class="ts"><span class="tsl">Airspeed</span> <span class="tsv" id="ts-spd">&#8212; mph</span></div>
        <div class="ts"><span class="tsl">Fuel</span>     <span class="tsv" id="ts-fuel">&#8212; lbs</span></div>
        <div class="ts"><span class="tsl">Ticket</span>   <span class="tsv" id="ts-tkt">Standard</span></div>
      </div>
      <div id="tcfv-atc">
        <div id="tcfv-atc-ttl">&#128251; ATC / FLIGHT DECK</div>
        <div id="tcfv-log"></div>
      </div>
    </div>
  </div>

  <div id="tcfv-set" class="tcfv-pg" style="display:none">
    <h3>&#9881; API Settings</h3>
    <p>An <strong>API key</strong> lets the visualiser read your live flight data directly from the Torn City servers, giving accurate real departure and arrival times.</p>
    <p>To get your API key: log in to Torn City &rarr; <strong>Preferences</strong> &rarr; <strong>API Keys</strong> tab &rarr; create a new key with at least <em>Public Access</em> enabled. It is a 16-character alphanumeric string.</p>
    <label for="tcfv-api-inp">API Key</label><br>
    <input id="tcfv-api-inp" type="password" placeholder="Paste your Torn API key here" autocomplete="off" spellcheck="false">
    <br><br>
    <button class="tcfv-btn" id="tcfv-api-save">&#128190; Save Key</button>
    <button class="tcfv-btn" id="tcfv-api-test">&#128279; Test Connection</button>
    <p id="tcfv-api-msg"></p>
    <hr>
    <p class="note">Your API key is stored locally in Tampermonkey's secure storage and is only ever sent to api.torn.com. It is never transmitted anywhere else.</p>
  </div>

  <div id="tcfv-cred" class="tcfv-pg" style="display:none">
    <h3>&#9733; Credits</h3>
    <p class="big-t">TORN CITY<br>Flight Visualiser</p>
    <p class="ver-t">Version 42.0.0</p>
    <p>Designed &amp; developed by</p>
    <a href="https://www.torn.com/profiles.php?XID=2987640" target="_blank" id="tcfv-author">&#9992; Sanxion [2987640]</a>
    <hr>
    <p class="note">Built for the Torn City community. Not affiliated with Torn Ltd.<br>
    Flight timings, altimeter, airspeed, fuel loads and ATC commentary are approximations for entertainment purposes only.</p>
  </div>

  <div id="tcfv-diag" class="tcfv-pg" style="display:none">
    <div id="tcfv-diag-inner"></div>
  </div>

  <div id="tcfv-more" class="tcfv-pg" style="display:none">
    <h3>&#9965; General Setting</h3>
    <p>Adjust the size of the airplane image on the flight map.</p>
    <div id="tcfv-scale-wrap">
      <div class="scale-row">
        <label for="tcfv-scale-slider">Plane Size</label>
        <span id="tcfv-scale-val">100%</span>
      </div>
      <input id="tcfv-scale-slider" type="range" min="10" max="300" value="100" step="5">
      <div id="tcfv-plane-preview-wrap">
        <svg id="tcfv-plane-preview" viewBox="-20 -20 40 40" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
          <rect width="40" height="40" x="-20" y="-20" fill="#06101c" rx="4"/>
          <g id="tcfv-preview-plane" transform="scale(1)">
            <ellipse cx="0" cy="0" rx="1.5" ry="4.5" fill="white" stroke="black" stroke-width="0.8"/>
            <polygon points="0,-2 -6.5,1 -5.5,2 0,-0.5 5.5,2 6.5,1" fill="white" stroke="black" stroke-width="0.7"/>
            <polygon points="0,2.5 -2.5,4.5 -2,5 0,3.5 2,5 2.5,4.5" fill="white" stroke="black" stroke-width="0.6"/>
          </g>
        </svg>
        <p class="note" style="margin-top:6px">Preview updates in real time. Actual plane on map rotates with flight direction.</p>
      </div>
    </div>
  </div>

</div>
<div id="tcfv-resize-handle" title="Drag to resize"></div>`;

    document.body.appendChild(panel);

    el = {
      panel,
      bod: panel.querySelector('#tcfv-bod'),
      status: panel.querySelector('#ts-status'),
      destname: panel.querySelector('#ts-destname'),
      dist: panel.querySelector('#ts-dist'),
      eta: panel.querySelector('#ts-eta'),
      alt: panel.querySelector('#ts-alt'),
      spd: panel.querySelector('#ts-spd'),
      fuel: panel.querySelector('#ts-fuel'),
      tkt: panel.querySelector('#ts-tkt'),
      log: panel.querySelector('#tcfv-log'),
      pgMain: panel.querySelector('#tcfv-main'),
      pgSet: panel.querySelector('#tcfv-set'),
      pgCred: panel.querySelector('#tcfv-cred'),
      pgMore: panel.querySelector('#tcfv-more'),
      pgDiag: panel.querySelector('#tcfv-diag'),
      svg: panel.querySelector('#tcfv-svg'),
    };

    panel.style.left = S.px + 'px';
    panel.style.top = S.py + 'px';

    makeDrag(panel, panel.querySelector('#tcfv-hdr'));
    makeResize(panel, panel.querySelector('#tcfv-resize-handle'));

    panel.querySelector('#thb-min').addEventListener('click', () => doMin(false));
    panel.querySelector('#thb-radar').addEventListener('click', doRadar);
    panel.querySelector('#thb-main').addEventListener('click', () => showPg('main'));
    panel.querySelector('#thb-diag').addEventListener('click', () => showPg('diag'));
    panel.querySelector('#thb-set').addEventListener('click', () => showPg('set'));
    panel.querySelector('#thb-more').addEventListener('click', () => showPg('more'));
    panel.querySelector('#thb-cred').addEventListener('click', () => showPg('cred'));

    const apiInp = panel.querySelector('#tcfv-api-inp');
    apiInp.value = S.apiKey || '';
    panel.querySelector('#tcfv-api-save').addEventListener('click', () => {
      S.apiKey = apiInp.value.trim(); saveS();
      const m = panel.querySelector('#tcfv-api-msg');
      m.textContent = 'Key saved successfully.'; m.style.color = '#44ff88';
    });
    panel.querySelector('#tcfv-api-test').addEventListener('click', () =>
      testApiKey(apiInp.value.trim(), panel.querySelector('#tcfv-api-msg'))
    );

    // Plane size slider
    const slider = panel.querySelector('#tcfv-scale-slider');
    const scaleVal = panel.querySelector('#tcfv-scale-val');
    const previewPlane = panel.querySelector('#tcfv-preview-plane');
    slider.value = S.planeScale || 100;
    scaleVal.textContent = `${slider.value}%`;
    slider.addEventListener('input', () => {
      S.planeScale = parseInt(slider.value, 10);
      scaleVal.textContent = `${S.planeScale}%`;
      const sc = S.planeScale / 100;
      if (previewPlane) previewPlane.setAttribute('transform', `scale(${sc})`);
      saveS();
    });
    // Set initial preview scale
    if (previewPlane) previewPlane.setAttribute('transform', `scale(${(S.planeScale || 100) / 100})`);
    // Restore radar mode
    try {
      const saved = GM_getValue('tcfv_radar', 0);
      radarMode = typeof saved === 'number' ? saved : (saved ? 1 : 0);
      if (radarMode > 0) applyRadarMode(el.panel);
    } catch(e) {}
    // Restore minimise state directly (doMin toggles so cannot be used here)
    if (S.min) {
      el.bod.style.display = 'none';
      document.querySelector('#tcfv-resize-handle').style.display = 'none';
      el.panel.style.height = 'auto';
      el.panel.style.minHeight = '0';
      el.panel.style.resize = 'none';
      document.querySelector('#thb-min').innerHTML = '&#9633;';
    }
    showPg(S.page || 'main');
  }

  function showPg(pg) {
    S.page = pg;
    el.pgMain.style.display = pg === 'main' ? 'flex' : 'none';
    el.pgSet.style.display = pg === 'set' ? 'block' : 'none';
    el.pgCred.style.display = pg === 'cred' ? 'block' : 'none';
    el.pgMore.style.display = pg === 'more' ? 'block' : 'none';
    el.pgDiag.style.display = pg === 'diag' ? 'flex' : 'none';
    if (pg === 'diag') renderDiagPage();
    document.querySelectorAll('.thb').forEach(b => b.classList.remove('ta'));
    const map = { main:'#thb-main', set:'#thb-set', cred:'#thb-cred', more:'#thb-more', diag:'#thb-diag' };
    document.querySelector(map[pg])?.classList.add('ta');
    saveS();
  }

  // ── DIAGNOSTICS ──────────────────────────────────────────────────────────

  const DIAG_STATUS_COLS = { green:'#44ff88', yellow:'#ffcc44', red:'#ff4444' };

  function generateDiagnostics() {
    const isSmall = TICKETS[S.ticket]?.size === 'small';
    const rnd = () => {
      const r = Math.random();
      if (r < 0.72) return 'green';
      if (r < 0.92) return 'yellow';
      return 'red';
    };
    const largeSystems = [
      { id:'electrical', name:'Electrical Systems', detail:'All buses nominal', x:140, y:52 },
      { id:'pressure', name:'Cabin Pressure', detail:'8.0 psi differential', x:140, y:80 },
      { id:'engines', name:'Engines (x4)', detail:'CFM56-7B thrust nominal', x:38, y:118 },
      { id:'wings', name:'Wings', detail:'Control surfaces nominal', x:252, y:108 },
      { id:'gear', name:'Flight Gear', detail:'Gear deployed', x:140, y:143 },
      { id:'tail', name:'Tail Wing', detail:'Stabilisers nominal', x:140, y:178 },
    ];
    const smallSystems = [
      { id:'electrical', name:'Electrical Systems', detail:'Battery & alternator OK', x:140, y:68 },
      { id:'engine', name:'Engine', detail:'Lycoming O-360 nominal', x:140, y:22 },
      { id:'wings', name:'Wings', detail:'Control surfaces nominal', x:28, y:96 },
      { id:'gear', name:'Flight Gear', detail:'Gear deployed', x:140, y:128 },
      { id:'tail', name:'Tail Wing', detail:'Stabiliser nominal', x:140, y:162 },
    ];
    const systems = (isSmall ? smallSystems : largeSystems).map(s => ({ ...s, status: rnd() }));
    return { isSmall, systems };
  }

  function diagSVGLarge(systems) {
    const sysMap = {};
    systems.forEach(s => { sysMap[s.id] = s.status; });
    const col = id => DIAG_STATUS_COLS[sysMap[id]] || '#444';
    return `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-height:200px">
  <rect width="280" height="200" fill="#050e05"/>
  <!-- Fuselage -->
  <ellipse cx="140" cy="100" rx="13" ry="88" fill="none" stroke="#5ab0e8" stroke-width="1.5"/>
  <!-- Main wings -->
  <polygon points="130,75 22,120 26,130 134,92" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <polygon points="150,75 258,120 254,130 146,92" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <!-- Engine nacelles (L) -->
  <ellipse cx="38" cy="118" rx="8" ry="13" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="78" cy="105" rx="7" ry="11" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <!-- Engine nacelles (R) -->
  <ellipse cx="202" cy="105" rx="7" ry="11" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="242" cy="118" rx="8" ry="13" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <!-- Tail stabilisers -->
  <polygon points="131,168 96,179 99,185 133,175" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <polygon points="149,168 184,179 181,185 147,175" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <!-- Nose -->
  <ellipse cx="140" cy="18" rx="6" ry="8" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <!-- Indicator dots with labels -->
  <circle cx="140" cy="52" r="5" fill="${col('electrical')}" opacity="0.9"/>
  <circle cx="140" cy="80" r="5" fill="${col('pressure')}" opacity="0.9"/>
  <circle cx="38" cy="118" r="5" fill="${col('engines')}" opacity="0.9"/>
  <circle cx="252" cy="108" r="5" fill="${col('wings')}" opacity="0.9"/>
  <circle cx="140" cy="143" r="5" fill="${col('gear')}" opacity="0.9"/>
  <circle cx="140" cy="178" r="5" fill="${col('tail')}" opacity="0.9"/>
  <!-- Connecting lines to labels -->
  <line x1="145" y1="52" x2="165" y2="52" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="80" x2="165" y2="80" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="43" y1="118" x2="63" y2="118" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="247" y1="108" x2="227" y2="108" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="143" x2="165" y2="143" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="178" x2="165" y2="178" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
</svg>`;
  }

  function diagSVGSmall(systems) {
    const sysMap = {};
    systems.forEach(s => { sysMap[s.id] = s.status; });
    const col = id => DIAG_STATUS_COLS[sysMap[id]] || '#444';
    return `<svg viewBox="0 0 280 190" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-height:190px">
  <rect width="280" height="190" fill="#050e05"/>
  <!-- Fuselage -->
  <ellipse cx="140" cy="95" rx="10" ry="74" fill="none" stroke="#88ff44" stroke-width="1.5"/>
  <!-- Straight wings -->
  <polygon points="132,88 20,96 22,104 134,95" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <polygon points="148,88 260,96 258,104 146,95" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <!-- Propeller at nose -->
  <ellipse cx="140" cy="25" rx="6" ry="6" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <line x1="140" y1="8" x2="140" y2="22" stroke="#88ff44" stroke-width="2"/>
  <line x1="125" y1="20" x2="155" y2="20" stroke="#88ff44" stroke-width="2" stroke-linecap="round"/>
  <!-- Tail stabilisers -->
  <polygon points="132,155 100,165 102,171 134,162" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <polygon points="148,155 180,165 178,171 146,162" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <!-- Indicator dots -->
  <circle cx="140" cy="68" r="5" fill="${col('electrical')}" opacity="0.9"/>
  <circle cx="140" cy="22" r="5" fill="${col('engine')}" opacity="0.9"/>
  <circle cx="28" cy="96" r="5" fill="${col('wings')}" opacity="0.9"/>
  <circle cx="140" cy="128" r="5" fill="${col('gear')}" opacity="0.9"/>
  <circle cx="140" cy="162" r="5" fill="${col('tail')}" opacity="0.9"/>
  <!-- Lines -->
  <line x1="145" y1="68" x2="165" y2="68" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="22" x2="165" y2="22" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="33" y1="96" x2="53" y2="96" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="128" x2="165" y2="128" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="162" x2="165" y2="162" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
</svg>`;
  }

  function renderDiagPage() {
    const inner = document.getElementById('tcfv-diag-inner');
    if (!inner) return;
    if (!S.diagnostics) S.diagnostics = generateDiagnostics();
    const d = S.diagnostics;
    // Update flight gear status and detail based on flight phase
    const gearSys = d.systems.find(s => s.id === 'gear');
    if (gearSys) {
      const phase = S.flying ? (S.arrTime && (S.arrTime - Date.now() < 120000) ? 'landing' : 'flying') : 'ground';
      if (phase === 'ground' || phase === 'landing') {
        gearSys.status = 'green';
        gearSys.detail = 'Gear deployed';
      } else {
        // Airborne — gear retracted (keep the random status from generation)
        gearSys.detail = 'Gear retracted';
      }
    }
    const schematic = d.isSmall ? diagSVGSmall(d.systems) : diagSVGLarge(d.systems);
    const acType = d.isSmall ? 'PRIVATE PLANE' : 'JUMBO JET';
    const rows = d.systems.map(s => {
      const col = DIAG_STATUS_COLS[s.status];
      const label = s.status.toUpperCase();
      return `<div class="diag-row">
  <span class="diag-ind" style="background:${col}"></span>
  <span class="diag-name">${s.name}</span>
  <span class="diag-detail">${s.detail}</span>
  <span class="diag-status" style="color:${col}">${label}</span>
</div>`;
    }).join('');
    inner.innerHTML = `<div class="diag-header">
  <span class="diag-title">&#9874; AIRCRAFT DIAGNOSTICS</span>
  <span class="diag-type">${acType}</span>
</div>
<div class="diag-schematic">${schematic}</div>
<div class="diag-systems">${rows}</div>`;
  }

  const RADAR_MODES = [
    null,
    { name:'green', rc:'#00ff44', mid:'#006622', dark:'#000a00', line:'#004400', glow:'rgba(0,255,68,.3)', hue:90 },
    { name:'yellow', rc:'#ffee00', mid:'#665500', dark:'#0a0a00', line:'#444400', glow:'rgba(255,238,0,.3)', hue:45 },
    { name:'cyan', rc:'#00ffee', mid:'#006655', dark:'#000a09', line:'#004440', glow:'rgba(0,255,238,.3)', hue:170 },
    { name:'blue', rc:'#4488ff', mid:'#1a3a88', dark:'#000518', line:'#1a3060', glow:'rgba(68,136,255,.3)', hue:200 },
    { name:'purple', rc:'#cc44ff', mid:'#551a88', dark:'#080010', line:'#440088', glow:'rgba(204,68,255,.3)', hue:270 },
    { name:'orange', rc:'#ff8800', mid:'#883300', dark:'#0a0500', line:'#662200', glow:'rgba(255,136,0,.3)', hue:20 },
    { name:'red', rc:'#ff2244', mid:'#881122', dark:'#0a0005', line:'#660022', glow:'rgba(255,34,68,.3)', hue:0 },
    { name:'grey', rc:'#cccccc', mid:'#666666', dark:'#0a0a0a', line:'#333333', glow:'rgba(200,200,200,.2)', hue:0 },
  ];

  let radarMode = 0; // 0=normal, 1-8=colour modes

  function applyRadarMode(panel) {
    const mode = RADAR_MODES[radarMode];
    const btn = document.querySelector('#thb-radar');
    if (!mode) {
      panel.classList.remove('radar-mode');
      ['--rc','--rc-mid','--rc-dark','--rc-line','--rc-glow','--rc-filter'].forEach(v => panel.style.removeProperty(v));
      if (btn) { btn.classList.remove('ta'); btn.title = 'Overlay'; }
    } else {
      panel.classList.add('radar-mode');
      panel.style.setProperty('--rc', mode.rc);
      panel.style.setProperty('--rc-mid', mode.mid);
      panel.style.setProperty('--rc-dark', mode.dark);
      panel.style.setProperty('--rc-line', mode.line);
      panel.style.setProperty('--rc-glow', mode.glow);
      const g = mode.name === 'grey' ? 'grayscale(0.7) ' : '';
      panel.style.setProperty('--rc-filter', `${g}sepia(1) saturate(4) hue-rotate(${mode.hue}deg) brightness(0.85)`);
      if (btn) { btn.classList.add('ta'); btn.title = `Overlay (${mode.name})`; }
    }
    try { GM_setValue('tcfv_radar', radarMode); } catch(e) {}
  }

  function doRadar() {
    radarMode = (radarMode + 1) % RADAR_MODES.length;
    applyRadarMode(el.panel);
  }

  function doMin(silent) {
    S.min = !S.min;
    const panel = el.panel;
    const resizeHandle = document.querySelector('#tcfv-resize-handle');
    if (S.min) {
      // Collapse to just the header bar
      el.bod.style.display = 'none';
      resizeHandle.style.display = 'none';
      panel.style.height = 'auto';
      panel.style.minHeight = '0';
      panel.style.resize = 'none';
    } else {
      // Restore to full size
      el.bod.style.display = 'block';
      resizeHandle.style.display = 'block';
      panel.style.height = S.ph_panel + 'px';
      panel.style.minHeight = '420px';
    }
    document.querySelector('#thb-min').innerHTML = S.min ? '&#9633;' : '&#8212;';
    if (!silent) saveS();
  }

  /* ─────────────────────────────────────────────────────────────
     DRAG & RESIZE
  ───────────────────────────────────────────────────────────── */

  function makeDrag(panel, handle) {
    let drag = false, ox = 0, oy = 0;
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
      e.preventDefault();
      e.stopPropagation(); // prevent Torn City map elements from receiving this event
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const nx = e.clientX - ox;
      const ny = e.clientY - oy;
      panel.style.left = nx + 'px'; panel.style.top = ny + 'px';
      S.px = nx; S.py = ny;
    });
    document.addEventListener('mouseup', () => { if (drag) { drag = false; saveS(); } });
  }

  function makeResize(panel, handle) {
    let resz = false, sx = 0, sy = 0, sw = 0, sh = 0;
    handle.addEventListener('mousedown', e => {
      resz = true; sx = e.clientX; sy = e.clientY;
      sw = panel.offsetWidth; sh = panel.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!resz) return;
      const nw = Math.max(500, sw + (e.clientX - sx));
      const nh = Math.max(420, sh + (e.clientY - sy));
      panel.style.width = nw + 'px'; panel.style.height = nh + 'px';
      S.pw = nw; S.ph_panel = nh;
    });
    document.addEventListener('mouseup', () => { if (resz) { resz = false; saveS(); } });
  }

  /* ─────────────────────────────────────────────────────────────
     PREVIEW DESTINATION  (immediate update when dest clicked)
  ───────────────────────────────────────────────────────────── */

  function previewDest(dstK) {
    if (S.flying) return;
    S.previewDst = dstK;
    drawPath(S.src, dstK);
    // Zoom map to frame the route
    if (el.svg) el.svg.setAttribute('viewBox', getZoomedViewBox(S.src, dstK));
    highlightDots(S.src, dstK);
    updateStats(0, 0);
    saveS();
  }

  /* ─────────────────────────────────────────────────────────────
     TORN PAGE DETECTION
  ───────────────────────────────────────────────────────────── */

  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  function matchDest(text) {
    if (!text) return null;
    const t = norm(text);
    for (const [k, d] of Object.entries(DESTS)) {
      if (t.includes(norm(d.city)) || t.includes(norm(d.country)) || t.includes(norm(d.label))) return k;
    }
    return null;
  }

  function matchTicket(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('private') && t.includes('jet')) return 'private';
    if (t.includes('airstrip') || t.includes('private plane')) return 'airstrip';
    if (t.includes('business')) return 'business';
    return 'standard';
  }

  function readSelectedDest() {
    const sels = [
      '[class*="travel"][class*="active"]', '[class*="destination"][class*="active"]',
      '[class*="country"][class*="active"]', '[class*="selected"]',
    ];
    for (const sel of sels) {
      for (const node of document.querySelectorAll(sel)) {
        const m = matchDest(node.textContent);
        if (m) return m;
      }
    }
    return null;
  }

  function readSelectedTicket() {
    const sels = [
      '[class*="ticket"][class*="active"]', '[class*="class"][class*="active"]',
      '[class*="method"][class*="active"]', '[class*="travel-method"][class*="active"]',
    ];
    for (const sel of sels) {
      const found = document.querySelector(sel);
      if (found) return matchTicket(found.textContent);
    }
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
     HOOK — capture-phase click listener
  ───────────────────────────────────────────────────────────── */

  function hookClicks() {
    document.addEventListener('click', e => {
      let t = e.target;
      for (let i = 0; i < 5; i++) {
        if (!t) break;
        const txt = (t.textContent || '').trim().toLowerCase();
        const cls = (t.className || '').toString().toLowerCase();
        const id = (t.id || '').toLowerCase();

        // Destination dot click → preview immediately
        if (!S.flying && (cls.includes('country') || cls.includes('destination') || cls.includes('travel') || cls.includes('city') || cls.includes('location'))) {
          const dm = matchDest(t.textContent);
          if (dm && dm !== S.src) { previewDest(dm); }
        }

        // Ticket type selection → update ticket on visualiser immediately
        if (cls.includes('ticket') || cls.includes('class') || cls.includes('method') || cls.includes('airstrip')) {
          const tk = matchTicket(t.textContent);
          if (S.ticket !== tk) {
            S.ticket = tk;
            if (el.tkt) el.tkt.textContent = TICKETS[tk]?.label || tk;
            if (S.previewDst && !S.flying) {
              drawPath(S.src, S.previewDst);
              updateStats(0, 0);
            }
            saveS();
          }
        }

        // Return home / fly back button detection
        if ((txt.includes('return') && (txt.includes('home') || txt.includes('torn') || txt.includes('back'))) ||
          txt === 'fly home' || txt === 'return home' || txt === 'go home' ||
          cls.includes('return') || cls.includes('fly-home') || id.includes('return') || id.includes('home')) {
          if (S.src !== 'torn' && !S.flying) {
            startFlight('torn', S.ticket, true);
            return;
          }
        }

        // Fly button
        if (txt === 'fly' || txt === 'fly now' || txt === 'fly!' || txt === 'take off' ||
          cls.includes('fly-btn') || cls.includes('flybtn') || id.includes('fly') || id.includes('takeoff')) {
          const dst = readSelectedDest() || S.previewDst || S.dst;
          const tkt = readSelectedTicket() || S.ticket;
          if (dst) { startFlight(dst, tkt, S.src !== 'torn'); return; }
        }

        t = t.parentElement;
      }
    }, true);
  }

  /* ─────────────────────────────────────────────────────────────
     NETWORK HOOK  (XHR + fetch intercept)
  ───────────────────────────────────────────────────────────── */

  function hookNetwork() {
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, u, ...r) { this._turl = u; return oOpen.apply(this, [m, u, ...r]); };
    XMLHttpRequest.prototype.send = function(...a) {
      this.addEventListener('load', function() {
        try { handleNetResponse(this._turl, JSON.parse(this.responseText)); } catch(e) {}
      });
      return oSend.apply(this, a);
    };
    const oFetch = window.fetch;
    window.fetch = function(...a) {
      const url = typeof a[0] === 'string' ? a[0] : (a[0]?.url || '');
      const pr = oFetch.apply(this, a);
      pr.then(r => r.clone().text().then(t => {
        try { handleNetResponse(url, JSON.parse(t)); } catch(e) {}
      })).catch(() => {});
      return pr;
    };
  }

  function handleNetResponse(url, data) {
    if (!data) return;
    const travel = data.travel || data.travelling || null;
    if (!travel) return;
    const dest = travel.destination || travel.dest || '';
    const method = travel.method || travel.ticket || '';
    const dep = (travel.departed || 0) * 1000;
    const arr = (travel.timestamp || 0) * 1000;
    if (!dest || !dep || !arr) return;
    const dk = matchDest(dest), tk = matchTicket(method);
    // Do not reinitialise an already-tracked flight — would clear log and commentary.
    // Use arrival time with tolerance since dep time may differ (click vs API timestamps).
    if (S.flying && Math.abs(S.arrTime - arr) < 10000) return;
    if (dk && dk !== 'torn') {
      startFlightTimes('torn', dk, tk, dep, arr, false);
    } else if ((!dk || dk === 'torn') && S.src !== 'torn') {
      startFlightTimes(S.src, 'torn', tk, dep, arr, true);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     MUTATION OBSERVER
  ───────────────────────────────────────────────────────────── */

  function watchDOM() {
    let db;
    const obs = new MutationObserver(() => {
      clearTimeout(db);
      db = setTimeout(() => {
        // Check for airport closed text immediately on any DOM change
        if (!S.airportClosed && document.body &&
            document.body.textContent.includes('You are currently in a race, you must leave or wait')) {
          // Kick the tick loop immediately to handle airport closed
          if (loopTmr) clearTimeout(loopTmr);
          tick();
          return;
        }

        // Check for ticket type changes
        const tk = readSelectedTicket();
        if (tk && tk !== S.ticket) {
          S.ticket = tk;
          if (el.tkt) el.tkt.textContent = TICKETS[tk]?.label || tk;
          if (S.previewDst && !S.flying) {
            drawPath(S.src, S.previewDst);
            updateStats(0, 0);
          }
          saveS();
        }

        // Check for flying text appearing in DOM
        if (!S.flying) {
          const body = document.body.textContent;
          const m = body.match(/(?:travelling|traveling|flying)\s+to\s+([A-Za-z\s]{3,30})(?:[.,\n]|$)/i);
          if (m) {
            const dk = matchDest(m[1]);
            if (dk && dk !== S.dst) {
              const dur = getDur(S.src, dk, S.ticket);
              startFlightTimes(S.src, dk, S.ticket, Date.now(), Date.now() + dur, S.src !== 'torn');
            }
          }
        }
      }, 500);
    });
    obs.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }

  /* ─────────────────────────────────────────────────────────────
     START FLIGHT
  ───────────────────────────────────────────────────────────── */

  function startFlight(dk, tk, isReturn) {
    const dur = getDur(S.src, dk, tk);
    startFlightTimes(S.src, dk, tk, Date.now(), Date.now() + dur, isReturn);
  }

  function startFlightTimes(sk, dk, tk, dep, arr, isReturn) {
    S.src = sk; S.dst = dk; S.ticket = tk;
    S.depTime = dep; S.arrTime = arr;
    S.flying = true; S.isReturn = isReturn;
    S.prevPhase = ''; S.phasesTriggered = {}; S.turbTriggered = false; S.halfwayFired = false;
    turbFired = false;
    S.inflightSchedule = null;
    S.inflightLogStart = null;
    S.diagnostics = null;
    S.log = [];
    S.previewDst = null;
    saveS();
    drawPath(sk, dk);
    if (el.svg) el.svg.setAttribute('viewBox', getZoomedViewBox(sk, dk));
    highlightDots(sk, dk);
    if (isReturn) {
      const p = {
        name: S.player,
        src: DESTS[sk]?.city || '',
        dst: DESTS[dk]?.city || 'Torn City',
        eta: fmtTime(arr - Date.now()),
        speed: TICKETS[tk]?.speed || 545,
        maxAlt: TICKETS[tk]?.maxAlt || 32000,
        arrivalTime: (() => { const d = new Date(arr); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })(),
        isTornCity: dk === 'torn',
      };
      triggerComm('return_start', p);
      // Suppress the standard takeoff ATC message — return_start already has one
      S.phasesTriggered.takeoff = true;
      saveS();
    }
    startLoop();
  }

  /* ─────────────────────────────────────────────────────────────
     TORN API
  ───────────────────────────────────────────────────────────── */

  function apiGet(key, cb) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.torn.com/user/?selections=travel,basic&key=${key}`,
      onload: r => { try { cb(null, JSON.parse(r.responseText)); } catch(e) { cb(e); } },
      onerror: e => cb(e),
    });
  }

  function testApiKey(key, msgEl) {
    if (!key) { msgEl.textContent = 'Please enter an API key first.'; return; }
    msgEl.textContent = 'Testing\u2026'; msgEl.style.color = '#aaa';
    apiGet(key, (err, data) => {
      if (err || data?.error) {
        msgEl.textContent = `Error: ${data?.error?.error || String(err)}`;
        msgEl.style.color = '#ff4444';
      } else {
        S.player = data.name || S.player;
        msgEl.textContent = `Connected as: ${data.name} [${data.player_id}]`;
        msgEl.style.color = '#44ff88';
      }
    });
  }

  function initFromApi() {
    if (!S.apiKey) return;
    apiGet(S.apiKey, (err, data) => {
      if (err || !data || data.error) return;
      if (data.name) S.player = data.name;
      const tr = data.travel;
      if (!tr || !tr.departed || !tr.timestamp) return;
      if (Date.now() > tr.timestamp * 1000) return;
      const dk = matchDest(tr.destination || '');
      const tk = matchTicket(tr.method || '');
      const dep = tr.departed * 1000, arr = tr.timestamp * 1000;
      // Do not reinitialise an already-tracked flight — would clear log and commentary
      if (S.flying && Math.abs(S.arrTime - arr) < 10000) return;
      if (dk && dk !== 'torn') {
        startFlightTimes('torn', dk, tk, dep, arr, false);
      } else if (S.src !== 'torn') {
        startFlightTimes(S.src, 'torn', tk, dep, arr, true);
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CSS
  ───────────────────────────────────────────────────────────── */

  function injectCSS() {
    GM_addStyle(`
#tcfv {
  position: fixed;
  z-index: 999999;
  min-width: 500px;
  min-height: 420px;
  background: #0a131f;
  border: 1px solid #1e3d5c;
  border-radius: 8px;
  box-shadow: 0 6px 40px rgba(0,80,160,.5), inset 0 1px 0 rgba(100,180,255,.06);
  font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
  font-size: 12px;
  color: #b8d4ee;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* Force Courier New throughout all child elements — overrides Edge/Firefox UA monospace */
#tcfv * {
  font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
}
#tcfv-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: linear-gradient(90deg,#070f1a,#0d1f35,#070f1a);
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #1a3550;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
#tcfv-title {
  font-size: 10px;
  font-weight: bold;
  color: #5ab0e8;
  letter-spacing: 3px;
  text-shadow: 0 0 10px rgba(80,180,255,.35);
}
#tcfv-hbtns { display: flex; gap: 3px; }
.thb {
  background: #0f1e30;
  border: 1px solid #1e3d5c;
  color: #5a8ab8;
  border-radius: 3px;
  padding: 1px 7px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.7;
  transition: background .15s, color .15s;
}
.thb:hover, .ta { background: #1a3a5a; color: #8ac8ff; border-color: #3a6a9a; }
#tcfv-bod { display: block; flex: 1; overflow: hidden; }
.tcfv-pg { height: 100%; }
#tcfv-main { display: flex; flex-direction: column; height: 100%; }
#tcfv-mapbox { flex: 1; overflow: hidden; background: #06101c; border-bottom: 1px solid #0e2035; min-height: 0; }
#tcfv-svg { width: 100%; height: 100%; display: block; transition: all 0.5s ease; }
#tcfv-lower { height: 170px; flex-shrink: 0; display: flex; overflow: hidden; }
#tcfv-stats { width: 220px; min-width: 220px; padding: 8px 10px; border-right: 1px solid #0e2035; overflow: hidden; }
.ts { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #0c1a28; }
.tsl { font-size: 9px; color: #3a6a8a; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap; }
.tsv { font-size: 11px; color: #6abcee; font-weight: bold; text-align: right; }
#tcfv-atc { flex: 1; display: flex; flex-direction: column; padding: 6px 8px; overflow: hidden; min-width: 0; }
#tcfv-atc-ttl { font-size: 9px; color: #3a6a8a; letter-spacing: 2px; text-transform: uppercase; padding-bottom: 4px; margin-bottom: 4px; border-bottom: 1px solid #0e2035; flex-shrink: 0; }
#tcfv-log { flex: 1; overflow-y: auto; font-size: 10.5px; color: #8ab8d8; line-height: 1.65; }
#tcfv-log::-webkit-scrollbar { width: 3px; }
#tcfv-log::-webkit-scrollbar-thumb { background: #1e3d5c; border-radius: 2px; }
.tl { padding: 1px 0; border-bottom: 1px dotted #08121e; }
.tln { color: #c8e890 !important; }
#tcfv-set, #tcfv-cred { padding: 14px 16px; overflow-y: auto; height: 100%; box-sizing: border-box; }
#tcfv-set h3, #tcfv-cred h3 { color: #5ab0e8; font-size: 11px; margin: 0 0 12px; border-bottom: 1px solid #1e3d5c; padding-bottom: 6px; letter-spacing: 2px; text-transform: uppercase; }
#tcfv-set p, #tcfv-cred p { margin: 8px 0; color: #8ab8d8; font-size: 11px; line-height: 1.65; }
#tcfv-set label { color: #4a7a9a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
#tcfv-api-inp { width: 92%; margin: 6px 0; padding: 5px 8px; background: #0c1a28; color: #b8d4ee; border: 1px solid #1e3d5c; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; outline: none; }
#tcfv-api-inp:focus { border-color: #3a6a9a; }
#tcfv-api-msg { font-size: 11px; min-height: 18px; margin: 6px 0; }
.tcfv-btn { background: #0e2035; border: 1px solid #1e3d5c; color: #5ab0e8; border-radius: 4px; padding: 4px 11px; cursor: pointer; font-size: 11px; margin-right: 6px; font-family: monospace; transition: background .15s; }
.tcfv-btn:hover { background: #1a3a5a; }
hr { border: none; border-top: 1px solid #1a3550; margin: 12px 0; }
.note { color: #445566 !important; font-size: 11px !important; line-height: 1.6 !important; }
.big-t { font-size: 18px; font-weight: bold; color: #5ab0e8 !important; line-height: 1.4 !important; letter-spacing: 1px; }
.ver-t { font-size: 11px; color: #3a6a8a !important; margin-bottom: 14px !important; }
#tcfv-author { display: inline-block; margin: 6px 0; color: #44aaff; font-size: 16px; font-weight: bold; text-decoration: none; letter-spacing: 1px; }
#tcfv-author:hover { color: #88ccff; text-decoration: underline; }
#tcfv-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 40%, #1e3d5c 40%, #1e3d5c 55%, transparent 55%, transparent 70%, #1e3d5c 70%, #1e3d5c 85%, transparent 85%);
  border-radius: 0 0 8px 0;
  opacity: 0.7;
}
#tcfv-resize-handle:hover { opacity: 1; }

/* ── DIAGNOSTICS ── */
#tcfv-diag { flex-direction: column; height: 100%; overflow-y: auto; background: #050e05; }
#tcfv-diag-inner { padding: 0; flex: 1; }
.diag-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px 4px; border-bottom: 1px solid #1a3520; }
.diag-title { font-size: 9px; color: #44ff88; letter-spacing: 2.5px; text-transform: uppercase; }
.diag-type { font-size: 9px; color: #336633; letter-spacing: 1px; }
.diag-schematic { padding: 6px 8px 2px; border-bottom: 1px solid #0a2010; }
.diag-systems { padding: 6px 8px; }
.diag-row { display: grid; grid-template-columns: 10px 1fr 1fr 56px; gap: 4px; align-items: center; padding: 3px 0; border-bottom: 1px dotted #0a1a0a; }
.diag-ind { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 5px currentColor; }
.diag-name { font-size: 10px; color: #66bb66; }
.diag-detail { font-size: 9px; color: #336633; }
.diag-status { font-size: 9px; font-weight: bold; text-align: right; letter-spacing: 0.5px; }
#tcfv.radar-mode #tcfv-diag { background: var(--rc-dark); }
#tcfv.radar-mode .diag-header { border-bottom-color: var(--rc-line); }
#tcfv.radar-mode .diag-title { color: var(--rc); }
#tcfv.radar-mode .diag-type { color: var(--rc-mid); }
#tcfv.radar-mode .diag-name { color: var(--rc); }
#tcfv.radar-mode .diag-detail { color: var(--rc-mid); }
#tcfv.radar-mode .diag-row { border-bottom-color: var(--rc-line); }
/* ── MORE SETTINGS ── */
#tcfv-more { padding: 14px 16px; overflow-y: auto; height: 100%; box-sizing: border-box; }
#tcfv-more h3 { color: #5ab0e8; font-size: 11px; margin: 0 0 12px; border-bottom: 1px solid #1e3d5c; padding-bottom: 6px; letter-spacing: 2px; text-transform: uppercase; }
#tcfv-more p { margin: 8px 0; color: #8ab8d8; font-size: 11px; line-height: 1.65; }
#tcfv-scale-wrap { margin-top: 10px; }
.scale-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.scale-row label { color: #4a7a9a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
#tcfv-scale-val { color: #6abcee; font-size: 13px; font-weight: bold; }
#tcfv-scale-slider { width: 100%; accent-color: #4488ff; cursor: pointer; margin-bottom: 14px; }
#tcfv-plane-preview-wrap { display: flex; flex-direction: column; align-items: center; margin-top: 6px; }
#tcfv-plane-preview { border: 1px solid #1e3d5c; border-radius: 6px; }
#tcfv.radar-mode #tcfv-more h3 { color: var(--rc) !important; border-bottom-color: var(--rc-line) !important; }
#tcfv.radar-mode #tcfv-more p { color: var(--rc-mid); }
#tcfv.radar-mode #tcfv-scale-val { color: var(--rc); }
#tcfv.radar-mode #tcfv-scale-slider { accent-color: var(--rc); }
#tcfv.radar-mode #tcfv-plane-preview { border-color: var(--rc-line); background: var(--rc-dark); }
#tcfv.radar-mode .scale-row label { color: var(--rc-mid); }
#tcfv.radar-mode {
  background: var(--rc-dark);
  border-color: var(--rc);
  box-shadow: 0 0 30px var(--rc-glow), 0 0 60px var(--rc-glow), inset 0 0 20px rgba(0,0,0,.4);
}
#tcfv.radar-mode::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.18) 2px, rgba(0,0,0,.18) 4px);
  pointer-events: none;
  z-index: 1000000;
  border-radius: 8px;
}
#tcfv.radar-mode #tcfv-hdr {
  background: linear-gradient(90deg, var(--rc-dark), var(--rc-line), var(--rc-dark));
  border-bottom-color: var(--rc-line);
}
#tcfv.radar-mode #tcfv-title { color: var(--rc); text-shadow: 0 0 12px var(--rc); }
#tcfv.radar-mode .thb { background: var(--rc-dark); border-color: var(--rc-line); color: var(--rc-mid); }
#tcfv.radar-mode .thb:hover,#tcfv.radar-mode .ta { background: var(--rc-line); color: var(--rc); border-color: var(--rc-mid); }
#tcfv.radar-mode #tcfv-mapbox { background: var(--rc-dark); }
#tcfv.radar-mode #tcfv-svg { filter: var(--rc-filter); }
#tcfv.radar-mode #tcfv-lower,#tcfv.radar-mode #tcfv-set,#tcfv.radar-mode #tcfv-cred { background: var(--rc-dark); }
#tcfv.radar-mode .ts { border-bottom-color: var(--rc-line); }
#tcfv.radar-mode .tsl { color: var(--rc-mid); }
#tcfv.radar-mode .tsv { color: var(--rc); text-shadow: 0 0 6px var(--rc); }
#tcfv.radar-mode #tcfv-atc-ttl { color: var(--rc-mid); border-bottom-color: var(--rc-line); }
#tcfv.radar-mode #tcfv-log { color: var(--rc); }
#tcfv.radar-mode .tln { color: var(--rc) !important; text-shadow: 0 0 8px var(--rc); }
#tcfv.radar-mode #tcfv-set p,#tcfv.radar-mode #tcfv-cred p { color: var(--rc-mid); }
#tcfv.radar-mode h3 { color: var(--rc) !important; border-bottom-color: var(--rc-line) !important; }
#tcfv.radar-mode #tcfv-api-inp { background: var(--rc-dark); color: var(--rc); border-color: var(--rc-line); }
#tcfv.radar-mode .tcfv-btn { background: var(--rc-dark); color: var(--rc-mid); border-color: var(--rc-line); }
#tcfv.radar-mode .tcfv-btn:hover { background: var(--rc-line); }
#tcfv.radar-mode hr { border-top-color: var(--rc-line); }
#tcfv.radar-mode .note { color: var(--rc-line) !important; }
#tcfv.radar-mode .big-t { color: var(--rc) !important; }
#tcfv.radar-mode .ver-t { color: var(--rc-mid) !important; }
#tcfv.radar-mode #tcfv-author { color: var(--rc); }
#tcfv.radar-mode #tcfv-author:hover { color: var(--rc); opacity: 0.7; }
`);
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  function injectStatcounter() {
    // Fires a 1×1 invisible tracking pixel to c.statcounter.com via a hidden <img>.
    // Waits for window.load first (or fires immediately if already loaded) so it
    // behaves like a standard bottom-of-page analytics snippet.
    // The { once: true } option removes the listener automatically after it fires.
    const fire = () => {
      try {
        const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const img = document.createElement('img');
        img.src = 'https://c.statcounter.com/13031782/0/af9e448b/1/?sc_sid=' + sid;
        img.width = 1;
        img.height = 1;
        img.style.cssText = 'position:absolute;left:-9999px;top:-9999px;pointer-events:none;';
        img.alt = '';
        document.body.appendChild(img);
      } catch(e) {}
    };
    if (document.readyState === 'complete') {
      fire();
    } else {
      window.addEventListener('load', fire, { once: true });
    }
  }

  function init() {
    loadS();
    injectStatcounter();
    // Only build the HUD if fastRestore hasn't already created the panel
    if (!document.getElementById('tcfv')) {
      injectCSS();
      buildHUD();
      renderLog();
    } else {
      // Panel already exists — just wire up the dynamic hooks
      injectCSS(); // safe to call again (adds/overwrites styles)
    }

    hookClicks();
    hookNetwork();
    watchDOM();

    // Restore in-flight or preview state from previous session
    if (S.flying && S.dst) {
      if (Date.now() >= S.arrTime) {
        // Landed while page was closed
        S.flying = false; S.src = S.dst; S.dst = null;
        S.phasesTriggered = {}; saveS();
      } else {
        drawPath(S.src, S.dst);
        if (el.svg) el.svg.setAttribute('viewBox', getZoomedViewBox(S.src, S.dst));
        highlightDots(S.src, S.dst);
      }
    } else if (S.previewDst) {
      drawPath(S.src, S.previewDst);
      if (el.svg) el.svg.setAttribute('viewBox', getZoomedViewBox(S.src, S.previewDst));
      highlightDots(S.src, S.previewDst);
    }

    showPg(S.page || 'main');
    startLoop();
    initFromApi();
  }

  // Fast path: restore panel and log at 100ms. init() at 400ms wires hooks and starts loop.
  // startLoop is NOT called here — init() owns the loop to avoid double-starting.
  function fastRestore() {
    loadS();
    // If airport was closed when saved, pre-load the log with just the airport message
    // so renderLog() shows it correctly before init() wires the tick loop
    if (S.airportClosed) {
      const am = '\x01Airport closed — you are in a <a href="https://www.torn.com/page.php?sid=racing" target="_blank" style="color:#ff6666;text-decoration:underline">race</a>.';
      S.log = [am];
    }
    injectCSS();
    buildHUD();
    renderLog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(fastRestore, 100);
      setTimeout(init, 400);
    });
  } else {
    setTimeout(fastRestore, 100);
    setTimeout(init, 400);
  }

})();

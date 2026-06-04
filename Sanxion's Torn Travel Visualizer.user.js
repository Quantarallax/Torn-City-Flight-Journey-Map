// ==UserScript==
// @name         TORN CITY Flight Visualiser
// @namespace    sanxion.tc.flightvisualiser
// @version      70.43.0
// @license      MIT
// @description  Real-time animated flight visualiser for Torn City. SVG world map, curved animated flight path, plane animation, ATC commentary and live flight stats.
// @author       Sanxion [2987640]
// @match        https://www.torn.com/page.php?sid=travel*
// @match        https://www.torn.com/travelagency.php*
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
     DESTINATIONS
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

  const BASE_DUR = {
    torn_mexico:5400000, torn_caymans:4500000, torn_canada:2700000, torn_hawaii:14400000,
    torn_uk:10800000, torn_argentina:14400000, torn_switzerland:12600000,
    torn_japan:25200000, torn_china:25200000, torn_uae:21600000, torn_southafrica:25200000,
  };

  const TICKETS = {
    standard: { label:'Standard', plane:'jumbo', size:'large', mult:1.00, fuel:42000, speed:545, maxAlt:32000, col:'#aaaaaa' },
    business: { label:'Business Class', plane:'jumbo', size:'large', mult:1.15, fuel:47000, speed:575, maxAlt:32000, col:'#4488ff' },
    private: { label:'Private Plane', plane:'private_plane', size:'small', mult:1.80, fuel:18000, speed:480, maxAlt:32000, col:'#ff6644' },
    airstrip: { label:'Airstrip', plane:'prop_plane', size:'small', mult:1.60, fuel:6000, speed:180, maxAlt:12000, col:'#88ff44' },
  };

  const PHASE_CFG = {
    ready: { label:'READY', col:'#6699aa' },
    takeoff: { label:'TAKE-OFF', col:'#ffcc44' },
    inflight: { label:'IN FLIGHT', col:'#44ccff' },
    descent: { label:'DESCENT', col:'#ffaa44' },
    landing: { label:'LANDING', col:'#ff8844' },
    arrived: { label:'LANDED', col:'#44ff88' },
    airport_closed: { label:'AIRPORT CLOSED', col:'#ff3333' },
    inaccessible: { label:'NO FLYING ALLOWED', col:'#ff6600' },
    terror_threat: { label:'POTENTIAL TERROR THREAT', col:'#ff4400' },
    state_of_emergency: { label:'STATE OF EMERGENCY', col:'#cc0044' },
  };

  const WEATHER = ['clear skies','partly cloudy','overcast','light rain','warm and humid','cool and breezy','sunny with light winds','scattered showers'];
  const rndW = () => WEATHER[Math.floor(Math.random() * WEATHER.length)];
  const rndFlightNum = () => 'TC' + (Math.floor(Math.random() * 9000) + 1000);

  /* ─────────────────────────────────────────────────────────────
     COMMENTARY
  ───────────────────────────────────────────────────────────── */

  const INFLIGHT_FIXED_START_LARGE = [
    p => `Levelling off at ${p.maxAlt.toLocaleString()} feet. Weather good. All clear.`,
    () => 'Seatbelt sign has been turned off.',
    p => `${p.name} stretches in their seat ready for the flight ahead.`,
  ];
  const INFLIGHT_FIXED_START_SMALL = [
    p => `Levelling off at ${p.maxAlt.toLocaleString()} feet. Weather good. All clear.`,
    () => 'A jet flies past, upside down.',
  ];
  const INFLIGHT_FIXED_END = [
    p => `Cruising at ${p.speed} mph. Estimated arrival: ${p.eta}.`,
    p => `Arrival time about ${p.arrivalTime}.`,
  ];
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
  const INFLIGHT_RANDOM_SMALL = [
    // v70.38.0: pool aligned with new spec. INFLIGHT_FIXED_START_SMALL
    // above carries the two phase-entry messages ("Levelling off..." and
    // "A jet flys past, upside down."); this random pool is sampled
    // between them. Removed messages the new spec no longer lists for
    // small planes ("WARNING: Flight proximity alert!", "ATC stand by,
    // unsure of error reason.", "The engine hums steadily.", "does a loop
    // the loop, here we go!") and added the three new ones.
    () => `ATC, this is flight ${rndFlightNum()}, autopilot engaged.`,
    () => 'Up here, the sun shines brightly.',
    () => 'Switching to 442.2.',
    p => `${p.name} checks the route.`,
    p => `${p.name} contemplates doing a loop-the-loop.`,
    () => 'A jet flies past — turbulence rocks the plane.',
  ];

  const isSmallPlane = () => TICKETS[S.ticket]?.size === 'small';

  const COMMENTARY = {
    // v70.38.0: per spec the "Landed at Source" phase is now a placeholder
    // — its messages have moved into the takeoff arrays. Empty arrays so
    // getComm('ready') returns nothing and triggerComm fires with no log
    // output.
    ready_large: [],
    ready_small: [],
    takeoff_large: [
      // v70.38.0: full takeoff sequence per spec. First three lines (Tower
      // pre-flight, clearance request, "ready for take off") come from the
      // old ready_large. The order weaves the picks-up-speed and
      // leaves-the-ground beats between formal ATC chatter and cabin
      // announcements.
      () => 'Tower, pre-flight checks complete.',
      p => `Flight requesting clearance for take-off from ${p.src} Airport.`,
      () => 'The airplane picks up speed.',
      () => 'Ladies and gentlemen, we are ready for take off.',
      () => 'Cabin crew, cross-check ready for departure.',
      () => 'The airplane leaves the ground.',
      p => `Welcome to your flight to ${p.dst}. Extinguish all doobies and put seats in upright position.`,
      () => 'Sit back and relax.',
      p => `Climbing to ${p.maxAlt.toLocaleString()} feet.`,
    ],
    takeoff_small: [
      // v70.38.0: prepended with the old ready_small lines so pre-flight
      // clearance chatter happens at takeoff. "Preflight checks confirmed."
      // no longer has the player name appended, and "Ready for instructions"
      // gains a trailing period — both per spec.
      p => `${p.name} requesting clearance for take-off from ${p.src} Airport.`,
      () => 'Preflight checks confirmed.',
      () => 'Ready for instructions.',
      p => `ATC: ${p.name}, you are cleared for take-off. Runway 1C. Proceed.`,
      () => 'Tower, increasing speed, throttle engaged.',
      p => `Climbing to ${p.maxAlt.toLocaleString()} feet.`,
      // v70.43.0: small-plane takeoff notes any faction members on the
      // same flight path. Reads factionData *live* at the moment this
      // template fires (not when triggerComm captures params) so the
      // message gets the most recent faction-API data. On a fresh page
      // load the faction API is async and factionData is usually empty
      // at the moment takeoff begins; by reading live, the last template
      // (fires ~30s in) sees the populated factionData. Returns null if
      // no members match, which triggerComm filters out.
      () => formatFactionOnPathLine(factionMembersOnPlayerPath()),
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
      // v70.34.0: only the spec-defined refuel line fires on return start.
      // Previously this array also included small-plane-only phrasing ("ATC:
      // ... Runway 2A. Proceed." and "Wheels up. Heading home.") which then
      // played on Jumbo Jet return journeys — wrong commentary for the
      // large plane. The plane-size-appropriate takeoff messages handle
      // the rest from the takeoff phase onwards.
      () => 'Refuel complete. Taxiing to runway. Have a nice flight.',
    ],
  };

  function getComm(phase, small) {
    const key = `${phase}_${small ? 'small' : 'large'}`;
    const arr = COMMENTARY[key] || COMMENTARY[phase] || [];
    return arr.filter(fn => fn !== null);
  }

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */

  let S = {
    src:'torn', dst:null, depTime:null, arrTime:null,
    ticket:'standard', player:'Pilot', flying:false, isReturn:false,
    prevPhase:'', phasesTriggered:{}, turbTriggered:false, halfwayFired:false,
    log:[], px:20, py:60, pw:680, ph_panel:520, min:false, page:'main', apiKey:'',
    previewDst:null, inflightSchedule:null, planeScale:100, inflightLogStart:null, diagnostics:null, airportClosed:false, inHospital:false, terrorThreat:false, stateOfEmergency:false, flightHistory:{ samples:[] }, factionName:'', commSchedule:[], commUsedIds:[],
  };

  const saveS = () => {
    try {
      GM_setValue('tcfv_v3', JSON.stringify({
        src:S.src, dst:S.dst, depTime:S.depTime, arrTime:S.arrTime,
        ticket:S.ticket, player:S.player, flying:S.flying, isReturn:S.isReturn,
        prevPhase:S.prevPhase, phasesTriggered:S.phasesTriggered, turbTriggered:S.turbTriggered, halfwayFired:S.halfwayFired,
        log:S.log.slice(-30), px:S.px, py:S.py, pw:S.pw, ph_panel:S.ph_panel,
        min:S.min, apiKey:S.apiKey, previewDst:S.previewDst, inflightSchedule:S.inflightSchedule, planeScale:S.planeScale, inflightLogStart:S.inflightLogStart, diagnostics:S.diagnostics, airportClosed:S.airportClosed, inHospital:S.inHospital, terrorThreat:S.terrorThreat, stateOfEmergency:S.stateOfEmergency, flightHistory:S.flightHistory, factionName:S.factionName, commSchedule:S.commSchedule, commUsedIds:S.commUsedIds,
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
      if (!S.flightHistory || !Array.isArray(S.flightHistory.samples)) S.flightHistory = { samples: [] };
      if (!Array.isArray(S.commSchedule)) S.commSchedule = [];
      if (!Array.isArray(S.commUsedIds)) S.commUsedIds = [];
      if (typeof S.factionName !== 'string') S.factionName = '';
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

  function getZoomedViewBox(sk, dk) {
    if (!sk || !dk) return `0 0 ${MAP_W} ${MAP_H}`;
    const s = toXY(DESTS[sk].lon, DESTS[sk].lat);
    const d = toXY(DESTS[dk].lon, DESTS[dk].lat);
    const routeW = Math.abs(d.x - s.x);
    const routeH = Math.abs(d.y - s.y);
    const routeSpan = Math.sqrt(routeW * routeW + routeH * routeH);
    const minSpan = 120;
    const effectiveSpan = Math.max(routeSpan, minSpan);
    const pad = Math.max(40, effectiveSpan * 0.35);
    let minX = Math.min(s.x, d.x) - pad;
    let maxX = Math.max(s.x, d.x) + pad;
    let minY = Math.min(s.y, d.y) - pad;
    let maxY = Math.max(s.y, d.y) + pad;
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(MAP_W, maxX);
    maxY = Math.min(MAP_H, maxY);
    const MIN_VW = 160;
    if (maxX - minX < MIN_VW) {
      const cx = (minX + maxX) / 2;
      minX = Math.max(0, cx - MIN_VW / 2);
      maxX = Math.min(MAP_W, cx + MIN_VW / 2);
    }
    const vw = maxX - minX, vh = maxY - minY;
    if (vw / vh < 2) {
      const extra = (vh * 2 - vw) / 2;
      minX = Math.max(0, minX - extra);
      maxX = Math.min(MAP_W, maxX + extra);
    }
    return `${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`;
  }

  /* ─────────────────────────────────────────────────────────────
     SVG WORLD MAP
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
<line x1="0" y1="${((90/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((90/180)*MAP_H).toFixed(0)}" stroke="#0d2035" stroke-width="1"/>
<line x1="${(MAP_W/2).toFixed(0)}" y1="0" x2="${(MAP_W/2).toFixed(0)}" y2="${MAP_H}" stroke="#0d2035" stroke-width="0.6"/>
<line x1="0" y1="${((66.5/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((66.5/180)*MAP_H).toFixed(0)}" stroke="#0c2a18" stroke-width="0.6" stroke-dasharray="6,6"/>
<line x1="0" y1="${((113.5/180)*MAP_H).toFixed(0)}" x2="${MAP_W}" y2="${((113.5/180)*MAP_H).toFixed(0)}" stroke="#0c2a18" stroke-width="0.6" stroke-dasharray="6,6"/>
<polygon points="130,64 171,41 253,34 306,36 349,45 388,65 391,89 376,114 360,137 370,170 348,208 318,235 289,255 260,272 232,260 203,235 175,215 149,185 130,143 119,105" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<polygon points="34,64 87,47 114,59 107,82 67,91 29,81" fill="#1a4418" stroke="#2a6030" stroke-width="0.8"/>
<ellipse cx="20" cy="105" rx="18" ry="4" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="334,23 383,15 411,33 398,64 352,71 329,51" fill="#22503a" stroke="#2e6c40" stroke-width="0.8"/>
<polygon points="170,174 193,196 185,238 165,254 148,225 163,190" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="218,235 253,258 246,279 228,285 204,266 200,245" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<ellipse cx="294" cy="240" rx="17" ry="7" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<ellipse cx="256" cy="248" rx="7" ry="4" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="237,254 280,242 338,249 373,277 385,326 367,380 338,412 296,420 261,398 242,350 234,303" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<polygon points="237,254 266,244 271,262 251,269 234,264" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<ellipse cx="289" cy="415" rx="9" ry="5" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="444,60 483,46 530,41 573,50 602,64 608,84 587,101 556,111 516,107 480,97 447,82" fill="#1a4418" stroke="#2a6030" stroke-width="1"/>
<polygon points="444,82 481,77 484,115 461,129 435,110" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="491,42 523,28 561,34 570,50 548,60 506,58" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="454,67 482,60 489,80 474,88 452,81" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<ellipse cx="462" cy="58" rx="10" ry="6" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="519,101 539,95 545,116 536,138 521,141 513,123" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="444,82 480,76 486,116 461,129 434,111" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="573,102 590,97 588,115 574,118 565,109" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="470,143 524,131 602,130 659,155 683,200 666,257 628,302 587,335 540,351 496,325 469,283 462,236 469,188" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<polygon points="659,207 689,199 695,228 668,237 649,222" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="622,294 643,285 651,317 634,330 614,313" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="590,139 671,130 713,148 723,193 692,217 642,210 604,185" fill="#1a4418" stroke="#2a6030" stroke-width="0.8"/>
<polygon points="578,103 647,94 668,109 663,129 598,136 572,120" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="575,46 697,29 822,33 905,50 933,90 928,131 892,156 875,178 834,189 780,185 740,148 694,140 639,145 614,136 584,119 578,88" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<polygon points="656,147 722,140 750,162 745,231 710,248 676,229 649,190" fill="#1a4418" stroke="#2a6030" stroke-width="0.7"/>
<ellipse cx="744" cy="246" rx="8" ry="11" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="736,148 793,139 820,164 797,197 757,201 736,178" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="793,202 832,192 848,210 826,225 798,218" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="836,220 877,215 890,234 862,244 838,235" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="869,113 892,107 906,132 891,152 872,145" fill="#1a4418" stroke="#2a6030" stroke-width="0.6"/>
<polygon points="888,96 907,91 918,110 904,118 887,112" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="841,115 858,109 862,133 848,139 837,128" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="839,181 850,175 855,192 845,198" fill="#1a4418" stroke="#2a6030" stroke-width="0.3"/>
<ellipse cx="862" cy="196" rx="9" ry="14" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="782,285 875,264 933,286 941,334 904,361 851,375 789,350 770,313" fill="#1a4418" stroke="#2a6030" stroke-width="1.2"/>
<ellipse cx="875" cy="380" rx="12" ry="10" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<polygon points="934,338 952,328 958,352 945,362 930,353" fill="#1a4418" stroke="#2a6030" stroke-width="0.5"/>
<polygon points="940,364 955,357 962,378 950,388 936,377" fill="#1a4418" stroke="#2a6030" stroke-width="0.4"/>
<rect x="0" y="${MAP_H - 24}" width="${MAP_W}" height="24" fill="#1a3a26" opacity="0.7"/>
<g id="tcfv-factiong"></g>
<g id="tcfv-pathg"></g>
${dots}
<g id="tcfv-planeg"></g>`;
  }

  /* ─────────────────────────────────────────────────────────────
     ANIMATED DASH OFFSET
  ───────────────────────────────────────────────────────────── */

  let dashAnimId = null;
  let dashOffset = 0;
  let currentZoom = 1;

  function startDashAnim() {
    if (dashAnimId) cancelAnimationFrame(dashAnimId);
    const step = () => {
      const dashTotal = 20 / currentZoom;
      const inc = 0.4 / currentZoom;
      dashOffset = (dashOffset + inc) % dashTotal;
      const ahead = document.getElementById('tcfv-route-ahead');
      if (ahead) ahead.style.strokeDashoffset = String(-dashOffset);
      dashAnimId = requestAnimationFrame(step);
    };
    dashAnimId = requestAnimationFrame(step);
  }

  function stopDashAnim() {
    if (dashAnimId) { cancelAnimationFrame(dashAnimId); dashAnimId = null; }
  }

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

  // v70.9.0: ahead polyline now always shows the FULL path so its geometry
  // never changes — the dash-offset animation flows continuously without the
  // per-tick "snap" that used to happen when ahead was sliced from the plane's
  // current position. The solid trail polyline is drawn ON TOP of ahead and
  // grows as the plane progresses, covering the dashed pattern behind it.
  // Trail uses opacity 1.0 to fully obscure the dashes underneath.
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
    // Stroke widths and dash sizes are inversely scaled by currentZoom so they
    // render at a constant visual size regardless of zoom level.
    const trailW = (2.2 / currentZoom).toFixed(3);
    const aheadW = (2 / currentZoom).toFixed(3);
    const dashOn = (12 / currentZoom).toFixed(1);
    const dashOff = (8 / currentZoom).toFixed(1);
    g.innerHTML = `
<polyline id="tcfv-route-ahead" points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${aheadW}" stroke-dasharray="${dashOn},${dashOff}" stroke-linecap="round" opacity="0.55"/>
<polyline id="tcfv-route-trail" points="${pts[0]} ${pts[0]}" fill="none" stroke="${col}" stroke-width="${trailW}" stroke-linecap="round" opacity="1"/>
<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="5" fill="${DESTS[sk]?.col||'#fff'}" opacity="0.9" filter="url(#gl)"/>
<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="5" fill="${DESTS[dk]?.col||'#fff'}" opacity="0.9" filter="url(#gl)"/>`;
    startDashAnim();
  }

  function updatePathProgress(progress, sk, dk) {
    if (!sk || !dk || sk === dk) return;
    const trail = document.getElementById('tcfv-route-trail');
    if (!trail) return;
    // v70.9.0: only update trail's geometry. ahead stays as the full path so
    // its dash animation runs uninterrupted at 60 fps.
    const pts = getPathPts(sk, dk);
    const N = pts.length - 1;
    const splitIdx = Math.max(0, Math.min(N, Math.round(progress * N)));
    const trailPts = pts.slice(0, splitIdx + 1);
    if (trailPts.length >= 2) trail.setAttribute('points', trailPts.join(' '));
    else trail.setAttribute('points', pts[0] + ' ' + pts[0]);
  }

  function drawPlane(progress, sk, dk) {
    const g = document.getElementById('tcfv-planeg');
    if (!g) return;
    if (!sk || !dk || sk === dk) { g.innerHTML = ''; return; }
    const { s, d, c } = buildBez(sk, dk);
    const t = Math.max(0.001, Math.min(0.999, progress));
    const pos = bPt(t, s, c, d), ang = bAng(t, s, c, d);
    const plane = TICKETS[S.ticket]?.plane || 'jumbo';
    const scale = ((S.planeScale || 100) / 100) / currentZoom;
    let svgShape;
    if (plane === 'jumbo') {
      svgShape = `
  <ellipse cx="0" cy="0" rx="1.5" ry="4.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-2 -6.5,1 -5.5,2 0,-0.5 5.5,2 6.5,1" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2.5,4.5 -2,5 0,3.5 2,5 2.5,4.5" fill="white" stroke="black" stroke-width="0.6"/>`;
    } else if (plane === 'private_plane') {
      svgShape = `
  <ellipse cx="0" cy="0" rx="1" ry="4" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-1.5 -5,1.5 -4.5,2.5 0,0.5 4.5,2.5 5,1.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2,4 -1.5,4.5 0,3.25 1.5,4.5 2,4" fill="white" stroke="black" stroke-width="0.6"/>`;
    } else {
      // v70.18.0: prop_plane gets more white on the tail (enlarged horizontal
      // stabiliser) and a richer propeller — a translucent motion-blur disc,
      // a cool-tinted blade line (#bbd0e0 instead of pure black), and a small
      // white hub on top. The "slight colour shift" comes from the cool grey/
      // light-blue tones rather than the original solid black stroke.
      svgShape = `
  <ellipse cx="0" cy="0.5" rx="1" ry="3.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="-4.5,-0.5 -4,0.5 4,0.5 4.5,-0.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2,4.2 -1.5,4.8 0,3.5 1.5,4.8 2,4.2" fill="white" stroke="black" stroke-width="0.55"/>
  <polygon points="-0.5,3.8 0.5,3.8 0,4.6" fill="white" stroke="black" stroke-width="0.4"/>
  <ellipse cx="0" cy="-4" rx="2.0" ry="0.55" fill="#dde8f5" stroke="none" opacity="0.55"/>
  <line x1="-1.9" y1="-4" x2="1.9" y2="-4" stroke="#bbd0e0" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="0" cy="-4" r="0.4" fill="white" stroke="black" stroke-width="0.35"/>`;
    }
    // v70.13.0: removed the stray +180 that prop_plane previously had — the
    // shape is drawn nose-up like the other planes, so `ang + 90` aligns it
    // with the direction of travel for every aircraft type.
    const rotAngle = ang + 90;
    g.innerHTML = `<g transform="translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${rotAngle.toFixed(1)}) scale(${scale})">
  <g filter="url(#gl)">${svgShape}
  </g>
</g>`;
  }

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

  let el = {};
  // v70.38.0: when status is READY, flash between READY and LANDED per
  // spec: 3s READY → 0.5s blank → 3s LANDED → 0.5s blank → repeat. Driven
  // by a 250ms timer because the main tick loop only fires once per second
  // — not fine-grained enough to render the 0.5s blank windows. The flash
  // is anchored to Date.now() % 7000 so the cadence stays consistent
  // across page visits rather than restarting each time.
  let readyFlashTimer = null;
  function startReadyFlash() {
    if (readyFlashTimer || !el.status) return;
    const paint = () => {
      if (!el.status) return;
      const cycle = Date.now() % 7000;
      // v70.39.0: use a non-breaking space (\u00A0) for the 0.5s blank
      // windows rather than an empty string. An empty string collapses
      // the element's height so the surrounding panel shifts up; the
      // NBSP keeps the same line height as the READY/LANDED text.
      if (cycle < 3000) el.status.textContent = 'READY';
      else if (cycle < 3500) el.status.textContent = '\u00A0';
      else if (cycle < 6500) el.status.textContent = 'LANDED';
      else el.status.textContent = '\u00A0';
    };
    paint();
    readyFlashTimer = setInterval(paint, 250);
  }
  function stopReadyFlash() {
    if (readyFlashTimer) { clearInterval(readyFlashTimer); readyFlashTimer = null; }
  }

  function updateStats(progress, timeLeftMs) {
    if (!el.status) return;
    const phase = getPhase(progress);
    const src = DESTS[S.src], dst = S.dst ? DESTS[S.dst] : (S.previewDst ? DESTS[S.previewDst] : null);
    const tkt = TICKETS[S.ticket] || TICKETS.standard;
    const totalDist = src && dst ? haversine(src, dst) : 0;
    let distRem;
    if (S.flying && timeLeftMs !== undefined && timeLeftMs <= 60000 && totalDist > 0) {
      distRem = Math.max(0, Math.round(5 * (timeLeftMs / 60000)));
    } else if (S.flying && progress > 0 && progress < 1 && totalDist > 0) {
      distRem = Math.round(totalDist * (1 - progress));
    } else {
      distRem = totalDist;
    }
    const ph = PHASE_CFG[phase] || PHASE_CFG.ready;
    // v70.38.0: in the ready phase the flash timer owns el.status's text.
    // updateStats still sets the colour each tick so re-renders pick it up.
    if (phase === 'ready') {
      startReadyFlash();
    } else {
      stopReadyFlash();
      el.status.textContent = ph.label;
    }
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
     COMMENTARY
  ───────────────────────────────────────────────────────────── */

  let phRunId = {};

  function addLog(text) {
    if ((S.airportClosed || S.inHospital || S.terrorThreat || S.stateOfEmergency) && !text.includes('Airport') && !text.includes('hospital') && !text.includes('discharged') && !text.includes('lockdown') && !text.includes('security')) return;
    S.log.push(text);
    if (S.log.length > 30) S.log.shift();
    renderLog();
  }

  function renderLog() {
    if (!el.log) return;
    const startIdx = (S.flying && S.inflightLogStart !== null) ? S.inflightLogStart : 0;
    const lines = S.log.slice(startIdx).slice(-8);
    el.log.innerHTML = lines.map((t, i) => {
      const isHtml = t.startsWith('\x01');
      const content = isHtml ? t.slice(1) : t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      return `<div class="tl${i === lines.length-1 ? ' tln' : ''}">&rsaquo; ${content}</div>`;
    }).join('');
    el.log.scrollTop = el.log.scrollHeight;
  }

  function triggerComm(phase, params) {
    if (S.phasesTriggered[phase]) return;
    S.phasesTriggered[phase] = true;
    saveS();
    const msgs = getComm(phase, params.isSmall);
    if (!msgs || !msgs.length) return;
    const rid = (phRunId[phase] = (phRunId[phase] || 0) + 1);
    // v70.38.0: takeoff uses 5-second spacing per spec ("five seconds
    // between each message"). Other phases keep the original 3.8s pace.
    const step = phase === 'takeoff' ? 5000 : 3800;
    msgs.forEach((fn, i) => {
      setTimeout(() => {
        if (phRunId[phase] === rid) {
          const msg = fn(params);
          if (msg) addLog(msg);
        }
      }, i * step);
    });
  }

  function buildInflightSchedule() {
    if (S.inflightSchedule) return;
    const total = S.arrTime - S.depTime;
    const inflightStart = S.depTime + total * 0.05;
    const inflightEnd = S.depTime + total * 0.75;
    const duration = inflightEnd - inflightStart;
    const small = TICKETS[S.ticket]?.size === 'small';
    const fixedStart = small ? INFLIGHT_FIXED_START_SMALL : INFLIGHT_FIXED_START_LARGE;
    const randomPool = small ? INFLIGHT_RANDOM_SMALL : INFLIGHT_RANDOM_LARGE;
    const poolSize = randomPool.length;
    const pickCount = Math.min(poolSize, 3 + Math.floor(Math.random() * 3));
    const indices = Array.from({ length: poolSize }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosen = indices.slice(0, pickCount).sort((a, b) => a - b);
    const schedule = [];
    const fixedStartCount = fixedStart.length;
    const fixedEndCount = INFLIGHT_FIXED_END.length;
    const totalSlots = fixedStartCount + pickCount + fixedEndCount;
    const slotSize = duration / (totalSlots + 1);
    let slot = 1;
    for (let i = 0; i < fixedStartCount; i++) {
      schedule.push({ pool:'fixed_start', idx:i, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }
    for (const idx of chosen) {
      schedule.push({ pool:'random', idx, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }
    for (let i = 0; i < fixedEndCount; i++) {
      schedule.push({ pool:'fixed_end', idx:i, fireAt: inflightStart + slotSize * slot, fired:false });
      slot++;
    }
    S.inflightSchedule = schedule;
    saveS();
  }

  let loopTmr = null;
  let _noRaceCount = 0;
  let commentaryQueue = [];
  let draining = false;
  let recentMessages = [];
  let turbFired = false;

  function startLoop() {
    if (loopTmr) clearTimeout(loopTmr);
    tick();
  }

  // v70.25.0: when an airport-closed state begins (race / hospital / terror
  // threat / state of emergency), wipe any leftover preview destination and
  // remove the flight-path + plane visuals. Without this, a destination the
  // player had previewed before the closure stays drawn on the map, making
  // it look like they're flying to that city while the airport is closed.
  function clearClosedStateVisuals() {
    S.previewDst = null;
    try {
      drawPath(null, null);
      drawPlane(0, S.src, S.src);
      highlightDots(S.src, null);
      updateStats(0, 0);
    } catch (e) { /* draw helpers may not be ready in early ticks */ }
  }

  function tick() {
    const bodyText = document.body ? (document.body.textContent || '') : '';
    const HOSP_STRING = 'not available while in hospital';
    const bodyAll = (document.documentElement ? document.documentElement.textContent : '') || bodyText;
    const inHospitalNow = bodyAll.includes(HOSP_STRING);
    if (inHospitalNow) {
      if (!S.inHospital) {
        S.inHospital = true;
        clearClosedStateVisuals();
        const hm = '\x01You are in <a href="https://www.torn.com/hospitalview.php" target="_blank" style="color:#ff9944;text-decoration:underline">hospital</a>, recuperating.';
        S.log.push(hm);
        recentMessages.push('in hospital');
        renderLog();
        saveS();
      }
      if (el.status) {
        stopReadyFlash(); el.status.textContent = PHASE_CFG.inaccessible.label;
        el.status.style.color = PHASE_CFG.inaccessible.col;
      }
      loopTmr = setTimeout(tick, 1000);
      return;
    }
    if (S.inHospital) {
      S.inHospital = false;
      addLog('You have been discharged from hospital.');
      saveS();
    }
    const RACE_STRING = 'You are currently in a race, you must leave or wait';
    const raceTextPresent = bodyText.includes(RACE_STRING);
    if (raceTextPresent) {
      _noRaceCount = 0;
      if (!S.airportClosed) {
        S.airportClosed = true;
        clearClosedStateVisuals();
        commentaryQueue = [];
        draining = false;
        const am = '\x01Airport closed — you are in a <a href="https://www.torn.com/page.php?sid=racing" target="_blank" style="color:#ff6666;text-decoration:underline">race</a>.';
        S.log.push(am);
        recentMessages.push('airport closed');
        renderLog();
        saveS();
      }
      if (el.status) {
        stopReadyFlash(); el.status.textContent = PHASE_CFG.airport_closed.label;
        el.status.style.color = PHASE_CFG.airport_closed.col;
      }
      loopTmr = setTimeout(tick, 1000);
      return;
    }
    if (S.airportClosed) {
      _noRaceCount = (_noRaceCount || 0) + 1;
      if (_noRaceCount >= 1) {
        S.airportClosed = false;
        _noRaceCount = 0;
        addLog('Airport has re-opened.');
        saveS();
      } else {
        if (el.status) {
          stopReadyFlash(); el.status.textContent = PHASE_CFG.airport_closed.label;
          el.status.style.color = PHASE_CFG.airport_closed.col;
        }
        loopTmr = setTimeout(tick, 1000);
        return;
      }
    }
    // STATE OF EMERGENCY (v70.6.0): airspace closed after a terror attack —
    // higher precedence than terror threat as it implies the attack happened.
    const SOE_STRING = 'The airspace above Torn City is closed due to the recent terror attack';
    const soeTextPresent = bodyText.includes(SOE_STRING);
    if (soeTextPresent) {
      if (!S.stateOfEmergency) {
        S.stateOfEmergency = true;
        clearClosedStateVisuals();
        addLog('Armed security turn you away.');
        setTimeout(() => {
          if (S.stateOfEmergency) addLog('Torn City is in lockdown. Airport closed until further notice.');
        }, 2000);
        saveS();
      }
      if (el.status) {
        stopReadyFlash(); el.status.textContent = PHASE_CFG.state_of_emergency.label;
        el.status.style.color = PHASE_CFG.state_of_emergency.col;
      }
      loopTmr = setTimeout(tick, 1000);
      return;
    }
    if (S.stateOfEmergency) {
      // v70.8.0: clear flag silently — spec says no re-open message for SoE.
      S.stateOfEmergency = false;
      saveS();
    }
    // POTENTIAL TERROR THREAT (v70.6.0): airport closed pre-emptively due to
    // intelligence on a possible attack.
    const TT_STRING = 'The airport is temporarily closed due to reports of a potential terror threat against Torn City';
    const ttTextPresent = bodyText.includes(TT_STRING);
    if (ttTextPresent) {
      if (!S.terrorThreat) {
        S.terrorThreat = true;
        clearClosedStateVisuals();
        addLog('Armed security point their weapons at you, denying entry.');
        setTimeout(() => {
          if (S.terrorThreat) addLog('Torn City is in lockdown. Airport closed until further notice.');
        }, 2000);
        saveS();
      }
      if (el.status) {
        stopReadyFlash(); el.status.textContent = PHASE_CFG.terror_threat.label;
        el.status.style.color = PHASE_CFG.terror_threat.col;
      }
      loopTmr = setTimeout(tick, 1000);
      return;
    }
    if (S.terrorThreat) {
      // v70.8.0: clear flag silently — spec says no re-open message for terror threat.
      S.terrorThreat = false;
      saveS();
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
    // v70.27.0: fire any comm messages whose scheduled time has come. The
    // helper is a no-op when the schedule is empty.
    processCommSchedule();
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
      // v70.40.0: list of faction member names on the same flight path
      // (either direction). Used by the small-plane takeoff "Flight
      // logged" message. Skips the player themselves and the 'self_player'
      // sentinel.
      factionOnPath: factionMembersOnPlayerPath(),
    };
    if (phase !== S.prevPhase) {
      S.prevPhase = phase;
      if (phase !== 'landing' && phase !== 'inflight' && phase !== 'arrived') triggerComm(phase, params);
      if (phase === 'inflight') {
        S.phasesTriggered.inflight = true;
        if (S.inflightLogStart === null) {
          S.inflightLogStart = S.log.length;
          saveS();
        }
        buildInflightSchedule();
      }
      if (phase === 'arrived') {
        S.phasesTriggered.arrived = true;
        const arrivedFns = COMMENTARY.arrived;
        const capturedParams = Object.assign({}, params);
        arrivedFns.forEach((fn, i) => {
          setTimeout(() => {
            const msg = fn(capturedParams);
            if (msg) addLog(msg);
            if (i === arrivedFns.length - 1) {
              const newSrc = S.dst;
              // v70.16.0: capture a final sample at landing so the chart
              // closes at t=1, then stop the per-flight sampler.
              recordFlightSample();
              stopFlightSampling();
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
        loopTmr = setTimeout(tick, arrivedFns.length * 3800 + 2500);
        return;
      }
    }
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
    <button class="thb" id="thb-faction" title="Faction Flights"><b style="font-style:normal;font-size:11px">F</b></button>
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
    <p style="color:#b8d4ee">An <strong>API key</strong> lets the visualiser read live flight data from Torn City servers.</p>
    <p style="color:#b8d4ee">To get a key: <strong style="color:#fff">Torn City</strong> &rarr; <strong style="color:#fff">Preferences</strong> &rarr; <strong style="color:#fff">API Keys</strong> tab &rarr; create or edit a key.</p>
    <table style="width:100%;font-size:10px;border-collapse:collapse;margin:6px 0 10px">
      <tr style="color:#5af;border-bottom:1px solid #1e3d5c">
        <th style="text-align:left;padding:2px 4px">Feature</th>
        <th style="text-align:left;padding:2px 4px">Key required</th>
      </tr>
      <tr>
        <td style="padding:2px 4px;color:#b8d4ee">Flight detection &amp; player name</td>
        <td style="padding:2px 4px;color:#44ff88">Minimal</td>
      </tr>
      <tr>
        <td style="padding:2px 4px;color:#b8d4ee">Faction Flights (F button)</td>
        <td style="padding:2px 4px;color:#ffcc44">Limited</td>
      </tr>
    </table>
    <label for="tcfv-api-inp" style="color:#b8d4ee">API Key</label><br>
    <input id="tcfv-api-inp" type="password" placeholder="Paste your Torn API key here" autocomplete="off" spellcheck="false">
    <br><br>
    <button class="tcfv-btn" id="tcfv-api-save">&#128190; Save Key</button>
    <button class="tcfv-btn" id="tcfv-api-test">&#128279; Test Connection</button>
    <p id="tcfv-api-msg"></p>
    <hr>
    <p class="note" style="color:#7a9ab8">Your key is stored locally in Tampermonkey's secure storage and only ever sent to api.torn.com.</p>
  </div>
  <div id="tcfv-cred" class="tcfv-pg" style="display:none">
    <h3>&#9733; Credits</h3>
    <p class="big-t">TORN CITY<br>Flight Visualiser</p>
    <p class="ver-t">Version 70.43.0</p>
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
      <input id="tcfv-scale-slider" type="range" min="10" max="1000" value="100" step="5">
      <div class="scale-ends">
        <span>small</span>
        <span>large</span>
      </div>
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
    // v70.10.0: drag from anywhere inside the panel (exclusions handled in makeDrag).
    makeDrag(panel, panel);
    makeResize(panel, panel.querySelector('#tcfv-resize-handle'));
    panel.querySelector('#thb-min').addEventListener('click', () => doMin(false));
    panel.querySelector('#thb-radar').addEventListener('click', doRadar);
    panel.querySelector('#thb-faction').addEventListener('click', doFaction);
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
      // v70.14.0: start background faction polling so takeoff notifications
      // work as soon as a key is set, without needing to enter faction view.
      if (S.apiKey) startBackgroundFactionPolling();
    });
    panel.querySelector('#tcfv-api-test').addEventListener('click', () =>
      testApiKey(apiInp.value.trim(), panel.querySelector('#tcfv-api-msg'))
    );
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
    if (previewPlane) previewPlane.setAttribute('transform', `scale(${(S.planeScale || 100) / 100})`);
    try {
      const saved = GM_getValue('tcfv_radar', 0);
      radarMode = typeof saved === 'number' ? saved : (saved ? 1 : 0);
      if (radarMode < 0 || radarMode >= RADAR_MODES.length) radarMode = 0;
      if (radarMode > 0) applyRadarMode(el.panel);
    } catch(e) {}
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
    if (factionFlightsOn) doFaction();
    S.page = pg;
    el.pgMain.style.display = pg === 'main' ? 'flex' : 'none';
    el.pgSet.style.display = pg === 'set' ? 'block' : 'none';
    el.pgCred.style.display = pg === 'cred' ? 'block' : 'none';
    el.pgMore.style.display = pg === 'more' ? 'block' : 'none';
    el.pgDiag.style.display = pg === 'diag' ? 'flex' : 'none';
    // v70.15.0: regenerate diagnostics on each visit so every system rolls
    // fresh status/detail; then start the periodic randomiser so indicators
    // continue to change while the page is open.
    if (pg === 'diag') {
      S.diagnostics = generateDiagnostics();
      renderDiagPage();
      startDiagRandomiser();
    } else {
      stopDiagRandomiser();
    }
    document.querySelectorAll('.thb').forEach(b => b.classList.remove('ta'));
    const map = { main:'#thb-main', set:'#thb-set', cred:'#thb-cred', more:'#thb-more', diag:'#thb-diag' };
    document.querySelector(map[pg])?.classList.add('ta');
    saveS();
  }

  /* ─────────────────────────────────────────────────────────────
     DIAGNOSTICS
  ───────────────────────────────────────────────────────────── */

  const DIAG_STATUS_COLS = { green:'#44ff88', yellow:'#ffcc44', red:'#ff4444' };

  // v70.14.0: each system carries a detailsByStatus pool so the displayed
  // message matches the rolled status. Messages reflect realistic aviation
  // issues (avionics faults, pressurisation problems, engine indications,
  // hydraulic/control-surface degradations, gear safety, stabiliser anomalies).
  function generateDiagnostics() {
    const isSmall = TICKETS[S.ticket]?.size === 'small';
    const rnd = () => {
      const r = Math.random();
      if (r < 0.72) return 'green';
      if (r < 0.92) return 'yellow';
      return 'red';
    };
    const pickDetail = (sys, status) => {
      const arr = sys.detailsByStatus && sys.detailsByStatus[status];
      if (!arr || !arr.length) return '';
      return arr[Math.floor(Math.random() * arr.length)];
    };
    const largeSystems = [
      { id:'electrical', name:'Electrical Systems', x:140, y:52,
        detailsByStatus: {
          green:  ['All buses nominal', 'Power distribution OK', 'IDG output stable'],
          yellow: ['Voltage flicker on bus 2', 'Battery charge irregular', 'IDG output marginal'],
          red:    ['Generator 1 offline', 'Avionics smoke detected', 'Total electrical fault'],
        } },
      { id:'pressure', name:'Cabin Pressure', x:140, y:80,
        detailsByStatus: {
          green:  ['8.0 psi differential', 'Pressurisation nominal', 'Outflow valve stable'],
          yellow: ['Outflow valve sluggish', 'Minor seal leak detected', 'Cabin altitude drifting'],
          red:    ['Rapid decompression risk', 'Oxygen masks armed', 'Cabin altitude critical'],
        } },
      { id:'engines', name:'Engines (x4)', x:38, y:118,
        detailsByStatus: {
          green:  ['CFM56-7B thrust nominal', 'All four engines stable', 'N1/N2 within tolerance'],
          yellow: ['EGT high on #3', 'Oil pressure marginal #2', 'Vibration warning #4'],
          red:    ['Engine #2 flame-out', 'Compressor stall #1', 'Critical overheat #3'],
        } },
      { id:'wings', name:'Wings', x:252, y:108,
        detailsByStatus: {
          green:  ['Control surfaces nominal', 'Aileron & flap response OK', 'Hydraulics green'],
          yellow: ['Flap actuator slow', 'Slat asymmetry detected', 'Hydraulic pressure low'],
          red:    ['Aileron jam', 'Leading edge damage', 'Spoiler split detected'],
        } },
      { id:'gear', name:'Flight Gear', x:140, y:143,
        detailsByStatus: {
          green:  ['Gear status normal', 'Hydraulics nominal', 'All three down & locked'],
          yellow: ['Hydraulic seal weak', 'Position indicator intermittent', 'Tyre pressure marginal'],
          red:    ['Gear unsafe — manual extension required', 'Tyre pressure critical', 'Strut leak detected'],
        } },
      { id:'tail', name:'Tail Wing', x:140, y:178,
        detailsByStatus: {
          green:  ['Stabilisers nominal', 'Rudder & elevator OK', 'Trim within range'],
          yellow: ['Rudder limiter active', 'Elevator trim drift', 'Yaw damper intermittent'],
          red:    ['Rudder jam', 'Elevator authority lost', 'Stabiliser runaway'],
        } },
    ];
    const smallSystems = [
      { id:'electrical', name:'Electrical Systems', x:140, y:68,
        detailsByStatus: {
          green:  ['Battery & alternator OK', 'Bus voltage stable', 'Avionics powered'],
          yellow: ['Alternator output low', 'Battery temperature high', 'Ammeter fluctuating'],
          red:    ['Alternator offline', 'Battery dead', 'Master switch tripped'],
        } },
      { id:'engine', name:'Engine', x:140, y:22,
        detailsByStatus: {
          green:  ['Lycoming O-360 nominal', 'CHT/EGT in range', 'Oil pressure stable'],
          yellow: ['CHT marginal cyl 3', 'Oil pressure low', 'Mag drop above limit'],
          red:    ['Engine rough running', 'Oil pressure critical', 'Fuel starvation detected'],
        } },
      { id:'wings', name:'Wings', x:28, y:96,
        detailsByStatus: {
          green:  ['Control surfaces nominal', 'Aileron response OK', 'Flap operation normal'],
          yellow: ['Flap actuator drag', 'Aileron friction high', 'Trim cable stretched'],
          red:    ['Aileron stuck', 'Flap asymmetric extension', 'Wing strut damage'],
        } },
      { id:'gear', name:'Flight Gear', x:140, y:128,
        detailsByStatus: {
          green:  ['Gear status normal', 'Down & locked indication clear', 'Tyre pressure OK'],
          yellow: ['Wheel bearing rough', 'Brake pad wear high', 'Tyre pressure marginal'],
          red:    ['Brake hydraulic leak', 'Tyre pressure critical', 'Gear strut bent'],
        } },
      { id:'tail', name:'Tail Wing', x:140, y:162,
        detailsByStatus: {
          green:  ['Stabiliser nominal', 'Rudder & elevator OK', 'Trim wheel free'],
          yellow: ['Trim wheel stiff', 'Rudder pedal asymmetry', 'Elevator vibration'],
          red:    ['Elevator jam', 'Rudder cable broken', 'Trim runaway'],
        } },
    ];
    const list = isSmall ? smallSystems : largeSystems;
    const systems = list.map(s => {
      const status = rnd();
      return { ...s, status, detail: pickDetail(s, status) };
    });
    // v70.19.0: pre-compute the widest possible name and detail strings
    // across every status pool so the diag columns can be sized to the
    // worst-case width rather than the current random selection. This stops
    // the layout from jittering between randomiser ticks.
    const gearPrefixLen = 'Gear retracted — '.length;
    let maxNameLen = 0;
    let maxDetailLen = 'Gear retracted'.length; // baseline (gear with green status, no suffix)
    systems.forEach(s => {
      maxNameLen = Math.max(maxNameLen, (s.name || '').length);
      if (!s.detailsByStatus) return;
      for (const arr of Object.values(s.detailsByStatus)) {
        for (const item of arr) {
          const len = (s.id === 'gear') ? (item.length + gearPrefixLen) : item.length;
          if (len > maxDetailLen) maxDetailLen = len;
        }
      }
    });
    return { isSmall, systems, maxNameLen, maxDetailLen };
  }

  function diagSVGLarge(systems, overrideCol) {
    const sysMap = {};
    systems.forEach(s => { sysMap[s.id] = s.status; });
    // v70.24.0: when an override colour is passed (maintenance/landed mode),
    // every indicator uses it instead of looking up the RAG status colour.
    const col = id => overrideCol || DIAG_STATUS_COLS[sysMap[id]] || '#444';
    return `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-height:200px">
  <rect width="280" height="200" fill="#050e05"/>
  <ellipse cx="140" cy="100" rx="13" ry="88" fill="none" stroke="#5ab0e8" stroke-width="1.5"/>
  <polygon points="130,75 22,120 26,130 134,92" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <polygon points="150,75 258,120 254,130 146,92" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="38" cy="118" rx="8" ry="13" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="78" cy="105" rx="7" ry="11" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="202" cy="105" rx="7" ry="11" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="242" cy="118" rx="8" ry="13" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <polygon points="131,168 96,179 99,185 133,175" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <polygon points="149,168 184,179 181,185 147,175" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <ellipse cx="140" cy="18" rx="6" ry="8" fill="#0a1a2a" stroke="#5ab0e8" stroke-width="1"/>
  <circle cx="140" cy="52" r="5" fill="${col('electrical')}" opacity="0.9"/>
  <circle cx="140" cy="80" r="5" fill="${col('pressure')}" opacity="0.9"/>
  <circle cx="38" cy="118" r="5" fill="${col('engines')}" opacity="0.9"/>
  <circle cx="252" cy="108" r="5" fill="${col('wings')}" opacity="0.9"/>
  <circle cx="140" cy="143" r="5" fill="${col('gear')}" opacity="0.9"/>
  <circle cx="140" cy="178" r="5" fill="${col('tail')}" opacity="0.9"/>
  <line x1="145" y1="52" x2="165" y2="52" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="80" x2="165" y2="80" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="43" y1="118" x2="63" y2="118" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="247" y1="108" x2="227" y2="108" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="143" x2="165" y2="143" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="178" x2="165" y2="178" stroke="#5ab0e8" stroke-width="0.5" opacity="0.4"/>
</svg>`;
  }

  function diagSVGSmall(systems, overrideCol) {
    const sysMap = {};
    systems.forEach(s => { sysMap[s.id] = s.status; });
    const col = id => overrideCol || DIAG_STATUS_COLS[sysMap[id]] || '#444';
    return `<svg viewBox="0 0 280 190" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-height:190px">
  <rect width="280" height="190" fill="#050e05"/>
  <ellipse cx="140" cy="95" rx="10" ry="74" fill="none" stroke="#88ff44" stroke-width="1.5"/>
  <polygon points="132,88 20,96 22,104 134,95" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <polygon points="148,88 260,96 258,104 146,95" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <ellipse cx="140" cy="25" rx="6" ry="6" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <line x1="140" y1="8" x2="140" y2="22" stroke="#88ff44" stroke-width="2"/>
  <line x1="125" y1="20" x2="155" y2="20" stroke="#88ff44" stroke-width="2" stroke-linecap="round"/>
  <polygon points="132,155 100,165 102,171 134,162" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <polygon points="148,155 180,165 178,171 146,162" fill="#0a1a0a" stroke="#88ff44" stroke-width="1"/>
  <circle cx="140" cy="68" r="5" fill="${col('electrical')}" opacity="0.9"/>
  <circle cx="140" cy="22" r="5" fill="${col('engine')}" opacity="0.9"/>
  <circle cx="28" cy="96" r="5" fill="${col('wings')}" opacity="0.9"/>
  <circle cx="140" cy="128" r="5" fill="${col('gear')}" opacity="0.9"/>
  <circle cx="140" cy="162" r="5" fill="${col('tail')}" opacity="0.9"/>
  <line x1="145" y1="68" x2="165" y2="68" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="22" x2="165" y2="22" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="33" y1="96" x2="53" y2="96" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="128" x2="165" y2="128" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
  <line x1="145" y1="162" x2="165" y2="162" stroke="#88ff44" stroke-width="0.5" opacity="0.4"/>
</svg>`;
  }

  // v70.16.0: periodic re-randomisation of every system's status & detail
  // (gear keeps its phase-driven position prefix). Runs while the user is on
  // the diagnostics page so indicators feel dynamic, paused otherwise.
  let diagRandomTimer = null;
  // v70.16.0: per-flight sampler. Runs throughout an active flight (regardless
  // of which page the user is viewing) so the RAG-history chart on the
  // Diagnostics page reflects the full flight duration from takeoff to landing.
  let flightSampleTimer = null;
  // v70.24.0: tracks whether the oscilloscope was last rendered in animated
  // (S.flying === true) or stopped state. When the state flips, the partial-
  // update branch of renderDiagPage rebuilds the oscilloscope SVG so the
  // SMIL animations get added or removed as appropriate.
  let lastOscFlyingState = null;

  function randomiseDiagnostics() {
    if (!S.diagnostics || !S.diagnostics.systems || !S.diagnostics.systems.length) return -1;
    const rnd = () => {
      const r = Math.random();
      if (r < 0.72) return 'green';
      if (r < 0.92) return 'yellow';
      return 'red';
    };
    const pickDetail = (sys, status) => {
      const arr = sys.detailsByStatus && sys.detailsByStatus[status];
      if (!arr || !arr.length) return '';
      return arr[Math.floor(Math.random() * arr.length)];
    };
    // v70.29.0: flip ONE random system per call, not all of them. The
    // returned index lets the caller flash the affected row white for half a
    // second to make the change visible. The gear row is still eligible —
    // its RAG colour can change even though the renderer overrides its
    // detail text to RETRACTED/LOWERED.
    const idx = Math.floor(Math.random() * S.diagnostics.systems.length);
    const s = S.diagnostics.systems[idx];
    s.status = rnd();
    s.detail = pickDetail(s, s.status);
    return idx;
  }

  // v70.29.0: highlights the row whose system has just changed in white for
  // 500ms, then lets it revert to its normal RAG colours. Bails silently if
  // the user isn't on the diag page or the row isn't in the DOM.
  function flashDiagRow(idx) {
    if (idx < 0 || S.page !== 'diag') return;
    const row = document.querySelector(`.diag-row[data-row-idx="${idx}"]`);
    if (!row) return;
    row.classList.add('flashing');
    setTimeout(() => { row.classList.remove('flashing'); }, 500);
  }

  function recordFlightSample() {
    if (!S.flying || !S.diagnostics) return;
    if (!S.flightHistory || !Array.isArray(S.flightHistory.samples)) {
      S.flightHistory = { samples: [] };
    }
    const counts = { green:0, yellow:0, red:0 };
    S.diagnostics.systems.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
    const now = Date.now();
    const total = (S.arrTime || 0) - (S.depTime || 0);
    const elapsed = now - (S.depTime || now);
    const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
    const timeLeft = Math.max(0, (S.arrTime || 0) - now);
    const alt = getAlt(progress, timeLeft);
    // v70.17.0/v70.18.0: also track number of faction members flying and
    // number abroad at sample time.
    const factionCount = Object.keys(factionData).filter(id => id !== 'self_player').length;
    const abroadCount = Object.keys(factionAbroad).length;
    S.flightHistory.samples.push({ t: progress, g: counts.green, y: counts.yellow, r: counts.red, a: alt, f: factionCount, ab: abroadCount });
    // Hard cap to keep storage manageable for very long flights — keep the
    // first sample plus an evenly-spaced subset when capacity is reached.
    if (S.flightHistory.samples.length > 600) {
      const ss = S.flightHistory.samples;
      const compacted = [ss[0]];
      for (let i = 2; i < ss.length; i += 2) compacted.push(ss[i]);
      S.flightHistory.samples = compacted;
    }
  }

  function startFlightSampling() {
    stopFlightSampling();
    flightSampleTimer = setInterval(() => {
      if (!S.flying) { stopFlightSampling(); return; }
      const idx = randomiseDiagnostics();
      recordFlightSample();
      saveS();
      if (S.page === 'diag') {
        renderDiagPage();
        flashDiagRow(idx);
      }
    }, 30000);
  }

  function stopFlightSampling() {
    if (flightSampleTimer) { clearInterval(flightSampleTimer); flightSampleTimer = null; }
  }

  function startDiagRandomiser() {
    stopDiagRandomiser();
    diagRandomTimer = setInterval(() => {
      if (S.page !== 'diag') return;
      const idx = randomiseDiagnostics();
      renderDiagPage();
      flashDiagRow(idx);
    }, 10000);
  }

  function stopDiagRandomiser() {
    if (diagRandomTimer) { clearInterval(diagRandomTimer); diagRandomTimer = null; }
  }

  // v70.16.0: curved line chart of RAG counts + altitude across the active
  // flight. X axis = flight progress (0→1). Left Y axis = system count
  // (0→max). Right Y axis = altitude (0→ticket maxAlt). Curves smoothed with
  // mid-point quadratic Bezier interpolation.
  // v70.17.0: altitude line is now solid light grey (not dashed), and this
  // chart sits underneath the rows spanning the full width.
  function renderFlightHistoryChart() {
    const W = 420, H = 180;
    // v70.25.0: padT bumped from 14 to 28 to leave room for the legend above
    // the plot area so curve paths can't draw over it.
    const padL = 28, padR = 32, padT = 28, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const samples = (S.flightHistory && S.flightHistory.samples) || [];
    const maxCount = (S.diagnostics && S.diagnostics.systems) ? S.diagnostics.systems.length : 6;
    const maxAlt = TICKETS[S.ticket]?.maxAlt || 32000;

    const buildPath = (getValue, max) => {
      if (!samples.length) return '';
      const pts = samples.map(s => ({
        x: padL + s.t * plotW,
        y: padT + plotH - (getValue(s) / max) * plotH,
      }));
      if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i-1];
        const cur = pts[i];
        const mx = ((prev.x + cur.x) / 2).toFixed(1);
        const my = ((prev.y + cur.y) / 2).toFixed(1);
        d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx} ${my}`;
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      return d;
    };

    const greenPath = buildPath(s => s.g, maxCount);
    const yellowPath = buildPath(s => s.y, maxCount);
    const redPath = buildPath(s => s.r, maxCount);
    const altPath = buildPath(s => s.a, maxAlt);

    const emptyMsg = samples.length === 0
      ? `<text x="${W/2}" y="${H/2}" font-size="9" fill="#446" text-anchor="middle" font-family="monospace">NO FLIGHT DATA</text>`
      : '';

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" width="100%" style="display:block">
  <rect width="${W}" height="${H}" fill="#050e05"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  <line x1="${W - padR}" y1="${padT}" x2="${W - padR}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  <text x="${padL - 3}" y="${padT + 4}" font-size="7" fill="#5a8a5a" text-anchor="end" font-family="monospace">${maxCount}</text>
  <text x="${padL - 3}" y="${H - padB + 2}" font-size="7" fill="#5a8a5a" text-anchor="end" font-family="monospace">0</text>
  <text x="${W - padR + 3}" y="${padT + 4}" font-size="7" fill="#5a8a5a" text-anchor="start" font-family="monospace">${(maxAlt/1000).toFixed(0)}K</text>
  <text x="${W - padR + 3}" y="${H - padB + 2}" font-size="7" fill="#5a8a5a" text-anchor="start" font-family="monospace">0</text>
  <text x="${(W/2).toFixed(0)}" y="${H - 6}" font-size="7" fill="#5a8a5a" text-anchor="middle" font-family="monospace">FLIGHT TIME</text>
  <text x="${padL - 3}" y="${(padT + plotH/2 + 2).toFixed(0)}" font-size="6" fill="#5a8a5a" text-anchor="end" font-family="monospace" transform="rotate(-90 ${padL - 3} ${(padT + plotH/2 + 2).toFixed(0)})">COUNT</text>
  <text x="${W - padR + 3}" y="${(padT + plotH/2 + 2).toFixed(0)}" font-size="6" fill="#5a8a5a" text-anchor="start" font-family="monospace" transform="rotate(-90 ${W - padR + 3} ${(padT + plotH/2 + 2).toFixed(0)})">ALT FT</text>
  <path d="${greenPath}" fill="none" stroke="#44ff88" stroke-width="1.2" opacity="0.9"/>
  <path d="${yellowPath}" fill="none" stroke="#ffcc44" stroke-width="1.2" opacity="0.9"/>
  <path d="${redPath}" fill="none" stroke="#ff4444" stroke-width="1.2" opacity="0.9"/>
  <path d="${altPath}" fill="none" stroke="#cccccc" stroke-width="1.1" opacity="0.85"/>
  <g transform="translate(${padL}, 10)" font-size="7" font-family="monospace">
    <text x="0" y="0" fill="#44ff88">&#9472; GREEN</text>
    <text x="58" y="0" fill="#ffcc44">&#9472; YELLOW</text>
    <text x="124" y="0" fill="#ff4444">&#9472; RED</text>
    <text x="172" y="0" fill="#cccccc">&#9472; ALT</text>
  </g>
  ${emptyMsg}
</svg>`;
  }

  // v70.21.0: oscilloscope display for the diagnostics page.
  // v70.26.0: rewritten — three flat horizontal lines stacked exactly on
  // each other at H/2. A JavaScript scheduler fires random "beats" every
  // 2–8 seconds during flight: each beat replaces the three flat paths
  // with random spike paths for a fraction of a second (150–400ms), then
  // reverts to flat. Lines all light grey, CRT glow via Gaussian blur.
  // When not flying, the scheduler is stopped and the traces stay flat.
  function renderOscilloscope() {
    const W = 400, H = 60;
    const flatPath = `M0,${(H/2).toFixed(1)} L${W.toFixed(1)},${(H/2).toFixed(1)}`;
    const animated = !!S.flying;
    const stoppedLabel = animated
      ? ''
      : `<text x="${W - 6}" y="${H - 4}" font-size="6" fill="#5a8a5a" font-family="monospace" letter-spacing="0.5" text-anchor="end">STOPPED</text>`;
    const greyLine = '#cccccc';
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" width="100%" style="display:block">
  <defs>
    <filter id="tcfv-osc-glow" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur stdDeviation="1.2" result="b1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="b2"/>
      <feMerge>
        <feMergeNode in="b1"/>
        <feMergeNode in="b2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#040c08"/>
  <g stroke="#1a3a1a" stroke-width="0.4" opacity="0.55">
    <line x1="0" y1="${(H/4).toFixed(1)}" x2="${W}" y2="${(H/4).toFixed(1)}"/>
    <line x1="0" y1="${(H/2).toFixed(1)}" x2="${W}" y2="${(H/2).toFixed(1)}"/>
    <line x1="0" y1="${(3*H/4).toFixed(1)}" x2="${W}" y2="${(3*H/4).toFixed(1)}"/>
    <line x1="${(W/4).toFixed(1)}" y1="0" x2="${(W/4).toFixed(1)}" y2="${H}"/>
    <line x1="${(W/2).toFixed(1)}" y1="0" x2="${(W/2).toFixed(1)}" y2="${H}"/>
    <line x1="${(3*W/4).toFixed(1)}" y1="0" x2="${(3*W/4).toFixed(1)}" y2="${H}"/>
  </g>
  <clipPath id="tcfv-osc-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
  <g clip-path="url(#tcfv-osc-clip)" filter="url(#tcfv-osc-glow)">
    <path class="tcfv-osc-trace" d="${flatPath}" fill="none" stroke="${greyLine}" stroke-width="0.85" opacity="0.55"/>
    <path class="tcfv-osc-trace" d="${flatPath}" fill="none" stroke="${greyLine}" stroke-width="0.85" opacity="0.70"/>
    <path class="tcfv-osc-trace" d="${flatPath}" fill="none" stroke="${greyLine}" stroke-width="0.95" opacity="0.95"/>
  </g>
  <text x="6" y="10" font-size="6" fill="#5a8a5a" font-family="monospace" letter-spacing="0.5">OSC</text>
  ${stoppedLabel}
</svg>`;
  }

  // v70.26.0: beat scheduler. Runs while S.flying is true and the
  // oscilloscope is on screen. Picks a random 2–8s delay, fires a beat
  // (random spike pattern on all three trace paths), holds for 150–400ms,
  // reverts to flat, schedules the next beat. stopOscBeats clears any
  // pending timer when the flight state changes or the page is rebuilt.
  let oscBeatTimer = null;
  let oscRevertTimer = null;
  const OSC_W = 400;
  const OSC_H = 60;
  function buildOscFlatPath() {
    return `M0,${(OSC_H/2).toFixed(1)} L${OSC_W.toFixed(1)},${(OSC_H/2).toFixed(1)}`;
  }
  function buildOscBeatPath(ampRange) {
    const points = 6;
    const midY = OSC_H / 2;
    let d = '';
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * OSC_W;
      // Endpoints stay at the centre so beats start/end at the flat line.
      const offset = (i === 0 || i === points) ? 0 : (Math.random() - 0.5) * 2 * ampRange;
      const y = midY + offset;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d;
  }
  function stopOscBeats() {
    if (oscBeatTimer) { clearTimeout(oscBeatTimer); oscBeatTimer = null; }
    if (oscRevertTimer) { clearTimeout(oscRevertTimer); oscRevertTimer = null; }
  }
  function startOscBeats() {
    stopOscBeats();
    const fireBeat = () => {
      if (!S.flying) { stopOscBeats(); return; }
      const traces = document.querySelectorAll('#tcfv-diag-osc .tcfv-osc-trace');
      if (traces.length !== 3) { stopOscBeats(); return; }
      // Three independent random amplitudes — each trace beats differently.
      const beats = [
        buildOscBeatPath(18),
        buildOscBeatPath(14),
        buildOscBeatPath(10),
      ];
      traces.forEach((tr, i) => tr.setAttribute('d', beats[i]));
      // Hold the beat for a fraction of a second, then revert to flat.
      const holdMs = 150 + Math.random() * 250;
      oscRevertTimer = setTimeout(() => {
        const flat = buildOscFlatPath();
        const tracesNow = document.querySelectorAll('#tcfv-diag-osc .tcfv-osc-trace');
        tracesNow.forEach(tr => tr.setAttribute('d', flat));
      }, holdMs);
      // Next beat in 2–8s.
      const nextMs = 2000 + Math.random() * 6000;
      oscBeatTimer = setTimeout(fireBeat, nextMs);
    };
    // Initial delay 2–8s before the first beat.
    oscBeatTimer = setTimeout(fireBeat, 2000 + Math.random() * 6000);
  }

  // v70.17.0/v70.18.0: faction-activity chart on the right of the textual
  // display. Left Y axis = number of faction members currently flying. Right
  // Y axis = number abroad. Both curves share the same flight-time X axis and
  // are sampled in sync with the RAG chart (every 30s during the flight).
  // v70.21.0: both axes now share the same top value (max of either curve's
  // peak, minimum 5) so the scale matches, and integer tick labels are drawn
  // for every value from 0 to that maximum. viewBox sized to match the RAG
  // chart so when they sit side-by-side at 50/50 they render at identical
  // heights including their axis labels.
  function renderFactionFlyingChart() {
    const W = 420, H = 180;
    // v70.25.0: padT bumped to 28 to make room for the legend above the
    // plot area.
    const padL = 30, padR = 30, padT = 28, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const samples = (S.flightHistory && S.flightHistory.samples) || [];
    const peakFly = samples.reduce((mx, s) => Math.max(mx, s.f || 0), 0);
    const peakAb = samples.reduce((mx, s) => Math.max(mx, s.ab || 0), 0);
    // v70.21.0: single shared maximum so both axes show the same top number.
    const maxCount = Math.max(5, peakFly, peakAb);

    const buildPath = (getValue) => {
      if (!samples.length) return '';
      const pts = samples.map(s => ({
        x: padL + s.t * plotW,
        y: padT + plotH - (getValue(s) / maxCount) * plotH,
      }));
      if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i-1];
        const cur = pts[i];
        const mx = ((prev.x + cur.x) / 2).toFixed(1);
        const my = ((prev.y + cur.y) / 2).toFixed(1);
        d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx} ${my}`;
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      return d;
    };

    const flyPath = buildPath(s => s.f || 0);
    const abPath = buildPath(s => s.ab || 0);

    // v70.21.0: tick label every integer from 0..maxCount on both axes. If
    // maxCount is huge, drop every other label so they don't overlap.
    const tickStep = (maxCount > 12) ? 2 : 1;
    let ticksMarkup = '';
    for (let v = 0; v <= maxCount; v += tickStep) {
      const y = (padT + plotH - (v / maxCount) * plotH).toFixed(1);
      ticksMarkup += `<text x="${padL - 3}" y="${y}" font-size="6" fill="#5a8a5a" text-anchor="end" dominant-baseline="middle" font-family="monospace">${v}</text>`;
      ticksMarkup += `<text x="${W - padR + 3}" y="${y}" font-size="6" fill="#5a8a5a" text-anchor="start" dominant-baseline="middle" font-family="monospace">${v}</text>`;
    }

    const emptyMsg = samples.length === 0
      ? `<text x="${W/2}" y="${H/2}" font-size="9" fill="#446" text-anchor="middle" font-family="monospace">NO DATA</text>`
      : '';

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" width="100%" style="display:block">
  <rect width="${W}" height="${H}" fill="#050e05"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  <line x1="${W - padR}" y1="${padT}" x2="${W - padR}" y2="${H - padB}" stroke="#2a4a2a" stroke-width="0.6"/>
  ${ticksMarkup}
  <text x="${(W/2).toFixed(0)}" y="${H - 6}" font-size="7" fill="#5a8a5a" text-anchor="middle" font-family="monospace">FLIGHT TIME</text>
  <text x="${padL - 18}" y="${(padT + plotH/2 + 2).toFixed(0)}" font-size="6" fill="#5a8a5a" text-anchor="middle" font-family="monospace" transform="rotate(-90 ${padL - 18} ${(padT + plotH/2 + 2).toFixed(0)})">FLYING</text>
  <text x="${W - padR + 18}" y="${(padT + plotH/2 + 2).toFixed(0)}" font-size="6" fill="#5a8a5a" text-anchor="middle" font-family="monospace" transform="rotate(-90 ${W - padR + 18} ${(padT + plotH/2 + 2).toFixed(0)})">ABROAD</text>
  <path d="${abPath}" fill="none" stroke="#ffaa66" stroke-width="1.2" opacity="0.9"/>
  <path d="${flyPath}" fill="none" stroke="#88ddff" stroke-width="1.2" opacity="0.9"/>
  <g transform="translate(${padL}, 10)" font-size="7" font-family="monospace">
    <text x="0" y="0" fill="#88ddff">&#9472; FLYING</text>
    <text x="64" y="0" fill="#ffaa66">&#9472; ABROAD</text>
  </g>
  ${emptyMsg}
</svg>`;
  }

  function renderDiagPage() {
    const inner = document.getElementById('tcfv-diag-inner');
    if (!inner) return;
    if (!S.diagnostics) S.diagnostics = generateDiagnostics();
    const d = S.diagnostics;
    // v70.15.0: gear display detail computed without mutating gearSys.detail.
    const gearSys = d.systems.find(s => s.id === 'gear');
    let gearDisplayDetail = null;
    if (gearSys) {
      const phase = S.flying ? (S.arrTime && (S.arrTime - Date.now() < 120000) ? 'landing' : 'flying') : 'ground';
      const isDown = (phase === 'ground' || phase === 'landing');
      const position = isDown ? 'Gear deployed' : 'Gear retracted';
      if (isDown) gearSys.status = 'green';
      const issue = gearSys.detail || '';
      const isGenericGreen = /^(Gear status normal|Down & locked indication clear|Hydraulics nominal|All three down & locked|Tyre pressure OK)$/.test(issue);
      gearDisplayDetail = (gearSys.status === 'green' || isGenericGreen) ? position : `${position} — ${issue}`;
    }
    // v70.24.0: when the player is not flying (parked at a city), all
    // systems show as in maintenance mode rather than running. The
    // schematic indicators, row dots, detail and status columns all switch
    // to a grey "SHUTDOWN/MAINTENANCE" presentation. Flight Gear's detail
    // becomes "LOWERED" per spec rather than "SHUTDOWN".
    // v70.25.0: gear says LOWERED (not RETRACTED) when on the ground —
    // physically the gear is deployed when parked, regardless of whether
    // the airport is open, closed for a race, closed due to a terror
    // threat, or any other not-flying state.
    const isLanded = !S.flying;
    const greyCol = '#888888';
    const schematic = d.isSmall ? diagSVGSmall(d.systems, isLanded ? greyCol : null) : diagSVGLarge(d.systems, isLanded ? greyCol : null);
    const acType = d.isSmall ? 'PRIVATE PLANE' : 'JUMBO JET';
    // v70.16.0: all three columns uppercased; gaps widened to 3 character
    // widths (~18px in the monospace stack) and the block is left-justified
    // rather than spanning the full row.
    const rows = d.systems.map((s, i) => {
      let col, label, detail;
      const name = (s.name || '').toUpperCase();
      if (isLanded) {
        col = greyCol;
        label = 'MAINTENANCE';
        // v70.39.0: gear detail says DEPLOYED when on the ground (parked /
        // closed airport / etc.) — previously 'LOWERED'. The plane's gear
        // is physically deployed when the aircraft is sitting at a gate,
        // and the spec now uses 'DEPLOYED' consistently.
        detail = (s.id === 'gear') ? 'DEPLOYED' : 'SHUTDOWN';
      } else {
        col = DIAG_STATUS_COLS[s.status];
        label = s.status.toUpperCase();
        const detailRaw = (s.id === 'gear' && gearDisplayDetail !== null) ? gearDisplayDetail : s.detail;
        detail = (detailRaw || '').toUpperCase();
      }
      // v70.29.0: data-row-idx lets the flash helper target the single row
      // whose system has just changed.
      return `<div class="diag-row" data-row-idx="${i}">
  <span class="diag-ind" style="background:${col}"></span>
  <span class="diag-name">${name}</span>
  <span class="diag-detail">${detail}</span>
  <span class="diag-status" style="color:${col}">${label}</span>
</div>`;
    }).join('');
    const chart = renderFlightHistoryChart();
    const factionChart = renderFactionFlyingChart();
    // v70.19.0: derive pixel widths from the precomputed character counts. The
    // monospace stack averages ~5.4px per glyph at 9px font size; an extra
    // small allowance protects against fractional rounding. Sizes are passed
    // as CSS custom properties so the grid template can reference them.
    const charPx = 5.4;
    const nameW = Math.ceil((d.maxNameLen || 0) * charPx) + 4;
    const detailW = Math.ceil((d.maxDetailLen || 0) * charPx) + 4;
    // v70.26.0: status column was 56px which truncated "MAINTENANCE" (11
    // chars × 5.4px = 59px) when the plane is parked. Widened to fit the
    // longest status word that can appear in either flying or landed state.
    const statusW = Math.ceil(Math.max('MAINTENANCE'.length, 'YELLOW'.length) * charPx) + 8;
    // v70.21.0: smart rebuild — if the page already has the oscilloscope DOM
    // in place, only refresh the dynamic content (rows, charts, header
    // schematic) so the SMIL-animated oscilloscope keeps scrolling without
    // restarting every 10s when the randomiser fires. The first render (and
    // any render where the oscilloscope is missing) does a full rebuild.
    // v70.24.0: also capture the current flying state so the partial-update
    // branch can detect a takeoff/landing transition and swap the
    // oscilloscope between music waveforms and stopped trace.
    const oscExists = !!document.getElementById('tcfv-diag-osc');
    const currentlyFlying = !!S.flying;
    if (!oscExists) {
      inner.innerHTML = `<div class="diag-header">
  <span class="diag-title">&#9874; AIRCRAFT DIAGNOSTICS</span>
  <span class="diag-type">${acType}</span>
</div>
<div class="diag-schematic">${schematic}</div>
<div class="diag-rows-osc">
  <div class="diag-systems" style="--diag-name-w:${nameW}px;--diag-detail-w:${detailW}px;--diag-status-w:${statusW}px;">${rows}</div>
  <div class="diag-osc" id="tcfv-diag-osc">${renderOscilloscope()}</div>
</div>
<div class="diag-charts-row">
  <div class="diag-chart-rag">${chart}</div>
  <div class="diag-chart-faction">${factionChart}</div>
</div>`;
      // v70.26.0: kick off the beat scheduler immediately after building the
      // oscilloscope DOM (only while flying — stopped state stays flat).
      stopOscBeats();
      if (currentlyFlying) startOscBeats();
    } else {
      const typeEl = inner.querySelector('.diag-type');
      if (typeEl) typeEl.textContent = acType;
      const schemEl = inner.querySelector('.diag-schematic');
      if (schemEl) schemEl.innerHTML = schematic;
      const rowsEl = inner.querySelector('.diag-systems');
      if (rowsEl) {
        rowsEl.style.setProperty('--diag-name-w', `${nameW}px`);
        rowsEl.style.setProperty('--diag-detail-w', `${detailW}px`);
        rowsEl.style.setProperty('--diag-status-w', `${statusW}px`);
        rowsEl.innerHTML = rows;
      }
      const ragEl = inner.querySelector('.diag-chart-rag');
      if (ragEl) ragEl.innerHTML = chart;
      const facEl = inner.querySelector('.diag-chart-faction');
      if (facEl) facEl.innerHTML = factionChart;
      // Oscilloscope intentionally left alone — its beat scheduler keeps
      // firing between renders. But if flight state has flipped (takeoff or
      // landing), rebuild it and restart/stop the scheduler.
      if (lastOscFlyingState !== currentlyFlying) {
        const oscEl = document.getElementById('tcfv-diag-osc');
        if (oscEl) oscEl.innerHTML = renderOscilloscope();
        stopOscBeats();
        if (currentlyFlying) startOscBeats();
      }
    }
    lastOscFlyingState = currentlyFlying;
  }

  /* ─────────────────────────────────────────────────────────────
     FACTION FLIGHTS  (Fixes 1–5 applied; v70.5.0 stagger fix using canonical bezier)
  ───────────────────────────────────────────────────────────── */

  let factionFlightsOn = false;
  let factionDrawTimer = null;
  let factionData = {};
  let factionAbroad = {};
  let savedPlayerViewBox = '';
  // v70.14.0: track previously-known flying faction members so we can fire
  // a takeoff notification when a new entry appears between polls.
  let prevFactionFlyingIds = new Set();
  // v70.19.0: cache the previous poll's flying members keyed by id, so when
  // they drop out of factionData on a subsequent poll (= they've landed) we
  // still know their destination to put in the notification.
  let prevFactionFlying = {};
  let factionFirstPollDone = false;
  let backgroundFactionTimer = null;
  let activeNotifyCount = 0;

  /**
   * v70.14.0: Show a small popup at the bottom-right of the map view when a
   * faction member takes off.
   * v70.17.0: Two-minute hold; click to dismiss; stack-container layout.
   * v70.19.0: Hold time bumped to ten minutes (per spec); landing
   * notifications added (see notifyFactionLanding). Both variants share the
   * notifyFactionEvent core so notification semantics stay identical.
   */
  function notifyFactionEvent(text) {
    const mapbox = document.getElementById('tcfv-mapbox');
    if (!mapbox) return;
    let stack = mapbox.querySelector('.tcfv-notify-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'tcfv-notify-stack';
      mapbox.appendChild(stack);
    }
    const note = document.createElement('div');
    note.className = 'tcfv-notify';
    note.title = 'Click to dismiss';
    const icon = document.createElement('span');
    icon.className = 'tcfv-notify-icon';
    icon.textContent = '\u2708';
    note.appendChild(icon);
    note.appendChild(document.createTextNode(` ${text}`));
    stack.appendChild(note);
    activeNotifyCount++;
    let removed = false;
    let timeoutId;
    const removeNote = () => {
      if (removed) return;
      removed = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (note.parentNode) note.parentNode.removeChild(note);
      activeNotifyCount = Math.max(0, activeNotifyCount - 1);
    };
    note.addEventListener('click', removeNote);
    timeoutId = setTimeout(removeNote, 600000);
  }

  function notifyFactionTakeoff(name, srcCity, dstCity) {
    notifyFactionEvent(`${name} has taken off from ${srcCity} headed for ${dstCity}`);
  }

  function notifyFactionLanding(name, dstCity) {
    notifyFactionEvent(`${name} has landed in ${dstCity}`);
  }

  function startBackgroundFactionPolling() {
    if (!S.apiKey || backgroundFactionTimer) return;
    backgroundFactionTimer = setInterval(fetchFactionFlights, 60000);
    fetchFactionFlights();
  }

  function stopBackgroundFactionPolling() {
    if (backgroundFactionTimer) { clearInterval(backgroundFactionTimer); backgroundFactionTimer = null; }
  }

  // v70.40.0: returns the list of faction-member names currently flying
  // the same route as the player (in either direction). Used to build the
  // small-plane takeoff "Flight logged. X is on the same flight path.
  // Noted." message. Skips the self_player sentinel and any entry whose
  // name matches the player's (the API can list the player under their
  // real user id, not just the sentinel).
  function factionMembersOnPlayerPath() {
    if (!S.src || !S.dst) return [];
    const out = [];
    for (const id of Object.keys(factionData)) {
      if (id === 'self_player') continue;
      const m = factionData[id];
      if (!m || !m.src || !m.dst || !m.name) continue;
      if (S.player && m.name === S.player) continue;
      const same = (m.src === S.src && m.dst === S.dst);
      const opp = (m.src === S.dst && m.dst === S.src);
      if (same || opp) out.push(m.name);
    }
    return out;
  }

  // v70.40.0: format an array of names as a natural-language list with
  // grammatical concord — "X" / "X and Y" / "X, Y and Z" — and pair with
  // singular/plural verb. Empty array yields null so the template can
  // skip emitting any message.
  function formatFactionOnPathLine(names) {
    if (!names || !names.length) return null;
    let list;
    if (names.length === 1) list = names[0];
    else if (names.length === 2) list = `${names[0]} and ${names[1]}`;
    else list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const verb = names.length === 1 ? 'is' : 'are';
    return `Flight logged. ${list} ${verb} on the same flight path. Noted.`;
  }

  function matchFactionTicket(method) {
    if (!method) return 'standard';
    const m = method.toLowerCase();
    if (m.includes('business')) return 'business';
    if (m.includes('private')) return 'private';
    if (m.includes('airstrip')) return 'airstrip';
    return 'standard';
  }

  function drawFactionFlights() {
    const g = document.getElementById('tcfv-factiong');
    if (!g) return;
    if (!factionFlightsOn) { g.innerHTML = ''; return; }
    const now = Date.now();
    const routeGroups = {};
    for (const [rid, rm] of Object.entries(factionData)) {
      const rk = [rm.src, rm.dst].sort().join('_');
      if (!routeGroups[rk]) routeGroups[rk] = [];
      routeGroups[rk].push(rid);
    }
    let html = '';
    for (const [fid, m] of Object.entries(factionData)) {
      const sk = m.src, dk = m.dst;
      if (!sk || !dk || sk === dk || !DESTS[sk] || !DESTS[dk]) continue;
      const total = m.arrTime - m.depTime;
      let progress;
      if (total > 0) {
        progress = Math.min(1, Math.max(0, (now - m.depTime) / total));
      } else if (m.arrTime === 0) {
        progress = 0.5;
      } else {
        continue;
      }
      const bez = buildBez(sk, dk);
      if (!bez) continue;
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const p = bPt(i / 60, bez.s, bez.c, bez.d);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      // FIX 5 (v70.5.0): Stagger uses canonical (sorted-endpoint) bezier as a
      // shared perpendicular reference so opposite-direction flights on the
      // same route always offset to different sides. Previously each plane
      // computed perp from its own tangent, which flipped sign for reversed
      // direction and cancelled the stagger at mirror progress points.
      const rk2 = [sk, dk].sort().join('_');
      const grp = routeGroups[rk2] || [fid];
      const grpIdx = grp.indexOf(fid);
      const t = Math.max(0.001, Math.min(0.999, progress));
      const basePos = bPt(t, bez.s, bez.c, bez.d);
      const tangentDeg = bAng(t, bez.s, bez.c, bez.d);
      // Canonical perpendicular reference frame: same for all planes on route.
      const sortedKeys = [sk, dk].sort();
      const canonBez = buildBez(sortedKeys[0], sortedKeys[1]);
      const isCanonicalDir = sk === sortedKeys[0];
      const canonT = isCanonicalDir ? t : (1 - t);
      const canonTangentDeg = bAng(canonT, canonBez.s, canonBez.c, canonBez.d);
      const perpDist = grp.length > 1 ? (grpIdx - (grp.length - 1) / 2) * 9 : 0;
      const perpRad = (canonTangentDeg + 90) * Math.PI / 180;
      const pos = {
        x: basePos.x + Math.cos(perpRad) * perpDist,
        y: basePos.y + Math.sin(perpRad) * perpDist,
      };
      const ang = tangentDeg + 90;
      const sw = '1.2';
      const sc = '0.98';
      const ticket = matchFactionTicket(m.method);
      const plane = TICKETS[ticket]?.plane || 'jumbo';
      let shape;
      if (plane === 'jumbo') {
        shape = `<ellipse cx="0" cy="0" rx="1.5" ry="4.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-2 -6.5,1 -5.5,2 0,-0.5 5.5,2 6.5,1" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2.5,4.5 -2,5 0,3.5 2,5 2.5,4.5" fill="white" stroke="black" stroke-width="0.6"/>`;
      } else if (plane === 'private_plane') {
        shape = `<ellipse cx="0" cy="0" rx="1" ry="4" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="0,-1.5 -5,1.5 -4.5,2.5 0,0.5 4.5,2.5 5,1.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -2,4 -1.5,4.5 0,3.25 1.5,4.5 2,4" fill="white" stroke="black" stroke-width="0.6"/>`;
      } else {
        shape = `<ellipse cx="0" cy="0.5" rx="1" ry="3.5" fill="white" stroke="black" stroke-width="0.8"/>
  <polygon points="-4.5,-0.5 -4,0.5 4,0.5 4.5,-0.5" fill="white" stroke="black" stroke-width="0.7"/>
  <polygon points="0,2.5 -1.5,4 -1,4.5 0,3.25 1,4.5 1.5,4" fill="white" stroke="black" stroke-width="0.6"/>
  <line x1="-1.5" y1="-4" x2="1.5" y2="-4" stroke="black" stroke-width="1.2" stroke-linecap="round"/>`;
      }
      // v70.13.0: aligned prop_plane with the other types — no +180 flip needed.
      const fAng = ang;
      // FIX 2 (v70.2.0): Alternate name above/below plane.
      const lblY = (grpIdx % 2 === 0) ? (pos.y - 6) : (pos.y + 11);
      html += `<polyline points="${pts.join(' ')}" fill="none" stroke="#888" stroke-width="${sw}" stroke-dasharray="10,6" opacity="0.45"/>
<g transform="translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${fAng.toFixed(1)}) scale(${sc})" opacity="0.95">${shape}</g>
<text x="${(pos.x + 5).toFixed(1)}" y="${lblY.toFixed(1)}" fill="white" font-size="8" font-family="monospace" font-weight="bold" opacity="0.95" stroke="#000" stroke-width="0.4" paint-order="stroke fill">${m.name}</text>`;
    }
    const abroadGroups = {};
    for (const [, mb] of Object.entries(factionAbroad)) {
      if (!mb.dest || !DESTS[mb.dest]) continue;
      if (!abroadGroups[mb.dest]) abroadGroups[mb.dest] = [];
      abroadGroups[mb.dest].push(mb.name);
    }
    for (const [destKey2, abNames] of Object.entries(abroadGroups)) {
      const dp2 = DESTS[destKey2];
      if (!dp2) continue;
      const dp2pos = toXY(dp2.lon, dp2.lat);
      // v70.22.0: was a `.forEach(...)` callback — eslint flagged no-loop-func
      // because forEach creates a fresh function on every outer loop pass.
      // Plain for-loop is identical semantically and has no captured-closure
      // concern.
      for (let ni2 = 0; ni2 < abNames.length; ni2++) {
        const nm2 = abNames[ni2];
        const yOff2 = (ni2 - (abNames.length - 1) / 2) * 9;
        html += '<circle cx="' + dp2pos.x.toFixed(1) + '" cy="' + dp2pos.y.toFixed(1) + '" r="4" fill="#44cc66" stroke="#226644" stroke-width="0.8" opacity="0.8"/>';
        html += '<text x="' + (dp2pos.x + 8).toFixed(1) + '" y="' + (dp2pos.y + yOff2 + 2).toFixed(1) + '" fill="white" font-size="7" font-family="monospace" opacity="0.85">' + nm2 + '</text>';
      }
    }
    g.innerHTML = html;
  }

  let factionAllMembers = {};

  // FIX 4 (v70.4.0): Dynamic column widths in the faction roster. Names and
  // routes can be long; previously the 68px name col and 102px route col were
  // hard-coded which truncated longer values. Now we size to the longest
  // content across flying + abroad + non-flying entries. Non-flying members
  // also align to the same name column for visual consistency.
  function renderFactionRoster() {
    if (!el.log || !factionFlightsOn) return;
    const now = Date.now();
    const flying = Object.entries(factionData)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => a.arrTime - b.arrTime);
    const flyingIds = new Set(Object.keys(factionData));
    const nonFlying = Object.values(factionAllMembers)
      .filter(m => !flyingIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const abroad = Object.values(factionAbroad);

    // Calculate column widths from longest content. Monospace 10px ≈ 6.2px/char.
    const CW = 6.2;
    const allNames = [
      ...flying.map(m => m.name),
      ...abroad.map(a => a.name),
      ...nonFlying.map(m => m.name),
    ];
    const routes = flying.map(m => {
      const sc = DESTS[m.src]?.city || m.src || '?';
      const dc = DESTS[m.dst]?.city || m.dst || '?';
      return `${sc}→${dc}`;
    });
    const abroadCities = abroad.map(a => DESTS[a.dest]?.city || a.dest || '?');
    const maxNameLen = allNames.reduce((mx, n) => Math.max(mx, n.length), 0);
    const maxRouteLen = Math.max(
      routes.reduce((mx, r) => Math.max(mx, r.length), 0),
      abroadCities.reduce((mx, c) => Math.max(mx, c.length), 0)
    );
    const nameW = Math.max(60, Math.ceil(maxNameLen * CW)) + 6;
    const routeW = Math.max(80, Math.ceil(maxRouteLen * CW)) + 6;

    let html = '';
    for (const m of flying) {
      const rem = Math.max(0, m.arrTime - now);
      const hrs = Math.floor(rem / 3600000);
      const mins = Math.floor((rem % 3600000) / 60000);
      const secs = Math.floor((rem % 60000) / 1000);
      const srcCity = DESTS[m.src]?.city || m.src || '?';
      const dstCity = DESTS[m.dst]?.city || m.dst || '?';
      const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
      const isSmall = (m.method && (m.method.toLowerCase().includes('airstrip') || m.method.toLowerCase().includes('private')));
      const planeIcon = isSmall
        ? '<svg width="14" height="14" viewBox="-6 -6 12 12"><ellipse cx="0" cy="0" rx="1" ry="3.5" fill="#aaa" stroke="#666" stroke-width="0.5"/><polygon points="-4,-0.3 -3.5,0.5 3.5,0.5 4,-0.3" fill="#aaa" stroke="#666" stroke-width="0.5"/><line x1="-1.2" y1="3.5" x2="1.2" y2="3.5" stroke="#aaa" stroke-width="0.9"/></svg>'
        : '<svg width="14" height="14" viewBox="-7 -7 14 14"><ellipse cx="0" cy="0" rx="1.5" ry="4" fill="#aaa" stroke="#666" stroke-width="0.5"/><polygon points="0,-1.5 -6,1 -5.5,2 0,-0.2 5.5,2 6,1" fill="#aaa" stroke="#666" stroke-width="0.5"/><polygon points="0,2.5 -2,4 -1.5,4.5 0,3.5 1.5,4.5 2,4" fill="#aaa" stroke="#666" stroke-width="0.5"/></svg>';
      html += `<div class="tl tln" style="color:#88ddff;font-size:10px;line-height:16px;display:flex;align-items:center;gap:4px"><span style="flex-shrink:0;display:inline-flex;align-items:center;width:14px;justify-content:center">${planeIcon}</span><span style="flex:0 0 ${nameW}px;overflow:hidden;white-space:nowrap">${m.name}</span><span style="flex:0 0 ${routeW}px;overflow:hidden;white-space:nowrap">${srcCity}→${dstCity}</span><span style="flex:1;white-space:nowrap">${timeStr}</span></div>`;
    }
    for (const ab of abroad) {
      const dCity = DESTS[ab.dest]?.city || ab.dest || '?';
      html += `<div class="tl tln" style="color:#88aacc;font-size:10px;line-height:16px;display:flex;align-items:center;gap:4px"><span style="flex-shrink:0;display:inline-flex;align-items:center;width:14px;justify-content:center"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#44cc66" stroke="#226644" stroke-width="0.8"/></svg></span><span style="flex:0 0 ${nameW}px;overflow:hidden;white-space:nowrap">${ab.name}</span><span style="flex:1;color:#77cc99;white-space:nowrap">${dCity}</span></div>`;
    }
    for (const m of nonFlying) {
      html += `<div class="tl" style="color:#777;display:flex;align-items:center;gap:4px;font-size:10px;line-height:16px"><span style="flex-shrink:0;width:14px"></span><span style="flex:0 0 ${nameW}px;overflow:hidden;white-space:nowrap">${m.name}</span></div>`;
    }
    if (!html) html = '<div class="tl tln">No faction members currently flying.</div>';
    if (el.log.innerHTML !== html) {
      const scrollPos = el.log.scrollTop;
      el.log.innerHTML = html;
      el.log.scrollTop = scrollPos;
    }
  }

  function fetchFactionFlights() {
    // v70.14.0: runs whenever an API key is set (no longer gated on faction
    // view). The visual updates (drawFactionFlights / zoom / roster) are still
    // skipped when the user is in Flight View — but the data is collected so
    // takeoff notifications can fire.
    if (!S.apiKey) return;
    GM_xmlhttpRequest({
      method: 'GET',
      // v70.27.0: also fetch the faction's basic info so we can substitute
      // the real faction name into the comm-message templates.
      url: `https://api.torn.com/v2/faction?selections=basic,members&key=${S.apiKey}`,
      onload: r => {
        try {
          const data = JSON.parse(r.responseText);
          if (data.error) {
            const ferr = typeof data.error === 'object' ? data.error.error : data.error;
            if (el.log && factionFlightsOn) {
              el.log.innerHTML = '<div class="tl tln" style="color:#f88">Faction error: ' + ferr + ' — check api key</div>';
            }
            return;
          }
          if (data.basic && data.basic.name && data.basic.name !== S.factionName) {
            S.factionName = data.basic.name;
            saveS();
          }
          const rawMembers = data.members || {};
          const members = Array.isArray(rawMembers)
            ? Object.fromEntries(rawMembers.map(m => [String(m.id || m.player_id || m.name), m]))
            : rawMembers;
          factionAllMembers = {};
          factionData = {};
          factionAbroad = {};
          for (const [id, m] of Object.entries(members)) {
            const memberId = String(m.id || m.player_id || id);
            const membName = m.name || ('ID' + id);
            factionAllMembers[memberId] = { id: memberId, name: membName };
            const st = m.status;
            const desc = (st && st.description) ? st.description : '';
            if (/traveling from .+ to .+/i.test(desc)) {
              const toM = desc.match(/traveling from .+ to (.+)$/i);
              const fromM = desc.match(/traveling from (.+?) to /i);
              const travDest = toM ? toM[1].trim() : '';
              const travSrc = fromM ? fromM[1].trim() : '';
              const dk3 = matchDest(travDest);
              const sk3 = travSrc ? matchDest(travSrc) : null;
              if (dk3) {
                const srcFinal = sk3 || (dk3 === 'torn' ? 'caymans' : 'torn');
                const routeK = 'torn_' + (dk3 === 'torn' ? srcFinal : dk3);
                const estDur = BASE_DUR[routeK] || BASE_DUR['torn_' + dk3] || 18000000;
                const stUntil = (st && st.until) ? st.until * 1000 : 0;
                const arrTime3 = stUntil > Date.now() ? stUntil : (Date.now() + estDur / 2);
                const depTime3 = arrTime3 - estDur;
                factionData[memberId] = { name: membName, src: srcFinal, dst: dk3, depTime: depTime3, arrTime: arrTime3, method: 'Standard' };
              }
              continue;
            }
            // FIX 3 (v70.3.0): Specific patterns first, generic last.
            const abroadPatterns = [
              /\bin\s+(?:a\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:hospital|jail|prison)/i,
              /hospitali[sz]ed in\s+(?:a\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
              /serving time in\s+(?:a\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
              /^visiting\s+([a-z]+(?:\s+[a-z]+){0,2}?)(?:\s+for\s|$)/i,
              /^abroad in\s+([a-z]+(?:\s+[a-z]+){0,2}?)(?:\s+for\s|$)/i,
              /^in\s+(?:a\s+)?([a-z]+(?:\s+[a-z]+){0,2}?)(?:\s+for\s|$)/i,
            ];
            for (const pat of abroadPatterns) {
              const aM = desc.match(pat);
              if (aM) {
                const abDest = matchAbroad(aM[1].trim());
                if (abDest && abDest !== 'torn') {
                  factionAbroad[memberId] = { name: membName, dest: abDest };
                }
                break;
              }
            }
          }
          if (S.flying && S.src && S.dst && S.player) {
            const selfId = 'self_player';
            const alreadyIn = Object.values(factionData).some(fx => fx.name === S.player);
            if (!alreadyIn) {
              factionData[selfId] = {
                name: S.player, src: S.src, dst: S.dst,
                depTime: S.depTime || (Date.now() - 3600000),
                arrTime: S.arrTime || (Date.now() + 3600000),
                method: TICKETS[S.ticket]?.label || 'Standard'
              };
            }
          }
          // v70.14.0: detect new takeoffs (members flying now who weren't
          // flying on the previous poll). Skip the first ever poll so we
          // don't notify for members who were already in the air on load.
          // v70.19.0: also detect landings — members who were in the air on
          // the previous poll but aren't any more.
          const currentFlyingIds = new Set(
            Object.keys(factionData).filter(id => id !== 'self_player')
          );
          if (factionFirstPollDone) {
            // Takeoffs
            for (const id of currentFlyingIds) {
              if (!prevFactionFlyingIds.has(id)) {
                const m = factionData[id];
                if (m && m.src && m.dst) {
                  const srcCity = DESTS[m.src]?.city || m.src;
                  const dstCity = DESTS[m.dst]?.city || m.dst;
                  notifyFactionTakeoff(m.name, srcCity, dstCity);
                }
              }
            }
            // Landings — present in prev poll, gone from this one. We look up
            // the destination from the cached snapshot since factionData has
            // already discarded their flight entry.
            for (const id of prevFactionFlyingIds) {
              if (!currentFlyingIds.has(id)) {
                const cached = prevFactionFlying[id];
                if (cached && cached.dst) {
                  const dstCity = DESTS[cached.dst]?.city || cached.dst;
                  notifyFactionLanding(cached.name, dstCity);
                }
              }
            }
          }
          prevFactionFlyingIds = currentFlyingIds;
          // Refresh the cache from the just-parsed factionData so the next
          // poll's landing detection has the destinations ready.
          prevFactionFlying = {};
          for (const id of currentFlyingIds) {
            const m = factionData[id];
            if (m) prevFactionFlying[id] = { name: m.name, dst: m.dst };
          }
          factionFirstPollDone = true;
          // Only redraw the faction map/zoom/roster when faction view is on.
          if (factionFlightsOn) {
            drawFactionFlights();
            zoomToFitFaction();
            renderFactionRoster();
          }
          // v70.43.0: cross-PC pickup runs here because both the page DOM
          // and the freshly-populated factionData are available. The
          // helper bails fast if there's no in-progress flight or if
          // S already matches.
          pickUpFromPage();
        } catch(e) {
          if (el.log && factionFlightsOn) {
            el.log.innerHTML = '<div class="tl tln" style="color:#f88">Faction parse error — check api key</div>';
          }
        }
      },
      onerror: () => {
        if (el.log && factionFlightsOn) {
          el.log.innerHTML = '<div class="tl tln" style="color:#f88">Faction request failed — check network</div>';
        }
      },
    });
  }

  function zoomToFitFaction() {
    if (!el.svg || !factionFlightsOn) return;
    const now = Date.now();
    const pts = [];
    for (const m of Object.values(factionData)) {
      if (!m.src || !m.dst || !DESTS[m.src] || !DESTS[m.dst]) continue;
      const s = toXY(DESTS[m.src].lon, DESTS[m.src].lat);
      const d = toXY(DESTS[m.dst].lon, DESTS[m.dst].lat);
      pts.push(s, d);
      const total = m.arrTime - m.depTime;
      if (total > 0) {
        const t = Math.min(0.999, Math.max(0.001, (now - m.depTime) / total));
        try {
          const bez = buildBez(m.src, m.dst);
          if (bez) pts.push(bPt(t, bez.s, bez.c, bez.d));
        } catch(e) {}
      }
    }
    if (pts.length === 0) return;
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 40;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(MAP_W, maxX + pad);
    maxY = Math.min(MAP_H, maxY + pad);
    const vw = Math.max(maxX - minX, 150);
    const vh = Math.max(maxY - minY, 75);
    let fw = vw;
    let fh = vh;
    if (fw / fh < 2) { fw = fh * 2; }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const nx = Math.max(0, Math.min(MAP_W - fw, cx - fw / 2));
    const ny = Math.max(0, Math.min(MAP_H - fh, cy - fh / 2));
    const vb = `${nx.toFixed(0)} ${ny.toFixed(0)} ${fw.toFixed(0)} ${fh.toFixed(0)}`;
    el.svg.setAttribute('viewBox', vb);
    currentZoom = MAP_W / fw;
  }

  function doFaction() {
    factionFlightsOn = !factionFlightsOn;
    const btn = document.querySelector('#thb-faction');
    const pathg = document.getElementById('tcfv-pathg');
    const planeg = document.getElementById('tcfv-planeg');
    if (factionFlightsOn) {
      if (!S.apiKey) {
        addLog('API key required for Faction Flights. Add one in API Settings.');
        factionFlightsOn = false;
        return;
      }
      if (el.pgMain) el.pgMain.style.display = 'flex';
      if (el.pgSet) el.pgSet.style.display = 'none';
      if (el.pgCred) el.pgCred.style.display = 'none';
      if (el.pgMore) el.pgMore.style.display = 'none';
      if (el.pgDiag) el.pgDiag.style.display = 'none';
      S.page = 'main';
      document.querySelectorAll('.thb').forEach(b => b.classList.remove('ta'));
      btn?.classList.add('ta');
      if (el.svg) {
        savedPlayerViewBox = el.svg.getAttribute('viewBox') || `0 0 ${MAP_W} ${MAP_H}`;
        el.svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
        currentZoom = 1;
      }
      if (pathg) pathg.style.display = 'none';
      if (planeg) planeg.style.display = 'none';
      highlightDots(null, null);
      stopDashAnim();
      // v70.14.0: background poller is already running (started by API-save
      // or init), so we only need to trigger an immediate refresh and start
      // the draw timer here. Drop the redundant 60s pollTimer.
      fetchFactionFlights();
      factionDrawTimer = setInterval(() => { drawFactionFlights(); zoomToFitFaction(); renderFactionRoster(); }, 5000);
    } else {
      btn?.classList.remove('ta');
      clearInterval(factionDrawTimer);
      factionDrawTimer = null;
      // v70.14.0: keep factionData populated so the background poller can
      // still detect new takeoffs while the user is in Flight View.
      const fg = document.getElementById('tcfv-factiong');
      if (fg) fg.innerHTML = '';
      if (el.svg && savedPlayerViewBox) {
        el.svg.setAttribute('viewBox', savedPlayerViewBox);
        currentZoom = MAP_W / parseFloat(savedPlayerViewBox.split(' ')[2]);
      }
      if (pathg) pathg.style.display = '';
      if (S.flying) highlightDots(S.src, S.dst);
      else if (S.previewDst) highlightDots(S.src, S.previewDst);
      renderLog();
      if (planeg) planeg.style.display = '';
      if (S.flying || S.previewDst) startDashAnim();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     RADAR / DOMIN
  ───────────────────────────────────────────────────────────── */

  // RADAR MODES (v70.7.0): simplified to 5 — normal, green, green glitch,
  // white grey, white grey glitch. Glitch variants add jitter, flicker, and
  // a moving scan line on top of the base radar styling.
  const RADAR_MODES = [
    null,
    { name:'green', display:'green', rc:'#00ff44', mid:'#006622', dark:'#000a00', line:'#004400', glow:'rgba(0,255,68,.3)', hue:90, glitch:false },
    { name:'green-glitch', display:'green glitch', rc:'#00ff44', mid:'#006622', dark:'#000a00', line:'#004400', glow:'rgba(0,255,68,.3)', hue:90, glitch:true },
    { name:'white-grey', display:'white grey', rc:'#cccccc', mid:'#888888', dark:'#0a0a0a', line:'#444444', glow:'rgba(220,220,220,.3)', hue:0, glitch:false },
    { name:'white-grey-glitch', display:'white grey glitch', rc:'#cccccc', mid:'#888888', dark:'#0a0a0a', line:'#444444', glow:'rgba(220,220,220,.3)', hue:0, glitch:true },
  ];

  let radarMode = 0;
  let scanTimer = null;

  // v70.13.0: Schedules the CRT scan line to sweep at random intervals between
  // 20s and 2min, rather than running on a fixed 2.3s loop. Toggling the
  // `.scan-active` class on the panel triggers a one-shot CSS animation; we
  // remove the class once the animation has completed (~3s) and queue the next
  // appearance after another random delay.
  function startScanScheduler() {
    stopScanScheduler();
    const runOnce = () => {
      if (!el.panel) return;
      el.panel.classList.add('scan-active');
      scanTimer = setTimeout(() => {
        if (el.panel) el.panel.classList.remove('scan-active');
        scheduleNext();
      }, 3000);
    };
    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 100000;
      scanTimer = setTimeout(runOnce, delay);
    };
    scheduleNext();
  }
  function stopScanScheduler() {
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    if (el.panel) el.panel.classList.remove('scan-active');
  }

  function applyRadarMode(panel) {
    const mode = RADAR_MODES[radarMode];
    const btn = document.querySelector('#thb-radar');
    if (!mode) {
      panel.classList.remove('radar-mode', 'radar-glitch');
      ['--rc','--rc-mid','--rc-dark','--rc-line','--rc-glow','--rc-filter'].forEach(v => panel.style.removeProperty(v));
      if (btn) { btn.classList.remove('ta'); btn.title = 'Overlay'; }
      stopScanScheduler();
    } else {
      panel.classList.add('radar-mode');
      panel.classList.toggle('radar-glitch', !!mode.glitch);
      panel.style.setProperty('--rc', mode.rc);
      panel.style.setProperty('--rc-mid', mode.mid);
      panel.style.setProperty('--rc-dark', mode.dark);
      panel.style.setProperty('--rc-line', mode.line);
      panel.style.setProperty('--rc-glow', mode.glow);
      // White-grey uses pure greyscale; green uses sepia+hue-rotate tint chain.
      if (mode.name.startsWith('white-grey')) {
        panel.style.setProperty('--rc-filter', 'grayscale(1) brightness(0.95) contrast(1.05)');
      } else {
        panel.style.setProperty('--rc-filter', `sepia(1) saturate(4) hue-rotate(${mode.hue}deg) brightness(0.85)`);
      }
      if (btn) { btn.classList.add('ta'); btn.title = `Overlay (${mode.display})`; }
      if (mode.glitch) startScanScheduler();
      else stopScanScheduler();
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
      el.bod.style.display = 'none';
      resizeHandle.style.display = 'none';
      panel.style.height = 'auto';
      panel.style.minHeight = '0';
      panel.style.resize = 'none';
    } else {
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
      // v70.10.0: drag handle is now the whole panel, so exclude interactive
      // elements (buttons, inputs, links, sliders) plus the resize handle and
      // the log area (keeps text selection working in commentary).
      if (e.target.closest('button, input, textarea, select, a, #tcfv-resize-handle, #tcfv-log')) return;
      drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
      e.preventDefault();
      e.stopPropagation();
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
     PREVIEW DESTINATION
  ───────────────────────────────────────────────────────────── */

  function previewDest(dstK) {
    if (S.flying) return;
    S.previewDst = dstK;
    // v70.9.0: zoom first so drawPath uses the correct currentZoom for stroke widths.
    if (el.svg) {
      const vb = getZoomedViewBox(S.src, dstK);
      el.svg.setAttribute('viewBox', vb);
      currentZoom = MAP_W / parseFloat(vb.split(' ')[2]);
    }
    drawPath(S.src, dstK);
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
      const nc = norm(d.city), ncn = norm(d.country), nl = norm(d.label);
      if (t === k || t.includes(k) || k.includes(t)) return k;
      if (t.includes(nc) || nc.includes(t)) return k;
      if (t.includes(ncn) || ncn.includes(t)) return k;
      if (nl && (t.includes(nl) || nl.includes(t))) return k;
    }
    return null;
  }

  // FIX 3 (v70.3.0): Adjective forms of country names.
  const NATIONALITY_TO_DEST = {
    mexican: 'mexico',
    caymanian: 'caymans',
    canadian: 'canada',
    hawaiian: 'hawaii',
    british: 'uk',
    english: 'uk',
    scottish: 'uk',
    welsh: 'uk',
    irish: 'uk',
    argentine: 'argentina',
    argentinian: 'argentina',
    swiss: 'switzerland',
    japanese: 'japan',
    chinese: 'china',
    emirati: 'uae',
    'south african': 'southafrica',
  };

  function matchAbroad(text) {
    if (!text) return null;
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (NATIONALITY_TO_DEST[t]) return NATIONALITY_TO_DEST[t];
    for (const adj of Object.keys(NATIONALITY_TO_DEST)) {
      if (t.includes(adj)) return NATIONALITY_TO_DEST[adj];
    }
    return matchDest(text);
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
     HOOK CLICKS
  ───────────────────────────────────────────────────────────── */

  function hookClicks() {
    document.addEventListener('click', e => {
      // v70.26.0: ignore clicks originating inside our own panel. The 5-level
      // textContent walk-up below would otherwise match "return"+"torn" inside
      // log messages or labels and spuriously trigger a return flight when
      // the user just dragged the panel (browsers fire a click after
      // mouseup even on a short drag).
      const myPanel = document.getElementById('tcfv');
      if (myPanel && myPanel.contains(e.target)) return;
      let t = e.target;
      for (let i = 0; i < 5; i++) {
        if (!t) break;
        const txt = (t.textContent || '').trim().toLowerCase();
        const cls = (t.className || '').toString().toLowerCase();
        const id = (t.id || '').toLowerCase();
        if (!S.flying && (cls.includes('country') || cls.includes('destination') || cls.includes('travel') || cls.includes('city') || cls.includes('location'))) {
          const dm = matchDest(t.textContent);
          if (dm && dm !== S.src) { previewDest(dm); }
        }
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
        if ((txt.includes('return') && (txt.includes('home') || txt.includes('torn') || txt.includes('back'))) ||
          txt === 'fly home' || txt === 'return home' || txt === 'go home' ||
          cls.includes('return') || cls.includes('fly-home') || id.includes('return') || id.includes('home')) {
          if (S.src !== 'torn' && !S.flying) {
            startFlight('torn', S.ticket, true);
            return;
          }
        }
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
     NETWORK HOOK
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

  // v70.40.0: when the network/API reports a return journey (destination =
  // Torn) but the local browser has no record of the outbound flight —
  // typical when the player started the flight on a different PC and
  // refreshed this one — infer the source city by matching observed
  // flight duration against expected durations for every city-pair at the
  // same ticket method. Returns the best-matching city key, or null if no
  // match is within ±2 minutes.
  function inferReturnSourceFromDuration(durMs, tk) {
    if (!durMs || durMs <= 0) return null;
    let best = null;
    let bestDelta = Infinity;
    for (const key of Object.keys(DESTS)) {
      if (key === 'torn') continue;
      const expected = getDur(key, 'torn', tk);
      const delta = Math.abs(expected - durMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = key;
      }
    }
    return (bestDelta < 120000) ? best : null;
  }

  // v70.43.0: cross-PC flight pickup driven primarily by the Torn page
  // DOM, with the non-Torn city of the route taken from factionData per
  // spec ("Use screen for everything apart from destination, which you
  // can get from the faction flyer screen"). The faction parser already
  // extracts src/dst correctly from each member's status description, so
  // the player's own factionData entry is a reliable source of the
  // destination city — which the page DOM doesn't reveal for return
  // flights ("Returning to Torn City" doesn't say which city you're
  // returning from). Timing (remaining time) and ticket come from the
  // page. Called from fetchFactionFlights's success path so both data
  // sources are ready.
  function pickUpFromPage() {
    if (!document.body) return;
    const body = document.body.textContent || '';
    // Direction.
    let isReturn = false;
    let outboundMatch = null;
    if (/return(?:ing)?\s+to\s+torn/i.test(body)) {
      isReturn = true;
    } else {
      outboundMatch = body.match(/(?:travelling|traveling|flying)\s+to\s+([A-Za-z\s]{3,30})(?:[.,\n]|$)/i);
      if (!outboundMatch) return;
    }
    // Non-Torn city from factionData (player's own entry).
    let nonTornCity = null;
    if (S.player) {
      for (const id of Object.keys(factionData)) {
        if (id === 'self_player') continue;
        const m = factionData[id];
        if (!m || m.name !== S.player) continue;
        if (isReturn && m.dst === 'torn' && m.src && m.src !== 'torn') {
          nonTornCity = m.src;
        } else if (!isReturn && m.src === 'torn' && m.dst && m.dst !== 'torn') {
          nonTornCity = m.dst;
        }
        break;
      }
    }
    // Fallback for outbound: use the destination name parsed from page
    // text. (Return flights have no DOM-visible source name, so they
    // require factionData; no fallback there.)
    if (!nonTornCity && !isReturn && outboundMatch) {
      nonTornCity = matchDest(outboundMatch[1]);
    }
    if (!nonTornCity || nonTornCity === 'torn') return;
    // Remaining time. Several formats appear in Torn's UI; try each.
    let remainingMs = 0;
    const hmsHM = body.match(/(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?/i);
    const colon = body.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
    const msMS = body.match(/(\d+)\s*m(?:in(?:ute)?s?)?\s*(\d+)\s*s(?:ec(?:ond)?s?)?/i);
    if (hmsHM) {
      remainingMs = (parseInt(hmsHM[1], 10) * 3600 + parseInt(hmsHM[2], 10) * 60) * 1000;
    } else if (colon) {
      remainingMs = (parseInt(colon[1], 10) * 3600 + parseInt(colon[2], 10) * 60 + parseInt(colon[3], 10)) * 1000;
    } else if (msMS) {
      remainingMs = (parseInt(msMS[1], 10) * 60 + parseInt(msMS[2], 10)) * 1000;
    }
    if (remainingMs <= 0) return;
    // Ticket from page. Scan for ticket labels; fall back to S.ticket.
    let tk = S.ticket || 'standard';
    for (const k of Object.keys(TICKETS)) {
      const lbl = TICKETS[k].label;
      if (!lbl) continue;
      const safe = lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      if (new RegExp(`\\b${safe}\\b`, 'i').test(body)) { tk = k; break; }
    }
    // Build src/dst + dep/arr.
    const src = isReturn ? nonTornCity : 'torn';
    const dst = isReturn ? 'torn' : nonTornCity;
    const dur = getDur(src, dst, tk);
    if (dur <= 0) return;
    // Sanity: remainingMs can't exceed the expected duration by more
    // than a minute (allow some clock drift).
    if (remainingMs > dur + 60000) return;
    const arr = Date.now() + remainingMs;
    const dep = arr - dur;
    // Dedup against the current S.flying state.
    if (S.flying && S.src === src && S.dst === dst && S.arrTime &&
        Math.abs(S.arrTime - arr) < 30000) return;
    startFlightTimes(src, dst, tk, dep, arr, isReturn);
    // Halfway catch-up to suppress retroactive announcement.
    const total = arr - dep;
    if (total > 0 && (Date.now() - dep) / total >= 0.5) S.halfwayFired = true;
    // Refresh Flight View immediately.
    if (S.flying && S.dst && el.svg) {
      const vb = getZoomedViewBox(S.src, S.dst);
      el.svg.setAttribute('viewBox', vb);
      currentZoom = MAP_W / parseFloat(vb.split(' ')[2]);
      drawPath(S.src, S.dst);
      highlightDots(S.src, S.dst);
      startFlightSampling();
    }
    saveS();
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
    if (S.flying && Math.abs(S.arrTime - arr) < 10000) return;
    if (dk && dk !== 'torn') {
      startFlightTimes('torn', dk, tk, dep, arr, false);
    } else if (!dk || dk === 'torn') {
      // v70.40.0: return journey. Was previously gated on `S.src !== 'torn'`
      // which fails on a fresh browser session where S.src defaults to 'torn'
      // (e.g. PC2 refresh of a flight initiated on PC1). Infer the source
      // by matching observed flight duration against known city-pair
      // durations for this ticket method. Fall back to locally-cached
      // S.src if duration inference can't find a match.
      let src = inferReturnSourceFromDuration(arr - dep, tk);
      if (!src && S.src && S.src !== 'torn') src = S.src;
      if (src && src !== 'torn') {
        startFlightTimes(src, 'torn', tk, dep, arr, true);
      }
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
        if (!S.airportClosed && document.body &&
            document.body.textContent.includes('You are currently in a race, you must leave or wait')) {
          if (loopTmr) clearTimeout(loopTmr);
          tick();
          return;
        }
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
     PLAYER ↔ FACTION SAME-FLIGHT-PATH COMM MESSAGES (v70.27.0)

     During the player's flight, if any faction members are flying the same
     route (Torn ↔ destination, in either direction), 1 or 2 random
     commentary messages get posted to the log. Schedule is generated at
     takeoff and persisted, so a mid-flight refresh doesn't re-roll the
     schedule.

     Templates use placeholders [player], [faction member],
     [destination], [faction member destination], [Faction Name].
     Same-direction templates substitute the player's destination (which is
     also the faction member's destination by definition).
     Opposite-direction templates substitute the faction member's
     destination — which is the player's src (where they came from / are
     returning to).

     Dedup: a faction member is referenced at most once per flight via
     S.commUsedIds. If only one faction member is on the same flight path
     and the schedule has two messages, the second fire finds nobody
     eligible and is silently skipped — fulfilling "If two messages are set
     to print and only one other player is on the same flight path, it
     should print just once."
  ───────────────────────────────────────────────────────────── */

  const COMM_TEMPLATES = {
    opposite: [
      (p, m, memDest) => `${p} waves out the window to ${m} passing on their way to ${memDest}.`,
      (p, m, memDest) => `${m} howls past on their way to ${memDest}.`,
    ],
    same: [
      (p, m, memDest) => `${p} sees ${m} flying in parallel for a while, on their way to ${memDest}.`,
      (p, m, memDest, fac) => `${p} sees ${m} flying just outside the window heading to ${memDest}, and does the ${fac} hand signals. ${m} nods back, affirmative.`,
      (p, m, memDest) => `${p} hears a scream of engines as ${m} howls past the airplane towards ${memDest}.`,
    ],
  };

  function generateCommSchedule(dep, arr) {
    const dur = arr - dep;
    if (dur <= 0) return [];
    // Keep messages inside the in-flight window: 15%..85% of total duration,
    // so they don't collide with takeoff/descent commentary.
    const minStart = dep + dur * 0.15;
    const maxEnd = dep + dur * 0.85;
    const usable = maxEnd - minStart;
    if (usable <= 0) return [];
    const numMsgs = 1 + Math.floor(Math.random() * 2); // 1 or 2
    if (numMsgs === 1) {
      const at = minStart + Math.random() * usable;
      return [{ at, dirPref: 'any' }];
    }
    // Two messages — split usable range in half so they're spread out.
    const half = usable / 2;
    const t1 = minStart + Math.random() * half;
    const t2 = minStart + half + Math.random() * half;
    // Try to vary direction — one same, one opposite.
    const firstSame = Math.random() < 0.5;
    return [
      { at: t1, dirPref: firstSame ? 'same' : 'opposite' },
      { at: t2, dirPref: firstSame ? 'opposite' : 'same' },
    ];
  }

  function tryFireCommMessage(dirPref) {
    if (!S.dst || !S.src) return false;
    const used = S.commUsedIds || [];
    const sameDir = [];
    const oppDir = [];
    for (const id of Object.keys(factionData)) {
      if (id === 'self_player') continue;
      if (used.indexOf(id) !== -1) continue;
      const m = factionData[id];
      if (!m || !m.src || !m.dst) continue;
      // v70.28.0: per spec, "Do not use [player] and [faction member] if
      // they are the same name." The self_player check above covers the
      // sentinel id, but the API may also list the player under their
      // actual user id — guard against that by skipping any member whose
      // name matches the player's.
      if (S.player && m.name === S.player) continue;
      if (m.src === S.src && m.dst === S.dst) sameDir.push({ id, m });
      else if (m.src === S.dst && m.dst === S.src) oppDir.push({ id, m });
    }
    let pool, dir;
    if (dirPref === 'same' && sameDir.length) { pool = sameDir; dir = 'same'; }
    else if (dirPref === 'opposite' && oppDir.length) { pool = oppDir; dir = 'opposite'; }
    else if (sameDir.length === 0 && oppDir.length === 0) return false;
    else if (sameDir.length === 0) { pool = oppDir; dir = 'opposite'; }
    else if (oppDir.length === 0) { pool = sameDir; dir = 'same'; }
    else {
      pool = Math.random() < 0.5 ? sameDir : oppDir;
      dir = (pool === sameDir) ? 'same' : 'opposite';
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const memDest = DESTS[pick.m.dst]?.city || pick.m.dst;
    const playerName = S.player || 'You';
    const factionName = S.factionName || 'faction';
    const templates = COMM_TEMPLATES[dir];
    const tmpl = templates[Math.floor(Math.random() * templates.length)];
    const msg = tmpl(playerName, pick.m.name, memDest, factionName);
    addLog(msg);
    if (!S.commUsedIds) S.commUsedIds = [];
    S.commUsedIds.push(pick.id);
    return true;
  }

  // v70.27.0: called from tick() during the in-flight phase. Fires any
  // scheduled comm message whose time has come, then drops it from the
  // schedule whether or not a faction member was available to reference.
  function processCommSchedule() {
    if (!S.flying) return;
    if (!Array.isArray(S.commSchedule) || S.commSchedule.length === 0) return;
    const now = Date.now();
    let mutated = false;
    while (S.commSchedule.length > 0 && now >= S.commSchedule[0].at) {
      const next = S.commSchedule.shift();
      tryFireCommMessage(next.dirPref);
      mutated = true;
    }
    if (mutated) saveS();
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
    // v70.16.0: reset RAG history and kick off the flight sampler so the
    // diagnostics chart fills from left to right across this flight.
    S.flightHistory = { samples: [] };
    // v70.27.0: generate the comm-message schedule for this flight (1 or 2
    // messages spread across the in-flight phase) and reset the
    // already-referenced members list so the new flight starts fresh.
    S.commSchedule = generateCommSchedule(dep, arr);
    S.commUsedIds = [];
    S.diagnostics = generateDiagnostics();
    recordFlightSample();
    startFlightSampling();
    saveS();
    // v70.9.0: zoom first so drawPath uses the correct currentZoom for stroke widths.
    if (el.svg) {
      const vb = getZoomedViewBox(sk, dk);
      el.svg.setAttribute('viewBox', vb);
      currentZoom = MAP_W / parseFloat(vb.split(' ')[2]);
    }
    drawPath(sk, dk);
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
      onload: r => {
        try { cb(null, JSON.parse(r.responseText)); } catch(e) { cb(e); }
      },
      onerror: e => { cb(e); },
    });
  }

  function testApiKey(key, msgEl) {
    if (!key) { msgEl.textContent = 'Please enter an API key first.'; return; }
    msgEl.innerHTML = 'Testing\u2026'; msgEl.style.color = '#aaa';
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.torn.com/user/?selections=basic,travel&key=${key}`,
      onload: r1 => {
        let html = '';
        try {
          const d1 = JSON.parse(r1.responseText);
          if (d1.error) {
            html = `<span style="color:#f44">&#10007; Error: ${d1.error.error || d1.error}</span>`;
            msgEl.innerHTML = html;
            return;
          }
          const name = d1.name || '?';
          const pid = d1.player_id || '?';
          S.player = name;
          html += `<span style="color:#4f8">&#10003; Connected as: <strong>${name}</strong> [${pid}]</span><br>`;
          html += `<span style="color:#4f8">&#10003; Flight data: accessible</span><br>`;
        } catch(e) {
          html = `<span style="color:#f44">&#10007; Parse error</span>`;
          msgEl.innerHTML = html;
          return;
        }
        GM_xmlhttpRequest({
          method: 'GET',
          url: `https://api.torn.com/v2/faction?selections=members&key=${key}`,
          onload: r2 => {
            try {
              const d2 = JSON.parse(r2.responseText);
              if (d2.error) {
                const fe = typeof d2.error === 'object' ? d2.error.error : d2.error;
                html += `<span style="color:#fa4">&#10007; Faction data: ${fe} — check api key: tick Faction section in key settings (Limited or higher)</span>`;
              } else {
                const rawM = d2.members || {};
                const mems = Array.isArray(rawM) ? rawM : Object.values(rawM);
                const flying2 = mems.filter(function(mx){ return mx.status && (mx.status.state === 'Traveling' || mx.status.state === 'Travelling'); }).length;
                html += '<span style="color:#4f8">&#10003; Faction data: accessible (' + mems.length + ' members, ' + flying2 + ' currently travelling)</span>';
              }
            } catch(e) {
              html += `<span style="color:#fa4">&#10007; Faction data: parse error</span>`;
            }
            msgEl.innerHTML = html;
          },
          onerror: () => {
            html += `<span style="color:#fa4">&#10007; Faction data: request failed</span>`;
            msgEl.innerHTML = html;
          },
        });
      },
      onerror: () => {
        msgEl.innerHTML = '<span style="color:#f44">&#10007; Request failed — check network</span>';
      },
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
      if (S.flying && Math.abs(S.arrTime - arr) < 10000) return;
      if (dk && dk !== 'torn') {
        startFlightTimes('torn', dk, tk, dep, arr, false);
      } else {
        // v70.40.0: return-journey branch now infers source by duration so
        // a fresh PC2 (where S.src defaults to 'torn') can still pick up
        // an in-progress return flight initiated on another browser.
        let src = inferReturnSourceFromDuration(arr - dep, tk);
        if (!src && S.src && S.src !== 'torn') src = S.src;
        if (src && src !== 'torn') {
          startFlightTimes(src, 'torn', tk, dep, arr, true);
        }
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
  /* v70.10.0: whole panel is draggable; child elements override the cursor where appropriate. */
  cursor: move;
}
#tcfv-log { cursor: text; }
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
/* v70.17.0: stack container at bottom-right of the map area. Children flow
   top-to-bottom in DOM order; since the container is bottom-anchored, the
   newest notification is at the visual bottom and older ones get pushed up.
   Click-dismissal removes one child and flexbox reflows the rest cleanly. */
.tcfv-notify-stack {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 50;
  pointer-events: none;
  /* let the stack auto-size to children but cap so off-screen overflow is fine */
  max-height: calc(100% - 24px);
  overflow: visible;
}
.tcfv-notify {
  position: relative;
  min-width: 200px;
  max-width: 260px;
  padding: 8px 10px;
  background: rgba(15, 30, 48, 0.92);
  border: 1px solid #4488ff;
  border-radius: 4px;
  color: #b8d4ee;
  font-size: 10px;
  font-family: 'Courier New', monospace;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 80, 160, 0.4);
  /* v70.19.0: 10 minute total per spec change — keyframes hold the box
     on-screen for almost all of it, with a quick slide-in at the start
     and slide-out at the end (~1.2s each). */
  animation: tcfv-notify-show 600s ease-in-out forwards;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
}
.tcfv-notify:hover {
  border-color: #6aa8ff;
  box-shadow: 0 4px 14px rgba(0, 100, 200, 0.55);
}
.tcfv-notify-icon {
  color: #88ff44;
  margin-right: 4px;
  font-weight: bold;
}
@keyframes tcfv-notify-show {
  0%    { transform: translateY(140%); opacity: 0; }
  0.2%  { transform: translateY(0);    opacity: 1; }
  99.8% { transform: translateY(0);    opacity: 1; }
  100%  { transform: translateY(140%); opacity: 0; }
}
#tcfv.radar-mode .tcfv-notify {
  background: var(--rc-dark);
  border-color: var(--rc);
  color: var(--rc);
  box-shadow: 0 4px 12px var(--rc-glow);
}
#tcfv.radar-mode .tcfv-notify-icon { color: var(--rc); }
#tcfv-diag { flex-direction: column; height: 100%; overflow-y: auto; background: #050e05; }
#tcfv-diag-inner { padding: 0; flex: 1; }
.diag-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px 4px; border-bottom: 1px solid #1a3520; }
.diag-title { font-size: 9px; color: #44ff88; letter-spacing: 2.5px; text-transform: uppercase; }
.diag-type { font-size: 9px; color: #336633; letter-spacing: 1px; }
.diag-schematic { padding: 6px 8px 2px; border-bottom: 1px solid #0a2010; }
/* v70.21.0: rows on the left, oscilloscope to the right of them filling the
   remaining width. Underneath, RAG | faction at 50/50. Both bottom charts
   share the same viewBox aspect (420x180) so they render at the same height
   when their containers are equal width.
   v70.22.0: chart containers use CSS 'aspect-ratio' so their heights track
   their widths precisely, and their inner SVGs explicitly fill 100% of the
   container — this is what makes the charts and oscilloscope scale fluidly
   with the panel as the user drags the resize handle. */
.diag-rows-osc { display: flex; gap: 12px; padding: 6px 8px; align-items: stretch; }
.diag-systems { flex: 0 0 auto; min-width: 0; overflow-x: auto; }
.diag-osc { flex: 1 1 0; min-width: 100px; align-self: stretch; }
.diag-osc svg { width: 100%; height: 100%; display: block; }
.diag-charts-row { display: flex; gap: 8px; padding: 0 8px 8px; align-items: flex-start; }
.diag-chart-rag { flex: 1 1 0; min-width: 0; aspect-ratio: 420 / 180; }
.diag-chart-faction { flex: 1 1 0; min-width: 0; aspect-ratio: 420 / 180; }
.diag-chart-rag svg, .diag-chart-faction svg { width: 100%; height: 100%; display: block; }
/* v70.17.0: each column auto-sizes to its longest content so no message
   gets truncated. column-gap supplies the 3-character spacing requirement. */
/* v70.19.0: column widths driven by CSS variables set on the parent
   .diag-systems wrapper. These are computed from the worst-case string length
   in each system's detailsByStatus pool so the layout never jitters when the
   randomiser picks shorter messages. Fallbacks keep things sane if variables
   are unset (e.g. before generateDiagnostics has run). */
.diag-row {
  display: grid;
  grid-template-columns:
    10px
    var(--diag-name-w, 100px)
    var(--diag-detail-w, 220px)
    var(--diag-status-w, 56px);
  column-gap: 18px;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px dotted #0a1a0a;
}
.diag-ind { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 5px currentColor; }
.diag-name {
  font-size: 9px; color: #66bb66;
  text-transform: uppercase;
  white-space: nowrap;
}
.diag-detail {
  font-size: 9px; color: #336633;
  text-transform: uppercase;
  white-space: nowrap;
}
.diag-status {
  font-size: 9px; font-weight: bold; letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}
/* v70.29.0: brief white flash on the one row whose system has just been
   re-randomised. Inline style="background:..." / style="color:..." on the
   indicator dot and status label use !important here to override them for
   the 500ms window. */
.diag-row.flashing .diag-name,
.diag-row.flashing .diag-detail,
.diag-row.flashing .diag-status {
  color: #ffffff !important;
  transition: color 60ms linear;
}
.diag-row.flashing .diag-ind {
  background: #ffffff !important;
  box-shadow: 0 0 6px #ffffff;
  transition: background 60ms linear, box-shadow 60ms linear;
}
#tcfv.radar-mode #tcfv-diag { background: var(--rc-dark); }
#tcfv.radar-mode .diag-header { border-bottom-color: var(--rc-line); }
#tcfv.radar-mode .diag-title { color: var(--rc); }
#tcfv.radar-mode .diag-type { color: var(--rc-mid); }
#tcfv.radar-mode .diag-name { color: var(--rc); }
#tcfv.radar-mode .diag-detail { color: var(--rc-mid); }
#tcfv.radar-mode .diag-row { border-bottom-color: var(--rc-line); }
#tcfv-more { padding: 14px 16px; overflow-y: auto; height: 100%; box-sizing: border-box; }
#tcfv-more h3 { color: #5ab0e8; font-size: 11px; margin: 0 0 12px; border-bottom: 1px solid #1e3d5c; padding-bottom: 6px; letter-spacing: 2px; text-transform: uppercase; }
#tcfv-more p { margin: 8px 0; color: #8ab8d8; font-size: 11px; line-height: 1.65; }
#tcfv-scale-wrap { margin-top: 10px; }
.scale-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.scale-row label { color: #4a7a9a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
#tcfv-scale-val { color: #6abcee; font-size: 13px; font-weight: bold; }
#tcfv-scale-slider { width: 100%; accent-color: #4488ff; cursor: pointer; margin-bottom: 14px; }
.scale-ends {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #4a7a9a;
  letter-spacing: 1px;
  margin-top: -10px;
  margin-bottom: 12px;
}
#tcfv-plane-preview-wrap { display: flex; flex-direction: column; align-items: center; margin-top: 6px; }
#tcfv-plane-preview { border: 1px solid #1e3d5c; border-radius: 6px; }
#tcfv.radar-mode #tcfv-more h3 { color: var(--rc) !important; border-bottom-color: var(--rc-line) !important; }
#tcfv.radar-mode #tcfv-more p { color: var(--rc-mid); }
#tcfv.radar-mode #tcfv-scale-val { color: var(--rc); }
#tcfv.radar-mode #tcfv-scale-slider { accent-color: var(--rc); }
#tcfv.radar-mode #tcfv-plane-preview { border-color: var(--rc-line); background: var(--rc-dark); }
#tcfv.radar-mode .scale-row label { color: var(--rc-mid); }
#tcfv.radar-mode .scale-ends span { color: var(--rc-mid); }
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

/* GLITCH OVERLAY (v70.7.0): adds jitter, flicker, and a moving scan line on
   top of the base radar styling. Triggered when a *-glitch mode is active. */
@keyframes tcfv-glitch-jitter {
  0%, 92%, 100% { transform: translate(0, 0); }
  93%          { transform: translate(-2px, 0); }
  94%          { transform: translate(2px, 1px); }
  95%          { transform: translate(-1px, -1px); }
  96%          { transform: translate(1px, 1px); }
}
@keyframes tcfv-glitch-flash {
  0%, 88%, 100% { opacity: 1; }
  90%           { opacity: 0.55; }
  91%           { opacity: 1; }
  92%           { opacity: 0.85; }
}
@keyframes tcfv-glitch-scanline {
  0%   { top: -4px; opacity: 0; }
  10%  { opacity: 0.35; }
  100% { top: 100%; opacity: 0.08; }
}
#tcfv.radar-glitch #tcfv-svg {
  animation: tcfv-glitch-jitter 3.7s infinite steps(1);
}
#tcfv.radar-glitch #tcfv-bod {
  animation: tcfv-glitch-flash 5.1s infinite;
}
#tcfv.radar-glitch #tcfv-mapbox {
  position: relative;
}
/* v70.13.0: scan line is less visible (thinner line, smaller glow, lower
   opacity) and triggered by the .scan-active class rather than running
   continuously. A JS scheduler toggles .scan-active at random 20s–2min
   intervals so the sweep feels occasional rather than constant. */
#tcfv.radar-glitch #tcfv-mapbox::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(180deg, transparent, var(--rc), transparent);
  box-shadow: 0 0 6px var(--rc);
  pointer-events: none;
  z-index: 5;
  opacity: 0;
  top: -10px;
  mix-blend-mode: screen;
}
#tcfv.radar-glitch.scan-active #tcfv-mapbox::before {
  animation: tcfv-glitch-scanline 3s linear;
}
`);
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  function injectStatcounter() {
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
    if (!document.getElementById('tcfv')) {
      injectCSS();
      buildHUD();
      renderLog();
    } else {
      injectCSS();
    }
    hookClicks();
    hookNetwork();
    watchDOM();
    if (S.flying && S.dst) {
      if (Date.now() >= S.arrTime) {
        S.flying = false; S.src = S.dst; S.dst = null;
        S.phasesTriggered = {}; saveS();
      } else {
        // v70.9.0: zoom first so drawPath uses the correct currentZoom.
        if (el.svg) { const vb=getZoomedViewBox(S.src,S.dst); el.svg.setAttribute('viewBox',vb); currentZoom=MAP_W/parseFloat(vb.split(' ')[2]); }
        drawPath(S.src, S.dst);
        highlightDots(S.src, S.dst);
        // v70.16.0: resume the per-flight sampler after a page reload.
        startFlightSampling();
      }
    } else if (S.previewDst) {
      // v70.9.0: zoom first so drawPath uses the correct currentZoom.
      if (el.svg) { const vb=getZoomedViewBox(S.src,S.previewDst); el.svg.setAttribute('viewBox',vb); currentZoom=MAP_W/parseFloat(vb.split(' ')[2]); }
      drawPath(S.src, S.previewDst);
      highlightDots(S.src, S.previewDst);
    }
    showPg(S.page || 'main');
    startLoop();
    initFromApi();
    // v70.14.0: background faction polling for takeoff notifications.
    if (S.apiKey) startBackgroundFactionPolling();
  }

  function fastRestore() {
    loadS();
    if (S.airportClosed) {
      const am = '\x01Airport closed — you are in a <a href="https://www.torn.com/page.php?sid=racing" target="_blank" style="color:#ff6666;text-decoration:underline">race</a>.';
      S.log = [am];
    } else if (S.stateOfEmergency) {
      S.log = [
        'Armed security turn you away.',
        'Torn City is in lockdown. Airport closed until further notice.',
      ];
    } else if (S.terrorThreat) {
      S.log = [
        'Armed security point their weapons at you, denying entry.',
        'Torn City is in lockdown. Airport closed until further notice.',
      ];
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

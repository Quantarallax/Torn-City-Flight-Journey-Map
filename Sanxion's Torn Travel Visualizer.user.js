// ==UserScript==
// @name         Sanxion's Torn Travel Visualizer - Radio Chatter Edition
// @namespace    sanxion.tc.flightjourneymap
// @version      1.3
// @description  Travel map with custom rotating flight messages
// @author       Sanxion [2987640]
// @match        https://www.torn.com/page.php?sid=travel*
// @updateURL    https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @downloadURL  https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const flightMessages = [
        "This is a test message",
        "This is test message 2",
        "Checking coordinates with ground control...",
        "Fuel levels look good for the trip.",
        "Cruising at 35,000 feet."
    ];

    const locations = {
        "Torn City": { x: 250, y: 120 },
        "Mexico": { x: 170, y: 180, std: 1560, air: 1080, bus: 468 },
        "Cayman Islands": { x: 210, y: 180, std: 2100, air: 1500, bus: 630 },
        "Canada": { x: 180, y: 90, std: 2460, air: 1740, bus: 738 },
        "Hawaii": { x: 50, y: 190, std: 8040, air: 5640, bus: 2412 },
        "United Kingdom": { x: 470, y: 85, std: 9540, air: 6660, bus: 2862 },
        "Argentina": { x: 280, y: 350, std: 11340, air: 7980, bus: 3402 },
        "Switzerland": { x: 495, y: 105, std: 10140, air: 7080, bus: 3042 },
        "Japan": { x: 850, y: 140, std: 12180, air: 8520, bus: 3654 },
        "China": { x: 750, y: 150, std: 13140, air: 9180, bus: 3942 },
        "UAE": { x: 600, y: 170, std: 16260, air: 11400, bus: 4878 },
        "South Africa": { x: 530, y: 320, std: 18660, air: 13020, bus: 5598 }
    };

    function getRemainingSeconds() {
        const timerElem = document.querySelector('.msg-countdown') || document.querySelector('[class*="countdown"]');
        if (!timerElem) return 300; // Default to 5 mins if not found yet
        const parts = timerElem.innerText.split(':').map(Number);
        if (parts.length < 3) return 300;
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }

    function renderMap() {
        // Prevent double-loading
        if (document.getElementById('gemini-map-container')) return;

        const destName = document.querySelector('.travel-destination')?.innerText || "Cayman Islands";
        const destData = locations[destName] || locations["Cayman Islands"];
        const start = locations["Torn City"];
        const end = { x: destData.x, y: destData.y };

        // 1. Create Container
        const mapContainer = document.createElement('div');
        mapContainer.id = 'gemini-map-container';
        mapContainer.style = "width: 100%; height: 380px; background: #000 url('https://www.torn.com/images/v2/travel/map_world.png') no-repeat center; background-size: cover; position: relative; margin: 20px 0; border: 2px solid #444; border-radius: 10px; z-index: 9999;";

        // 2. SVG for Curved Path
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
        svg.style.position = "absolute";

        const midX = (start.x + end.x) / 2;
        const midY = Math.min(start.y, end.y) - 60;
        const pathData = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", "transparent");
        path.setAttribute("stroke", "white");
        path.setAttribute("stroke-dasharray", "6,4");
        path.setAttribute("stroke-width", "2");
        path.id = "flightPath";

        // 3. Elements
        const plane = document.createElement('div');
        plane.innerHTML = '✈️';
        plane.style = "position: absolute; font-size: 24px; z-index: 100;";

        const msgBox = document.createElement('div');
        msgBox.style = "position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.8); color: #0f0; padding: 5px 15px; font-family: monospace; border: 1px solid #0f0; border-radius: 4px;";

        const pinStart = document.createElement('div');
        pinStart.style = `position: absolute; left: ${start.x-4}px; top: ${start.y-4}px; width: 8px; height: 8px; background: cyan; border-radius: 50%; box-shadow: 0 0 10px cyan;`;

        const pinEnd = document.createElement('div');
        pinEnd.style = `position: absolute; left: ${end.x-4}px; top: ${end.y-4}px; width: 8px; height: 8px; background: red; border-radius: 50%; box-shadow: 0 0 10px red;`;

        // Assemble
        svg.appendChild(path);
        mapContainer.appendChild(svg);
        mapContainer.appendChild(pinStart);
        mapContainer.appendChild(pinEnd);
        mapContainer.appendChild(plane);
        mapContainer.appendChild(msgBox);

        // Inject into page
        const target = document.querySelector('.content-wrapper') || document.body;
        target.prepend(mapContainer);

        // 4. Animation
        let totalFlightTime = destData.std || 2100;
        const remAtStart = getRemainingSeconds();
        if (remAtStart <= (destData.bus || 600)) totalFlightTime = destData.bus;
        else if (remAtStart <= (destData.air || 1500)) totalFlightTime = destData.air;

        function move() {
            const currentRem = getRemainingSeconds();
            const progress = Math.max(0, Math.min(1, 1 - (currentRem / totalFlightTime)));
            const length = path.getTotalLength();
            const pt = path.getPointAtLength(progress * length);

            plane.style.left = `${pt.x - 12}px`;
            plane.style.top = `${pt.y - 12}px`;

            const lookAhead = path.getPointAtLength(Math.min((progress + 0.01), 1) * length);
            const angle = Math.atan2(lookAhead.y - pt.y, lookAhead.x - pt.x) * 180 / Math.PI;
            plane.style.transform = `rotate(${angle}deg)`;

            requestAnimationFrame(move);
        }

        function cycle() {
            msgBox.innerText = `RADIO: ${flightMessages[Math.floor(Math.random() * flightMessages.length)]}`;
        }

        move();
        cycle();
        setInterval(cycle, 8000);
    }

    // Try to load every second until the content area exists
    const retry = setInterval(() => {
        if (document.querySelector('.content-wrapper') || document.querySelector('.main-wrapper')) {
            renderMap();
            clearInterval(retry);
        }
    }, 1000);

})();

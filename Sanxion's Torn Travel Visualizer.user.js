// ==UserScript==
// @name         Sanxion's Torn Travel Visualizer - Radio Chatter Edition
// @namespace    sanxion.tc.flightjourneymap
// @version      1.3
// @description  Travel map with custom rotating flight messages
// @author       Sanxion [2987640]
// @match        https://www.torn.com/loader.php?sid=travel*
// @updateURL    https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @downloadURL  https://github.com/Quantarallax/Torn-City-Flight-Journey-Map/raw/refs/heads/main/Sanxion's%20Torn%20Travel%20Visualizer.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================
    // CUSTOM MESSAGES - ADD YOUR OWN BELOW
    // Just follow the format: "Your message here",
    // =========================================================
    const flightMessages = [
        "This is a test message",
        "This is test message 2",
        "The captain has turned on the 'No Smoking' sign.",
        "Crossing the Atlantic... looks like sharks down there.",
        "Reminder: Check your stocks when you land!",
        "Turbulence ahead! Hold onto your Xanax.",
    ];
    // =========================================================

    const locations = {
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
        const timerElem = document.querySelector('.msg-countdown');
        if (!timerElem) return 0;
        const parts = timerElem.innerText.split(':').map(Number);
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }

    function init() {
        const destName = document.querySelector('.travel-destination')?.innerText || "Cayman Islands";
        const destData = locations[destName] || locations["Cayman Islands"];
        const remaining = getRemainingSeconds();

        let totalFlightTime = destData.std;
        if (remaining <= destData.bus) totalFlightTime = destData.bus;
        else if (remaining <= destData.air) totalFlightTime = destData.air;

        // --- UI Setup ---
        const mapDiv = document.createElement('div');
        mapDiv.style = "width: 100%; height: 350px; background: #111 url('https://www.torn.com/images/v2/travel/map_world.png') no-repeat center; background-size: cover; position: relative; margin-bottom: 15px; border-radius: 8px; border: 1px solid #444; overflow: hidden;";

        // Message Overlay
        const msgBox = document.createElement('div');
        msgBox.style = "position: absolute; bottom: 15px; width: 100%; text-align: center; color: #00ff00; font-family: monospace; font-size: 14px; text-shadow: 1px 1px 2px black; transition: opacity 1s; opacity: 0; z-index: 20;";

        const plane = document.createElement('div');
        plane.innerHTML = '✈️';
        plane.style = "position: absolute; font-size: 22px; z-index: 10; transform-origin: center;";

        document.querySelector('.content-wrapper').prepend(mapDiv);
        mapDiv.appendChild(plane);
        mapDiv.appendChild(msgBox);

        const start = { x: 250, y: 120 };
        const end = { x: destData.x, y: destData.y };

        // --- Animation & Messages ---
        function update() {
            const currentRemaining = getRemainingSeconds();
            const progress = 1 - (currentRemaining / totalFlightTime);

            plane.style.left = `${start.x + (end.x - start.x) * progress}px`;
            plane.style.top = `${start.y + (end.y - start.y) * progress}px`;

            const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
            plane.style.transform = `rotate(${angle}deg)`;

            if (currentRemaining > 0) requestAnimationFrame(update);
        }

        function cycleMessages() {
            const randomMsg = flightMessages[Math.floor(Math.random() * flightMessages.length)];
            msgBox.innerText = `[RADIO]: ${randomMsg}`;
            msgBox.style.opacity = 1;

            setTimeout(() => { msgBox.style.opacity = 0; }, 5000); // Fade out after 5s
        }

        update();
        cycleMessages();
        setInterval(cycleMessages, 12000); // New message every 12 seconds
    }

    setTimeout(init, 500);
})();

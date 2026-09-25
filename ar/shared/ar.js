// Shared shell for the AR pages: checks camera/location access before AR.js starts,
// shows progress while the camera warms up, and explains what to do when something fails.
// Load it with `defer` after A-Frame and AR.js.
window.ARShell = (() => {
    const $ = id => document.getElementById(id);

    const ERRORS = {
        insecure: ['Camera needs a secure page',
            'Browsers only allow the camera on pages opened with https://. Open the https version of this page, then try again.'],
        denied: ['Camera is blocked',
            'This demo needs your camera. Allow camera access in your browser\'s site settings, then try again.'],
        nocamera: ['No camera found',
            'Open this page on a phone, or on a computer with a webcam.'],
        busy: ['Camera is busy',
            'Another app or tab is using the camera. Close it, then try again.'],
        timeout: ['Camera didn\'t start',
            'The camera took too long to start. Try again, or reload the page.'],
        library: ['AR didn\'t load',
            'Part of the AR library failed to download. Check your connection, then try again.'],
        'location-denied': ['Location is blocked',
            'This demo needs your location to place the object. Allow location access in your browser\'s site settings, then try again.'],
        'location-unavailable': ['Can\'t find your location',
            'Turn on location services and try again outdoors, where GPS works better.'],
        generic: ['Something went wrong',
            'The camera couldn\'t start. Reload the page and try again.']
    };

    function status(text) {
        const el = $('ar-status');
        if (!el) return;
        el.hidden = !text;
        if (text) el.textContent = text;
    }

    function showError(kind) {
        const [title, text] = ERRORS[kind] || ERRORS.generic;
        status(null);
        const intro = $('ar-intro');
        if (intro) intro.hidden = true;
        $('ar-error-title').textContent = title;
        $('ar-error-text').textContent = text;
        $('ar-error').hidden = false;
        $('ar-retry').focus();
    }

    // Ask for the camera ourselves first, so a refusal shows our message instead of a blank screen.
    // The stream is stopped straight away; AR.js opens its own once permission is granted.
    async function requestCamera() {
        if (!window.isSecureContext) throw 'insecure';
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw 'nocamera';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            stream.getTracks().forEach(t => t.stop());
        } catch (e) {
            const name = e && e.name;
            if (name === 'NotAllowedError' || name === 'SecurityError') throw 'denied';
            if (name === 'NotFoundError' || name === 'OverconstrainedError') throw 'nocamera';
            if (name === 'NotReadableError' || name === 'AbortError') throw 'busy';
            throw 'generic';
        }
    }

    function requestLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject('location-unavailable');
            navigator.geolocation.getCurrentPosition(
                resolve,
                err => reject(err.code === 1 ? 'location-denied' : 'location-unavailable'),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
            );
        });
    }

    // AR.js stretches the camera to cover the whole window, which crops it (a lot, on a phone
    // held upright) and can leave the 3D layer out of line with the video. Instead, fit the
    // whole camera image into a centred window and pin the video and the 3D canvas to exactly
    // that box. The box keeps the camera's own shape, so nothing is cropped or stretched.
    // Room around the window comes from the --stage-* CSS variables in ar.css.
    function containCamera(video) {
        const root = document.documentElement;
        const px = name => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

        function place() {
            const camW = video.videoWidth, camH = video.videoHeight;
            if (!camW || !camH) return;
            const top = px('--stage-top'), bottom = px('--stage-bottom'), side = px('--stage-side');
            const maxW = Math.min(innerWidth - 2 * side, px('--stage-max-width') || Infinity);
            const maxH = innerHeight - top - bottom;
            const scale = Math.min(maxW / camW, maxH / camH);
            const w = Math.floor(camW * scale), h = Math.floor(camH * scale);
            root.style.setProperty('--stage-w', w + 'px');
            root.style.setProperty('--stage-h', h + 'px');
            root.style.setProperty('--stage-x', Math.round((innerWidth - w) / 2) + 'px');
            root.style.setProperty('--stage-y', Math.round(top + (maxH - h) / 2) + 'px');
        }

        document.body.classList.add('ar-contained');
        place();
        video.addEventListener('resize', place); // the camera can switch resolution after starting
        window.addEventListener('resize', place);
    }

    // Resolves once AR.js's video is actually playing.
    function waitForVideo(timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            let askedForTap = false;
            const timer = setInterval(() => {
                const video = document.querySelector('video');
                if (video && video.readyState >= 2 && !video.paused) {
                    clearInterval(timer);
                    containCamera(video);
                    resolve(video);
                    return;
                }
                if (video && video.readyState >= 2 && video.paused) {
                    video.play().catch(() => {
                        // Autoplay refused: a tap anywhere starts it (AR.js listens for that too).
                        if (!askedForTap) {
                            askedForTap = true;
                            status('Tap the screen to start the camera');
                            document.addEventListener('pointerdown', () => video.play().catch(() => {}), { once: true });
                        }
                    });
                }
                if (Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    reject('timeout');
                }
            }, 250);
        });
    }

    // A "Size" slider over the bottom of the camera window. It scales `target` (an A-Frame
    // entity) relative to the scale it started with, and remembers the choice per page.
    function addSizeSlider(target, { min = 0.25, max = 3, step = 0.05 } = {}) {
        const base = target.object3D.scale.clone();
        const key = 'arSize:' + location.pathname;
        let saved = 1;
        try { saved = parseFloat(localStorage.getItem(key)) || 1; } catch (e) {}

        const box = document.createElement('div');
        box.className = 'ar-size';
        box.innerHTML = '<label for="ar-size-input">Size</label>' +
            '<input id="ar-size-input" type="range">' +
            '<output for="ar-size-input" aria-hidden="true"></output>';
        const input = box.querySelector('input');
        const output = box.querySelector('output');
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = Math.min(max, Math.max(min, saved));

        function apply() {
            const size = parseFloat(input.value);
            target.object3D.scale.set(base.x * size, base.y * size, base.z * size);
            const percent = Math.round(size * 100) + '%';
            output.textContent = percent;
            input.setAttribute('aria-valuetext', percent);
            try { localStorage.setItem(key, String(size)); } catch (e) {}
        }

        input.addEventListener('input', apply);
        document.body.appendChild(box);
        apply();
    }

    function watchMarker(marker, hint = 'Point your camera at the marker') {
        let lostTimer = null;
        status(hint);
        marker.addEventListener('markerFound', () => {
            clearTimeout(lostTimer);
            status(null);
        });
        marker.addEventListener('markerLost', () => {
            clearTimeout(lostTimer);
            lostTimer = setTimeout(() => status(hint), 600);
        });
    }

    // Switch from the intro to the camera view.
    function enterCamera() {
        const intro = $('ar-intro');
        if (intro) intro.hidden = true;
        document.body.classList.add('ar-running');
        const back = $('ar-back-float');
        if (back) back.hidden = false;
    }

    function librariesLoaded() {
        return !!(window.AFRAME && window.THREEx);
    }

    // The three marker demos share the Hiro marker, so the full how-to only shows until
    // someone has downloaded the marker or started a camera once.
    const SEEN_KEY = 'arHiroMarkerSeen';
    function rememberMarker() {
        try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    }
    function setupShortIntro() {
        let seen = false;
        try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
        if (seen) document.documentElement.classList.add('ar-returning');
        const show = $('ar-show-howto');
        if (show) show.addEventListener('click', () => document.documentElement.classList.remove('ar-returning'));
        document.querySelectorAll('a[download]').forEach(a => a.addEventListener('click', rememberMarker));
    }

    // Wires up a marker page: intro → permission check → scene from <template> → marker hints.
    function initMarkerPage({ templateId = 'ar-scene', onStarted } = {}) {
        const start = $('ar-start');
        $('ar-retry').addEventListener('click', () => location.reload());
        setupShortIntro();

        if (!librariesLoaded()) {
            showError('library');
            return;
        }
        start.disabled = false;
        start.textContent = 'Start camera';

        start.addEventListener('click', async () => {
            start.disabled = true;
            start.textContent = 'Starting…';
            try {
                await requestCamera();
                enterCamera();
                status('Starting camera…');
                document.body.appendChild($(templateId).content.cloneNode(true));
                await waitForVideo();
                rememberMarker();
                watchMarker(document.querySelector('a-marker'));
                // Objects wrapped in <a-entity data-ar-size> get a size slider.
                const sizeTarget = document.querySelector('[data-ar-size]');
                if (sizeTarget) addSizeSlider(sizeTarget);
                if (onStarted) onStarted();
            } catch (kind) {
                showError(typeof kind === 'string' ? kind : 'generic');
            }
        });
    }

    return { status, showError, requestCamera, requestLocation, waitForVideo, watchMarker, addSizeSlider, enterCamera, librariesLoaded, initMarkerPage };
})();

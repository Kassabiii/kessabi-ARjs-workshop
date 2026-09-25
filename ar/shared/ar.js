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

    // Resolves once AR.js's video is actually playing.
    function waitForVideo(timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            let askedForTap = false;
            const timer = setInterval(() => {
                const video = document.querySelector('video');
                if (video && video.readyState >= 2 && !video.paused) {
                    clearInterval(timer);
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
                if (onStarted) onStarted();
            } catch (kind) {
                showError(typeof kind === 'string' ? kind : 'generic');
            }
        });
    }

    return { status, showError, requestCamera, requestLocation, waitForVideo, watchMarker, enterCamera, librariesLoaded, initMarkerPage };
})();

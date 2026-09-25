# Portfolio — Taoufik Kassabi

AR, e-learning and web projects. Plain HTML, CSS and JavaScript: no build step, runs on any static host.

## Structure

```
index.html            Hub page (links to every project)
ar/                   AR.js demos
  cube.html             01 · Cube on the Hiro marker
  earth-sphere.html     02 · Textured Earth on the marker
  object-switcher.html  03 · Switch between Earth, Saturn and shapes
  location.html         04 · 3D object at a GPS location
  shared/               ar.css, ar.js (intro screen, camera checks, back button)
  markers/              Hiro marker image + pattern, camera calibration
  models/               Earth texture, Saturn model
verb-master/          Irregular verbs quiz (JS), with its course documents in docs/
playlist-game/        Page for the Spotify game: demo, download, how to use it
```

Not published (git-ignored): `private/` (CV and personal files) and `music-player/`
(the Spotify game's source, a separate repo: [Kassabiii/music-player](https://github.com/Kassabiii/music-player)).

## Run locally

Any static server from this folder, for example:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. The AR pages need HTTPS (or localhost) for camera access,
so test them on a phone through the deployed site.

## Updating the Spotify game download

After committing changes in `music-player/`, rebuild the zip from that folder:

```
git archive --format=zip --prefix=do-you-know-your-playlist/ -o ../playlist-game/do-you-know-your-playlist.zip HEAD
```

`git archive` only packs committed files, so `node_modules`, `dist` and `.env.local` never end up in it.

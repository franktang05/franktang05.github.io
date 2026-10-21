# franktang05.github.io

Personal landing page — live at [franktang05.github.io](https://franktang05.github.io).

Plain HTML, CSS, and a little JS. No framework, no build step, no Jekyll. Edit and push.

Pages caches files for 10 minutes, so a new `index.html` can load with an old `styles.css`. When you change CSS or JS, bump the `?v=` on its `<link>`/`<script>` tags in `index.html` and `404.html`.

- `index.html`, `styles.css`: the page, with light and dark themes
- `script.js`: theme toggle, the New York clock, and live weather from [Open-Meteo](https://open-meteo.com) (no API key)
- `gomoku.js`: the playable five-in-a-row tile
- `404.html`: GitHub Pages serves this for missing paths
- `fonts/`: self-hosted Geist, Geist Mono, and Instrument Serif (SIL OFL, see `fonts/OFL.txt`)
- `og.png`, `apple-touch-icon.png`: link preview and home screen icon

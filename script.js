(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Theme toggle. The inline head script already stamped data-theme before first paint.
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');
  const toggle = document.querySelector('[data-theme-toggle]');
  const themeColors = document.querySelectorAll('meta[name="theme-color"]');
  const systemTheme = () => (systemLight.matches ? 'light' : 'dark');
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch { return null; }
  };
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    themeColors.forEach((meta) => meta.setAttribute('content', theme === 'light' ? '#f3f2ee' : '#0d0c0b'));
    toggle?.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
  };

  applyTheme(root.dataset.theme || systemTheme());
  systemLight.addEventListener('change', () => {
    if (!savedTheme()) applyTheme(systemTheme());
  });

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    // Choosing the system theme drops the override so later OS changes are followed again.
    try {
      if (next === systemTheme()) localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {}

    if (!document.startViewTransition || reduceMotion) {
      applyTheme(next);
      return;
    }
    const r = toggle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('theme-switching');
    const transition = document.startViewTransition(() => applyTheme(next));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
    transition.finished.finally(() => root.classList.remove('theme-switching'));
  });

  // Letter-by-letter name reveal. Screen readers get the sr-only copy next to it.
  const name = document.querySelector('[data-split]');
  if (name && !reduceMotion) {
    const text = name.textContent;
    name.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--i', i);
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      name.append(span);
    });
  }

  // Page spotlight plus per-tile glow, mouse/trackpad only.
  if (finePointer) {
    let px = 0;
    let py = 0;
    let frame = 0;
    window.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--px', `${px}px`);
        root.style.setProperty('--py', `${py}px`);
        frame = 0;
      });
    }, { passive: true });

    document.querySelectorAll('.tile').forEach((tile) => {
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
        tile.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  // New York clock: time, a sky that follows the real sunrise and sunset, and live weather.
  const clockTile = document.querySelector('.tile-clock');
  if (clockTile) {
    const timeEl = clockTile.querySelector('[data-time]');
    const hmEl = clockTile.querySelector('[data-hm]');
    const secEl = clockTile.querySelector('[data-sec]');
    const ampmEl = clockTile.querySelector('[data-ampm]');
    const statusEl = clockTile.querySelector('[data-status-label]');
    const orb = clockTile.querySelector('[data-orb]');
    const weatherEl = clockTile.querySelector('[data-weather-readout]');
    const tempEl = clockTile.querySelector('[data-temp]');
    const conditionsEl = clockTile.querySelector('[data-conditions]');
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
    // Sunrise and sunset as decimal hours. Rough defaults until today's forecast arrives.
    const sun = { rise: 6.5, set: 18 };

    const skyPhase = (t) => {
      if (t < sun.rise - 0.6 || t >= sun.set + 0.75) return 'night';
      if (t < sun.rise + 0.75) return 'dawn';
      if (t < sun.set - 0.75) return 'day';
      return 'dusk';
    };

    const statusLabel = (t, weekend) => {
      if (t < 5.5) return 'Probably asleep';
      if (t < 8) return 'Coffee first';
      if (t < 17) return weekend ? 'Weekend' : 'Heads down';
      if (t < 20) return 'Winding down';
      return 'Off the clock';
    };

    const tick = () => {
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(({ type, value }) => [type, value]));
      const h = Number(parts.hour) % 24;
      const t = h + Number(parts.minute) / 60 + Number(parts.second) / 3600;

      hmEl.textContent = `${h % 12 || 12}:${parts.minute}`;
      secEl.textContent = `:${parts.second}`;
      ampmEl.textContent = h < 12 ? 'AM' : 'PM';
      timeEl.dateTime = `${String(h).padStart(2, '0')}:${parts.minute}:${parts.second}`;
      clockTile.dataset.phase = skyPhase(t);
      statusEl.textContent = statusLabel(t, parts.weekday === 'Sat' || parts.weekday === 'Sun');

      // Sun crosses the arc sunrise to sunset, the moon sunset to the next sunrise.
      // Matches the SVG arc: center (50, 62), radii 40 x 40.
      const isDay = t >= sun.rise && t < sun.set;
      const dayLength = sun.set - sun.rise;
      const progress = isDay ? (t - sun.rise) / dayLength : ((t - sun.set + 24) % 24) / (24 - dayLength);
      const angle = Math.PI * progress;
      orb.dataset.kind = isDay ? 'sun' : 'moon';
      orb.style.left = `${50 - 40 * Math.cos(angle)}%`;
      orb.style.top = `${62 - 40 * Math.sin(angle)}%`;
    };

    const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01'
      + '&current=temperature_2m,weather_code&daily=sunrise,sunset&forecast_days=1'
      + '&temperature_unit=fahrenheit&timezone=America%2FNew_York';
    // WMO weather codes, as used by Open-Meteo, mapped to a sky effect and a label.
    const CONDITIONS = {
      0: ['clear', 'Clear'],
      1: ['clear', 'Mostly clear'],
      2: ['partly', 'Partly cloudy'],
      3: ['cloudy', 'Overcast'],
      45: ['fog', 'Fog'],
      48: ['fog', 'Freezing fog'],
      51: ['rain', 'Light drizzle'],
      53: ['rain', 'Drizzle'],
      55: ['rain', 'Heavy drizzle'],
      56: ['rain', 'Freezing drizzle'],
      57: ['rain', 'Freezing drizzle'],
      61: ['rain', 'Light rain'],
      63: ['rain', 'Rain'],
      65: ['rain', 'Heavy rain'],
      66: ['rain', 'Freezing rain'],
      67: ['rain', 'Freezing rain'],
      71: ['snow', 'Light snow'],
      73: ['snow', 'Snow'],
      75: ['snow', 'Heavy snow'],
      77: ['snow', 'Snow grains'],
      80: ['rain', 'Showers'],
      81: ['rain', 'Showers'],
      82: ['rain', 'Heavy showers'],
      85: ['snow', 'Snow showers'],
      86: ['snow', 'Snow showers'],
      95: ['storm', 'Thunderstorm'],
      96: ['storm', 'Thunderstorm'],
      99: ['storm', 'Thunderstorm'],
    };
    // Open-Meteo returns local times like "2026-10-21T07:13".
    const decimalHour = (iso) => Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;

    const loadWeather = async () => {
      try {
        const res = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const { current, daily } = await res.json();
        sun.rise = decimalHour(daily.sunrise[0]);
        sun.set = decimalHour(daily.sunset[0]);
        const [kind, label] = CONDITIONS[current.weather_code] ?? ['clear', ''];
        clockTile.dataset.weather = kind;
        tempEl.textContent = `${Math.round(current.temperature_2m)}°F`;
        conditionsEl.textContent = label;
        weatherEl.hidden = false;
        tick();
      } catch {
        // Offline or blocked: the clock keeps a clear sky and the default sun times.
      }
    };

    tick();
    requestAnimationFrame(() => orb.classList.add('is-live'));
    setInterval(tick, 1000);
    loadWeather();
    setInterval(loadWeather, 15 * 60 * 1000);
  }

  // Contact tile copies the address; falls back to mailto when the clipboard is unavailable.
  const copyBtn = document.querySelector('[data-copy]');
  if (copyBtn) {
    const hint = document.querySelector('[data-copy-hint]');
    if (!finePointer) hint.textContent = 'Tap to copy';
    const original = hint.textContent;
    let timer = 0;
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.copy;
      try {
        await navigator.clipboard.writeText(email);
        hint.textContent = 'Copied to clipboard';
        clearTimeout(timer);
        timer = setTimeout(() => {
          hint.textContent = original;
        }, 2200);
      } catch {
        window.location.href = `mailto:${email}`;
      }
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();

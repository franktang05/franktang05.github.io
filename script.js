(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Letter-by-letter name reveal. The <h1> carries an aria-label, so the split spans stay hidden.
  const name = document.querySelector('[data-split]');
  if (name && !reduceMotion) {
    const text = name.textContent;
    name.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--i', i);
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      name.append(span);
    });
  }

  // Page spotlight plus per-tile glow and tilt, mouse/trackpad only.
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
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        tile.style.setProperty('--mx', `${x * 100}%`);
        tile.style.setProperty('--my', `${y * 100}%`);
        if (reduceMotion) return;
        // Big tiles tilt less so their far edges don't swing too far.
        const maxDeg = 6 * Math.min(1, 300 / Math.max(r.width, r.height));
        tile.style.setProperty('--rx', `${((0.5 - y) * maxDeg).toFixed(2)}deg`);
        tile.style.setProperty('--ry', `${((x - 0.5) * maxDeg).toFixed(2)}deg`);
      });
      tile.addEventListener('pointerleave', () => {
        tile.style.setProperty('--rx', '0deg');
        tile.style.setProperty('--ry', '0deg');
      });
    });
  }

  // New York clock: time, sky phase, and sun/moon position on the arc.
  const clockTile = document.querySelector('.tile-clock');
  if (clockTile) {
    const hmEl = clockTile.querySelector('[data-hm]');
    const secEl = clockTile.querySelector('[data-sec]');
    const ampmEl = clockTile.querySelector('[data-ampm]');
    const phaseEl = clockTile.querySelector('[data-phase-label]');
    const orb = clockTile.querySelector('[data-orb]');
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
    const PHASES = [
      { until: 5.5, phase: 'night', label: 'Probably asleep' },
      { until: 8, phase: 'dawn', label: 'Coffee first' },
      { until: 17, phase: 'day', label: 'Heads down' },
      { until: 20, phase: 'dusk', label: 'Winding down' },
      { until: 24, phase: 'night', label: 'Off the clock' },
    ];

    const tick = () => {
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(({ type, value }) => [type, value]));
      const h = Number(parts.hour) % 24;
      const t = h + Number(parts.minute) / 60 + Number(parts.second) / 3600;

      hmEl.textContent = `${h % 12 || 12}:${parts.minute}`;
      secEl.textContent = `:${parts.second}`;
      ampmEl.textContent = h < 12 ? 'AM' : 'PM';

      const { phase, label } = PHASES.find((p) => t < p.until);
      clockTile.dataset.phase = phase;
      phaseEl.textContent = label;

      // Sun crosses the arc 6am-6pm, moon 6pm-6am. Matches the SVG arc: center (50, 62), radii 40 x 40.
      const isDay = t >= 6 && t < 18;
      const progress = ((t - (isDay ? 6 : 18) + 24) % 24) / 12;
      const angle = Math.PI * progress;
      orb.dataset.kind = isDay ? 'sun' : 'moon';
      orb.style.left = `${50 - 40 * Math.cos(angle)}%`;
      orb.style.top = `${62 - 40 * Math.sin(angle)}%`;
    };

    tick();
    requestAnimationFrame(() => orb.classList.add('is-live'));
    setInterval(tick, 1000);
  }

  // Contact tile copies the address; falls back to mailto when the clipboard is unavailable.
  const copyBtn = document.querySelector('[data-copy]');
  if (copyBtn) {
    const hint = copyBtn.querySelector('[data-copy-hint]');
    const original = hint.textContent;
    let timer = 0;
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.copy;
      try {
        await navigator.clipboard.writeText(email);
        copyBtn.dataset.copied = '';
        hint.textContent = 'Copied to clipboard';
        clearTimeout(timer);
        timer = setTimeout(() => {
          delete copyBtn.dataset.copied;
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

// Five in a row against a small pattern-scoring AI. You always move first.
(() => {
  const tile = document.querySelector('.tile-gomoku');
  if (!tile) return;

  const boardEl = tile.querySelector('[data-board]');
  const statusEl = tile.querySelector('[data-status]');
  const scoreEl = tile.querySelector('[data-score]');
  const resetBtn = tile.querySelector('[data-reset]');

  const N = 11;
  const CENTER = (N * N - 1) / 2;
  const EMPTY = 0;
  const YOU = 1;
  const AI = 2;
  // Go-style coordinates: columns skip "I", row 1 is at the bottom.
  const COLUMNS = 'ABCDEFGHJKL';
  const STAR_POINTS = new Set([3 * N + 3, 3 * N + 7, CENTER, 7 * N + 3, 7 * N + 7]);
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  // Shapes through the point being scored: 1 = that player's stone, 0 = empty, 2 = opponent or board edge.
  const SHAPES = [
    [1e7, ['11111']],
    [1e6, ['011110']],
    [1e5, ['011112', '211110', '10111', '11011', '11101']],
    [1e4, ['001110', '011100']],
    [8e3, ['010110', '011010']],
    [1e3, ['211100', '001112', '210110', '011012', '211010', '010112', '10011', '11001', '10101', '2011102']],
    [4e2, ['00110', '01100', '01010', '010010']],
    [5e1, ['211000', '000112', '210100', '001012']],
  ];

  const cells = new Array(N * N).fill(EMPTY);
  const buttons = [];
  let focused = CENTER;
  let lastMove = -1;
  let moves = 0;
  let over = false;
  let aiTimer = 0;
  let score = { you: 0, ai: 0 };

  try {
    score = { ...score, ...JSON.parse(localStorage.getItem('gomoku-score') || '{}') };
  } catch {}

  const row = (i) => Math.floor(i / N);
  const col = (i) => i % N;
  const onBoard = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const coord = (i) => `${COLUMNS[col(i)]}${N - row(i)}`;

  const say = (text) => { statusEl.textContent = text; };
  const renderScore = () => { scoreEl.textContent = `You ${score.you} · AI ${score.ai}`; };
  const saveScore = () => {
    try { localStorage.setItem('gomoku-score', JSON.stringify(score)); } catch {}
  };

  const describe = (i) => {
    const owner = cells[i] === YOU ? 'your stone' : cells[i] === AI ? 'AI stone' : 'empty';
    buttons[i].setAttribute('aria-label', `${coord(i)}, ${owner}`);
  };

  // The nine points centered on (r, c) along one direction, from `who`'s point of view.
  const lineThrough = (r, c, dr, dc, who) => {
    let line = '';
    for (let k = -4; k <= 4; k++) {
      const rr = r + k * dr;
      const cc = c + k * dc;
      if (k === 0) line += '1';
      else if (!onBoard(rr, cc)) line += '2';
      else {
        const v = cells[rr * N + cc];
        line += v === who ? '1' : v === EMPTY ? '0' : '2';
      }
    }
    return line;
  };

  // Best shape in the line that includes the center point (index 4).
  const shapeScore = (line) => {
    for (const [value, shapes] of SHAPES) {
      for (const shape of shapes) {
        for (let at = line.indexOf(shape); at !== -1; at = line.indexOf(shape, at + 1)) {
          if (at <= 4 && at + shape.length > 4) return value;
        }
      }
    }
    return 1;
  };

  const pointValue = (i, who) => DIRECTIONS.reduce(
    (sum, [dr, dc]) => sum + shapeScore(lineThrough(row(i), col(i), dr, dc, who)),
    0,
  );

  const nearStone = (i) => {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = row(i) + dr;
        const c = col(i) + dc;
        if (onBoard(r, c) && cells[r * N + c] !== EMPTY) return true;
      }
    }
    return false;
  };

  const chooseMove = () => {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < N * N; i++) {
      if (cells[i] !== EMPTY || !nearStone(i)) continue;
      // Building our own line counts slightly more than blocking yours, so a winning move beats a block.
      const value = (pointValue(i, AI) + 0.9 * pointValue(i, YOU)) * (1 + Math.random() * 0.04);
      if (value > bestScore) {
        bestScore = value;
        best = i;
      }
    }
    return best === -1 ? CENTER : best;
  };

  const winningLine = (i, who) => {
    for (const [dr, dc] of DIRECTIONS) {
      const line = [i];
      for (const sign of [1, -1]) {
        for (let k = 1; k < 5; k++) {
          const r = row(i) + sign * k * dr;
          const c = col(i) + sign * k * dc;
          if (!onBoard(r, c) || cells[r * N + c] !== who) break;
          line.push(r * N + c);
        }
      }
      if (line.length >= 5) return line;
    }
    return null;
  };

  const place = (i, who) => {
    cells[i] = who;
    moves += 1;
    if (lastMove !== -1) delete buttons[lastMove].dataset.last;
    lastMove = i;
    const button = buttons[i];
    button.dataset.stone = who === YOU ? 'you' : 'ai';
    button.dataset.last = '';
    describe(i);
  };

  const end = () => {
    over = true;
    boardEl.dataset.over = '';
  };

  // Returns true when the move ended the game.
  const settle = (i, who) => {
    const line = winningLine(i, who);
    if (line) {
      end();
      line.forEach((k) => buttons[k].classList.add('win'));
      if (who === YOU) score.you += 1;
      else score.ai += 1;
      saveScore();
      renderScore();
      say(who === YOU ? 'Five in a row. You win!' : `AI made five with ${coord(i)}. Rematch?`);
      return true;
    }
    if (moves === N * N) {
      end();
      say("Board's full. It's a draw.");
      return true;
    }
    return false;
  };

  const play = (i) => {
    if (over || aiTimer || cells[i] !== EMPTY) return;
    place(i, YOU);
    if (settle(i, YOU)) return;
    boardEl.setAttribute('aria-busy', 'true');
    say('AI is thinking…');
    aiTimer = setTimeout(() => {
      aiTimer = 0;
      boardEl.removeAttribute('aria-busy');
      const j = chooseMove();
      place(j, AI);
      if (!settle(j, AI)) say(`AI played ${coord(j)}. Your move.`);
    }, 420);
  };

  const moveFocus = (i) => {
    buttons[focused].tabIndex = -1;
    focused = i;
    buttons[i].tabIndex = 0;
    buttons[i].focus();
  };

  const reset = () => {
    clearTimeout(aiTimer);
    aiTimer = 0;
    cells.fill(EMPTY);
    moves = 0;
    lastMove = -1;
    over = false;
    delete boardEl.dataset.over;
    boardEl.removeAttribute('aria-busy');
    buttons.forEach((button, i) => {
      delete button.dataset.stone;
      delete button.dataset.last;
      button.classList.remove('win');
      describe(i);
    });
    say('Your move. Five in a row wins.');
  };

  for (let i = 0; i < N * N; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.tabIndex = i === CENTER ? 0 : -1;
    const edges = [
      col(i) === 0 && 'l',
      col(i) === N - 1 && 'r',
      row(i) === 0 && 't',
      row(i) === N - 1 && 'b',
    ].filter(Boolean).join(' ');
    if (edges) button.dataset.edge = edges;
    if (STAR_POINTS.has(i)) button.classList.add('star');
    button.innerHTML = '<span class="stone"></span>';
    button.addEventListener('click', () => {
      if (focused !== i) {
        buttons[focused].tabIndex = -1;
        focused = i;
        button.tabIndex = 0;
      }
      play(i);
    });
    buttons.push(button);
  }
  boardEl.append(...buttons);
  buttons.forEach((_, i) => describe(i));

  const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  boardEl.addEventListener('keydown', (e) => {
    const step = ARROWS[e.key];
    if (!step) return;
    e.preventDefault();
    const r = Math.min(N - 1, Math.max(0, row(focused) + step[0]));
    const c = Math.min(N - 1, Math.max(0, col(focused) + step[1]));
    moveFocus(r * N + c);
  });

  resetBtn.addEventListener('click', reset);
  renderScore();
  say('Your move. Five in a row wins.');
})();

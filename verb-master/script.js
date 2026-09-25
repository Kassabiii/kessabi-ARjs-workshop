// Verb Master: irregular verb practice with saved progress, badges and charts.
(() => {
  const ROUND_SIZE = 5;
  const MASTERY_STREAK = 2; // both forms right this many times in a row
  const STORE_KEY = 'verbMaster.v1';
  const SLOTS = ['pastSimple', 'pastParticiple'];
  const SLOT_NAMES = { pastSimple: 'Past simple', pastParticiple: 'Past participle' };

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function today(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- storage
  function emptyProgress() {
    return { verbs: {}, rounds: [], days: [], badges: {} };
  }
  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (raw && raw.verbs && Array.isArray(raw.rounds)) return { ...emptyProgress(), ...raw };
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return emptyProgress();
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* private mode */ }
  }

  let verbs = [];
  let progress = loadProgress();

  // ---------------------------------------------------------------- stats
  const verbStat = inf => progress.verbs[inf] || { seen: 0, right: 0, wrong: 0, streak: 0 };
  const isMastered = inf => verbStat(inf).streak >= MASTERY_STREAK;
  const needsFixing = inf => { const s = verbStat(inf); return s.seen > 0 && s.streak === 0; };

  function stageCounts() {
    let mastered = 0, learning = 0;
    for (const v of verbs) {
      const s = verbStat(v.infinitive);
      if (s.streak >= MASTERY_STREAK) mastered++;
      else if (s.seen > 0) learning++;
    }
    return { mastered, learning, notStarted: verbs.length - mastered - learning };
  }

  function dayStreak() {
    const days = new Set(progress.days);
    let start = days.has(today()) ? 0 : (days.has(today(-1)) ? -1 : null);
    if (start === null) return 0;
    let n = 0;
    while (days.has(today(start - n))) n++;
    return n;
  }

  function overallAccuracy() {
    let right = 0, total = 0;
    for (const r of progress.rounds) { right += r.right; total += r.total; }
    return total ? Math.round((right / total) * 100) : null;
  }

  // ---------------------------------------------------------------- badges
  const BADGES = [
    { id: 'first-round', name: 'First round', how: 'Finish your first round.', icon: 'flag',
      test: () => progress.rounds.length >= 1 },
    { id: 'perfect', name: 'Perfect round', how: 'Get every form right in one round.', icon: 'star',
      test: () => progress.rounds.some(r => r.right === r.total) },
    { id: 'hard-perfect', name: 'Hard mode ace', how: 'Get a perfect round in hard mode.', icon: 'bolt',
      test: () => progress.rounds.some(r => r.mode === 'hard' && r.right === r.total) },
    { id: 'fixer', name: 'Fixer', how: 'Get every form right in a "practise my mistakes" round.', icon: 'check',
      test: () => progress.rounds.some(r => r.review && r.right === r.total) },
    { id: 'streak-3', name: '3-day streak', how: 'Practise on 3 days in a row.', icon: 'flame',
      test: () => dayStreak() >= 3 },
    { id: 'rounds-10', name: '10 rounds', how: 'Finish 10 rounds.', text: '10',
      test: () => progress.rounds.length >= 10 },
    { id: 'mastered-25', name: '25 verbs mastered', how: 'Master 25 verbs.', text: '25',
      test: () => stageCounts().mastered >= 25 },
    { id: 'mastered-all', name: 'Verb Master', how: 'Master all 162 verbs.', icon: 'crown',
      test: () => verbs.length > 0 && stageCounts().mastered === verbs.length }
  ];

  const ICONS = {
    flag: 'M18 13h2v22h-2zM20 13h11l-2 4 2 4H20z',
    star: 'M24 12l3.5 7.4 8 1-5.9 5.5 1.5 8L24 30l-7.1 3.9 1.5-8-5.9-5.5 8-1z',
    bolt: 'M26 11l-10 15h7l-3 11 11-16h-7z',
    check: 'M14 24.5l3-3 5 5 11-11 3 3-14 14z',
    flame: 'M24 11c1 5 8 8 8 15a8 8 0 01-16 0c0-4 2-6 4-8 0 3 1 5 3 5-1-5 1-9 1-12z',
    crown: 'M13 18l5.5 5L24 14l5.5 9 5.5-5-2 14H15z'
  };

  function medal(badge) {
    const s = svg('svg', { viewBox: '0 0 48 48', class: 'badge-medal', 'aria-hidden': 'true' });
    s.appendChild(svg('circle', { cx: 24, cy: 24, r: 21, class: 'medal-ring' }));
    if (badge.text) {
      const t = svg('text', { x: 24, y: 29, 'text-anchor': 'middle', class: 'medal-text' });
      t.textContent = badge.text;
      s.appendChild(t);
    } else {
      s.appendChild(svg('path', { d: ICONS[badge.icon], class: 'medal-icon' }));
    }
    return s;
  }

  // Returns badges earned for the first time.
  function awardBadges() {
    const fresh = [];
    for (const b of BADGES) {
      if (!progress.badges[b.id] && b.test()) {
        progress.badges[b.id] = today();
        fresh.push(b);
      }
    }
    return fresh;
  }

  // ---------------------------------------------------------------- round setup
  function pickVerbs(review) {
    if (review) {
      return shuffle(verbs.filter(v => needsFixing(v.infinitive))).slice(0, ROUND_SIZE);
    }
    // Mix a couple of verbs still being learned with new ones, so progress moves forward.
    const learning = shuffle(verbs.filter(v => { const s = verbStat(v.infinitive); return s.seen > 0 && !isMastered(v.infinitive); }));
    const fresh = shuffle(verbs.filter(v => verbStat(v.infinitive).seen === 0));
    const rest = shuffle(verbs);
    const chosen = [...learning.slice(0, 2)];
    for (const pool of [fresh, learning.slice(2), rest]) {
      for (const v of pool) {
        if (chosen.length >= ROUND_SIZE) break;
        if (!chosen.includes(v)) chosen.push(v);
      }
    }
    return shuffle(chosen);
  }

  function choicesFor(verb, mode) {
    const answers = [verb.pastSimple, verb.pastParticiple];
    const isAnswer = w => answers.includes(w);
    const taken = new Set(answers);
    const distractors = [];
    const add = w => { if (w && !isAnswer(w) && !taken.has(w)) { taken.add(w); distractors.push(w); } };
    const want = mode === 'hard' ? 4 : 2;

    if (mode === 'hard') {
      add(verb.infinitive);
      // Look-alikes: forms of verbs that start the same way (begin/bring/bite...).
      const prefix = verb.infinitive.slice(0, 2);
      for (const v of shuffle(verbs)) {
        if (distractors.length >= want) break;
        if (v !== verb && v.infinitive.startsWith(prefix)) add(v[shuffle(SLOTS)[0]]);
      }
    }
    for (const v of shuffle(verbs)) {
      if (distractors.length >= want) break;
      if (v !== verb) add(v[shuffle(SLOTS)[0]]);
    }
    return shuffle([...answers, ...distractors.slice(0, want)]);
  }

  // ---------------------------------------------------------------- round state
  let round = null; // { mode, review, items: [{verb, choices, placed:{}, result}], index }
  let activeSlot = 'pastSimple';

  function startRound(mode, review = false) {
    const picked = pickVerbs(review);
    if (!picked.length) return;
    round = {
      mode,
      review,
      index: 0,
      items: picked.map(verb => ({ verb, choices: choicesFor(verb, mode), placed: {}, result: null }))
    };
    show('play');
    $('round-mode').textContent = review ? 'Mistakes round' : (mode === 'hard' ? 'Hard' : 'Easy');
    renderVerb();
  }

  const current = () => round.items[round.index];

  function renderPips() {
    const pips = $('pips');
    pips.replaceChildren();
    round.items.forEach((item, i) => {
      const p = el('span', 'pip');
      if (item.result) {
        const n = SLOTS.filter(s => item.result[s]).length;
        p.classList.add(n === 2 ? 'right' : n === 1 ? 'part' : 'wrong');
      } else if (i === round.index) {
        p.classList.add('current');
      }
      pips.appendChild(p);
    });
    const right = round.items.reduce((sum, it) => sum + (it.result ? SLOTS.filter(s => it.result[s]).length : 0), 0);
    $('round-position').textContent = `Verb ${round.index + 1} of ${round.items.length}`;
    $('round-score').textContent = `${right} ${right === 1 ? 'form' : 'forms'} right`;
  }

  function renderVerb() {
    const item = current();
    activeSlot = firstEmptySlot() || 'pastSimple';
    $('infinitive').textContent = item.verb.infinitive;
    $('arabic').textContent = item.verb.arabic;
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    const check = $('check-btn');
    check.textContent = 'Check answers';
    check.onclick = checkAnswers;
    renderGaps();
    renderBank();
    renderPips();
  }

  function firstEmptySlot() {
    const item = current();
    return SLOTS.find(s => item.placed[s] === undefined) || null;
  }

  function renderGaps() {
    const item = current();
    const done = !!item.result;
    document.querySelectorAll('.gap').forEach(gap => {
      const slot = gap.dataset.slot;
      const placedIdx = item.placed[slot];
      const word = placedIdx === undefined ? null : item.choices[placedIdx];
      const blank = gap.querySelector('.blank');
      blank.textContent = word || ' ';
      gap.className = 'gap';
      if (word) gap.classList.add('filled');
      if (!done && slot === activeSlot) gap.classList.add('active');
      gap.setAttribute('aria-disabled', String(done));

      const res = gap.querySelector('.gap-result');
      if (done) {
        const ok = item.result[slot];
        gap.classList.add(ok ? 'right' : 'wrong');
        res.hidden = false;
        res.textContent = ok ? '✓ Correct' : `✗ Answer: ${item.verb[slot]}`;
      } else {
        res.hidden = true;
      }

      const state = word ? `filled with ${word}` : 'empty';
      const extra = done ? (item.result[slot] ? ', correct' : `, wrong, answer ${item.verb[slot]}`)
        : (slot === activeSlot ? ', selected' : '');
      gap.setAttribute('aria-label', `${SLOT_NAMES[slot]} gap, ${state}${extra}`);
    });

    const complete = SLOTS.every(s => item.placed[s] !== undefined);
    $('check-btn').disabled = !done && !complete;
    $('hint').textContent = done ? ''
      : complete ? 'Both gaps are filled. Check your answers, or tap a gap to change it.'
      : `Tap a word to put it in the ${SLOT_NAMES[activeSlot].toLowerCase()} gap.`;
  }

  function renderBank() {
    const item = current();
    const bank = $('bank');
    bank.replaceChildren();
    bank.hidden = !!item.result;
    const used = new Set(Object.values(item.placed));
    item.choices.forEach((word, idx) => {
      const chip = el('button', 'chip', word);
      chip.type = 'button';
      chip.dataset.idx = idx;
      if (used.has(idx) || item.result) {
        chip.classList.add('used');
        chip.tabIndex = -1;
        chip.setAttribute('aria-hidden', 'true');
      } else {
        chip.draggable = true;
      }
      bank.appendChild(chip);
    });
  }

  function place(idx, slot = activeSlot) {
    const item = current();
    if (item.result || slot === null) return;
    item.placed[slot] = idx;
    activeSlot = firstEmptySlot() || slot;
    renderGaps();
    renderBank();
    if (!firstEmptySlot()) $('check-btn').focus();
    else focusFirstChip();
  }

  function focusFirstChip() {
    const chip = $('bank').querySelector('.chip:not(.used)');
    if (chip && document.activeElement && document.activeElement.classList.contains('chip')) chip.focus();
  }

  function onGapClick(slot) {
    const item = current();
    if (item.result) return;
    if (item.placed[slot] !== undefined) delete item.placed[slot]; // tap a filled gap to take the word back
    activeSlot = slot;
    renderGaps();
    renderBank();
  }

  function checkAnswers() {
    const item = current();
    const result = {};
    for (const s of SLOTS) result[s] = item.choices[item.placed[s]] === item.verb[s];
    item.result = result;

    const allRight = result.pastSimple && result.pastParticiple;
    const stat = { ...verbStat(item.verb.infinitive) };
    stat.seen++;
    if (allRight) { stat.right++; stat.streak++; } else { stat.wrong++; stat.streak = 0; }
    progress.verbs[item.verb.infinitive] = stat;
    saveProgress();

    const fb = $('feedback');
    const n = SLOTS.filter(s => result[s]).length;
    fb.textContent = n === 2 ? (stat.streak === MASTERY_STREAK ? `Both right. You've mastered "${item.verb.infinitive}".` : 'Both right.')
      : n === 1 ? 'One of two right. The correct form is shown above.'
      : 'Not this time. The correct forms are shown above.';
    fb.className = 'feedback ' + (n === 2 ? 'good' : 'bad');

    renderGaps();
    renderBank();
    renderPips();

    const last = round.index === round.items.length - 1;
    const btn = $('check-btn');
    btn.textContent = last ? 'See results' : 'Next verb';
    btn.disabled = false;
    btn.onclick = () => {
      if (last) finishRound();
      else { round.index++; renderVerb(); focusFirstChipAlways(); }
    };
    btn.focus();
  }

  function focusFirstChipAlways() {
    const chip = $('bank').querySelector('.chip:not(.used)');
    if (chip) chip.focus();
  }

  function finishRound() {
    const total = round.items.length * 2;
    const right = round.items.reduce((sum, it) => sum + SLOTS.filter(s => it.result[s]).length, 0);
    progress.rounds.push({ date: today(), mode: round.mode, review: round.review, right, total });
    if (!progress.days.includes(today())) progress.days.push(today());
    const fresh = awardBadges();
    saveProgress();
    renderResults(right, total, fresh);
    show('results');
  }

  // ---------------------------------------------------------------- results
  function renderResults(right, total, freshBadges) {
    const pct = Math.round((right / total) * 100);
    $('results-title').textContent = right === total ? 'Perfect round' : 'Round complete';
    $('results-score').textContent = `${right} of ${total}`;
    $('results-sub').textContent = `forms right (${pct}%)`;

    const nb = $('new-badges');
    nb.replaceChildren();
    $('results-badges').hidden = !freshBadges.length;
    for (const b of freshBadges) {
      const card = el('div', 'new-badge');
      card.appendChild(medal(b));
      const txt = el('div');
      txt.appendChild(el('div', 'badge-name', b.name));
      txt.appendChild(el('div', 'badge-how', b.how));
      card.appendChild(txt);
      nb.appendChild(card);
    }

    const list = $('review-list');
    list.replaceChildren();
    for (const it of round.items) {
      const li = el('li', 'review-item');
      li.appendChild(el('span', 'verb', it.verb.infinitive));
      const forms = el('div', 'review-forms');
      for (const s of SLOTS) {
        const line = el('div', 'form-line');
        line.appendChild(el('span', 'form-name', SLOT_NAMES[s]));
        if (it.result[s]) {
          line.appendChild(el('span', 'ok', '✓'));
          line.appendChild(el('span', '', it.verb[s]));
        } else {
          line.appendChild(el('span', 'no', '✗'));
          line.appendChild(el('s', '', it.choices[it.placed[s]]));
          line.appendChild(el('span', '', it.verb[s]));
        }
        forms.appendChild(line);
      }
      li.appendChild(forms);
      list.appendChild(li);
    }

    const missed = round.items.some(it => !(it.result.pastSimple && it.result.pastParticiple));
    $('fix-btn').hidden = !missed;
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    const played = progress.rounds.length > 0;
    $('home-howto').hidden = played;
    const snap = $('home-snapshot');
    snap.hidden = !played;
    if (played) {
      const c = stageCounts();
      snap.replaceChildren();
      const row = el('div', 'snapshot-row');
      const m = el('span'); m.append(el('b', '', String(c.mastered)), ` of ${verbs.length} verbs mastered`);
      const s = el('span'); const ds = dayStreak();
      s.append(el('b', '', String(ds)), ` ${ds === 1 ? 'day' : 'days'} in a row`);
      const b = el('span'); b.append(el('b', '', String(Object.keys(progress.badges).length)), ` of ${BADGES.length} badges`);
      row.append(m, s, b);
      snap.append(row, stageBar(c, false));
    }
    const toFix = verbs.filter(v => needsFixing(v.infinitive)).length;
    const review = $('start-review');
    review.hidden = toFix === 0;
    review.textContent = `Practise my mistakes (${Math.min(toFix, ROUND_SIZE)} ${Math.min(toFix, ROUND_SIZE) === 1 ? 'verb' : 'verbs'})`;
  }

  // ---------------------------------------------------------------- charts
  const tooltip = el('div', 'tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('role', 'tooltip');

  function showTip(card, anchorRect, value, label) {
    tooltip.replaceChildren(el('strong', '', value), el('span', '', label));
    card.appendChild(tooltip);
    tooltip.hidden = false;
    const cardRect = card.getBoundingClientRect();
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    let x = anchorRect.left + anchorRect.width / 2 - cardRect.left - tw / 2;
    x = Math.max(4, Math.min(x, cardRect.width - tw - 4));
    const y = anchorRect.top - cardRect.top - th - 8;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${Math.max(4, y)}px`;
  }
  const hideTip = () => { tooltip.hidden = true; };

  const STAGES = [
    { key: 'mastered', label: 'Mastered', color: 'var(--stage-mastered)' },
    { key: 'learning', label: 'Learning', color: 'var(--stage-learning)' },
    { key: 'notStarted', label: 'Not started', color: 'var(--stage-new)' }
  ];

  // Part-to-whole of all verbs: one stacked bar, legend with counts, table view.
  function stageBar(counts, withTable = true) {
    const wrap = el('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '0.75rem';
    const bar = el('div', 'stage-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', STAGES.map(s => `${s.label}: ${counts[s.key]}`).join(', '));
    const total = verbs.length || 1;
    for (const s of STAGES) {
      if (!counts[s.key]) continue;
      const seg = el('span', 'stage-seg');
      seg.style.flexGrow = counts[s.key];
      seg.style.flexBasis = '0';
      seg.style.background = s.color;
      if (withTable) {
        seg.tabIndex = 0;
        const tip = () => showTip(wrap.closest('.chart-card'), seg.getBoundingClientRect(),
          `${counts[s.key]} verbs`, `${s.label} · ${Math.round(counts[s.key] / total * 100)}%`);
        seg.addEventListener('pointerenter', tip);
        seg.addEventListener('focus', tip);
        seg.addEventListener('pointerleave', hideTip);
        seg.addEventListener('blur', hideTip);
      }
      bar.appendChild(seg);
    }
    wrap.appendChild(bar);

    const legend = el('ul', 'legend');
    for (const s of STAGES) {
      const li = el('li');
      const sw = el('span', 'swatch');
      sw.style.background = s.color;
      li.append(sw, el('span', '', s.label), el('b', '', String(counts[s.key])));
      legend.appendChild(li);
    }
    wrap.appendChild(legend);

    if (withTable) {
      wrap.appendChild(tableView(['Stage', 'Verbs'], STAGES.map(s => [s.label, counts[s.key]])));
    }
    return wrap;
  }

  // Accuracy of the last 12 rounds as columns on a 0-100% axis.
  function accuracyChart(container) {
    container.replaceChildren();
    const card = container.closest('.chart-card');
    const offset = Math.max(0, progress.rounds.length - 12);
    const rounds = progress.rounds.slice(-12).map((r, i) => ({
      n: offset + i + 1,
      pct: Math.round((r.right / r.total) * 100),
      r
    }));
    if (!rounds.length) {
      container.appendChild(el('p', 'chart-empty', 'Finish a round to see your accuracy here.'));
      return;
    }

    const W = Math.max(260, Math.round(container.clientWidth || 320));
    const H = 190;
    const pad = { top: 22, right: 4, bottom: 24, left: 40 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const band = plotW / Math.max(rounds.length, 6); // spread a few rounds out; 12 max
    const barW = Math.min(24, band * 0.6);
    const y = v => pad.top + plotH - (v / 100) * plotH;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img',
      'aria-label': `Accuracy for the last ${rounds.length} rounds. Latest: ${rounds[rounds.length - 1].pct}%.` });

    for (const t of [0, 50, 100]) {
      s.appendChild(svg('line', { x1: pad.left, x2: W - pad.right, y1: y(t), y2: y(t), class: 'grid' }));
      const lbl = svg('text', { x: pad.left - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' });
      lbl.textContent = `${t}%`;
      s.appendChild(lbl);
    }

    rounds.forEach((d, i) => {
      const cx = pad.left + band * i + band / 2;
      const g = svg('g', { class: 'col' });
      const top = y(d.pct);
      const h = pad.top + plotH - top;
      if (h > 0) {
        const r = Math.min(4, h, barW / 2);
        const x0 = cx - barW / 2, x1 = cx + barW / 2, base = pad.top + plotH;
        // Rounded data-end, square at the baseline.
        g.appendChild(svg('path', {
          class: 'bar',
          d: `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${base}Z`
        }));
      }
      const tick = svg('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'tick' });
      tick.textContent = d.n;
      g.appendChild(tick);

      if (i === rounds.length - 1) {
        const v = svg('text', { x: cx, y: top - 7, 'text-anchor': 'middle', class: 'value-label' });
        v.textContent = `${d.pct}%`;
        g.appendChild(v);
      }

      const hit = svg('rect', { x: cx - band / 2, y: pad.top, width: band, height: plotH, class: 'hit', tabindex: 0,
        'aria-label': `Round ${d.n}: ${d.pct}%` });
      const label = `Round ${d.n} · ${d.r.review ? 'mistakes' : d.r.mode} · ${d.r.right} of ${d.r.total} forms`;
      const tip = () => {
        g.classList.add('focus');
        const barRect = (g.querySelector('.bar') || hit).getBoundingClientRect();
        showTip(card, barRect, `${d.pct}%`, label);
      };
      const untip = () => { g.classList.remove('focus'); hideTip(); };
      hit.addEventListener('pointerenter', tip);
      hit.addEventListener('focus', tip);
      hit.addEventListener('pointerleave', untip);
      hit.addEventListener('blur', untip);
      g.appendChild(hit);
      s.appendChild(g);
    });

    container.appendChild(s);
    container.appendChild(tableView(['Round', 'Level', 'Forms right', 'Accuracy'],
      rounds.map(d => [d.n, d.r.review ? 'Mistakes' : d.r.mode === 'hard' ? 'Hard' : 'Easy', `${d.r.right} of ${d.r.total}`, `${d.pct}%`]),
      [0, 2, 3]));
  }

  function tableView(headers, rows, numericCols = [1]) {
    const d = el('details', 'table-view');
    d.appendChild(el('summary', '', 'Show as table'));
    const t = el('table');
    const thead = el('thead');
    const hr = el('tr');
    headers.forEach((h, i) => hr.appendChild(el('th', numericCols.includes(i) ? 'num' : '', h)));
    thead.appendChild(hr);
    const tbody = el('tbody');
    for (const r of rows) {
      const tr = el('tr');
      r.forEach((c, i) => tr.appendChild(el('td', numericCols.includes(i) ? 'num' : '', String(c))));
      tbody.appendChild(tr);
    }
    t.append(thead, tbody);
    d.appendChild(t);
    return d;
  }

  // ---------------------------------------------------------------- progress
  function renderProgress() {
    const c = stageCounts();
    const acc = overallAccuracy();
    const ds = dayStreak();
    const stats = $('stats');
    stats.replaceChildren();
    const tile = (label, value, sub) => {
      const t = el('div', 'stat');
      t.append(el('span', 'stat-label', label), el('span', 'stat-value', value));
      if (sub) t.appendChild(el('span', 'stat-sub', sub));
      stats.appendChild(t);
    };
    tile('Verbs mastered', String(c.mastered), `of ${verbs.length}`);
    tile('Accuracy', acc === null ? '–' : `${acc}%`, 'all rounds');
    tile('Rounds played', String(progress.rounds.length));
    tile('Day streak', String(ds), ds === 1 ? 'day' : 'days');

    $('stage-chart').replaceChildren(stageBar(c));
    accuracyChart($('accuracy-chart'));

    const earned = Object.keys(progress.badges).length;
    $('badge-count').textContent = `${earned} of ${BADGES.length}`;
    const grid = $('badges');
    grid.replaceChildren();
    for (const b of BADGES) {
      const has = !!progress.badges[b.id];
      const card = el('div', 'badge ' + (has ? 'earned' : 'locked'));
      card.appendChild(medal(b));
      const txt = el('div');
      txt.appendChild(el('div', 'badge-name', b.name));
      txt.appendChild(el('div', 'badge-how', has ? `Earned ${progress.badges[b.id]}` : b.how));
      card.appendChild(txt);
      card.setAttribute('aria-label', `${b.name}: ${has ? 'earned' : 'locked. ' + b.how}`);
      grid.appendChild(card);
    }

    const tricky = verbs
      .filter(v => verbStat(v.infinitive).wrong > 0)
      .sort((a, b) => verbStat(b.infinitive).wrong - verbStat(a.infinitive).wrong)
      .slice(0, 6);
    const box = $('tricky');
    box.replaceChildren();
    if (!tricky.length) {
      box.appendChild(el('p', 'muted', 'No mistakes yet. Verbs you get wrong will show up here.'));
    } else {
      const ul = el('ul', 'review-verbs');
      for (const v of tricky) {
        const li = el('li');
        const w = verbStat(v.infinitive).wrong;
        li.append(el('b', '', v.infinitive),
          el('span', 'forms', `${v.pastSimple} · ${v.pastParticiple} · missed ${w} ${w === 1 ? 'time' : 'times'}`));
        ul.appendChild(li);
      }
      box.appendChild(ul);
    }
    resetArmed(false);
  }

  function resetArmed(on) {
    const btn = $('reset-btn');
    btn.classList.toggle('armed', on);
    btn.textContent = on ? 'Tap again to erase all progress' : 'Reset progress';
  }

  // ---------------------------------------------------------------- navigation
  const SCREENS = ['home', 'play', 'results', 'progress'];
  function show(name, focus = true) {
    for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
    hideTip();
    if (name === 'home') renderHome();
    if (name === 'progress') renderProgress();
    window.scrollTo(0, 0);
    const heading = $(`screen-${name}`).querySelector('h1, .infinitive');
    if (heading && focus) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  function wireEvents() {
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

    $('start-form').addEventListener('submit', e => {
      e.preventDefault();
      startRound(new FormData(e.target).get('mode'));
    });
    $('start-review').addEventListener('click', () => {
      startRound(new FormData($('start-form')).get('mode'), true);
    });
    $('again-btn').addEventListener('click', () => startRound(round ? round.mode : 'easy'));
    $('fix-btn').addEventListener('click', () => startRound(round ? round.mode : 'easy', true));
    $('quit-round').addEventListener('click', () => { round = null; show('home'); });

    $('bank').addEventListener('click', e => {
      const chip = e.target.closest('.chip:not(.used)');
      if (chip) place(Number(chip.dataset.idx));
    });
    document.querySelectorAll('.gap').forEach(gap => {
      gap.addEventListener('click', () => onGapClick(gap.dataset.slot));
      gap.addEventListener('dragover', e => { if (!current().result) { e.preventDefault(); gap.classList.add('drag-over'); } });
      gap.addEventListener('dragleave', () => gap.classList.remove('drag-over'));
      gap.addEventListener('drop', e => {
        e.preventDefault();
        gap.classList.remove('drag-over');
        const idx = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(idx)) place(idx, gap.dataset.slot);
      });
    });
    $('bank').addEventListener('dragstart', e => {
      const chip = e.target.closest('.chip');
      if (chip) e.dataTransfer.setData('text/plain', chip.dataset.idx);
    });

    $('reset-btn').addEventListener('click', () => {
      const btn = $('reset-btn');
      if (!btn.classList.contains('armed')) { resetArmed(true); return; }
      progress = emptyProgress();
      saveProgress();
      renderProgress();
    });
    $('reset-btn').addEventListener('blur', () => resetArmed(false));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!$('screen-progress').hidden) accuracyChart($('accuracy-chart'));
      }, 150);
    });
  }

  fetch('verbs.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      verbs = data;
      wireEvents();
      show('home', false);
    })
    .catch(err => {
      console.error('Could not load verbs.json', err);
      $('load-error').hidden = false;
      $('start-form').hidden = true;
    });
})();

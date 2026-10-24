/* ============================================================
   PETIT JUEGO — moteur de la borne
   Un téléphone, trois joueurs, cinq mini-jeux.
   ============================================================ */
(function () {
  'use strict';

  const D = window.DATA;
  const LS = 'petitjuego_v1';
  const COLORS = ['#00e5ff', '#ff4fa3', '#ffe14d'];

  /* ---------- état ---------- */
  const defaultState = () => ({
    players: ['', '', ''],
    scores: [0, 0, 0],
    hot: false,
    sound: true,
    turn: { cinq: 0, tete: 0 },
    used: { qui: [], cinq: [], tete: [], prefere: [] },
    custom: { qui: [], cinq: [], tete: [], prefere: [] },
    stats: {
      ko: [0, 0, 0], lucid: [0, 0, 0], mental: [0, 0, 0],
      lieHidden: [0, 0, 0], lieDetect: [0, 0, 0],
      cinqOk: [0, 0, 0], cinqFail: [0, 0, 0], guessedOn: [0, 0, 0],
      rounds: 0
    }
  });

  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(LS);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      const d = defaultState();
      // fusion défensive
      return Object.assign(d, s, {
        turn: Object.assign(d.turn, s.turn || {}),
        used: Object.assign(d.used, s.used || {}),
        custom: Object.assign(d.custom, s.custom || {}),
        stats: Object.assign(d.stats, s.stats || {})
      });
    } catch (e) { return defaultState(); }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* tant pis */ } }

  /* ---------- utilitaires ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const others = i => [0, 1, 2].filter(x => x !== i);
  const P = i => S.players[i] || ('Joueur ' + (i + 1));
  const namesSet = () => S.players.every(n => n && n.trim());
  const nameTag = i => `<span class="c${i}">${esc(P(i))}</span>`;

  /* Tirage d'une question non encore utilisée (reset automatique quand le stock est vide) */
  function draw(game) {
    const base = D[game];
    let pool = base.soft.slice();
    if (S.hot && base.hot) pool = pool.concat(base.hot);
    const custom = (S.custom[game] || []).map(c => (game === 'prefere') ? c.split('|').map(x => x.trim()) : c);
    pool = pool.concat(custom.filter(c => game !== 'prefere' || (c.length === 2 && c[0] && c[1])));
    const key = q => (Array.isArray(q) ? q.join('|') : q);
    let fresh = pool.filter(q => !S.used[game].includes(key(q)));
    if (!fresh.length) { S.used[game] = []; fresh = pool; }
    const q = rnd(fresh);
    S.used[game].push(key(q));
    save();
    return q;
  }
  const isHot = (game, q) => {
    const k = Array.isArray(q) ? q.join('|') : q;
    return !!(D[game].hot && D[game].hot.some(h => (Array.isArray(h) ? h.join('|') : h) === k));
  };

  /* ---------- sons (WebAudio, zéro asset) ---------- */
  let AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(freq, dur, type, vol, when) {
    if (!S.sound) return; const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    const t = c.currentTime + (when || 0);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const SFX = {
    blip: () => tone(880, 0.06),
    select: () => { tone(660, 0.07); tone(990, 0.09, 'square', 0.08, 0.07); },
    back: () => { tone(440, 0.08); tone(300, 0.1, 'square', 0.07, 0.08); },
    tick: () => tone(1200, 0.05, 'square', 0.06),
    tock: () => tone(500, 0.08, 'square', 0.1),
    alarm: () => { [0, .15, .3, .45].forEach(t => tone(220, 0.14, 'sawtooth', 0.12, t)); },
    coin: () => { tone(1046, 0.08, 'square', 0.1); tone(1318, 0.25, 'square', 0.1, 0.08); },
    ko: () => { tone(150, 0.3, 'sawtooth', 0.15); tone(90, 0.5, 'sawtooth', 0.15, 0.15); },
    drum: () => { tone(120, 0.08, 'square', 0.1); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.09, i * 0.12)); tone(1318, 0.5, 'square', 0.1, 0.5); },
    fail: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.18)); },
    fanfare: () => { [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.09, i * 0.14)); }
  };

  /* ---------- avatars pixel ---------- */
  const FACES = [
    // Joueur 1 : cheveux courts + barbe
    ['..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.SSESSESS.', '.SSSSSSSS.', '.SBSMMSBS.', '..BBBBBB..', '...BBBB...', '.CCCCCCCC.', 'CCCCCCCCCC'],
    // Joueur 2 : cheveux longs
    ['..HHHHHH..', '.HHHHHHHH.', 'HHSSSSSSHH', 'HHSESSESHH', 'HHSSSSSSHH', 'HHSSMMSSHH', 'HH.SSSS.HH', 'HH..SS..HH', '.CCCCCCCC.', 'CCCCCCCCCC'],
    // Joueur 3 : pics + lunettes
    ['H.HH..HH.H', '.HHHHHHHH.', '.HSSSSSSH.', '.GEGSSGEG.', '.SSSSSSSS.', '.SSSMMSSS.', '..SSSSSS..', '...SSSS...', '.CCCCCCCC.', 'CCCCCCCCCC']
  ];
  const PAL = [
    { H: '#3b2a1e', B: '#2a1d14', S: '#f2c6a0', E: '#111', M: '#c0392b', G: '#222', C: COLORS[0] },
    { H: '#5a2d82', B: '#2a1d14', S: '#f6d2b5', E: '#111', M: '#ff2e7e', G: '#222', C: COLORS[1] },
    { H: '#d9a21b', B: '#2a1d14', S: '#e8b98f', E: '#111', M: '#c0392b', G: '#1a1a1a', C: COLORS[2] }
  ];
  function avatar(i, cls, extra) {
    const face = FACES[i % 3], pal = PAL[i % 3];
    let r = '';
    face.forEach((row, y) => { row.split('').forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`; }); });
    return `<span class="av ${cls || ''}" ${extra || ''}><svg viewBox="0 0 10 10">${r}</svg></span>`;
  }

  /* ---------- rendu ---------- */
  const app = $('#app');
  let timers = [];
  function clearTimers() { timers.forEach(t => clearInterval(t)); timers.forEach(t => clearTimeout(t)); timers = []; $('#screen').classList.remove('alarm'); }
  function render(html) {
    clearTimers();
    app.innerHTML = `<div class="screen-in stack grow">${html}</div>`;
    window.scrollTo(0, 0);
    const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }
  function shake() { const s = $('#screen'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }

  function topbar(gname) {
    return `<div class="topbar"><button class="back" data-act="home">◀ BORNE</button><div class="gname">${esc(gname)}</div><button class="back" data-act="toggleSound">${S.sound ? '♪' : '✕'}</button></div>` + scoreline();
  }
  function scoreline() {
    const max = Math.max(...S.scores);
    return `<div class="scoreline">${[0, 1, 2].map(i => `<div class="sc ${S.scores[i] === max && max > 0 ? 'lead' : ''}">${avatar(i)}<div><div class="nm">${esc(P(i))}</div><div class="pt">${S.scores[i]}</div></div></div>`).join('')}</div>`;
  }
  function addPoints(i, n, label) { S.scores[i] += n; save(); return { i, n, label }; }
  function refreshScores() { const el = $('.scoreline'); if (el) el.outerHTML = scoreline(); }
  function ptsList(list) {
    return `<div class="pts">${list.map(p => `<div class="p ${p.n ? '' : 'zero'}">${avatar(p.i)}<span>${esc(P(p.i))}<br><span class="muted">${esc(p.label || '')}</span></span><span class="plus">${p.n ? '+' + p.n : '0'}</span></div>`).join('')}</div>`;
  }
  function playerButtons(act, selfIdx, exclude) {
    return [0, 1, 2].filter(i => !exclude || !exclude.includes(i)).map(i => `<button class="btn pbtn c${i}" data-act="${act}" data-arg="${i}">${avatar(i)}<span>${esc(P(i))}</span>${i === selfIdx ? '<span class="me">(MOI)</span>' : ''}</button>`).join('');
  }

  /* ---------- passage du téléphone ---------- */
  let pending = null;
  function handoff(i, next, note) {
    pending = next;
    render(`<div class="handoff">
      <div class="label">PASSE LE TÉLÉPHONE À</div>
      ${avatar(i, 'huge bounce')}
      <div class="who c${i}">${esc(P(i))}</div>
      ${note ? `<div class="muted">${note}</div>` : ''}
      <button class="btn primary big" data-act="iam">C'EST MOI, ${esc(P(i)).toUpperCase()}</button>
      <div class="coin">Les deux autres : regardez ailleurs 👀</div>
    </div>`);
  }

  /* ============================================================
     ACCUEIL
     ============================================================ */
  function home() {
    render(`
      <div class="pixelbar"></div>
      <div class="mt"></div>
      <h1 class="title">PETIT<br><span class="neon">JUEGO</span></h1>
      <div class="sub">${esc(rnd(D.taunts.home))}</div>
      <div class="players3 mt">${[0, 1, 2].map(i => `<div class="pl">${avatar(i, 'big')}<div class="nm c${i}">${esc(P(i))}</div><div class="px sm muted">${S.scores[i]} pts</div></div>`).join('')}</div>
      <div class="hr"></div>
      <div class="games">
        <button class="gcard g0" data-act="g1"><span class="ico">🎯</span><span><div class="gt">QUI DE NOUS 3 ?</div><div class="gd">Vote, parie, assume.</div></span><span class="num">01</span></button>
        <button class="gcard g1" data-act="g2"><span class="ico">⏱️</span><span><div class="gt">5 SECONDES CHRONO</div><div class="gd">3 réponses, 5 secondes, pas de pitié.</div></span><span class="num">02</span></button>
        <button class="gcard g2" data-act="g3"><span class="ico">🤥</span><span><div class="gt">MENTEUR !</div><div class="gd">2 vérités, 1 mensonge, démasque.</div></span><span class="num">03</span></button>
        <button class="gcard g3" data-act="g4"><span class="ico">🧠</span><span><div class="gt">DANS LA TÊTE DE…</div><div class="gd">Devine ce qu'il va répondre.</div></span><span class="num">04</span></button>
        <button class="gcard g4" data-act="g5"><span class="ico">⚖️</span><span><div class="gt">TU PRÉFÈRES ?</div><div class="gd">Dilemmes impossibles et prédictions.</div></span><span class="num">05</span></button>
      </div>
      <div class="hr"></div>
      <div class="toggle"><span class="px sm">MODE ${S.hot ? '<span class="tag hot">🌶️ HOT</span>' : '<span class="tag soft">SOFT</span>'}</span><button class="sw ${S.hot ? 'on' : ''}" data-act="toggleHot">${S.hot ? 'HOT ON' : 'HOT OFF'}</button></div>
      <div class="row">
        <button class="btn ghost" data-act="podium">🏆 PODIUM</button>
        <button class="btn ghost" data-act="custom">✏️ NOS QUESTIONS</button>
        <button class="btn ghost" data-act="settings">⚙️</button>
      </div>
      <button class="btn ghost" data-act="newNight">👥 NOUVELLE SOIRÉE (autres joueurs)</button>
      <div class="coin blink mt">INSERT COIN ▸ CHOISIS UN JEU</div>
      <div class="credits">© ske-media arcade · ${S.stats.rounds} manche${S.stats.rounds > 1 ? 's' : ''} jouée${S.stats.rounds > 1 ? 's' : ''}</div>
    `);
  }

  /* ============================================================
     JEU 1 — QUI DE NOUS 3 ?
     ============================================================ */
  let g1 = null;
  function g1Rules() {
    render(topbar('QUI DE NOUS 3 ?') + `
      <div class="panel neon stack">
        <div class="px lg c0">🎯 QUI DE NOUS 3 ?</div>
        <div class="rules">Une question. Chacun <b>vote en secret</b> pour l'un de nous trois (soi-même compris), puis <b>parie</b> sur qui va être désigné.<br><br>
        <b>+1</b> si ton pari est bon.<br><b>+2 lucidité</b> si tu as voté pour toi… et que tu es désigné.<br>Si c'est 1-1-1, personne ne marque.</div>
      </div>
      <div class="grow"></div>
      <button class="btn primary big" data-act="g1start">LANCER UNE MANCHE</button>
    `);
  }
  function g1start() {
    g1 = { q: draw('qui'), votes: [null, null, null], bets: [null, null, null], idx: 0 };
    handoff(0, g1vote);
  }
  function g1vote() {
    const i = g1.idx;
    render(topbar('QUI DE NOUS 3 ?') + `
      <div class="panel neon"><div class="label">${isHot('qui', g1.q) ? '<span class="tag hot">🌶️</span> ' : ''}QUESTION</div><div class="question mt">${esc(g1.q)}</div></div>
      <div class="label center mt">${esc(P(i))}, TON VOTE</div>
      <div class="stack">${playerButtons('g1v', i)}</div>
    `);
  }
  function g1v(t) {
    g1.votes[g1.idx] = +t;
    render(topbar('QUI DE NOUS 3 ?') + `
      <div class="panel"><div class="question sm">${esc(g1.q)}</div></div>
      <div class="label center mt">${esc(P(g1.idx))}, TON PARI : QUI VA ÊTRE DÉSIGNÉ ?</div>
      <div class="stack">${playerButtons('g1b', g1.idx)}</div>
    `);
  }
  function g1b(t) {
    g1.bets[g1.idx] = +t;
    g1.idx++;
    if (g1.idx < 3) handoff(g1.idx, g1vote);
    else g1reveal();
  }
  function g1reveal() {
    const counts = [0, 0, 0];
    g1.votes.forEach(v => counts[v]++);
    const max = Math.max(...counts);
    const tie = max === 1;
    const ko = tie ? null : counts.indexOf(max);
    S.stats.rounds++;
    render(topbar('QUI DE NOUS 3 ?') + `
      <div class="panel"><div class="question sm">${esc(g1.q)}</div></div>
      <div class="label center mt blink">DÉPOUILLEMENT…</div>
      <div class="votes" id="votes">${[0, 1, 2].map(i => `<div class="vrow" id="vr${i}">${avatar(i)}<span class="txt">${esc(P(i))}</span><span class="arrow">▶</span>${avatar(g1.votes[i])}<span class="txt c${g1.votes[i]}">${esc(P(g1.votes[i]))}</span></div>`).join('')}</div>
      <div id="result"></div>
    `);
    [0, 1, 2].forEach(i => later(() => { $('#vr' + i).classList.add('in'); SFX.drum(); }, 500 + i * 650));
    later(() => {
      const pts = [];
      if (tie) {
        SFX.fail();
        $('#result').innerHTML = `<div class="panel yellow mt center stack"><div class="px xl">ÉGALITÉ</div><div class="muted">${esc(rnd(D.taunts.tie))}</div></div>
          <div class="label center mt">PARIS</div>${ptsList([0, 1, 2].map(i => ({ i, n: 0, label: 'a parié ' + P(g1.bets[i]) })))}
          <button class="btn primary big mt" data-act="g1start">MANCHE SUIVANTE</button><button class="btn ghost" data-act="home">RETOUR BORNE</button>`;
        save();
        return;
      }
      SFX.ko(); shake();
      S.stats.ko[ko]++;
      [0, 1, 2].forEach(i => {
        let n = 0, lab = 'a parié ' + P(g1.bets[i]);
        if (g1.bets[i] === ko) { n += 1; S.stats.mental[i]++; lab = 'bon pari'; }
        if (i === ko && g1.votes[i] === i) { n += 2; S.stats.lucid[i]++; lab += (n > 1 ? ' + ' : '') + 'lucidité'; }
        pts.push(addPoints(i, n, lab));
      });
      const lucid = g1.votes[ko] === ko;
      $('#result').innerHTML = `
        <div class="tally mt">${[0, 1, 2].map(i => `<div class="t ${i === ko ? 'win' : ''}">${avatar(i)}<div class="n">${counts[i]}</div></div>`).join('')}</div>
        <div class="ko mt">K.O.</div>
        <div class="center stack" style="align-items:center">${avatar(ko, 'big glitch')}<div class="px lg c${ko}">${esc(P(ko))}</div><div class="muted">${esc(lucid ? rnd(D.taunts.lucid) : rnd(D.taunts.ko))}</div></div>
        <div class="label center mt">POINTS</div>${ptsList(pts)}
        <button class="btn primary big mt" data-act="g1start">MANCHE SUIVANTE</button><button class="btn ghost" data-act="home">RETOUR BORNE</button>`;
      save(); refreshScores();
    }, 2700);
  }

  /* ============================================================
     JEU 2 — 5 SECONDES CHRONO
     ============================================================ */
  let g2 = null;
  function g2Rules() {
    render(topbar('5 SECONDES CHRONO') + `
      <div class="panel red stack">
        <div class="px lg" style="color:var(--red)">⏱️ 5 SECONDES CHRONO</div>
        <div class="rules">Le joueur appuie sur START, la consigne apparaît, et il doit donner <b>3 réponses à voix haute</b> avant la fin du chrono. Les deux autres jugent.<br><br><b>RÉUSSI +2</b> · <b>PRESQUE +1</b> · <b>RATÉ 0</b><br>Le chrono dure 5 secondes. Ça passe vite.</div>
      </div>
      <div class="grow"></div>
      <button class="btn red big" data-act="g2start">AU TOUR DE ${esc(P(S.turn.cinq % 3)).toUpperCase()}</button>
    `);
  }
  function g2start() {
    const p = S.turn.cinq % 3;
    g2 = { p, q: draw('cinq'), done: false };
    render(topbar('5 SECONDES CHRONO') + `
      <div class="center stack" style="align-items:center">${avatar(p, 'big')}<div class="px lg c${p}">${esc(P(p))}</div><div class="muted">Respire. Appuie. Parle.</div></div>
      <div class="panel red mt"><div class="question">? ? ?</div><div class="coin mt">${isHot('cinq', g2.q) ? '🌶️ consigne épicée' : 'consigne cachée'}</div></div>
      <div class="grow"></div>
      <button class="btn red big" data-act="g2go">START ▶</button>
      <button class="btn ghost" data-act="g2skip">autre consigne (1 joker)</button>
    `);
  }
  function g2skip() { g2.q = draw('cinq'); g2start(); $('[data-act=g2skip]').remove(); }
  function g2go() {
    const total = 5000, p = g2.p;
    render(topbar('5 SECONDES CHRONO') + `
      <div class="panel red"><div class="label">CITE…</div><div class="question mt">${esc(g2.q)}</div></div>
      <div class="timer" id="tm">5</div>
      <div class="tbar" id="tb"><div style="width:100%"></div></div>
      <div class="coin mt">${esc(P(p))} parle, les autres comptent.</div>
    `);
    SFX.tick();
    const start = Date.now();
    let lastSec = 5;
    const iv = setInterval(() => {
      const left = Math.max(0, total - (Date.now() - start));
      const sec = Math.ceil(left / 1000);
      const tm = $('#tm'), tb = $('#tb');
      if (!tm) { clearInterval(iv); return; }
      tm.textContent = sec;
      tb.firstElementChild.style.width = (left / total * 100) + '%';
      if (sec !== lastSec) { lastSec = sec; if (sec > 0) (sec <= 2 ? SFX.tock : SFX.tick)(); }
      if (left <= 2000) { tm.classList.add('warn'); tb.classList.add('warn'); }
      if (left <= 0) { clearInterval(iv); $('#screen').classList.add('alarm'); SFX.alarm(); shake(); later(g2judge, 900); }
    }, 50);
    timers.push(iv);
  }
  function g2judge() {
    $('#screen').classList.remove('alarm');
    render(topbar('5 SECONDES CHRONO') + `
      <div class="panel"><div class="question sm">${esc(g2.q)}</div></div>
      <div class="px xl center mt" style="color:var(--red)">STOP !</div>
      <div class="label center">LES JUGES DÉCIDENT POUR ${esc(P(g2.p)).toUpperCase()}</div>
      <div class="stack">
        <button class="btn green big" data-act="g2score" data-arg="2">👍 RÉUSSI +2</button>
        <button class="btn yellow" data-act="g2score" data-arg="1">🤏 PRESQUE +1</button>
        <button class="btn red" data-act="g2score" data-arg="0">👎 RATÉ 0</button>
      </div>
    `);
  }
  function g2score(n) {
    n = +n;
    const p = g2.p;
    if (n === 2) { S.stats.cinqOk[p]++; SFX.win(); } else if (n === 0) { S.stats.cinqFail[p]++; SFX.fail(); } else SFX.select();
    S.stats.rounds++;
    S.turn.cinq++;
    addPoints(p, n);
    render(topbar('5 SECONDES CHRONO') + `
      <div class="center stack" style="align-items:center">${avatar(p, 'big ' + (n ? 'bounce' : ''))}<div class="px lg c${p}">${esc(P(p))}</div><div class="px xl" style="color:${n ? 'var(--green)' : 'var(--red)'}">+${n}</div><div class="muted">${esc(n ? rnd(D.taunts.timerOk) : rnd(D.taunts.timerFail))}</div></div>
      <div class="grow"></div>
      <button class="btn red big" data-act="g2start">AU TOUR DE ${esc(P(S.turn.cinq % 3)).toUpperCase()}</button>
      <button class="btn ghost" data-act="home">RETOUR BORNE</button>
    `);
  }

  /* ============================================================
     JEU 3 — MENTEUR !
     ============================================================ */
  let g3 = null;
  function g3Rules() {
    render(topbar('MENTEUR !') + `
      <div class="panel green stack">
        <div class="px lg" style="color:var(--green)">🤥 MENTEUR !</div>
        <div class="rules">Chacun écrit en secret <b>2 vérités et 1 mensonge</b> sur lui. Les deux autres doivent trouver le mensonge.<br><br>
        <b>+1</b> si tu trouves le mensonge.<br><b>+2</b> pour l'auteur si personne ne le trouve, <b>+1</b> si un seul tombe dans le panneau.</div>
      </div>
      <div class="grow"></div>
      <button class="btn green big" data-act="g3start">ON ÉCRIT</button>
    `);
  }
  function g3start() {
    g3 = { sets: [null, null, null], idx: 0, guesses: {}, phase: 'write' };
    handoff(0, g3write, 'Tu vas écrire tes 3 phrases.');
  }
  function g3write() {
    const i = g3.idx;
    const inspi = shuffle(D.menteur.inspi).slice(0, 3);
    render(topbar('MENTEUR !') + `
      <div class="label">${esc(P(i))}, ÉCRIS 3 PHRASES SUR TOI</div>
      <div class="muted">Marque celle qui est <span style="color:var(--red)">FAUSSE</span>. Sois crédible.</div>
      ${[0, 1, 2].map(k => `<div class="lieopt"><input type="text" id="st${k}" maxlength="90" placeholder="Phrase ${k + 1}…" autocomplete="off"><button class="mark" data-act="g3mark" data-arg="${k}">FAUX</button></div>`).join('')}
      <div class="panel"><div class="label">BESOIN D'IDÉES ?</div><div class="muted">${inspi.map(esc).join(' · ')}</div></div>
      <div class="grow"></div>
      <button class="btn green big" data-act="g3save">VALIDER</button>
    `);
    g3.lie = null;
  }
  function g3mark(k) {
    k = +k; g3.lie = k;
    $$('.lieopt .mark').forEach((b, j) => b.classList.toggle('on', j === k));
    SFX.blip();
  }
  function g3save() {
    const st = [0, 1, 2].map(k => $('#st' + k).value.trim());
    if (st.some(s => !s)) { shake(); SFX.fail(); return; }
    if (g3.lie === null) { shake(); SFX.fail(); return; }
    g3.sets[g3.idx] = { st, lie: g3.lie };
    g3.idx++;
    if (g3.idx < 3) handoff(g3.idx, g3write, 'Tu vas écrire tes 3 phrases.');
    else { g3.author = 0; g3guessSetup(); }
  }
  function g3guessSetup() {
    const a = g3.author;
    const set = g3.sets[a];
    const order = shuffle([0, 1, 2]);
    g3.cur = { a, order, guesser: 0, picks: {} };
    g3guessScreen();
  }
  function g3guessScreen() {
    const c = g3.cur, set = g3.sets[c.a];
    const guessers = others(c.a);
    const g = guessers[c.guesser];
    render(topbar('MENTEUR !') + `
      <div class="center stack" style="align-items:center">${avatar(c.a, 'big')}<div class="px lg c${c.a}">${esc(P(c.a))} DIT :</div></div>
      <div class="stack">${c.order.map((k, pos) => `<button class="stmt" data-act="g3pick" data-arg="${k}">${esc(set.st[k])}</button>`).join('')}</div>
      <div class="label center mt">${esc(P(g))}, LEQUEL EST LE MENSONGE ?</div>
      ${c.guesser > 0 ? `<div class="mark-done center">✓ ${esc(P(guessers[0]))} a choisi</div>` : ''}
    `);
  }
  function g3pick(k) {
    const c = g3.cur, guessers = others(c.a);
    c.picks[guessers[c.guesser]] = +k;
    SFX.select();
    c.guesser++;
    if (c.guesser < 2) g3guessScreen(); else g3revealSet();
  }
  function g3revealSet() {
    const c = g3.cur, set = g3.sets[c.a], guessers = others(c.a);
    const found = guessers.filter(g => c.picks[g] === set.lie);
    const pts = [];
    guessers.forEach(g => { if (c.picks[g] === set.lie) { S.stats.lieDetect[g]++; pts.push(addPoints(g, 1, 'a démasqué')); } else pts.push(addPoints(g, 0, 'a cru ' + '« ' + set.st[c.picks[g]].slice(0, 18) + '… »')); });
    const authorPts = found.length === 0 ? 2 : found.length === 1 ? 1 : 0;
    if (found.length === 0) S.stats.lieHidden[c.a]++;
    pts.unshift(addPoints(c.a, authorPts, found.length === 0 ? 'personne ne l\'a vu' : found.length === 1 ? 'un seul a vu' : 'démasqué par tous'));
    S.stats.rounds++; save();
    if (found.length === 2) SFX.fail(); else SFX.win();
    render(topbar('MENTEUR !') + `
      <div class="px xl center" style="color:var(--red)">LE MENSONGE</div>
      <div class="stack">${c.order.map(k => `<div class="stmt ${k === set.lie ? 'lie' : 'truth'}">${esc(set.st[k])}<div class="who">${k === set.lie ? '❌ FAUX' : '✅ VRAI'} · ${guessers.filter(g => c.picks[g] === k).map(g => P(g)).join(', ') || '—'}</div></div>`).join('')}</div>
      <div class="muted center">${esc(found.length === 0 ? rnd(D.taunts.lieHidden) : found.length === 2 ? rnd(D.taunts.lieFound) : 'Un sur deux. Moyen.')}</div>
      <div class="label center mt">POINTS</div>${ptsList(pts)}
      <button class="btn green big mt" data-act="g3next">${c.a < 2 ? 'AU TOUR DE ' + esc(P(c.a + 1)).toUpperCase() : 'TERMINER'}</button>
    `);
  }
  function g3next() {
    if (g3.author < 2) { g3.author++; g3guessSetup(); }
    else {
      render(topbar('MENTEUR !') + `<div class="panel green center stack"><div class="px xl">FIN DE LA MANCHE</div><div class="muted">Vous vous connaissez un peu mieux. Ou pas.</div></div><div class="grow"></div><button class="btn green big" data-act="g3start">REJOUER</button><button class="btn ghost" data-act="home">RETOUR BORNE</button>`);
      SFX.fanfare();
    }
  }

  /* ============================================================
     JEU 4 — DANS LA TÊTE DE…
     ============================================================ */
  let g4 = null;
  function g4Rules() {
    render(topbar('DANS LA TÊTE DE…') + `
      <div class="panel pink stack">
        <div class="px lg" style="color:var(--pink)">🧠 DANS LA TÊTE DE…</div>
        <div class="rules">Un joueur est sur la sellette. Une question tombe sur lui : il <b>répond en secret</b>. Les deux autres essaient de <b>deviner sa réponse</b>.<br><br>Le joueur sur la sellette désigne qui était le plus proche : <b>+2</b> (ou +1 chacun si les deux sont bons). Si personne n'a trouvé, <b>+1</b> pour l'énigme.</div>
      </div>
      <div class="grow"></div>
      <button class="btn pink big" data-act="g4start">SELLETTE : ${esc(P(S.turn.tete % 3)).toUpperCase()}</button>
    `);
  }
  function g4start() {
    const seat = S.turn.tete % 3;
    const raw = draw('tete');
    g4 = { seat, q: raw.replace(/\{P\}/g, P(seat)), hot: isHot('tete', raw), answer: null, guesses: {}, idx: 0 };
    handoff(seat, g4answer, 'Tu es sur la sellette.');
  }
  function g4answer() {
    render(topbar('DANS LA TÊTE DE…') + `
      <div class="panel pink"><div class="label">${g4.hot ? '<span class="tag hot">🌶️</span> ' : ''}SELLETTE : ${esc(P(g4.seat))}</div><div class="question mt">${esc(g4.q)}</div></div>
      <div class="label">TA VRAIE RÉPONSE (SECRÈTE)</div>
      <input type="text" id="ans" maxlength="80" placeholder="Réponds honnêtement…" autocomplete="off">
      <div class="grow"></div>
      <button class="btn pink big" data-act="g4saveAns">VALIDER</button>
    `);
    later(() => $('#ans') && $('#ans').focus(), 150);
  }
  function g4saveAns() {
    const v = $('#ans').value.trim();
    if (!v) { shake(); SFX.fail(); return; }
    g4.answer = v;
    g4.guessers = others(g4.seat);
    handoff(g4.guessers[0], g4guess, 'À toi de deviner.');
  }
  function g4guess() {
    const g = g4.guessers[g4.idx];
    render(topbar('DANS LA TÊTE DE…') + `
      <div class="panel pink"><div class="label">DANS LA TÊTE DE ${esc(P(g4.seat)).toUpperCase()}</div><div class="question mt">${esc(g4.q)}</div></div>
      <div class="label">${esc(P(g))}, QU'A RÉPONDU ${esc(P(g4.seat)).toUpperCase()} ?</div>
      <input type="text" id="gs" maxlength="80" placeholder="Ta prédiction…" autocomplete="off">
      <div class="grow"></div>
      <button class="btn pink big" data-act="g4saveGuess">VALIDER</button>
    `);
    later(() => $('#gs') && $('#gs').focus(), 150);
  }
  function g4saveGuess() {
    const v = $('#gs').value.trim();
    if (!v) { shake(); SFX.fail(); return; }
    g4.guesses[g4.guessers[g4.idx]] = v;
    g4.idx++;
    if (g4.idx < 2) handoff(g4.guessers[1], g4guess, 'À toi de deviner.');
    else g4reveal();
  }
  function g4reveal() {
    const [a, b] = g4.guessers;
    SFX.coin();
    render(topbar('DANS LA TÊTE DE…') + `
      <div class="panel"><div class="question sm">${esc(g4.q)}</div></div>
      <div class="answer seat"><div class="who c${g4.seat}">${esc(P(g4.seat))} A RÉPONDU</div><div class="txt">${esc(g4.answer)}</div></div>
      <div class="answer"><div class="who c${a}">${esc(P(a))} PENSAIT</div><div class="txt">${esc(g4.guesses[a])}</div></div>
      <div class="answer"><div class="who c${b}">${esc(P(b))} PENSAIT</div><div class="txt">${esc(g4.guesses[b])}</div></div>
      <div class="label center mt">${esc(P(g4.seat))}, QUI ÉTAIT LE PLUS PROCHE ?</div>
      <div class="stack">
        <button class="btn pbtn c${a}" data-act="g4award" data-arg="${a}">${avatar(a)}<span>${esc(P(a))}</span></button>
        <button class="btn pbtn c${b}" data-act="g4award" data-arg="${b}">${avatar(b)}<span>${esc(P(b))}</span></button>
        <button class="btn yellow" data-act="g4award" data-arg="both">LES DEUX +1 CHACUN</button>
        <button class="btn ghost" data-act="g4award" data-arg="none">PERSONNE. JE SUIS UNE ÉNIGME.</button>
      </div>
    `);
  }
  function g4award(who) {
    const [a, b] = g4.guessers, pts = [];
    if (who === 'both') { pts.push(addPoints(a, 1, 'bien vu'), addPoints(b, 1, 'bien vu')); S.stats.mental[a]++; S.stats.mental[b]++; S.stats.guessedOn[g4.seat] += 2; SFX.win(); }
    else if (who === 'none') { pts.push(addPoints(g4.seat, 1, 'énigme vivante'), addPoints(a, 0, 'à côté'), addPoints(b, 0, 'à côté')); SFX.fail(); }
    else { const w = +who, l = w === a ? b : a; pts.push(addPoints(w, 2, 'dans sa tête'), addPoints(l, 0, 'à côté')); S.stats.mental[w]++; S.stats.guessedOn[g4.seat]++; SFX.win(); }
    S.stats.rounds++; S.turn.tete++; save();
    render(topbar('DANS LA TÊTE DE…') + `
      <div class="label center">POINTS</div>${ptsList(pts)}
      <div class="grow"></div>
      <button class="btn pink big" data-act="g4start">SELLETTE : ${esc(P(S.turn.tete % 3)).toUpperCase()}</button>
      <button class="btn ghost" data-act="home">RETOUR BORNE</button>
    `);
  }

  /* ============================================================
     JEU 5 — TU PRÉFÈRES ?
     ============================================================ */
  let g5 = null;
  function g5Rules() {
    render(topbar('TU PRÉFÈRES ?') + `
      <div class="panel yellow stack">
        <div class="px lg" style="color:var(--yellow)">⚖️ TU PRÉFÈRES ?</div>
        <div class="rules">Un dilemme impossible. Chacun <b>choisit en secret</b>, puis <b>prédit</b> le choix des deux autres.<br><br><b>+1</b> par prédiction correcte. <b>+1 bonus</b> si tu as les deux.</div>
      </div>
      <div class="grow"></div>
      <button class="btn yellow big" data-act="g5start">LANCER UN DILEMME</button>
    `);
  }
  function g5start() {
    g5 = { d: draw('prefere'), picks: [null, null, null], preds: [{}, {}, {}], idx: 0 };
    g5.hot = isHot('prefere', g5.d);
    handoff(0, g5choose);
  }
  function abBox(d, act, extra) {
    return `<div class="ab"><button class="opt a" data-act="${act}" data-arg="0" ${extra || ''}><span class="l">A</span>${esc(d[0])}</button><button class="opt b" data-act="${act}" data-arg="1" ${extra || ''}><span class="l">B</span>${esc(d[1])}</button></div>`;
  }
  function g5choose() {
    const i = g5.idx;
    render(topbar('TU PRÉFÈRES ?') + `
      <div class="label center">${g5.hot ? '<span class="tag hot">🌶️</span> ' : ''}${esc(P(i))}, TU PRÉFÈRES…</div>
      ${abBox(g5.d, 'g5pick')}
    `);
  }
  function g5pick(v) {
    g5.picks[g5.idx] = +v; SFX.select();
    const i = g5.idx, oth = others(i);
    g5.tmp = {};
    render(topbar('TU PRÉFÈRES ?') + `
      <div class="panel"><div class="muted center">A · ${esc(g5.d[0])}<br>B · ${esc(g5.d[1])}</div></div>
      <div class="label center">${esc(P(i))}, QU'ONT CHOISI LES AUTRES ?</div>
      ${oth.map(o => `<div class="predrow">${avatar(o)}<span class="nm c${o}">${esc(P(o))}</span><button class="mini" data-act="g5pred" data-arg="${o}:0">A</button><button class="mini" data-act="g5pred" data-arg="${o}:1">B</button></div>`).join('')}
      <div class="grow"></div>
      <button class="btn yellow big" data-act="g5valid">VALIDER</button>
    `);
  }
  function g5pred(arg, el) {
    const [o, v] = arg.split(':').map(Number);
    g5.tmp[o] = v; SFX.blip();
    $$('.mini', el.parentElement).forEach(b => b.classList.toggle('on', b === el));
  }
  function g5valid() {
    const oth = others(g5.idx);
    if (oth.some(o => g5.tmp[o] === undefined)) { shake(); SFX.fail(); return; }
    g5.preds[g5.idx] = Object.assign({}, g5.tmp);
    g5.idx++;
    if (g5.idx < 3) handoff(g5.idx, g5choose); else g5reveal();
  }
  function g5reveal() {
    const pts = [];
    [0, 1, 2].forEach(i => {
      let ok = 0;
      others(i).forEach(o => { if (g5.preds[i][o] === g5.picks[o]) { ok++; S.stats.guessedOn[o]++; } });
      const n = ok + (ok === 2 ? 1 : 0);
      if (ok) S.stats.mental[i] += ok;
      pts.push(addPoints(i, n, ok === 2 ? 'les deux + bonus' : ok === 1 ? 'une bonne' : 'à côté'));
    });
    const unanimous = g5.picks.every(p => p === g5.picks[0]);
    S.stats.rounds++; save(); SFX.coin();
    render(topbar('TU PRÉFÈRES ?') + `
      <div class="ab">
        <div class="opt a"><span class="l">A</span>${esc(g5.d[0])}<div class="row mt" style="justify-content:center">${[0, 1, 2].filter(i => g5.picks[i] === 0).map(i => avatar(i)).join('') || '<span class="muted">personne</span>'}</div></div>
        <div class="opt b"><span class="l">B</span>${esc(g5.d[1])}<div class="row mt" style="justify-content:center">${[0, 1, 2].filter(i => g5.picks[i] === 1).map(i => avatar(i)).join('') || '<span class="muted">personne</span>'}</div></div>
      </div>
      ${unanimous ? '<div class="px center" style="color:var(--yellow)">UNANIMITÉ. VOUS ÊTES LE MÊME CERVEAU.</div>' : ''}
      <div class="label center mt">PRÉDICTIONS</div>${ptsList(pts)}
      <button class="btn yellow big mt" data-act="g5start">DILEMME SUIVANT</button><button class="btn ghost" data-act="home">RETOUR BORNE</button>
    `);
  }

  /* ============================================================
     PODIUM & TITRES
     ============================================================ */
  function podium() {
    const order = [0, 1, 2].sort((a, b) => S.scores[b] - S.scores[a]);
    const st = S.stats;
    const awards = [];
    const seen = new Set();
    D.titles.forEach(t => {
      const arr = st[t.key]; if (!arr) return;
      const total = arr.reduce((a, b) => a + b, 0); if (!total) return;
      const val = t.mode === 'max' ? Math.max(...arr) : Math.min(...arr);
      const who = [0, 1, 2].filter(i => arr[i] === val);
      if (who.length !== 1) return;
      if (seen.has(who[0] + t.key)) return;
      seen.add(who[0] + t.key);
      awards.push({ t, who: who[0] });
    });
    SFX.fanfare();
    render(topbar('PODIUM') + `
      <div class="px xl center" style="color:var(--yellow)">🏆 PODIUM</div>
      <div class="podium">
        ${[{ i: order[1], c: 'second', n: 2 }, { i: order[0], c: 'first', n: 1 }, { i: order[2], c: 'third', n: 3 }].map(s => `<div class="step ${s.c}">${avatar(s.i, s.n === 1 ? 'bounce' : '')}<div class="nm c${s.i}">${esc(P(s.i))}</div><div class="total">${S.scores[s.i]} pts</div><div class="box">${s.n}</div></div>`).join('')}
      </div>
      <div class="label center mt">TITRES DE LA SOIRÉE</div>
      ${awards.length ? `<div class="awards">${awards.map(a => `<div class="award"><span class="ico">${a.t.icon}</span><span><div class="nm">${esc(a.t.name)}</div><div class="ds">${esc(a.t.desc)}</div></span>${avatar(a.who)}</div>`).join('')}</div>` : '<div class="muted center">Jouez quelques manches pour débloquer des titres.</div>'}
      <div class="coin mt">${st.rounds} manche${st.rounds > 1 ? 's' : ''} jouée${st.rounds > 1 ? 's' : ''}</div>
      <div class="grow"></div>
      <button class="btn ghost" data-act="newNight">👥 NOUVELLE SOIRÉE (joueurs et scores à zéro)</button>
      <button class="btn primary" data-act="home">RETOUR BORNE</button>
    `);
  }

  /* ============================================================
     NOS QUESTIONS (perso)
     ============================================================ */
  let customTab = 'qui';
  const TABS = { qui: 'QUI DE NOUS 3', cinq: '5 SECONDES', tete: 'DANS LA TÊTE', prefere: 'TU PRÉFÈRES' };
  const HINTS = {
    qui: 'Ex : Qui de nous a déjà pleuré devant Pékin Express ?',
    cinq: 'Ex : 3 surnoms qu\'on donne au plus petit du groupe',
    tete: 'Utilise {P} pour le prénom. Ex : Le pire achat de {P} ?',
    prefere: 'Sépare A et B par une barre |. Ex : Un mois sans sucre | Un mois sans sel'
  };
  function custom() {
    const list = S.custom[customTab];
    render(topbar('NOS QUESTIONS') + `
      <div class="muted">Vos private jokes, c'est là que ça devient drôle. Tout reste sur ce téléphone.</div>
      <div class="row wrap">${Object.keys(TABS).map(k => `<button class="chip ${k === customTab ? 'on' : ''}" data-act="customTab" data-arg="${k}">${TABS[k]} (${S.custom[k].length})</button>`).join('')}</div>
      <div class="field"><input type="text" id="cq" maxlength="140" placeholder="${esc(HINTS[customTab])}" autocomplete="off"><button class="btn primary" data-act="customAdd">AJOUTER</button></div>
      <div class="list">${list.length ? list.map((q, i) => `<div class="it"><span>${esc(q)}</span><button class="del" data-act="customDel" data-arg="${i}">✕</button></div>`).join('') : '<div class="muted center">Rien pour l\'instant.</div>'}</div>
    `);
  }
  function customAdd() {
    const v = $('#cq').value.trim();
    if (!v) { shake(); return; }
    if (customTab === 'prefere' && v.split('|').length !== 2) { shake(); SFX.fail(); $('#cq').placeholder = 'Il faut une barre | entre A et B'; return; }
    S.custom[customTab].push(v); save(); SFX.coin(); custom();
  }

  /* ============================================================
     RÉGLAGES
     ============================================================ */
  function settings() {
    render(topbar('RÉGLAGES') + `
      <div class="label">JOUEURS</div>
      ${[0, 1, 2].map(i => `<div class="row">${avatar(i)}<input type="text" id="pn${i}" maxlength="12" value="${esc(P(i))}" autocomplete="off"></div>`).join('')}
      <button class="btn primary" data-act="saveNames">ENREGISTRER LES NOMS</button>
      <div class="hr"></div>
      <div class="toggle"><span class="px sm">SON</span><button class="sw ${S.sound ? 'on' : ''}" data-act="toggleSoundS">${S.sound ? 'ON' : 'OFF'}</button></div>
      <div class="toggle"><span class="px sm">MODE HOT 🌶️</span><button class="sw ${S.hot ? 'on' : ''}" data-act="toggleHotS">${S.hot ? 'ON' : 'OFF'}</button></div>
      <div class="hr"></div>
      <button class="btn ghost" data-act="resetUsed">♻️ REMETTRE TOUTES LES QUESTIONS DANS LE STOCK</button>
      <button class="btn ghost" data-act="resetScores">🔄 SCORES ET TITRES À ZÉRO</button>
      <button class="btn ghost" data-act="resetAll" style="color:var(--red)">💣 TOUT EFFACER (y compris nos questions)</button>
      <div class="credits mt">PETIT JUEGO · fait maison, zéro serveur, zéro tracking.<br>Tout est dans ce téléphone.</div>
    `);
  }

  /* ============================================================
     ACTIONS (délégation des clics)
     ============================================================ */
  const ACT = {
    home: () => { SFX.back(); home(); },
    toggleSound: () => { S.sound = !S.sound; save(); SFX.blip(); const b = $('[data-act=toggleSound]'); if (b) b.textContent = S.sound ? '♪' : '✕'; },
    toggleSoundS: () => { S.sound = !S.sound; save(); SFX.blip(); settings(); },
    toggleHot: () => { S.hot = !S.hot; save(); SFX.coin(); home(); },
    toggleHotS: () => { S.hot = !S.hot; save(); SFX.coin(); settings(); },
    iam: () => { SFX.coin(); const f = pending; pending = null; if (f) f(); },
    g1: () => { SFX.select(); g1Rules(); }, g1start, g1v, g1b,
    g2: () => { SFX.select(); g2Rules(); }, g2start, g2go, g2skip, g2score,
    g3: () => { SFX.select(); g3Rules(); }, g3start, g3mark, g3save, g3pick, g3next,
    g4: () => { SFX.select(); g4Rules(); }, g4start, g4saveAns, g4saveGuess, g4award,
    g5: () => { SFX.select(); g5Rules(); }, g5start, g5pick, g5pred, g5valid,
    podium: () => podium(),
    custom: () => { SFX.select(); custom(); },
    customTab: k => { customTab = k; SFX.blip(); custom(); },
    customAdd, customDel: i => { S.custom[customTab].splice(+i, 1); save(); SFX.back(); custom(); },
    settings: () => { SFX.select(); settings(); },
    saveNames: () => { [0, 1, 2].forEach(i => { const v = $('#pn' + i).value.trim(); if (v) S.players[i] = v; }); save(); SFX.coin(); home(); },
    resetUsed: () => { S.used = { qui: [], cinq: [], tete: [], prefere: [] }; save(); SFX.coin(); settings(); },
    resetScores: () => {
      if (!confirm('Remettre les scores et les titres à zéro ?')) return;
      const d = defaultState(); S.scores = d.scores; S.stats = d.stats; S.turn = d.turn; save(); SFX.back(); home();
    },
    resetAll: () => { if (!confirm('Tout effacer, vraiment tout ?')) return; localStorage.removeItem(LS); S = defaultState(); SFX.ko(); home(); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    ac();
    fn(el.dataset.arg, el);
  });
  // Entrée = valider sur les écrans à saisie
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const btn = $('[data-act=g4saveAns], [data-act=g4saveGuess], [data-act=customAdd], [data-act=startNight]');
    if (btn && document.activeElement && document.activeElement.tagName === 'INPUT') { e.preventDefault(); btn.click(); }
  });

  /* ---------- nouvelle soirée : qui joue ? ---------- */
  function setup() {
    render(`<div class="pixelbar"></div>
      <h1 class="title mt">QUI<br><span class="neon">JOUE ?</span></h1>
      <div class="sub">Trois joueurs, un téléphone qu'on se passe.<br>Entrez vos prénoms dans l'ordre où vous êtes assis.</div>
      <div class="stack mt">${[0, 1, 2].map(i => `<div class="row">${avatar(i, 'big')}<input type="text" id="pn${i}" maxlength="12" placeholder="Prénom du joueur ${i + 1}" value="${esc(S.players[i] || '')}" autocomplete="off" autocapitalize="words"></div>`).join('')}</div>
      <div class="grow"></div>
      <button class="btn yellow big" data-act="startNight">LANCER LA SOIRÉE ▶</button>
      <div class="coin">les scores et les titres repartent de zéro</div>`);
    later(() => { const f = $('#pn0'); if (f && !f.value) f.focus(); }, 150);
  }
  ACT.startNight = () => {
    const names = [0, 1, 2].map(i => $('#pn' + i).value.trim());
    if (names.some(n => !n)) { shake(); SFX.fail(); return; }
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== 3) { shake(); SFX.fail(); $('#pn0').placeholder = 'Deux prénoms identiques…'; return; }
    const d = defaultState();
    S.players = names; S.scores = d.scores; S.stats = d.stats; S.turn = d.turn; save();
    SFX.fanfare(); later(home, 200);
  };
  ACT.newNight = () => { if (!confirm('Nouvelle soirée ? Les scores et les titres repartent de zéro.')) return; SFX.coin(); setup(); };

  /* ---------- écran d'allumage ---------- */
  function boot() {
    render(`<div class="handoff">
      <div class="pixelbar" style="width:100%"></div>
      <h1 class="title">PETIT<br><span class="neon">JUEGO</span></h1>
      <div class="players3">${[0, 1, 2].map(i => avatar(i, 'big bounce', `style="animation-delay:${i * .15}s"`)).join('')}</div>
      <div class="muted">${namesSet() ? esc(P(0)) + ' · ' + esc(P(1)) + ' · ' + esc(P(2)) : 'Un téléphone, trois joueurs, zéro mensonge (ou presque).'}</div>
      <button class="btn yellow big blink" data-act="boot">PRESS START</button>
      <div class="coin">3 JOUEURS · 1 TÉLÉPHONE · 5 JEUX</div>
    </div>`);
  }
  ACT.boot = () => { SFX.coin(); later(namesSet() ? home : setup, 120); };
  boot();
})();

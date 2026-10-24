/* ============================================================
   PETIT JUEGO — runtime « un téléphone qu'on se passe »
   La logique des 20 jeux est dans games.js ; ici : l'état, la borne,
   le passage du téléphone et le rendu des invites (prompts.js).
   ============================================================ */
(function () {
  'use strict';
  const D = window.DATA;
  const { esc, rnd, shuffle, others, sleep, $, $$, avatar, SFX, renderPrompt, GAMES, CATS, pickRandom, available, countdown } = window.PJ;
  const LS = 'petitjuego_v2';

  /* ---------- état ---------- */
  const defaultState = () => ({
    players: ['', '', ''], scores: [0, 0, 0], ambiance: null, hot: false, sound: true, lastGame: null, setsPlayed: 0,
    turn: { tour: 0 },
    used: {}, custom: { qui: [], cinq: [], tete: [], prefere: [] },
    stats: { ko: [0, 0, 0], lucid: [0, 0, 0], mental: [0, 0, 0], lieHidden: [0, 0, 0], lieDetect: [0, 0, 0], cinqOk: [0, 0, 0], cinqFail: [0, 0, 0], guessedOn: [0, 0, 0], reflex: [0, 0, 0], votes: [0, 0, 0], sips: [0, 0, 0], rounds: 0 }
  });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(LS); if (!raw) return defaultState(); const s = JSON.parse(raw), d = defaultState();
      return Object.assign(d, s, { turn: Object.assign(d.turn, s.turn || {}), used: s.used || {}, custom: Object.assign(d.custom, s.custom || {}), stats: Object.assign(d.stats, s.stats || {}) }); } catch (e) { return defaultState(); }
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }
  SFX.setOn(S.sound);
  const P = i => S.players[i] || ('Joueur ' + (i + 1));
  const namesSet = () => S.players.every(n => n && n.trim());
  const hotOn = () => S.ambiance === 'glisse' || S.ambiance === 'mix' || S.hot;

  /* Tirage d'un élément non encore utilisé (reset automatique quand le stock est vide) */
  function draw(game) {
    const base = D[game];
    let pool = Array.isArray(base) ? base.slice() : base.soft.slice();
    if (!Array.isArray(base) && hotOn() && base.hot) pool = pool.concat(base.hot);
    const custom = (S.custom[game] || []).map(c => game === 'prefere' ? c.split('|').map(x => x.trim()) : c).filter(c => game !== 'prefere' || (c.length === 2 && c[0] && c[1]));
    pool = pool.concat(custom);
    const key = q => Array.isArray(q) ? q.join('|') : q;
    S.used[game] = S.used[game] || [];
    let fresh = pool.filter(q => !S.used[game].includes(key(q)));
    if (!fresh.length) { S.used[game] = []; fresh = pool; }
    const q = rnd(fresh); S.used[game].push(key(q)); save(); return q;
  }
  const isHot = (game, q) => { const b = D[game]; if (Array.isArray(b) || !b.hot) return false; const k = Array.isArray(q) ? q.join('|') : q; return b.hot.some(h => (Array.isArray(h) ? h.join('|') : h) === k); };

  /* ---------- rendu ---------- */
  const app = $('#app');
  let gen = 0, screenName = 'boot';
  class Aborted extends Error { }
  function render(html, name) {
    screenName = name || screenName;
    app.innerHTML = `<div class="screen-in stack grow">${html}</div>`;
    window.scrollTo(0, 0);
    const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }
  function shake() { const s = $('#screen'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  function topbar(gname) {
    return `<div class="topbar"><button class="back" data-act="home">◀ BORNE</button><div class="gname">${esc(gname || '')}</div><button class="back" data-act="toggleSound">${S.sound ? '♪' : '✕'}</button></div>` + scoreline();
  }
  function scoreline() {
    const max = Math.max(...S.scores);
    return `<div class="scoreline">${[0, 1, 2].map(i => `<div class="sc ${S.scores[i] === max && max > 0 ? 'lead' : ''}">${avatar(i)}<div><div class="nm">${esc(P(i))}</div><div class="pt" id="pt${i}">${S.scores[i]}</div></div></div>`).join('')}</div>`;
  }
  function refreshScores() { const el = $('.scoreline'); if (el) el.outerHTML = scoreline(); }
  const amb = () => D.ambiances[S.ambiance] || D.ambiances.mix;

  /* ============================================================
     RUNTIME pour games.js
     ============================================================ */
  let currentGame = null;
  const R = {
    S, P, draw, isHot, esc, avatar, sleep, sfx: SFX, isWeb: false, save,
    aborted: () => false,
    shake, alarm: on => $('#screen').classList.toggle('alarm', !!on),
    show(html) { render(topbar(currentGame ? currentGame.name : '') + html, 'game'); },
    result(html) { const r = $('#result'); if (r) r.innerHTML = html; else app.firstElementChild.insertAdjacentHTML('beforeend', `<div id="result" class="stack">${html}</div>`); refreshScores(); },
    progress() { return ''; },
    addPoints(i, n, label) { S.scores[i] += n; save(); const el = $('#pt' + i); if (el) el.textContent = S.scores[i]; return { i, n, label }; },
    ptsList(list) { return `<div class="pts">${list.map(p => `<div class="p ${p.n ? '' : 'zero'}">${avatar(p.i)}<span>${esc(P(p.i))}<br><span class="muted">${esc(p.label || '')}</span></span><span class="plus">${p.n ? '+' + p.n : '0'}</span></div>`).join('')}</div>`; },
    /** Passe le téléphone à `seat`, affiche l'invite, résout avec sa réponse. */
    ask(seat, prompt) {
      const myGen = gen;
      return new Promise((resolve, reject) => {
        render(`<div class="handoff"><div class="label">PASSE LE TÉLÉPHONE À</div>${avatar(seat, 'huge bounce')}<div class="who c${seat}">${esc(P(seat))}</div><button class="btn primary big" id="iam">C'EST MOI, ${esc(P(seat)).toUpperCase()}</button><div class="coin">Les deux autres : regardez ailleurs 👀</div><button class="btn ghost" data-act="home">◀ retour borne</button></div>`, 'handoff');
        $('#iam').onclick = () => {
          if (gen !== myGen) return reject(new Aborted());
          SFX.coin();
          render(topbar(currentGame ? currentGame.name : '') + `<div class="stack grow" id="pbox"></div>`, 'prompt');
          renderPrompt($('#pbox'), prompt, { names: S.players.map((n, i) => P(i)), seat }, v => {
            if (gen !== myGen) return reject(new Aborted());
            if (prompt.kind !== 'wait' && prompt.kind !== 'start') { render(`<div class="handoff">${avatar(seat, 'big')}<div class="px lg" style="color:var(--green)">✓ C'EST NOTÉ</div><div class="muted">${esc(prompt.after || 'Tu peux rendre le téléphone.')}</div></div>`, 'sent'); SFX.coin(); setTimeout(() => { if (gen === myGen) resolve(v); }, 650); }
            else resolve(v);
          });
        };
      });
    },
    async askAll(seats, fn) { const out = {}; for (const s of seats) out[s] = await R.ask(s, fn(s)); return out; },
    /** Boutons en bas de l'écran courant. */
    choice(options) {
      const myGen = gen;
      return new Promise((resolve, reject) => {
        const box = document.createElement('div'); box.className = 'tvbtns';
        box.innerHTML = options.map((o, i) => `<button class="btn ${o.cls || (i === 0 ? 'primary big' : 'ghost')}" data-i="${i}">${esc(o.label)}</button>`).join('');
        app.firstElementChild.appendChild(box);
        $$('button', box).forEach(b => b.onclick = () => { if (gen !== myGen) return reject(new Aborted()); SFX.select(); resolve(+b.dataset.i); });
        setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
      });
    }
  };
  R.countdown = s => countdown(R, s);

  function abortGame() { gen++; currentGame = null; $('#screen').classList.remove('alarm'); }
  async function runGame(g) {
    abortGame(); const myGen = gen; currentGame = g;
    if (S.ambiance === 'mix') S.mixApero = Math.random() < 0.5;
    R.aborted = () => gen !== myGen;
    try { await g.run(R, g); } catch (e) { if (!(e instanceof Aborted)) { console.error(e); alert('Oups : ' + e.message); } return; }
    if (gen !== myGen) return;
    S.lastGame = g.id; S.setsPlayed++; save();
    endSet(g);
  }
  function endSet(g) {
    const order = [0, 1, 2].slice().sort((a, b) => S.scores[b] - S.scores[a]);
    const lead = S.scores[order[0]] > S.scores[order[1]] ? `${esc(P(order[0]))} mène avec ${S.scores[order[0]]} pts` : 'Égalité en tête. Tendu.';
    const next = pickRandom(S.ambiance, g.id);
    render(topbar(g.name) + `<div class="sc centered"><div class="px xl" style="color:${g.color}">FIN DU SET</div><div class="muted">${lead}</div><div class="instr">${esc(rnd(D.taunts.home))}</div></div>
      <div class="tvbtns">
        <button class="btn primary big" data-game="${next.id}">🎲 AU HASARD : ${esc(next.name)}</button>
        <button class="btn" data-game="${g.id}">🔁 ENCORE ${esc(g.name)}</button>
        <button class="btn ghost" data-act="home">🕹️ CHOISIR À LA BORNE</button>
        <button class="btn ghost" data-act="podium">🏆 PODIUM</button>
      </div>`, 'endset');
    SFX.fanfare();
  }

  /* ============================================================
     BORNE, SETUP, AMBIANCE
     ============================================================ */
  function home() {
    abortGame();
    const a = amb();
    const games = available(S.ambiance);
    const byCat = {}; games.forEach(g => (byCat[g.cat] = byCat[g.cat] || []).push(g));
    render(`<div class="pixelbar"></div>
      <h1 class="title mt">PETIT<br><span class="neon">JUEGO</span></h1>
      <div class="sub">${esc(rnd(D.taunts.home))}</div>
      ${scoreline()}
      <button class="ambiance" data-act="ambiance"><span class="ico">${a.icon}</span><span><div class="an" style="color:${a.color}">SOIRÉE ${esc(a.name)}</div><div class="ad">${esc(a.desc)} · changer</div></span></button>
      <button class="btn yellow big" data-act="random">🎲 UN JEU AU HASARD</button>
      ${Object.keys(CATS).filter(c => byCat[c]).map(c => `<div class="catname">${CATS[c].icon} ${CATS[c].name}</div><div class="games">${byCat[c].map(g => `<button class="gcard ${g.cat === 'glisse' ? 'glisse' : 'g' + (g.n % 5)}" data-game="${g.id}"><span class="ico">${g.icon}</span><span><div class="gt">${esc(g.name)}</div><div class="gd">${esc(g.desc)}</div></span><span class="num">${String(g.n).padStart(2, '0')}</span></button>`).join('')}</div>`).join('')}
      <div class="hr"></div>
      <div class="row">
        <button class="btn ghost" data-act="podium">🏆 PODIUM</button>
        <button class="btn ghost" data-act="custom">✏️ NOS QUESTIONS</button>
        <button class="btn ghost" data-act="settings">⚙️</button>
      </div>
      <button class="btn ghost" data-act="newNight">👥 NOUVELLE SOIRÉE (autres joueurs)</button>
      <div class="coin blink mt">INSERT COIN ▸ CHOISIS UN JEU</div>
      <div class="credits">© ske-media arcade · ${S.stats.rounds} manche${S.stats.rounds > 1 ? 's' : ''} · ${S.setsPlayed} set${S.setsPlayed > 1 ? 's' : ''}</div>`, 'home');
  }
  function setup() {
    abortGame();
    render(`<div class="pixelbar"></div>
      <h1 class="title mt">QUI<br><span class="neon">JOUE ?</span></h1>
      <div class="sub">Trois joueurs, un téléphone qu'on se passe.<br>Entrez vos prénoms dans l'ordre où vous êtes assis.</div>
      <div class="stack mt">${[0, 1, 2].map(i => `<div class="row">${avatar(i, 'big')}<input type="text" id="pn${i}" maxlength="12" placeholder="Prénom du joueur ${i + 1}" value="${esc(S.players[i] || '')}" autocomplete="off" autocapitalize="words"></div>`).join('')}</div>
      <div class="grow"></div>
      <button class="btn yellow big" data-act="startNight">SUIVANT ▶</button>`, 'setup');
    setTimeout(() => { const f = $('#pn0'); if (f && !f.value) f.focus(); }, 150);
  }
  function ambianceScreen(first) {
    render(`<div class="pixelbar"></div>
      <h1 class="title mt">QUELLE<br><span class="neon">SOIRÉE ?</span></h1>
      <div class="sub">Ça change les questions, les jeux proposés, et ce qui arrive aux perdants.</div>
      <div class="stack mt">${Object.keys(D.ambiances).map(k => { const a = D.ambiances[k]; return `<button class="ambiance ${S.ambiance === k ? 'sel' : ''}" data-amb="${k}"><span class="ico">${a.icon}</span><span><div class="an" style="color:${a.color}">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div></span></button>`; }).join('')}</div>
      <div class="coin mt">🍻 apéro : celui qui perd boit · 🌶️ ça glisse : questions épicées · 🎲 mix : les deux, au hasard</div>
      ${first ? '' : '<button class="btn ghost mt" data-act="home">annuler</button>'}`, 'ambiance');
    $$('[data-amb]').forEach(b => b.onclick = () => { S.ambiance = b.dataset.amb; save(); SFX.fanfare(); setTimeout(home, 250); });
  }

  /* ============================================================
     PODIUM, NOS QUESTIONS, RÉGLAGES
     ============================================================ */
  function podium() {
    abortGame();
    const order = [0, 1, 2].slice().sort((a, b) => S.scores[b] - S.scores[a]), st = S.stats, awards = [];
    D.titles.forEach(t => { const arr = st[t.key]; if (!arr) return; const total = arr.reduce((a, b) => a + b, 0); if (!total) return; const val = t.mode === 'max' ? Math.max(...arr) : Math.min(...arr); const who = [0, 1, 2].filter(i => arr[i] === val); if (who.length === 1) awards.push({ t, who: who[0] }); });
    SFX.fanfare();
    render(topbar('PODIUM') + `<div class="px xl center" style="color:var(--yellow)">🏆 PODIUM</div>
      <div class="podium">${[{ i: order[1], c: 'second', n: 2 }, { i: order[0], c: 'first', n: 1 }, { i: order[2], c: 'third', n: 3 }].map(s => `<div class="step ${s.c}">${avatar(s.i, s.n === 1 ? 'bounce' : '')}<div class="nm c${s.i}">${esc(P(s.i))}</div><div class="total">${S.scores[s.i]} pts</div><div class="box">${s.n}</div></div>`).join('')}</div>
      <div class="label center mt">TITRES DE LA SOIRÉE</div>
      ${awards.length ? `<div class="awards">${awards.map(a => `<div class="award"><span class="ico">${a.t.icon}</span><span><div class="nm">${esc(a.t.name)}</div><div class="ds">${esc(a.t.desc)}</div></span>${avatar(a.who)}</div>`).join('')}</div>` : '<div class="muted center">Jouez quelques manches pour débloquer des titres.</div>'}
      <div class="coin mt">${st.rounds} manche${st.rounds > 1 ? 's' : ''} jouée${st.rounds > 1 ? 's' : ''}</div>
      <div class="grow"></div>
      <button class="btn ghost" data-act="newNight">👥 NOUVELLE SOIRÉE (joueurs et scores à zéro)</button>
      <button class="btn primary" data-act="home">RETOUR BORNE</button>`, 'podium');
  }
  let customTab = 'qui';
  const TABS = { qui: 'QUI DE NOUS', cinq: '5 SECONDES', tete: 'DANS LA TÊTE', prefere: 'TU PRÉFÈRES' };
  const HINTS = { qui: 'Ex : Qui de nous a déjà pleuré devant Pékin Express ?', cinq: 'Ex : 3 surnoms qu\'on donne au plus petit du groupe', tete: 'Utilise {P} pour le prénom. Ex : Le pire achat de {P} ?', prefere: 'Sépare A et B par une barre |. Ex : Un mois sans sucre | Un mois sans sel' };
  function custom() {
    abortGame();
    const list = S.custom[customTab];
    render(topbar('NOS QUESTIONS') + `<div class="muted">Vos private jokes, c'est là que ça devient drôle. Tout reste sur ce téléphone.</div>
      <div class="row wrap">${Object.keys(TABS).map(k => `<button class="chip ${k === customTab ? 'on' : ''}" data-tab="${k}">${TABS[k]} (${S.custom[k].length})</button>`).join('')}</div>
      <div class="field"><input type="text" id="cq" maxlength="140" placeholder="${esc(HINTS[customTab])}" autocomplete="off"><button class="btn primary" id="cadd">AJOUTER</button></div>
      <div class="list">${list.length ? list.map((q, i) => `<div class="it"><span>${esc(q)}</span><button class="del" data-del="${i}">✕</button></div>`).join('') : '<div class="muted center">Rien pour l\'instant.</div>'}</div>`, 'custom');
    $$('[data-tab]').forEach(b => b.onclick = () => { customTab = b.dataset.tab; SFX.blip(); custom(); });
    $$('[data-del]').forEach(b => b.onclick = () => { S.custom[customTab].splice(+b.dataset.del, 1); save(); SFX.back(); custom(); });
    const add = () => { const v = $('#cq').value.trim(); if (!v) return shake(); if (customTab === 'prefere' && v.split('|').length !== 2) { shake(); SFX.fail(); $('#cq').placeholder = 'Il faut une barre | entre A et B'; return; } S.custom[customTab].push(v); save(); SFX.coin(); custom(); };
    $('#cadd').onclick = add; $('#cq').onkeydown = e => { if (e.key === 'Enter') add(); };
  }
  function settings() {
    abortGame();
    render(topbar('RÉGLAGES') + `
      <div class="label">JOUEURS</div>
      ${[0, 1, 2].map(i => `<div class="row">${avatar(i)}<input type="text" id="pn${i}" maxlength="12" value="${esc(S.players[i] || '')}" autocomplete="off"></div>`).join('')}
      <button class="btn primary" id="savenames">ENREGISTRER LES NOMS</button>
      <div class="hr"></div>
      <div class="toggle"><span class="px sm">SON</span><button class="sw ${S.sound ? 'on' : ''}" id="swsound">${S.sound ? 'ON' : 'OFF'}</button></div>
      <div class="toggle"><span class="px sm">AMBIANCE ${amb().icon}</span><button class="sw on" data-act="ambiance">CHANGER</button></div>
      <div class="toggle"><span class="px sm">QUESTIONS 🌶️ EN MODE SOFT</span><button class="sw ${S.hot ? 'on' : ''}" id="swhot">${S.hot ? 'ON' : 'OFF'}</button></div>
      <div class="hr"></div>
      <button class="btn ghost" id="rused">♻️ REMETTRE TOUTES LES QUESTIONS DANS LE STOCK</button>
      <button class="btn ghost" data-act="newNight">👥 NOUVELLE SOIRÉE</button>
      <button class="btn ghost" id="rall" style="color:var(--red)">💣 TOUT EFFACER (y compris nos questions)</button>
      <div class="credits mt">PETIT JUEGO · fait maison, zéro serveur, zéro tracking.<br>Tout est dans ce téléphone.</div>`, 'settings');
    $('#savenames').onclick = () => { [0, 1, 2].forEach(i => { const v = $('#pn' + i).value.trim(); if (v) S.players[i] = v; }); save(); SFX.coin(); home(); };
    $('#swsound').onclick = () => { S.sound = !S.sound; SFX.setOn(S.sound); save(); settings(); };
    $('#swhot').onclick = () => { S.hot = !S.hot; save(); SFX.coin(); settings(); };
    $('#rused').onclick = () => { S.used = {}; save(); SFX.coin(); settings(); };
    $('#rall').onclick = () => { if (!confirm('Tout effacer, vraiment tout ?')) return; localStorage.removeItem(LS); S = defaultState(); Object.assign(R, { S }); SFX.ko(); setup(); };
  }

  /* ============================================================
     ACTIONS GLOBALES
     ============================================================ */
  const ACT = {
    home: () => { SFX.back(); home(); },
    podium, custom, settings,
    ambiance: () => { SFX.select(); ambianceScreen(false); },
    random: () => { const g = pickRandom(S.ambiance, S.lastGame); SFX.coin(); runGame(g); },
    toggleSound: () => { S.sound = !S.sound; SFX.setOn(S.sound); save(); SFX.blip(); const b = $('[data-act=toggleSound]'); if (b) b.textContent = S.sound ? '♪' : '✕'; },
    startNight: () => {
      const names = [0, 1, 2].map(i => $('#pn' + i).value.trim());
      if (names.some(n => !n)) { shake(); SFX.fail(); return; }
      if (new Set(names.map(n => n.toLowerCase())).size !== 3) { shake(); SFX.fail(); $('#pn0').placeholder = 'Deux prénoms identiques…'; return; }
      const d = defaultState(); S.players = names; S.scores = d.scores; S.stats = d.stats; S.turn = d.turn; S.lastGame = null; S.setsPlayed = 0; save();
      SFX.coin(); ambianceScreen(true);
    },
    newNight: () => { if (!confirm('Nouvelle soirée ? Les joueurs, les scores et les titres repartent de zéro.')) return; SFX.coin(); setup(); },
    boot: () => { SFX.coin(); setTimeout(() => (namesSet() && S.ambiance) ? home() : setup(), 120); }
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act], [data-game]');
    if (!el) return;
    SFX.ac();
    if (el.dataset.game) { const g = GAMES.find(x => x.id === el.dataset.game); if (g) { SFX.select(); runGame(g); } return; }
    const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !document.activeElement || document.activeElement.tagName !== 'INPUT') return;
    const btn = $('[data-act=startNight], #savenames'); if (btn && (screenName === 'setup' || screenName === 'settings')) { e.preventDefault(); btn.click(); }
  });

  /* ---------- allumage ---------- */
  render(`<div class="handoff">
    <div class="pixelbar" style="width:100%"></div>
    <h1 class="title">PETIT<br><span class="neon">JUEGO</span></h1>
    <div class="players3">${[0, 1, 2].map(i => avatar(i, 'big bounce', `style="animation-delay:${i * .15}s"`)).join('')}</div>
    <div class="muted">${namesSet() ? esc(P(0)) + ' · ' + esc(P(1)) + ' · ' + esc(P(2)) : 'Un téléphone, trois joueurs, zéro mensonge (ou presque).'}</div>
    <button class="btn yellow big blink" data-act="boot">PRESS START</button>
    <div class="coin">3 JOUEURS · 1 TÉLÉPHONE · ${GAMES.length} JEUX</div>
  </div>`, 'boot');
})();

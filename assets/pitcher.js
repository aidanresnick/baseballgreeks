// Pitcher page: search + one spacious player card per pitch type (chips to
// switch), with axed stuff curves and a season-history line.
(async () => {
  const SHARDS_CACHE = {};
  const meta = await getJSON('data/meta.json');
  const CG = meta.curve_grid || { start: -3, step: 0.5, n: 13 };
  const index = await getJSON('data/players_index.json'); // [[name, id, shard], ...]
  const byId = new Map(index.map(e => [e[1], e]));

  const input = document.getElementById('psearch');
  const sug = document.getElementById('suggest');
  let sel = -1, matches = [];

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    sel = -1;
    if (q.length < 2) { sug.classList.remove('open'); return; }
    matches = index.filter(e => e[0].toLowerCase().includes(q)).slice(0, 12);
    sug.innerHTML = matches.map((e, i) => `<div data-i="${i}">${e[0]}</div>`).join('');
    sug.classList.toggle('open', matches.length > 0);
    sug.querySelectorAll('div').forEach(d => {
      d.onclick = () => pick(matches[+d.dataset.i]);
    });
  };
  input.onkeydown = e => {
    if (!sug.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, matches.length - 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); mark(); e.preventDefault(); }
    else if (e.key === 'Enter' && sel >= 0) { pick(matches[sel]); e.preventDefault(); }
    else if (e.key === 'Escape') sug.classList.remove('open');
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) sug.classList.remove('open');
  });
  function mark() {
    sug.querySelectorAll('div').forEach((d, i) => d.classList.toggle('sel', i === sel));
  }
  function pick(entry) {
    sug.classList.remove('open');
    input.value = entry[0];
    history.replaceState(null, '', `?id=${entry[1]}`);
    show(entry[1]);
  }

  async function playerData(id) {
    const entry = byId.get(id);
    if (!entry) return null;
    const shard = entry[2];
    if (!SHARDS_CACHE[shard]) SHARDS_CACHE[shard] = await getJSON(`data/players/${shard}.json`);
    return SHARDS_CACHE[shard][id] || null;
  }

  // nice round tick values covering [lo, hi]
  function ticks(lo, hi, target) {
    const span = hi - lo;
    const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
    const step = steps.find(s => span / s <= target) || 10;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
      out.push(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(2));
    return out;
  }

  // stuff-vs-input curve with full axes: y ticks in zStuff, x ticks in the
  // input's natural units, marker at the pitcher's operating point.
  function curveChart(pt, title, xtitle, centerX, decimals, ys, yLo, yHi) {
    const W = 400, H = 230, PL = 46, PR = 14, PTOP = 30, PB = 44;
    const color = ptColor(pt);
    const xs = ys.map((_, i) => centerX + CG.start + CG.step * i);
    const x = i => PL + (W - PL - PR) * i / (ys.length - 1);
    const xv = v => PL + (W - PL - PR) * (v - xs[0]) / (xs[xs.length - 1] - xs[0]);
    const y = v => PTOP + (H - PTOP - PB) * (1 - (v - yLo) / (yHi - yLo));
    const ci = Math.round(-CG.start / CG.step);
    const path = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

    const grid = ticks(yLo, yHi, 4).map(v =>
      `<line x1="${PL}" x2="${W - PR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
         stroke="${v === 0 ? 'var(--baseline)' : 'var(--grid)'}" stroke-width="1"/>
       <text x="${PL - 7}" y="${(y(v) + 3.5).toFixed(1)}" fill="var(--muted)"
         font-size="10.5" text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`).join('');

    const xticks = [xs[0], xs[3], xs[ci], xs[9], xs[12]].map(v =>
      `<line x1="${xv(v).toFixed(1)}" x2="${xv(v).toFixed(1)}" y1="${H - PB}" y2="${H - PB + 4}"
         stroke="var(--baseline)" stroke-width="1"/>
       <text x="${xv(v).toFixed(1)}" y="${H - PB + 16}" fill="var(--muted)" font-size="10.5"
         text-anchor="middle">${v.toFixed(decimals)}</text>`).join('');

    const hover = ys.map((v, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="10" fill="transparent"
        class="curvept" data-x="${xs[i].toFixed(decimals)} ${xtitle}" data-z="${v.toFixed(2)}"/>`).join('');

    return `<div class="curve"><svg viewBox="0 0 ${W} ${H}">
      <text x="${PL}" y="15" fill="var(--ink-2)" font-size="12.5" font-weight="600">${title}</text>
      <text x="${PL - 32}" y="${PTOP - 6}" fill="var(--muted)" font-size="10">zStuff</text>
      ${grid}
      <line x1="${PL}" x2="${W - PR}" y1="${H - PB}" y2="${H - PB}" stroke="var(--baseline)" stroke-width="1"/>
      ${xticks}
      <text x="${(PL + W - PR) / 2}" y="${H - 8}" fill="var(--muted)" font-size="11"
        text-anchor="middle">${xtitle}</text>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(ci).toFixed(1)}" cy="${y(ys[ci]).toFixed(1)}" r="5"
              fill="${color}" stroke="var(--surface-2)" stroke-width="2"/>
      ${hover}
    </svg></div>`;
  }

  // season history with year axis and per-point value labels
  function historyChart(pt, series) {
    const W = 1160, H = 160, PL = 46, PR = 24, PTOP = 26, PB = 30;
    const color = ptColor(pt);
    const zs = series.map(s => s.z);
    const lo = Math.min(-0.5, ...zs) - 0.25, hi = Math.max(0.5, ...zs) + 0.25;
    const x = i => PL + (W - PL - PR) * (series.length === 1 ? 0.5 : i / (series.length - 1));
    const y = z => PTOP + (H - PTOP - PB) * (1 - (z - lo) / (hi - lo));
    const path = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.z).toFixed(1)}`).join('');
    const grid = ticks(lo, hi, 3).map(v =>
      `<line x1="${PL}" x2="${W - PR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
         stroke="${v === 0 ? 'var(--baseline)' : 'var(--grid)'}" stroke-width="1"/>
       <text x="${PL - 7}" y="${(y(v) + 3.5).toFixed(1)}" fill="var(--muted)" font-size="10.5"
         text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`).join('');
    return `<div class="history"><svg viewBox="0 0 ${W} ${H}">
      <text x="${PL}" y="14" fill="var(--ink-2)" font-size="12.5" font-weight="600">zStuff by Season</text>
      ${grid}
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
      ${series.map((s, i) => `
        <circle cx="${x(i).toFixed(1)}" cy="${y(s.z).toFixed(1)}" r="5" fill="${color}"
          stroke="var(--surface-2)" stroke-width="2"
          data-year="${s.year}" data-z="${s.z}" data-n="${s.n}"/>
        <text x="${x(i).toFixed(1)}" y="${H - 8}" fill="var(--muted)" font-size="10.5"
          text-anchor="middle">${s.year}</text>
        <text x="${x(i).toFixed(1)}" y="${(y(s.z) - 11).toFixed(1)}" fill="var(--ink-2)"
          font-size="11" font-weight="600" text-anchor="middle">${fmtZ(s.z)}</text>`).join('')}
    </svg></div>`;
  }

  let PLAYER = null;

  function renderCard(pt) {
    const seasons = Object.keys(PLAYER.pts[pt]).sort();
    const series = seasons.map(yr => {
      const r = PLAYER.pts[pt][yr];
      return { year: yr, n: r[ROW.N], z: r[ROW.Z], velo: r[ROW.VELO],
               d: r[ROW.D], g: r[ROW.G], ivb: r[ROW.IVB], vz: r[ROW.VZ],
               hb: r[ROW.HB], vx: r[ROW.VX],
               crvV: r[ROW.CV], crvZ: r[ROW.CZ], crvX: r[ROW.CX] };
    });
    const cur = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const d = prev ? cur.z - prev.z : null;
    const deltaHtml = d === null ? ''
      : `<div class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${fmtZ(d)} vs ${prev.year}</div>`;

    let curvesHtml = '';
    if (cur.crvV) {
      const all = [...cur.crvV, ...cur.crvZ, ...cur.crvX, 0];
      const yLo = Math.min(...all) - 0.2, yHi = Math.max(...all) + 0.2;
      curvesHtml = `<div class="curves">
        ${curveChart(pt, 'Stuff vs Velocity', 'mph', cur.velo, 1, cur.crvV, yLo, yHi)}
        ${curveChart(pt, 'Stuff vs IVB', 'inches', cur.ivb, 1, cur.crvZ, yLo, yHi)}
        ${curveChart(pt, 'Stuff vs HB', 'inches', cur.hb, 1, cur.crvX, yLo, yHi)}
      </div>`;
    }

    document.getElementById('card').innerHTML = `<div class="ptcard" style="--pt:${ptColor(pt)}">
      <div class="cardtop">
        <div>
          <div class="cardname">${PLAYER.name}</div>
          <div class="cardsub">
            <span class="ptchip"><span class="dot"></span>${PT_NAMES[pt]}</span>
            <span class="season">${cur.year} &middot; ${fmtN(cur.n)} pitches &middot;
              ${cur.velo.toFixed(1)} mph &middot; IVB ${cur.ivb.toFixed(1)}&Prime; &middot;
              HB ${cur.hb.toFixed(1)}&Prime;</span>
          </div>
        </div>
        <div class="cardbrand"><span class="delta">Δ</span> Baseball Greeks
          <div class="site">baseballgreeks.com</div></div>
      </div>
      <div class="tiles">
        <div class="tile"><div class="lbl">zStuff</div>
          <div class="val">${fmtZ(cur.z)}</div>${deltaHtml}</div>
        <div class="tile"><div class="lbl">Delta</div>
          <div class="val">${fmtG(cur.d)}</div><div class="delta">per +1 mph</div></div>
        <div class="tile"><div class="lbl">Gamma</div>
          <div class="val">${fmtG(cur.g)}</div><div class="delta">per +1 mph&sup2;</div></div>
        <div class="tile"><div class="lbl">Vega-Z</div>
          <div class="val">${fmtG(cur.vz)}</div><div class="delta">per +1 in IVB</div></div>
        <div class="tile"><div class="lbl">Vega-X</div>
          <div class="val">${fmtG(cur.vx)}</div><div class="delta">per +1 in HB</div></div>
      </div>
      ${curvesHtml}
      ${series.length > 1 ? historyChart(pt, series) : ''}
    </div>`;

    document.querySelectorAll('#pttabs button').forEach(b =>
      b.classList.toggle('on', b.dataset.pt === pt));

    document.querySelectorAll('#card circle[data-year]').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `<b>${c.dataset.year}</b> &middot; zStuff ${fmtZ(+c.dataset.z)} &middot; ${fmtN(+c.dataset.n)} pitches`,
        e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
    document.querySelectorAll('#card circle.curvept').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `${c.dataset.x} &rarr; zStuff ${fmtZ(+c.dataset.z)}`, e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
  }

  async function show(id) {
    const p = await playerData(id);
    const box = document.getElementById('player');
    if (!p) { box.innerHTML = '<div class="empty">Pitcher not found.</div>'; return; }
    PLAYER = p;

    const pts = PT_ORDER.filter(pt => p.pts[pt]);
    const latestN = pt => {
      const yrs = Object.keys(p.pts[pt]).sort();
      return p.pts[pt][yrs[yrs.length - 1]][ROW.N];
    };
    const defaultPt = [...pts].sort((a, b) => latestN(b) - latestN(a))[0];
    const allYears = [...new Set(pts.flatMap(pt => Object.keys(p.pts[pt])))].sort();

    box.innerHTML = `
      <div class="player-head"><h2>${p.name}</h2>
        <div class="meta">${allYears[0]}–${allYears[allYears.length - 1]}</div></div>
      <div class="seg pttabs" id="pttabs">
        ${pts.map(pt => `<button data-pt="${pt}" style="--pt:${ptColor(pt)}" title="${PT_NAMES[pt]}">
          <span class="dot"></span>${PT_NAMES[pt]}</button>`).join('')}
      </div>
      <div id="card"></div>`;

    document.querySelectorAll('#pttabs button').forEach(b => {
      b.onclick = () => renderCard(b.dataset.pt);
    });
    renderCard(defaultPt);
  }

  const id = new URLSearchParams(location.search).get('id');
  if (id && byId.has(+id)) {
    input.value = byId.get(+id)[0];
    show(+id);
  }
})();

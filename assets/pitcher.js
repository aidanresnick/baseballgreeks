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

  function cardHTML(pt) {
    const seasons = Object.keys(PLAYER.pts[pt]).sort();
    const series = seasons.map(yr => {
      const r = PLAYER.pts[pt][yr];
      return { year: yr, n: r[ROW.N], z: r[ROW.Z], velo: r[ROW.VELO],
               d: r[ROW.D], g: r[ROW.G], ivb: r[ROW.IVB], vz: r[ROW.VZ],
               hb: r[ROW.HB], vx: r[ROW.VX],
               crvV: r[ROW.CV], crvZ: r[ROW.CZ], crvX: r[ROW.CX] };
    });
    let si = seasons.indexOf(SEASON);
    if (si < 0) si = series.length - 1;
    const cur = series[si];
    const prev = si > 0 ? series[si - 1] : null;
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

    return `<div class="ptcard" style="--pt:${ptColor(pt)}">
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
          <div class="site">baseballgreeks.com</div>
          <button class="dlbtn card-dl no-export" title="Download card as PNG">⤓ PNG</button></div>
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
  }

  function bindCardIn(root, pt) {
    const dl = root.querySelector('.card-dl');
    if (dl) dl.onclick = e => {
      e.stopPropagation();
      downloadCard(root.querySelector('.ptcard'),
        `${slug(PLAYER.name)}-${pt.toLowerCase()}-${SEASON}.png`, false);
    };
    root.querySelectorAll('circle[data-year]').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `<b>${c.dataset.year}</b> &middot; zStuff ${fmtZ(+c.dataset.z)} &middot; ${fmtN(+c.dataset.n)} pitches`,
        e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
    root.querySelectorAll('circle.curvept').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `${c.dataset.x} &rarr; zStuff ${fmtZ(+c.dataset.z)}`, e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
  }

  function toggleRow(tr, pt) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('expandrow')) {
      next.remove();
      tr.classList.remove('open');
      return;
    }
    const er = document.createElement('tr');
    er.className = 'expandrow';
    er.innerHTML = `<td colspan="8">${cardHTML(pt)}</td>`;
    tr.after(er);
    tr.classList.add('open');
    bindCardIn(er, pt);
  }

  const ALLBOARD = {};
  async function overallRow(id, year) {
    if (!ALLBOARD[year]) ALLBOARD[year] = await getJSON(`data/lb_ALL_${year}.json`);
    return ALLBOARD[year].find(r => r[1] === id) || null;
  }

  let SEASON = null, PLAYER_ID = null;

  async function renderSeason(year) {
    SEASON = year;
    const p = PLAYER;
    const pts = PT_ORDER.filter(pt => p.pts[pt] && p.pts[pt][year]);
    const cur = pts
      .map(pt => ({ pt, r: p.pts[pt][year] }))
      .sort((a, b) => b.r[ROW.N] - a.r[ROW.N]);
    const ov = await overallRow(PLAYER_ID, year);
    const ovHtml = ov
      ? `<div class="ovline"><span class="ovz">${fmtZ(ov[3])}</span> overall zStuff
         &middot; ${fmtN(ov[2])} pitches &middot; ${year}</div>`
      : `<div class="ovline">${year}</div>`;

    document.getElementById('season-block').innerHTML = `
      <div class="ptcard summary" style="--pt:var(--accent)">
        <div class="cardtop">
          <div>
            <div class="cardname">${p.name}</div>
            ${ovHtml}
          </div>
          <div class="cardbrand"><span class="delta">Δ</span> Baseball Greeks
            <div class="site">baseballgreeks.com</div>
            <button class="dlbtn no-export" id="dl-summary" title="Download card as PNG">⤓ PNG</button></div>
        </div>
        <div class="tablewrap"><table class="sumtab">
          <thead><tr>
            <th class="l">Pitch</th><th>Pitches</th><th>Velo</th><th>zStuff</th>
            <th class="grp">Delta</th><th>Gamma</th><th>Vega-Z</th><th>Vega-X</th>
          </tr></thead>
          <tbody>
            ${cur.map(({ pt, r }) => `<tr data-pt="${pt}">
              <td class="l"><span class="caret no-export">▸</span><span class="ptchip" style="--pt:${ptColor(pt)}">
                <span class="dot"></span>${PT_NAMES[pt]}</span></td>
              <td>${fmtN(r[ROW.N])}</td>
              <td>${r[ROW.VELO].toFixed(1)}</td>
              <td class="z">${fmtZ(r[ROW.Z])}</td>
              <td class="grp">${fmtG(r[ROW.D])}</td>
              <td>${fmtG(r[ROW.G])}</td>
              <td>${fmtG(r[ROW.VZ])}</td>
              <td>${fmtG(r[ROW.VX])}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;

    document.querySelectorAll('.sumtab tbody tr[data-pt]').forEach(tr => {
      tr.onclick = () => toggleRow(tr, tr.dataset.pt);
    });
    const dlS = document.getElementById('dl-summary');
    if (dlS) dlS.onclick = e => {
      e.stopPropagation();
      downloadCard(document.querySelector('.ptcard.summary'),
        `${slug(PLAYER.name)}-${SEASON}-arsenal.png`,
        new URLSearchParams(location.search).has('dltest'));
    };
    if (dlS && new URLSearchParams(location.search).has('dltest'))
      setTimeout(() => dlS.onclick(new Event('click')), 800);
    const first = document.querySelector('.sumtab tbody tr[data-pt]');
    if (first) toggleRow(first, first.dataset.pt);
  }

  async function show(id) {
    const p = await playerData(id);
    const box = document.getElementById('player');
    if (!p) { box.innerHTML = '<div class="empty">Pitcher not found.</div>'; return; }
    PLAYER = p;
    PLAYER_ID = id;

    const pts = PT_ORDER.filter(pt => p.pts[pt]);
    const allYears = [...new Set(pts.flatMap(pt => Object.keys(p.pts[pt])))].sort();
    const latestYear = allYears[allYears.length - 1];

    box.innerHTML = `
      <div class="player-head headrow">
        <div><h2>${p.name}</h2>
          <div class="meta">${allYears[0]}–${latestYear}</div></div>
        <select id="pseason" aria-label="Season">
          ${[...allYears].reverse().map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
      </div>
      <div id="season-block"></div>`;

    document.getElementById('pseason').onchange = e => renderSeason(e.target.value);
    renderSeason(latestYear);
  }

  const id = new URLSearchParams(location.search).get('id');
  if (id && byId.has(+id)) {
    input.value = byId.get(+id)[0];
    show(+id);
  }
})();

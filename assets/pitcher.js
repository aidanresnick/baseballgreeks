// Pitcher page: search + player cards (stat tiles, stuff curves, per-season sparkline).
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

  function sparkline(pt, years, series) {
    // single series: no legend; 2px line, 8px end marker with 2px surface ring
    const W = 560, H = 84, PX = 26, PY = 12;
    const zs = series.map(s => s.z);
    const lo = Math.min(-0.5, ...zs), hi = Math.max(0.5, ...zs);
    const x = i => PX + (W - PX - 74) * (years.length === 1 ? 0.5 : i / (years.length - 1));
    const y = z => PY + (H - 2 * PY) * (1 - (z - lo) / (hi - lo));
    const color = ptColor(pt);
    const pts = series.map(s => ({ cx: x(years.indexOf(s.year)), cy: y(s.z), ...s }));
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('');
    const zeroY = (0 >= lo && 0 <= hi) ? y(0) : null;
    const last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-pt="${pt}">
      ${zeroY !== null ? `<line x1="${PX}" x2="${W - PX}" y1="${zeroY}" y2="${zeroY}"
         stroke="var(--baseline)" stroke-width="1"/>` : ''}
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${p.cx.toFixed(1)}" cy="${p.cy.toFixed(1)}" r="4.5"
          fill="${color}" stroke="var(--surface)" stroke-width="2"
          data-year="${p.year}" data-z="${p.z}" data-n="${p.n}"/>`).join('')}
      <text x="${last.cx + 8}" y="${last.cy + 4}" fill="var(--ink-2)"
            font-size="12" font-weight="600">${fmtZ(last.z)}</text>
      <text x="${PX - 4}" y="${y(pts[0].z) + 4}" fill="var(--muted)" font-size="11"
            text-anchor="end">${series[0].year}</text>
    </svg>`;
  }

  // one stuff-vs-input curve: single series in the PT hue, marker at the
  // pitcher's operating point, hairline at league-average stuff (z = 0).
  function curveChart(pt, title, centerX, decimals, unit, ys, yLo, yHi) {
    const W = 320, H = 140, PL = 34, PR = 12, PT_ = 22, PB = 24;
    const color = ptColor(pt);
    const xs = ys.map((_, i) => centerX + CG.start + CG.step * i);
    const x = i => PL + (W - PL - PR) * i / (ys.length - 1);
    const y = v => PT_ + (H - PT_ - PB) * (1 - (v - yLo) / (yHi - yLo));
    const ci = Math.round(-CG.start / CG.step); // operating-point index
    const path = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const zeroLine = (0 >= yLo && 0 <= yHi)
      ? `<line x1="${PL}" x2="${W - PR}" y1="${y(0)}" y2="${y(0)}" stroke="var(--grid)" stroke-width="1"/>
         <text x="${PL - 5}" y="${y(0) + 3.5}" fill="var(--muted)" font-size="10" text-anchor="end">0</text>` : '';
    const hover = ys.map((v, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="9" fill="transparent"
        class="curvept" data-x="${xs[i].toFixed(decimals)}${unit}" data-z="${v.toFixed(2)}"/>`).join('');
    return `<div class="curve"><svg viewBox="0 0 ${W} ${H}">
      <text x="${PL}" y="12" fill="var(--muted)" font-size="11" font-weight="600">${title}</text>
      ${zeroLine}
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(ci).toFixed(1)}" cy="${y(ys[ci]).toFixed(1)}" r="4.5"
              fill="${color}" stroke="var(--surface)" stroke-width="2"/>
      ${hover}
      <text x="${PL}" y="${H - 6}" fill="var(--muted)" font-size="10">${xs[0].toFixed(decimals)}</text>
      <text x="${(PL + W - PR) / 2}" y="${H - 6}" fill="var(--muted)" font-size="10"
            text-anchor="middle">${xs[ci].toFixed(decimals)}${unit}</text>
      <text x="${W - PR}" y="${H - 6}" fill="var(--muted)" font-size="10"
            text-anchor="end">${xs[xs.length - 1].toFixed(decimals)}</text>
    </svg></div>`;
  }

  async function show(id) {
    const p = await playerData(id);
    const box = document.getElementById('player');
    if (!p) { box.innerHTML = '<div class="empty">Pitcher not found.</div>'; return; }

    const pts = PT_ORDER.filter(pt => p.pts[pt]);
    const allYears = [...new Set(pts.flatMap(pt => Object.keys(p.pts[pt])))].sort();
    const span = `${allYears[0]}–${allYears[allYears.length - 1]}`;

    let html = `<div class="player-head"><h2>${p.name}</h2>
      <div class="meta">${span} &middot; ${pts.map(pt => PT_NAMES[pt]).join(', ')}</div></div>`;

    for (const pt of pts) {
      const seasons = Object.keys(p.pts[pt]).sort();
      const series = seasons.map(yr => {
        const r = p.pts[pt][yr];
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

      html += `<div class="ptcard" style="--pt:${ptColor(pt)}">
        <div class="cardtop">
          <div>
            <div class="cardname">${p.name}</div>
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
            <div class="val">${fmtG(cur.vz)}</div><div class="delta">per +1 in</div></div>
          <div class="tile"><div class="lbl">Vega-X</div>
            <div class="val">${fmtG(cur.vx)}</div><div class="delta">per +1 in</div></div>
        </div>
        ${(() => {
          if (!cur.crvV) return '';
          const all = [...cur.crvV, ...cur.crvZ, ...cur.crvX, 0];
          const yLo = Math.min(...all) - 0.15, yHi = Math.max(...all) + 0.15;
          return `<div class="curves">
            ${curveChart(pt, 'Stuff vs Velo', cur.velo, 1, ' mph', cur.crvV, yLo, yHi)}
            ${curveChart(pt, 'Stuff vs IVB', cur.ivb, 1, '″', cur.crvZ, yLo, yHi)}
            ${curveChart(pt, 'Stuff vs HB', cur.hb, 1, '″', cur.crvX, yLo, yHi)}
          </div>`;
        })()}
        ${series.length > 1 ? `<div class="spark">${sparkline(pt, seasons, series)}</div>` : ''}
      </div>`;
    }
    box.innerHTML = html;

    box.querySelectorAll('circle[data-year]').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `<b>${c.dataset.year}</b> &middot; zStuff ${fmtZ(+c.dataset.z)} &middot; ${fmtN(+c.dataset.n)} pitches`,
        e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
    box.querySelectorAll('circle.curvept').forEach(c => {
      c.addEventListener('mousemove', e => showTip(
        `${c.dataset.x} &rarr; zStuff ${fmtZ(+c.dataset.z)}`, e.clientX, e.clientY));
      c.addEventListener('mouseleave', hideTip);
    });
  }

  const id = new URLSearchParams(location.search).get('id');
  if (id && byId.has(+id)) {
    input.value = byId.get(+id)[0];
    show(+id);
  }
})();

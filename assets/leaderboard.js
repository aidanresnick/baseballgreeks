// Leaderboard page: Overall arsenal board + PT × season tables.
(async () => {
  const meta = await getJSON('data/meta.json');
  const state = {
    pt: 'ALL',
    year: meta.years[meta.years.length - 1],
    minn: 1,
    q: '',
    sort: 'z',
    dir: -1,
    rows: [],
  };

  // hydrate from URL (?pt=SL&y=2025)
  const params = new URLSearchParams(location.search);
  if (params.get('pt') && (params.get('pt') === 'ALL' || meta.pts.includes(params.get('pt'))))
    state.pt = params.get('pt');
  if (params.get('y') && meta.years.includes(params.get('y'))) state.year = params.get('y');

  const HEADS = {
    ALL: `<th class="l" data-k="rank">#</th>
      <th class="l" data-k="name">Pitcher</th>
      <th data-k="n">Pitches</th>
      <th data-k="z" title="Usage-weighted zStuff + pitch-type baseline (cross-type level included)">zStuff</th>`
      + meta.pts.map((pt, i) =>
        `<th ${i === 0 ? 'class="grp" ' : ''}data-k="p${i}" title="${PT_NAMES[pt]} zStuff">${pt}</th>`).join(''),
    PT: `<th class="l" data-k="rank">#</th>
      <th class="l" data-k="name">Pitcher</th>
      <th data-k="n">Pitches</th>
      <th data-k="z" title="Stuff grade: z-score within season × pitch type">zStuff</th>
      <th class="grp" data-k="velo" title="Average release speed (mph)">Velo</th>
      <th data-k="d" title="Δ — change in stuff per +1 mph, along the manifold">Delta</th>
      <th data-k="g" title="Γ — change in delta per +1 mph (curvature)">Gamma</th>
      <th class="grp" data-k="ivb" title="Induced vertical break, release to plate (inches, ride-positive)">IVB</th>
      <th data-k="vz" title="ν_z — change in zStuff per +1 inch of IVB">Vega-Z</th>
      <th class="grp" data-k="hb" title="Horizontal break, release to plate (inches, glove-side positive: + cut, − run)">HB</th>
      <th data-k="vx" title="ν_x — change in zStuff per +1 inch of HB">Vega-X</th>`,
  };

  const seg = document.getElementById('ptseg');
  const mkBtn = (pt, label, color) => {
    const b = document.createElement('button');
    b.style.setProperty('--pt', color);
    b.innerHTML = `<span class="dot"></span>${label}`;
    b.title = pt === 'ALL' ? 'Overall arsenal grade' : PT_NAMES[pt];
    b.dataset.pt = pt;
    b.onclick = () => { state.pt = pt; load(); };
    seg.appendChild(b);
  };
  mkBtn('ALL', 'Overall', 'var(--accent)');
  PT_ORDER.filter(p => meta.pts.includes(p)).forEach(pt => mkBtn(pt, pt, ptColor(pt)));

  const seasonSel = document.getElementById('season');
  [...meta.years].reverse().forEach(y => {
    const o = document.createElement('option');
    o.value = o.textContent = y;
    seasonSel.appendChild(o);
  });
  seasonSel.onchange = () => { state.year = seasonSel.value; load(); };

  const minSel = document.getElementById('minn');
  minSel.onchange = () => { state.minn = +minSel.value; render(); };

  const q = document.getElementById('q');
  q.oninput = () => { state.q = q.value.trim().toLowerCase(); render(); };

  function bindHead() {
    document.querySelectorAll('thead th').forEach(th => {
      th.onclick = () => {
        const k = th.dataset.k;
        if (k === 'rank') return;
        if (state.sort === k) state.dir *= -1;
        else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        render();
      };
    });
  }

  async function load() {
    const isAll = state.pt === 'ALL';
    document.querySelectorAll('#ptseg button').forEach(b =>
      b.classList.toggle('on', b.dataset.pt === state.pt));
    seasonSel.value = state.year;
    document.getElementById('title').textContent = isAll
      ? `Overall zStuff — ${state.year}`
      : `${PT_NAMES[state.pt]} zStuff — ${state.year}`;
    history.replaceState(null, '', `?pt=${state.pt}&y=${state.year}`);
    document.querySelector('#lb thead tr').innerHTML = isAll ? HEADS.ALL : HEADS.PT;
    if (isAll ? !(['name', 'n', 'z'].includes(state.sort) || state.sort.startsWith('p'))
        : state.sort.startsWith('p')) { state.sort = 'z'; state.dir = -1; }
    bindHead();
    state.rows = await getJSON(`data/lb_${state.pt}_${state.year}.json`);
    render();
  }

  const KEYS = { name: 0, n: 2, z: 3, velo: 4, d: 5, g: 6, ivb: 7, vz: 8, hb: 9, vx: 10 };

  // hero: smooth density of the current board's zStuff, top pitcher labeled
  function renderHero(rows) {
    const el = document.getElementById('hero');
    if (!el) return;
    if (rows.length < 8) { el.innerHTML = ''; return; }
    const W = 1200, H = 150, PL = 20, PR = 20, PT_ = 24, PB = 26;
    const LO = -3.5, HI = 3.5, NB = 70;
    const bins = new Array(NB).fill(0);
    rows.forEach(r => {
      const z = Math.max(LO, Math.min(HI, r[3]));
      bins[Math.min(NB - 1, Math.floor((z - LO) / (HI - LO) * NB))]++;
    });
    // gaussian smooth
    const K = [1, 4, 7, 4, 1], KS = 17;
    const sm = bins.map((_, i) =>
      K.reduce((a, k, j) => a + k * (bins[i + j - 2] || 0), 0) / KS);
    const peak = Math.max(...sm);
    const x = i => PL + (W - PL - PR) * i / (NB - 1);
    const xz = z => PL + (W - PL - PR) * (z - LO) / (HI - LO);
    const y = v => PT_ + (H - PT_ - PB) * (1 - v / peak);
    const line = sm.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const area = `${line} L${x(NB - 1).toFixed(1)},${H - PB} L${PL},${H - PB} Z`;
    const top = [...rows].sort((a, b) => b[3] - a[3])[0];
    const topX = Math.min(xz(top[3]), W - PR - 4);
    const name = top[0].split(' ').slice(-1)[0];
    const anchor = topX > W - 190 ? 'end' : 'start';
    const ticks = [-3, -2, -1, 0, 1, 2, 3];
    el.innerHTML = `<div class="hero-panel"><svg viewBox="0 0 ${W} ${H}">
      <text x="${PL}" y="15" fill="var(--muted)" font-size="12" font-weight="600">
        zStuff Distribution — ${document.getElementById('title').textContent}</text>
      <line x1="${PL}" x2="${W - PR}" y1="${H - PB}" y2="${H - PB}"
        stroke="var(--baseline)" stroke-width="1"/>
      ${ticks.map(t => `<text x="${xz(t)}" y="${H - 9}" fill="var(--muted)" font-size="10.5"
        text-anchor="middle">${t > 0 ? '+' : ''}${t}</text>
        <line x1="${xz(t)}" x2="${xz(t)}" y1="${H - PB}" y2="${H - PB + 4}"
          stroke="var(--baseline)" stroke-width="1"/>`).join('')}
      <line x1="${xz(0)}" x2="${xz(0)}" y1="${PT_}" y2="${H - PB}"
        stroke="var(--grid)" stroke-width="1"/>
      <path d="${area}" fill="var(--accent)" opacity="0.1"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${topX.toFixed(1)}" cy="${(H - PB - 7)}" r="4.5" fill="var(--accent)"
        stroke="var(--surface)" stroke-width="2"/>
      <text x="${(topX + (anchor === 'end' ? -9 : 9)).toFixed(1)}" y="${H - PB - 12}"
        fill="var(--ink-2)" font-size="11.5" font-weight="600"
        text-anchor="${anchor}">${name} ${fmtZ(top[3])}</text>
    </svg></div>`;
  }

  function render() {
    const isAll = state.pt === 'ALL';
    let rows = state.rows.filter(r => r[2] >= state.minn);
    if (state.q) rows = rows.filter(r => r[0].toLowerCase().includes(state.q));
    renderHero(rows);

    // rank by zStuff regardless of current sort
    const rank = new Map();
    [...rows].sort((a, b) => b[3] - a[3]).forEach((r, i) => rank.set(r[1], i + 1));

    let acc;
    if (isAll && state.sort.startsWith('p')) {
      const pi = +state.sort.slice(1);
      acc = r => (r[4][pi] && r[4][pi][0] != null) ? r[4][pi][0]
        : (state.dir === -1 ? -Infinity : Infinity);
    } else {
      const k = KEYS[state.sort] ?? 3;
      acc = r => r[k];
    }
    rows.sort((a, b) => (acc(a) > acc(b) ? 1 : acc(a) < acc(b) ? -1 : 0) * state.dir);

    document.querySelectorAll('thead th').forEach(th => {
      const base = th.textContent.replace(/[▲▼]\s*$/, '').trim();
      th.innerHTML = base + (th.dataset.k === state.sort
        ? `<span class="arrow">${state.dir === -1 ? '▼' : '▲'}</span>` : '');
    });

    const tb = document.querySelector('#lb tbody');
    tb.innerHTML = rows.map(r => isAll
      ? `<tr data-id="${r[1]}">
          <td class="rank l">${rank.get(r[1])}</td>
          <td class="name l">${r[0]}</td>
          <td>${fmtN(r[2])}</td>
          <td class="z">${fmtZ(r[3])}</td>
          ${r[4].map((v, i) => `<td ${i === 0 ? 'class="grp"' : ''}>${
            v == null ? '<span class="none">–</span>'
              : `${v[0] == null ? '<span class="none">–</span>' : fmtZ(v[0])}<span class="cnt">${fmtN(v[1])}</span>`
          }</td>`).join('')}
        </tr>`
      : `<tr data-id="${r[1]}">
          <td class="rank l">${rank.get(r[1])}</td>
          <td class="name l">${r[0]}</td>
          <td>${fmtN(r[2])}</td>
          <td class="z">${fmtZ(r[3])}</td>
          <td class="grp">${r[4].toFixed(1)}</td>
          <td>${fmtG(r[5])}</td>
          <td>${fmtG(r[6])}</td>
          <td class="grp">${r[7].toFixed(1)}</td>
          <td>${fmtG(r[8])}</td>
          <td class="grp">${r[9].toFixed(1)}</td>
          <td>${fmtG(r[10])}</td>
        </tr>`).join('');
    document.getElementById('empty').hidden = rows.length > 0;

    tb.querySelectorAll('tr').forEach(tr => {
      tr.onclick = () => { location.href = `pitcher.html?id=${tr.dataset.id}`; };
    });
  }

  minSel.value = String(state.minn);
  load();
})();

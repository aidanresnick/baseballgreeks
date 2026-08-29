// Leaderboard page: Overall arsenal board + PT × season tables.
(async () => {
  const meta = await getJSON('data/meta.json');
  const state = {
    pt: 'ALL',
    year: meta.years[meta.years.length - 1],
    minn: 10,
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
  const Z_SPAN = 3; // bar full-scale at |z| = 3

  const zbar = z => {
    const w = Math.min(Math.abs(z) / Z_SPAN, 1) * 36;
    return `<span class="zbar"><i class="${z >= 0 ? 'pos' : 'neg'}" style="width:${w}px"></i></span>`;
  };

  function render() {
    const isAll = state.pt === 'ALL';
    let rows = state.rows.filter(r => r[2] >= state.minn);
    if (state.q) rows = rows.filter(r => r[0].toLowerCase().includes(state.q));

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
          <td class="z">${fmtZ(r[3])}${zbar(r[3])}</td>
          ${r[4].map((v, i) => `<td ${i === 0 ? 'class="grp"' : ''}>${
            v == null ? '<span class="none">–</span>'
              : `${v[0] == null ? '<span class="none">–</span>' : fmtZ(v[0])}<span class="cnt">${fmtN(v[1])}</span>`
          }</td>`).join('')}
        </tr>`
      : `<tr data-id="${r[1]}">
          <td class="rank l">${rank.get(r[1])}</td>
          <td class="name l">${r[0]}</td>
          <td>${fmtN(r[2])}</td>
          <td class="z">${fmtZ(r[3])}${zbar(r[3])}</td>
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

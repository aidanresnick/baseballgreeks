// Leaderboard page: PT × season tables with sort, min-pitch filter, search.
(async () => {
  const meta = await getJSON('data/meta.json');
  const state = {
    pt: 'FF',
    year: meta.years[meta.years.length - 1],
    minn: 200,
    q: '',
    sort: 'z',
    dir: -1,
    rows: [],
  };

  // hydrate from URL (?pt=SL&y=2025)
  const params = new URLSearchParams(location.search);
  if (params.get('pt') && meta.pts.includes(params.get('pt'))) state.pt = params.get('pt');
  if (params.get('y') && meta.years.includes(params.get('y'))) state.year = params.get('y');

  const seg = document.getElementById('ptseg');
  PT_ORDER.filter(p => meta.pts.includes(p)).forEach(pt => {
    const b = document.createElement('button');
    b.style.setProperty('--pt', ptColor(pt));
    b.innerHTML = `<span class="dot"></span>${pt}`;
    b.title = PT_NAMES[pt];
    b.dataset.pt = pt;
    b.onclick = () => { state.pt = pt; load(); };
    seg.appendChild(b);
  });

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

  document.querySelectorAll('thead th').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.k;
      if (k === 'rank') return;
      if (state.sort === k) state.dir *= -1;
      else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
      render();
    };
  });

  async function load() {
    document.querySelectorAll('#ptseg button').forEach(b =>
      b.classList.toggle('on', b.dataset.pt === state.pt));
    seasonSel.value = state.year;
    document.getElementById('title').textContent =
      `${PT_NAMES[state.pt]} zStuff — ${state.year}`;
    history.replaceState(null, '', `?pt=${state.pt}&y=${state.year}`);
    state.rows = await getJSON(`data/lb_${state.pt}_${state.year}.json`);
    render();
  }

  const KEYS = { name: 0, n: 2, z: 3, velo: 4, d: 5, g: 6, ivb: 7, vz: 8, hb: 9, vx: 10 };

  function render() {
    let rows = state.rows.filter(r => r[2] >= state.minn);
    if (state.q) rows = rows.filter(r => r[0].toLowerCase().includes(state.q));

    // rank by zStuff regardless of current sort
    const rank = new Map();
    [...rows].sort((a, b) => b[3] - a[3]).forEach((r, i) => rank.set(r[1], i + 1));

    const k = KEYS[state.sort];
    rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * state.dir);

    document.querySelectorAll('thead th').forEach(th => {
      const base = th.textContent.replace(/[▲▼]\s*$/, '').trim();
      th.innerHTML = base + (th.dataset.k === state.sort
        ? `<span class="arrow">${state.dir === -1 ? '▼' : '▲'}</span>` : '');
    });

    const tb = document.querySelector('#lb tbody');
    const Z_SPAN = 3; // bar full-scale at |z| = 3
    tb.innerHTML = rows.map(r => {
      const z = r[3];
      const w = Math.min(Math.abs(z) / Z_SPAN, 1) * 36;
      const bar = `<span class="zbar"><i class="${z >= 0 ? 'pos' : 'neg'}" style="width:${w}px"></i></span>`;
      return `<tr data-id="${r[1]}">
        <td class="rank l">${rank.get(r[1])}</td>
        <td class="name l">${r[0]}</td>
        <td>${fmtN(r[2])}</td>
        <td class="z">${fmtZ(z)}${bar}</td>
        <td class="grp">${r[4].toFixed(1)}</td>
        <td>${fmtG(r[5])}</td>
        <td>${fmtG(r[6])}</td>
        <td class="grp">${r[7].toFixed(1)}</td>
        <td>${fmtG(r[8])}</td>
        <td class="grp">${r[9].toFixed(1)}</td>
        <td>${fmtG(r[10])}</td>
      </tr>`;
    }).join('');
    document.getElementById('empty').hidden = rows.length > 0;

    tb.querySelectorAll('tr').forEach(tr => {
      tr.onclick = () => { location.href = `pitcher.html?id=${tr.dataset.id}`; };
    });
  }

  minSel.value = String(state.minn);
  load();
})();

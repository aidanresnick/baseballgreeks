// Shared helpers for Baseball Greeks pages.
const PT_NAMES = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter', SL: 'Slider', ST: 'Sweeper',
  CU: 'Curveball', KC: 'Knuckle-Curve', CH: 'Changeup', FS: 'Splitter',
};
const PT_ORDER = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS'];

const ptColor = pt =>
  getComputedStyle(document.documentElement).getPropertyValue(`--pt-${pt}`).trim() || '#3987e5';

const fmtZ = v => (v > 0 ? '+' : '') + v.toFixed(2);
const fmtG = v => (v > 0 ? '+' : '') + v.toFixed(2);
const fmtN = v => v.toLocaleString('en-US');

const DATA_V = '14';
async function getJSON(path) {
  const r = await fetch(path + '?v=' + DATA_V);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// Row layout in every data file:
// [name?, id?, n, z, velo, delta, gamma, ivb, vegaZ, hb, vegaX]
// (greeks in xRV units x 1000; velo mph; ride/sweep inches, sweep glove-side +).
// Leaderboard rows carry name+id in front. Player rows append three
// 13-point stuff curves (zStuff over +-3 mph / +-3 in, manifold paths).
const ROW = { N: 0, Z: 1, VELO: 2, D: 3, G: 4, IVB: 5, VZ: 6, HB: 7, VX: 8,
              CV: 9, CZ: 10, CX: 11 };

function tooltipEl() {
  let t = document.querySelector('.tooltip');
  if (!t) {
    t = document.createElement('div');
    t.className = 'tooltip';
    document.body.appendChild(t);
  }
  return t;
}
function showTip(html, x, y) {
  const t = tooltipEl();
  t.innerHTML = html;
  t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(x + 14, window.innerWidth - w - 8) + 'px';
  t.style.top = Math.max(8, y - h - 12) + 'px';
}
function hideTip() { tooltipEl().style.display = 'none'; }

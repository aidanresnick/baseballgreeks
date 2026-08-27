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

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// Row layout in every data file: [name?, id?, n, z, xrv, gVelo, gVert, gHorz]
// Leaderboard rows carry name+id in front; player rows are the 6-value tail.
const ROW = { N: 0, Z: 1, XRV: 2, GV: 3, GDZ: 4, GDX: 5 };

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

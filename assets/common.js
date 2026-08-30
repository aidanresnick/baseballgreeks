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

const DATA_V = '25';
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

// One-click card download: clone the card with computed styles inlined,
// rasterize via SVG foreignObject -> canvas, save as PNG. Self-contained.
async function downloadCard(el, filename, testMode) {
  const W = el.offsetWidth, H = el.offsetHeight, PAD = 0, SCALE = 2;
  const clone = el.cloneNode(true);
  const src = el.querySelectorAll('*'), dst = clone.querySelectorAll('*');
  const inline = (s, d) => {
    const cs = getComputedStyle(s);
    let css = '';
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      css += `${p}:${cs.getPropertyValue(p)};`;
    }
    d.setAttribute('style', css);
  };
  inline(el, clone);
  for (let i = 0; i < src.length; i++) inline(src[i], dst[i]);
  // full-bleed export: square corners, no outer border
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  clone.style.borderTop = getComputedStyle(el).borderTopWidth + ' solid ' +
    getComputedStyle(el).borderTopColor;
  clone.querySelectorAll('.no-export').forEach(n => n.remove());
  clone.style.width = W + 'px';
  clone.style.margin = '0';
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const cv = document.createElement('canvas');
  cv.width = (W + 2 * PAD) * SCALE; cv.height = (H + 2 * PAD) * SCALE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#0d0d0d';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(SCALE, 0, 0, SCALE, PAD * SCALE, PAD * SCALE);
  ctx.drawImage(img, 0, 0, W, H);
  if (testMode) { console.log('DLTEST-OK ' + cv.width + 'x' + cv.height); return; }
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

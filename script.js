const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

// Nav hamburger
const hamburger = $('.hamburger'), navMenu = $('.nav-menu');
if (hamburger) hamburger.onclick = () => {
  navMenu?.classList.toggle('active');
  hamburger.classList.toggle('active');
};

document.addEventListener('click', e => {
  const link = e.target.closest('.nav-link');
  if (link) { navMenu?.classList.remove('active'); hamburger?.classList.remove('active'); }
  const anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    const href = anchor.getAttribute('href');
    if (href !== '#' && $(href)) { e.preventDefault(); $(href).scrollIntoView({ behavior: 'smooth' }); }
  }
});

const sections = $$('section'), navLinks = $$('.nav-link');
function onScroll() {
  const y = window.pageYOffset;
  for (let i = sections.length - 1; i >= 0; i--) {
    if (y >= sections[i].offsetTop - 220) {
      const id = sections[i].id;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      break;
    }
  }
}
window.addEventListener('scroll', onScroll); onScroll();

// ── Full-page honeycomb spin lattice ───────────────────────────────────────
(function () {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  const D      = 80;     // bond length (px) — larger cell for bigger atoms
  const S3     = Math.sqrt(3);
  const AL     = 26;     // arrow half-length (~5× bigger than before)
  const ATOM_R = 9;      // atom radius (~5× bigger than before)
  const THETA0 = 0.13;   // base cone angle (rad, ~7°) — subtle, not exaggerated
  const OMEGA  = 1.5;    // base precession rate (rad/s)
  const MOUSE_R = 160;   // mouse influence radius (px)
  const PERSP  = 0.30;   // perspective factor for depth axis

  const A1x = S3 * D, A1y = 0;
  const A2x = S3 * D / 2, A2y = 1.5 * D;
  const BDX = S3 * D / 2, BDY = D / 2;

  let W, H, atoms = [], bonds = [];
  const mouse = { x: -9999, y: -9999 };

  function build() {
    atoms = []; bonds = [];
    const map = new Map();
    const cols = Math.ceil(W / (S3 * D)) + 3;
    const rows = Math.ceil(H / (1.5 * D)) + 3;

    for (let m = -1; m < rows; m++) {
      for (let n = -1; n < cols; n++) {
        const cx = n * A1x + m * A2x;
        const cy = n * A1y + m * A2y;

        // A sublattice — spin up (red)
        const ai = atoms.length;
        atoms.push({ x: cx, y: cy, spin: 1,
          phase: ((n * 13 + m * 7  + 3) & 0x7FFF) / 0x7FFF * Math.PI * 2 });
        map.set(`A${n},${m}`, ai);

        // B sublattice — spin down (blue)
        const bi = atoms.length;
        atoms.push({ x: cx + BDX, y: cy + BDY, spin: -1,
          phase: ((n * 11 + m * 17 + 5) & 0x7FFF) / 0x7FFF * Math.PI * 2 });
        map.set(`B${n},${m}`, bi);
      }
    }

    const cols2 = Math.ceil(W / (S3 * D)) + 3;
    const rows2 = Math.ceil(H / (1.5 * D)) + 3;
    for (let m = -1; m < rows2; m++) {
      for (let n = -1; n < cols2; n++) {
        const ai = map.get(`A${n},${m}`);
        if (ai === undefined) continue;
        for (const key of [`B${n},${m}`, `B${n-1},${m}`, `B${n},${m-1}`]) {
          const bi = map.get(key);
          if (bi !== undefined) bonds.push([ai, bi]);
        }
      }
    }
  }

  function drawArrowHead(x1, y1, x2, y2, size) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - 0.42), y2 - size * Math.sin(angle - 0.42));
    ctx.lineTo(x2 - size * Math.cos(angle + 0.42), y2 - size * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
  }

  function draw(ts) {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    const t = ts * 0.001;

    // Bonds
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (const [ai, bi] of bonds) {
      const a = atoms[ai], b = atoms[bi];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Spins
    for (const atom of atoms) {
      const mdx = atom.x - mouse.x, mdy = atom.y - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      // pf: 1 = at mouse, 0 = far away
      const pf = Math.max(0, 1 - mdist / MOUSE_R);

      // Mouse DAMPENS the precession: cone narrows and slows near mouse
      const theta   = THETA0 * (1 - pf * 0.88);   // shrinks toward ~zero near mouse
      const omegaEff = OMEGA * (1 - pf * 0.80);    // slows to 20% of normal near mouse

      const phi  = omegaEff * t + atom.phase;
      const spin = atom.spin;

      const tipX = atom.x + AL * Math.sin(theta) * Math.cos(phi);
      const tipY = atom.y - spin * AL * Math.cos(theta)
                         + AL * Math.sin(theta) * Math.sin(phi) * PERSP;
      const tf   = 0.40;
      const tlX  = atom.x - AL * tf * Math.sin(theta) * Math.cos(phi);
      const tlY  = atom.y + spin * AL * tf * Math.cos(theta)
                         - AL * tf * Math.sin(theta) * Math.sin(phi) * PERSP;

      // Up = red, Down = blue
      const rgb   = spin === 1 ? '239,68,68' : '96,165,250';
      const alpha = 0.60 + pf * 0.10;  // very slightly brighter when dampened (frozen)

      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.fillStyle   = `rgba(${rgb},${alpha})`;
      ctx.lineWidth   = 2.0;

      ctx.beginPath();
      ctx.moveTo(tlX, tlY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      drawArrowHead(tlX, tlY, tipX, tipY, 7);

      // Atom dot — slightly dims/freezes near mouse
      const dotAlpha = 0.55 - pf * 0.15;
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, ATOM_R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${dotAlpha})`;
      ctx.fill();

      // Atom ring (tinted by spin colour)
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, ATOM_R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb},0.45)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }

  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  document.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(draw);
})();

const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

// Nav hamburger
const hamburger = $('.hamburger'), navMenu = $('.nav-menu');
if (hamburger) hamburger.onclick = () => {
  navMenu?.classList.toggle('active');
  hamburger.classList.toggle('active');
};

// Smooth anchor clicks + nav close
document.addEventListener('click', e => {
  const link = e.target.closest('.nav-link');
  if (link) { navMenu?.classList.remove('active'); hamburger?.classList.remove('active'); }
  const anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    const href = anchor.getAttribute('href');
    if (href !== '#' && $(href)) { e.preventDefault(); $(href).scrollIntoView({ behavior: 'smooth' }); }
  }
});

// Active nav link on scroll
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

// ── Honeycomb spin lattice with precessing magnetic moments ─────────────────
(function () {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const D      = 54;           // bond length (px)
  const S3     = Math.sqrt(3);
  const AL     = 17;           // spin arrow half-length (px)
  const THETA0 = 0.20;         // base precession cone angle (~11°)
  const THETA1 = 0.72;         // perturbed cone angle (~41°)
  const OMEGA  = 1.6;          // base precession rate (rad/s)
  const MOUSE_R = 140;         // mouse influence radius (px)
  const PERSP  = 0.32;         // perspective factor for depth axis

  // Honeycomb primitive vectors
  const A1x = S3 * D, A1y = 0;
  const A2x = S3 * D / 2, A2y = 1.5 * D;
  // B-atom offset within unit cell
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

        // A sublattice — spin up
        const ai = atoms.length;
        atoms.push({
          x: cx, y: cy, spin: 1,
          phase: ((n * 13 + m * 7 + 3) & 0x7FFF) / 0x7FFF * Math.PI * 2
        });
        map.set(`A${n},${m}`, ai);

        // B sublattice — spin down
        const bi = atoms.length;
        atoms.push({
          x: cx + BDX, y: cy + BDY, spin: -1,
          phase: ((n * 11 + m * 17 + 5) & 0x7FFF) / 0x7FFF * Math.PI * 2
        });
        map.set(`B${n},${m}`, bi);
      }
    }

    // Each A(n,m) bonds to B(n,m), B(n-1,m), B(n,m-1) — gives exact honeycomb
    for (let m = -1; m < rows; m++) {
      for (let n = -1; n < cols; n++) {
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

    // Draw honeycomb bonds
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,0.11)';
    for (const [ai, bi] of bonds) {
      const a = atoms[ai], b = atoms[bi];
      if (a.x < -D * 2 || a.x > W + D * 2) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Draw precessing spins
    for (const atom of atoms) {
      if (atom.x < -D * 2 || atom.x > W + D * 2 ||
          atom.y < -D * 2 || atom.y > H + D * 2) continue;

      const mdx = atom.x - mouse.x, mdy = atom.y - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      const pf = Math.max(0, 1 - mdist / MOUSE_R); // 0 → 1 near mouse

      // Cone angle widens, precession speeds up, wobble added — all near mouse
      const theta  = THETA0 + (THETA1 - THETA0) * pf * pf;
      const wobble = pf * 0.42 * Math.sin(t * 9.7 + atom.phase * 2.3);
      const phi    = (OMEGA + pf * 2.8) * t + atom.phase + wobble;

      const spin = atom.spin; // +1 = up, -1 = down

      // 3D precession projected to 2D with perspective on depth axis
      const tipX = atom.x + AL * Math.sin(theta) * Math.cos(phi);
      const tipY = atom.y - spin * AL * Math.cos(theta)
                         + AL * Math.sin(theta) * Math.sin(phi) * PERSP;

      // Short tail stub in opposite direction
      const tf  = 0.38;
      const tlX = atom.x - AL * tf * Math.sin(theta) * Math.cos(phi);
      const tlY = atom.y + spin * AL * tf * Math.cos(theta)
                         - AL * tf * Math.sin(theta) * Math.sin(phi) * PERSP;

      // A (up) = teal, B (down) = lighter teal
      const rgb   = spin === 1 ? '20,184,166' : '94,234,212';
      const alpha = 0.55 + pf * 0.45;

      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.fillStyle   = `rgba(${rgb},${alpha})`;
      ctx.lineWidth   = 1.5;

      // Shaft
      ctx.beginPath();
      ctx.moveTo(tlX, tlY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Arrowhead at tip
      drawArrowHead(tlX, tlY, tipX, tipY, 5.5);

      // Atom dot — glows when mouse is close
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, 2.0 + pf * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.28 + pf * 0.55})`;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
    build();
  }

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(draw);
})();

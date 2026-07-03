// © 2026 George Yumnam · georgeyumnam.github.io
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
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.6;';
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  const D      = 104;    // bond length (px) — 1.3× larger honeycomb cells
  const S3     = Math.sqrt(3);
  const AL     = 44;     // arrow half-length (1.7× increase)
  const ATOM_R = 13.5;   // atom radius (1.5× increase)
  const THETA0 = 0.182;  // base cone angle (rad, ~10°) — 40% increase
  const OMEGA  = 3.0;    // base precession rate (rad/s) — 2× increase
  const MOUSE_R = 160;   // mouse influence radius (px)
  const PERSP  = 0.30;   // perspective factor for depth axis

  const PHONON_AMP   = 6;                          // px — peak lateral displacement
  const PHONON_OMEGA = 2 * Math.PI / 1.5;          // rad/s — period = 1.5 s (0.75 s half-period)

  const A1x = S3 * D, A1y = 0;
  const A2x = S3 * D / 2, A2y = 1.5 * D;
  const BDX = S3 * D / 2, BDY = D / 2;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, atoms = [], bonds = [];
  const mouse = { x: -9999, y: -9999 };

  let prevT = 0;

  function build() {
    atoms = []; bonds = [];
    const map = new Map();
    const rows = Math.ceil(H / (1.5 * D)) + 3;
    const cols = Math.ceil(W / (S3 * D)) + 3;
    // A2 has a rightward component, so bottom rows are shifted right.
    // Extend nStart negative enough to cover the bottom-left corner.
    const nStart = -Math.ceil((rows * A2x) / A1x) - 2;

    for (let m = -1; m < rows; m++) {
      for (let n = nStart; n < cols; n++) {
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

    for (let m = -1; m < rows; m++) {
      for (let n = nStart; n < cols; n++) {
        const ai = map.get(`A${n},${m}`);
        if (ai === undefined) continue;
        for (const key of [`B${n},${m}`, `B${n-1},${m}`, `B${n},${m-1}`]) {
          const bi = map.get(key);
          if (bi !== undefined) bonds.push([ai, bi]);
        }
      }
    }
  }

  // Draws a cylinder shaft + conical arrowhead from (x1,y1) to (x2,y2)
  function drawCylinderArrow(x1, y1, x2, y2, color, alpha) {
    const SHAFT_W  = 6;   // cylinder diameter (px) — 3× the old ~2px line
    const HEAD_W   = 15;  // cone base diameter
    const HEAD_LEN = 17;  // cone length

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const totalLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const shaftLen = Math.max(0, totalLen - HEAD_LEN);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    // ── Cylinder shaft ──────────────────────────
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.rect(0, -SHAFT_W / 2, shaftLen, SHAFT_W);
    ctx.fill();

    // Highlight strip — top ~25% of shaft for 3-D cylinder illusion
    ctx.fillStyle = `rgba(255,255,255,0.16)`;
    ctx.beginPath();
    ctx.rect(0, -SHAFT_W / 2, shaftLen, SHAFT_W * 0.28);
    ctx.fill();

    // ── Cone arrowhead ───────────────────────────
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(totalLen, 0);                      // tip
    ctx.lineTo(shaftLen, -HEAD_W / 2);            // base left
    ctx.lineTo(shaftLen,  HEAD_W / 2);            // base right
    ctx.closePath();
    ctx.fill();

    // Cone highlight
    ctx.fillStyle = `rgba(255,255,255,0.12)`;
    ctx.beginPath();
    ctx.moveTo(totalLen, 0);
    ctx.lineTo(shaftLen, -HEAD_W / 2);
    ctx.lineTo(shaftLen, -HEAD_W * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function draw(ts) {
    if (!REDUCED) requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    const t = ts * 0.001;
    // phonon: red sublattice (spin=+1) moves left, blue (spin=-1) moves right — antiphase
    const pdx = s => -s * PHONON_AMP * Math.sin(PHONON_OMEGA * t);

    // Bonds
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148,171,255,0.14)';
    for (const [ai, bi] of bonds) {
      const a = atoms[ai], b = atoms[bi];
      ctx.beginPath();
      ctx.moveTo(a.x + pdx(a.spin), a.y);
      ctx.lineTo(b.x + pdx(b.spin), b.y);
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

      const spin = atom.spin;
      const rx = atom.x + pdx(spin);   // rendered x — original + phonon displacement

      // Red (spin-up) lags blue (spin-down) by half a precession period (π)
      const phi  = omegaEff * t + atom.phase + (spin === 1 ? Math.PI : 0);

      const tipX = rx + AL * Math.sin(theta) * Math.cos(phi);
      const tipY = atom.y - spin * AL * Math.cos(theta)
                         + AL * Math.sin(theta) * Math.sin(phi) * PERSP;
      const tf   = 0.40;
      const tlX  = rx - AL * tf * Math.sin(theta) * Math.cos(phi);
      const tlY  = atom.y + spin * AL * tf * Math.cos(theta)
                         - AL * tf * Math.sin(theta) * Math.sin(phi) * PERSP;

      // Up = red, Down = blue
      const rgb   = spin === 1 ? '79,217,236' : '242,104,142';
      const alpha = 0.42 + pf * 0.30;

      drawCylinderArrow(tlX, tlY, tipX, tipY, rgb, alpha);

      // Shiny black ball — directional hemisphere light from mouse side
      const lx = mouse.x > -9000 ? -mdx / (mdist || 1) : -0.5;
      const ly = mouse.y > -9000 ? -mdy / (mdist || 1) : -0.8;

      // Black base sphere
      ctx.beginPath();
      ctx.arc(rx, atom.y, ATOM_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(9,13,26)';
      ctx.fill();

      // Light overlay: full white on lit side, zero on dark side
      const grad = ctx.createLinearGradient(
        rx + lx * ATOM_R, atom.y + ly * ATOM_R,
        rx - lx * ATOM_R, atom.y - ly * ATOM_R
      );
      grad.addColorStop(0,    'rgba(170,215,255,0.55)');
      grad.addColorStop(0.50, 'rgba(170,215,255,0.06)');
      grad.addColorStop(1,    'rgba(255,255,255,0)');

      ctx.beginPath();
      ctx.arc(rx, atom.y, ATOM_R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    prevT = t;
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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(0);                 // single static frame
  } else {
    requestAnimationFrame(draw);
  }
})();

// ── Scroll reveal ───────────────────────────────────────────────────────────
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = $$('.section-header, .project-card, .pub-card, .opp-card, .education-list li, .contact-item, .about-text, .about-photo-wrap, .teaching-intro, .research-panel');
  if (!('IntersectionObserver' in window) || !targets.length) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min((i % 4) * 60, 180)}ms`;
    io.observe(el);
  });
})();

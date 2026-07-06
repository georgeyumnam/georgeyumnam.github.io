// © 2026 George Yumnam · georgeyumnam.github.io
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

// Nav hamburger
const hamburger = $('.hamburger'), navMenu = $('.nav-menu');
if (hamburger) hamburger.onclick = () => {
  navMenu?.classList.toggle('active');
  hamburger.classList.toggle('active');
};

document.addEventListener('click', e => {
  const link = e.target.closest('.nav-menu a');
  if (link && link.getAttribute('href') !== '#') { navMenu?.classList.remove('active'); hamburger?.classList.remove('active'); }
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

  const D      = 104;    // bond length (px) - 1.3× larger honeycomb cells
  const S3     = Math.sqrt(3);
  const AL     = 44;     // arrow half-length (1.7× increase)
  const ATOM_R = 13.5;   // atom radius (1.5× increase)
  const THETA0 = 0.182;  // base cone angle (rad, ~10°) - 40% increase
  const OMEGA  = 3.0;    // base precession rate (rad/s) - 2× increase
  const MOUSE_R = 160;   // mouse influence radius (px)
  const PERSP  = 0.30;   // perspective factor for depth axis

  const PHONON_AMP   = 6;                          // px - peak lateral displacement
  const PHONON_OMEGA = 2 * Math.PI / 1.5;          // rad/s - period = 1.5 s (0.75 s half-period)

  const A1x = S3 * D, A1y = 0;
  const A2x = S3 * D / 2, A2y = 1.5 * D;
  const BDX = S3 * D / 2, BDY = D / 2;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DRIFT   = 0.12;         // scroll-parallax rate for the lattice
  const PERIODY = 3 * D;        // vertical lattice period - drift wraps seamlessly
  let W, H, atoms = [], bonds = [];
  const mouse = { x: -9999, y: -9999 };

  let prevT = 0;

  function build() {
    atoms = []; bonds = [];
    const map = new Map();
    const rows = Math.ceil(H / (1.5 * D)) + 5;   // extra rows cover the drift band
    const cols = Math.ceil(W / (S3 * D)) + 3;
    // A2 has a rightward component, so bottom rows are shifted right.
    // Extend nStart negative enough to cover the bottom-left corner.
    const nStart = -Math.ceil((rows * A2x) / A1x) - 2;

    for (let m = -1; m < rows; m++) {
      for (let n = nStart; n < cols; n++) {
        const cx = n * A1x + m * A2x;
        const cy = n * A1y + m * A2y;

        // A sublattice - spin up (red)
        const ai = atoms.length;
        atoms.push({ x: cx, y: cy, spin: 1,
          phase: ((n * 13 + m * 7  + 3) & 0x7FFF) / 0x7FFF * Math.PI * 2 });
        map.set(`A${n},${m}`, ai);

        // B sublattice - spin down (blue)
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
    const SHAFT_W  = 6;   // cylinder diameter (px) - 3× the old ~2px line
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

    // Highlight strip - top ~25% of shaft for 3-D cylinder illusion
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
    // phonon: red sublattice (spin=+1) moves left, blue (spin=-1) moves right - antiphase
    const pdx = s => -s * PHONON_AMP * Math.sin(PHONON_OMEGA * t);
    // scroll drift: lattice glides up slowly as the page scrolls (wraps on period)
    const yoff = REDUCED ? 0 : (window.scrollY * DRIFT) % PERIODY;

    // Bonds
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148,171,255,0.16)';
    for (const [ai, bi] of bonds) {
      const a = atoms[ai], b = atoms[bi];
      ctx.beginPath();
      ctx.moveTo(a.x + pdx(a.spin), a.y - yoff);
      ctx.lineTo(b.x + pdx(b.spin), b.y - yoff);
      ctx.stroke();
    }

    // Spins
    for (const atom of atoms) {
      const ry = atom.y - yoff;        // rendered y - original + scroll drift
      const mdx = atom.x - mouse.x, mdy = ry - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      // pf: 1 = at mouse, 0 = far away
      const pf = Math.max(0, 1 - mdist / MOUSE_R);

      // Mouse DAMPENS the precession: cone narrows and slows near mouse
      const theta   = THETA0 * (1 - pf * 0.88);   // shrinks toward ~zero near mouse
      const omegaEff = OMEGA * (1 - pf * 0.80);    // slows to 20% of normal near mouse

      const spin = atom.spin;
      const rx = atom.x + pdx(spin);   // rendered x - original + phonon displacement

      // Red (spin-up) lags blue (spin-down) by half a precession period (π)
      const phi  = omegaEff * t + atom.phase + (spin === 1 ? Math.PI : 0);

      const tipX = rx + AL * Math.sin(theta) * Math.cos(phi);
      const tipY = ry - spin * AL * Math.cos(theta)
                      + AL * Math.sin(theta) * Math.sin(phi) * PERSP;
      const tf   = 0.40;
      const tlX  = rx - AL * tf * Math.sin(theta) * Math.cos(phi);
      const tlY  = ry + spin * AL * tf * Math.cos(theta)
                      - AL * tf * Math.sin(theta) * Math.sin(phi) * PERSP;

      // Up = red, Down = blue
      const rgb   = spin === 1 ? '79,217,236' : '242,104,142';
      const alpha = 0.42 + pf * 0.30;

      drawCylinderArrow(tlX, tlY, tipX, tipY, rgb, alpha);

      // Shiny ball - directional hemisphere light from mouse side
      const lx = mouse.x > -9000 ? -mdx / (mdist || 1) : -0.5;
      const ly = mouse.y > -9000 ? -mdy / (mdist || 1) : -0.8;

      // Base sphere (lifted to match lighter theme)
      ctx.beginPath();
      ctx.arc(rx, ry, ATOM_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(19,27,49)';
      ctx.fill();

      // Light overlay: full white on lit side, zero on dark side
      const grad = ctx.createLinearGradient(
        rx + lx * ATOM_R, ry + ly * ATOM_R,
        rx - lx * ATOM_R, ry - ly * ATOM_R
      );
      grad.addColorStop(0,    'rgba(170,215,255,0.55)');
      grad.addColorStop(0.50, 'rgba(170,215,255,0.06)');
      grad.addColorStop(1,    'rgba(255,255,255,0)');

      ctx.beginPath();
      ctx.arc(rx, ry, ATOM_R, 0, Math.PI * 2);
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
  const targets = $$('.section-header, .project-card, .pub-card, .opp-card, .education-list li, .contact-item, .about-text, .about-photo-wrap, .teaching-intro, .research-panel, .stats-grid');
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

// ═══ v5 · "You are the neutron" - dynamics engine ═══════════════════════════
(function () {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wlColor = i => ['79,217,236', '139,122,247', '242,104,142'][i % 3];

  // ── 1. Spallation preloader (once per session) ────────────────────────────
  // After the burst, the page "lands": the photo zooms out into place on top
  // of the already-running lattice/beam animations.
  const pre = document.getElementById('preloader');
  const photoWrap = document.querySelector('.hero-photo-wrap');
  const heroContent = document.querySelector('.hero-content');
  const land = soft => {
    if (RM) return;
    if (soft) photoWrap?.classList.add('zoomland-soft');
    else { photoWrap?.classList.add('zoomland'); heroContent?.classList.add('zoomland'); }
    // drop the animation fill once done so scroll parallax can take over
    [photoWrap, heroContent].forEach(el => el?.addEventListener('animationend', () =>
      el.classList.remove('zoomland', 'zoomland-soft'), { once: true }));
  };
  if (pre) {
    if (RM || sessionStorage.getItem('gy-pre')) { pre.remove(); land(true); }
    else {
      sessionStorage.setItem('gy-pre', '1');
      document.body.style.overflow = 'hidden';
      // ~2 s total: proton flight (1.05 s) → point-of-collision burst → page
      // emerges from the collision via the photo zoom-out landing
      setTimeout(() => {
        pre.classList.add('burst');
        for (let k = 0; k < 24; k++) {
          const n = document.createElement('div');
          n.className = 'pre-n';
          const a = Math.random() * Math.PI * 2;          // full-sphere burst from the point
          const d = 130 + Math.random() * 260;
          n.style.setProperty('--dx', Math.cos(a) * d + 'px');
          n.style.setProperty('--dy', Math.sin(a) * d + 'px');
          n.style.background = `rgb(${wlColor(k)})`;
          n.style.boxShadow = `0 0 14px rgba(${wlColor(k)},0.9)`;
          pre.appendChild(n);
        }
      }, 1050);
      setTimeout(() => { pre.classList.add('done'); document.body.style.overflow = ''; land(false); }, 2050);
      setTimeout(() => pre.remove(), 2700);
    }
  } else land(true);

  // ── 2. Hero neutron stream: spheres with spin arrows, sample scattering ───
  //     Neutrons carry random up/down spins (same color for both). 40% of
  //     them scatter off the circular photo "sample"; each scattering event
  //     briefly lights up the photo frame.
  const bc = document.getElementById('beamcanvas');
  if (bc && !RM) {
    const bctx = bc.getContext('2d');
    let W, H, ps = [], glow = 0;
    const M = { x: -9e3, y: -9e3 };
    const wrap = document.querySelector('.hero-photo-wrap');
    function size() {
      const r = bc.parentElement.getBoundingClientRect();
      W = bc.width = r.width; H = bc.height = r.height;
    }
    function sampleCircle() {
      if (!wrap) return null;
      const pr = wrap.getBoundingClientRect();
      const cr = bc.getBoundingClientRect();
      return { x: pr.left + pr.width / 2 - cr.left,
               y: pr.top + pr.height / 2 - cr.top,
               r: pr.width / 2 };
    }
    function spawn() {
      const lam = Math.random();                    // 0 = short λ (fast, cyan) → 1 = long λ (slow, rose)
      ps.push({ x: -20, y: Math.random() * H, lam,
                vx: (3.4 - lam * 2.3) * 1.35,       // 1.35x faster overall
                vy: 0,
                r: 5.5,                             // uniform size for all neutrons
                spin: Math.random() < 0.5 ? 1 : -1, // up / down, random
                scat: Math.random() < 0.4,          // 40% scatter off the sample
                hit: false });
    }
    function drawNeutron(p, c) {
      // comet tail: faint, semi-transparent, longer for faster neutrons
      const sp = Math.hypot(p.vx, p.vy) || 0.1;
      const tl = sp * 10;
      const tx = p.x - (p.vx / sp) * tl;
      const ty = p.y - (p.vy / sp) * tl;
      const tg = bctx.createLinearGradient(tx, ty, p.x, p.y);
      tg.addColorStop(0, `rgba(${c},0)`);
      tg.addColorStop(1, `rgba(${c},0.22)`);
      bctx.strokeStyle = tg;
      bctx.lineWidth = p.r * 1.1;
      bctx.lineCap = 'round';
      bctx.beginPath();
      bctx.moveTo(tx, ty);
      bctx.lineTo(p.x, p.y);
      bctx.stroke();
      // sphere body with a small highlight
      bctx.beginPath();
      bctx.arc(p.x, p.y, p.r, 0, 7);
      bctx.fillStyle = `rgba(${c},0.85)`;
      bctx.fill();
      bctx.beginPath();
      bctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.4, 0, 7);
      bctx.fillStyle = 'rgba(255,255,255,0.30)';
      bctx.fill();
      // spin arrow through the sphere: tip up (spin +1) or down (-1)
      const L = p.r * 2.7, s = p.spin;
      const yTail = p.y + s * L / 2, yTip = p.y - s * L / 2;
      const ah = Math.max(2.5, p.r * 0.85);
      bctx.strokeStyle = `rgba(${c},0.95)`;
      bctx.lineWidth = Math.max(1.5, p.r * 0.26);
      bctx.lineCap = 'round';
      bctx.beginPath();
      bctx.moveTo(p.x, yTail);
      bctx.lineTo(p.x, yTip);
      bctx.moveTo(p.x - ah * 0.7, yTip + s * ah);
      bctx.lineTo(p.x, yTip);
      bctx.lineTo(p.x + ah * 0.7, yTip + s * ah);
      bctx.stroke();
    }
    function frame() {
      requestAnimationFrame(frame);
      // skip all work while the hero is scrolled out of view
      const hb = bc.parentElement.getBoundingClientRect();
      if (hb.bottom <= 0 || hb.top >= innerHeight) return;
      bctx.clearRect(0, 0, W, H);
      if (ps.length < 70 && Math.random() < 0.35) spawn();
      const C = sampleCircle();
      for (const p of ps) {
        const dx = p.x - M.x, dy = p.y - M.y, d2 = dx * dx + dy * dy;
        if (d2 < 22500) { const f = (1 - d2 / 22500) * 0.5; p.vy += (dy > 0 ? f : -f); }  // field deflection
        p.vy *= 0.96;
        p.x += p.vx; p.y += p.vy;
        // sample interaction: 40% scatter at the rim, the rest transmit behind the photo
        if (C && !p.hit) {
          const cx = p.x - C.x, cy = p.y - C.y;
          if (Math.hypot(cx, cy) < C.r + p.r) {
            p.hit = true;
            if (p.scat) {
              // deflect by at most 60 degrees from the original flight path
              const th0 = Math.atan2(p.vy, p.vx);
              const th = th0 + (Math.random() - 0.5) * (2 * Math.PI / 3);
              const sp = Math.hypot(p.vx, p.vy) * (0.8 + Math.random() * 0.35);
              p.vx = Math.cos(th) * sp;
              p.vy = Math.sin(th) * sp;
              glow = Math.min(1, glow + 0.35);
            }
          }
        }
        const c = p.lam < 0.33 ? '79,217,236' : p.lam < 0.66 ? '139,122,247' : '242,104,142';
        drawNeutron(p, c);
      }
      ps = ps.filter(p => p.x > -40 && p.x < W + 40 && p.y > -40 && p.y < H + 40);
      // frame glow: brief flash on each scattering event, exponential decay
      if (wrap) {
        if (glow > 0.015) {
          wrap.style.boxShadow =
            `0 0 ${60 + glow * 50}px rgba(79,217,236,${(0.22 + glow * 0.45).toFixed(3)}), ` +
            `0 0 ${120 + glow * 60}px rgba(139,122,247,${(0.14 + glow * 0.30).toFixed(3)})`;
          glow *= 0.94;
        } else if (glow !== 0) { glow = 0; wrap.style.boxShadow = ''; }
      }
    }
    // rAF drives the loop directly (auto-pauses in background tabs); the
    // in-frame visibility check replaces the old IntersectionObserver, whose
    // initial entry never fired in some embedded contexts
    size();
    requestAnimationFrame(frame);
    bc.parentElement.addEventListener('mousemove', e => {
      const r = bc.getBoundingClientRect();
      M.x = e.clientX - r.left; M.y = e.clientY - r.top;
    });
    bc.parentElement.addEventListener('mouseleave', () => { M.x = -9e3; M.y = -9e3; });
    window.addEventListener('resize', size);
  }

  // ── 3. Hero letter scatter ────────────────────────────────────────────────
  const ht = document.querySelector('.hero-title');
  if (ht) {
    const split = node => {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const c of ch.textContent) {
            if (c === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
            const sp = document.createElement('span');
            sp.className = 'ltr';
            sp.textContent = c;
            frag.appendChild(sp);
          }
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) split(ch);
      });
    };
    split(ht);
    // Composited .ltr spans break the parent's background-clip:text gradient
    // (Chromium): repaint the gradient per letter, offset so the sweep stays
    // continuous across the whole word.
    const paintGrad = () => {
      ht.querySelectorAll('.grad-text').forEach(g => {
        const gw = Math.max(1, g.offsetWidth);   // offset* ignores transforms
        g.querySelectorAll('.ltr').forEach(l => {
          l.style.background = 'linear-gradient(120deg, #4fd9ec 0%, #8b7af7 55%, #f2688e 100%)';
          l.style.backgroundSize = `${gw}px 100%`;
          l.style.backgroundPosition = `${g.offsetLeft - l.offsetLeft}px 0`;
          l.style.webkitBackgroundClip = 'text';
          l.style.backgroundClip = 'text';
          l.style.color = 'transparent';
        });
      });
    };
    paintGrad();
    addEventListener('resize', paintGrad);
    document.fonts?.ready.then(paintGrad);
    const ls = ht.querySelectorAll('.ltr');
    if (!RM) {
      ls.forEach(l => {
        l.style.setProperty('--sx', (Math.random() - 0.5) * 220 + 'px');
        l.style.setProperty('--sy', (Math.random() - 0.5) * 140 + 'px');
        l.style.setProperty('--sr', (Math.random() - 0.5) * 70 + 'deg');
        l.classList.add('scatter');
      });
      const t0 = pre && !sessionStorage.getItem('gy-pre-done') ? 1950 : 150;
      sessionStorage.setItem('gy-pre-done', '1');
      ls.forEach((l, i) => setTimeout(() => l.classList.add('land'), t0 + i * 55));
    }
  }

  // ── 3b. Hero scroll parallax - content drifts/fades so leaving the hero
  //        feels continuous rather than a hard cut ─────────────────────────
  if (heroContent && !RM) {
    let hpTick = false;
    addEventListener('scroll', () => {
      if (hpTick) return; hpTick = true;
      requestAnimationFrame(() => {
        hpTick = false;
        const y = scrollY;
        if (y <= innerHeight * 1.2 && !heroContent.classList.contains('zoomland')) {
          heroContent.style.transform = `translateY(${y * 0.16}px)`;
          heroContent.style.opacity = Math.max(0, 1 - y / (innerHeight * 0.95));
        }
      });
    }, { passive: true });
  }

  // ── 4. Time-of-flight chromatic tint on reveals ───────────────────────────
  document.querySelectorAll('.reveal, .project-card, .pub-card, .opp-card, .stat').forEach((el, i) => {
    el.classList.add(['tof-b', 'tof-v', 'tof-r'][i % 3]);
  });

  // ── 5. Beamline rail ──────────────────────────────────────────────────────
  const rail = document.getElementById('beamrail');
  if (rail) {
    const secs = [...document.querySelectorAll('section[id]')].filter(s => s.id !== 'home');
    const names = { about: 'Sample · About', employment: 'Career', education: 'Training',
                    projects: 'Scattering · Research', 'past-research': 'Archive · Past research',
                    publications: 'Detector · Papers', teaching: 'Mentorship',
                    mitsna: 'Community', contact: 'Signal out · Contact' };
    const nodes = secs.map(sec => {
      const n = document.createElement('button');
      n.className = 'rail-node';
      n.setAttribute('aria-label', names[sec.id] || sec.id);
      n.innerHTML = `<span class="rail-tip">${names[sec.id] || sec.id}</span>`;
      n.addEventListener('click', () => sec.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }));
      rail.appendChild(n);
      return n;
    });
    const prog = rail.querySelector('.rail-progress');
    function railTick() {
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.height = Math.min(100, (scrollY / max) * 100) + '%';
      const rh = rail.clientHeight;
      let active = 0;
      secs.forEach((sec, i) => {
        const t = sec.offsetTop / max;
        nodes[i].style.top = Math.min(0.97, t) * rh - 7 + 'px';
        if (scrollY >= sec.offsetTop - innerHeight * 0.45) active = i;
      });
      nodes.forEach((n, i) => n.classList.toggle('on', i === active));
    }
    addEventListener('scroll', railTick, { passive: true });
    addEventListener('resize', railTick);
    railTick();
  }

  // ── 6. Count-up stats ─────────────────────────────────────────────────────
  const stats = document.querySelectorAll('.stat-n');
  if (stats.length) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const end = +e.target.dataset.count;
      if (RM) { e.target.textContent = end; return; }
      const t0 = performance.now();
      (function tick(t) {
        const p = Math.min(1, (t - t0) / 1400);
        e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }), { threshold: 0.6 });
    stats.forEach(s => io.observe(s));
  }

  // ── 7. 3D tilt on research + publication cards ────────────────────────────
  if (!RM && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.project-card, .pub-card').forEach(card => {
      card.classList.add('tilt');
      const glare = document.createElement('div');
      glare.className = 'tilt-glare';
      card.appendChild(glare);
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 7}deg) rotateX(${(0.5 - py) * 7}deg) translateY(-6px)`;
        card.style.setProperty('--gx', px * 100 + '%');
        card.style.setProperty('--gy', py * 100 + '%');
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    // Magnetic buttons
    document.querySelectorAll('.btn').forEach(b => {
      b.addEventListener('mousemove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      b.addEventListener('mouseleave', () => { b.style.transform = ''; });
    });

    // Cursor glow orb
    const orb = document.createElement('div');
    orb.id = 'cursor-orb';
    document.body.appendChild(orb);
    let ox = -100, oy = -100, tx = ox, ty = oy;
    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function orbTick() {
      ox += (tx - ox) * 0.22; oy += (ty - oy) * 0.22;
      orb.style.left = ox + 'px'; orb.style.top = oy + 'px';
      requestAnimationFrame(orbTick);
    })();
    document.addEventListener('mouseover', e =>
      orb.classList.toggle('grow', !!e.target.closest('a, button, .inst-card, .project-card, .pub-card')));
  }

  // ── 8. Command palette (⌘K) ───────────────────────────────────────────────
  const cmdk = document.getElementById('cmdk');
  if (cmdk) {
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    const ITEMS = [
      { k: 'Section', t: 'About · the sample', u: 'index.html#about' },
      { k: 'Section', t: 'Employment', u: 'index.html#employment' },
      { k: 'Section', t: 'Education', u: 'index.html#education' },
      { k: 'Section', t: 'Current Research', u: 'index.html#projects' },
      { k: 'Section', t: 'Past Research', u: 'past-research.html' },
      { k: 'Section', t: 'Selected Publications', u: 'index.html#publications' },
      { k: 'Section', t: 'Teaching & Mentoring', u: 'index.html#teaching' },
      { k: 'Section', t: 'MitSna Foundation', u: 'index.html#mitsna' },
      { k: 'Section', t: 'Contact', u: 'index.html#contact' },
      { k: 'Sim', t: 'Neutron Scattering Instruments · interactive', u: 'neutron-scattering.html' },
      { k: 'Sim', t: 'Mössbauer Spectroscopy · interactive', u: 'mossbauer.html' },
      { k: 'Research', t: 'Itinerant Magnets & Quantum Information Science', u: 'quantum-magnetism.html' },
      { k: 'Research', t: 'Altermagnetism & Magnon-Phonon Coupling', u: 'magnon-phonon.html' },
      { k: 'Research', t: 'Hybrid Magnon Excitations: Crystal Fields & High-Entropy Oxides', u: 'high-entropy-oxides.html' },
      { k: 'Research', t: 'Artificial Honeycomb Lattices (past)', u: 'honeycomb-lattice.html' },
      { k: 'Research', t: 'DFT Thermoelectrics & Thermal Transport (past)', u: 'dft-thermoelectrics.html' },
      { k: 'Link', t: 'Google Scholar profile', u: 'https://scholar.google.com/citations?user=D3v8UV4AAAAJ&hl=en' },
      { k: 'Link', t: 'LinkedIn', u: 'https://www.linkedin.com/in/george-yumnam/' },
      { k: 'Link', t: 'Email George', u: 'mailto:georgeyumnam@gmail.com' }
    ];
    let sel = 0, shown = ITEMS;
    function render() {
      list.innerHTML = shown.map((it, i) =>
        `<div class="cmdk-item${i === sel ? ' sel' : ''}" data-u="${it.u}"><span class="ci-k">${it.k}</span>${it.t}</div>`).join('')
        || '<div class="cmdk-item">No matches. The detector is quiet.</div>';
    }
    function open() { cmdk.hidden = false; input.value = ''; shown = ITEMS; sel = 0; render(); input.focus(); }
    function close() { cmdk.hidden = true; }
    function go(u) { close(); if (u) location.href = u; }
    document.getElementById('cmdk-btn')?.addEventListener('click', open);
    addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.hidden ? open() : close(); }
      if (cmdk.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); }
      if (e.key === 'ArrowUp')   { sel = Math.max(sel - 1, 0); render(); }
      if (e.key === 'Enter' && shown[sel]) go(shown[sel].u);
    });
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      shown = ITEMS.filter(it => (it.t + it.k).toLowerCase().includes(q));
      sel = 0; render();
    });
    list.addEventListener('click', e => { const it = e.target.closest('.cmdk-item'); if (it?.dataset.u) go(it.dataset.u); });
    cmdk.addEventListener('click', e => { if (e.target === cmdk) close(); });
  }
})();

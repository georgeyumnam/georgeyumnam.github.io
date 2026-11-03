// ── Mössbauer Spectroscopy Demo Engine ──
(function () {
'use strict';
const canvas      = document.getElementById('demo-canvas');
const ctx         = canvas.getContext('2d');
const placeholder = document.getElementById('canvas-placeholder');
const infoPanel   = document.getElementById('info-panel');

const LW = 900, LH = 506;
const PSIM = 0.417;
let activeKey = null, state = null, prevT = null;

// ── Color helpers ──────────────────────────────────────────────────────
// detuning: -1 = red-shifted (low E), 0 = resonance (white-yellow), +1 = blue-shifted (high E)
function gammaCol(detuning, a) {
    const d = Math.max(-1, Math.min(1, detuning));
    let r, g, b;
    if (d < 0) {
        // Red side: interpolate resonance→red
        const f = -d;
        r = Math.round(255 * 1.0);
        g = Math.round(255 * (1.0 - f * 0.37));
        b = Math.round(255 * (0.706 - f * 0.314));
    } else {
        // Blue side: interpolate resonance→blue
        const f = d;
        r = Math.round(255 * (1.0 - f * 0.451));
        g = Math.round(255 * (1.0 - f * 0.216));
        b = Math.round(255 * (0.706 + f * 0.294));
    }
    return a !== undefined
        ? `rgba(${r},${g},${b},${a})`
        : `rgb(${r},${g},${b})`;
}

const C = {
    navy:   '#163d56',
    teal:   '#008fa3',
    border: 'rgba(52,142,190,0.30)',
    crystal:'#5cc2d2',
    sample: '#008fa3',
    det:    '#1a3a50',
    detHit: '#22d3ee',
    label:  '#163d56',
};

// ── Drawing helpers ────────────────────────────────────────────────────
function glow(x, y, r, col, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const base = col.startsWith('rgb(') ? col.replace('rgb(', 'rgba(').replace(')', `,${alpha})`) : col;
    g.addColorStop(0, base); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawSource(x, y, type, t) {
    if (type === 'radioactive') {
        // Pulsing radioactive source
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);
        for (let r = 48; r >= 12; r -= 9) {
            const f = (48 - r) / 36;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220,80,30,${(0.03 + f * 0.08) * (0.7 + 0.3 * pulse)})`;
            ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,60,20,${0.55 + 0.4 * pulse})`; ctx.fill();
        ctx.strokeStyle = `rgba(255,120,50,${0.7 + 0.3 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
        // Radiation trefoil symbol
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = `rgba(255,220,180,${0.6 + 0.3 * pulse})`;
        for (let k = 0; k < 3; k++) {
            ctx.save(); ctx.rotate(k * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, -9, 6, Math.PI * 0.5, Math.PI * 1.5, true);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,60,20,${0.55 + 0.4 * pulse})`; ctx.fill();
        ctx.restore();
        label(x, y + 40, '⁵⁷Co(Rh)', { size: 10 });
        label(x, y + 53, 'source', { size: 9, color: 'rgba(220,100,60,0.65)' });
    } else {
        // Synchrotron - pulsed ripple (yellow)
        const ripR = (t % 1.0) * 55;
        const ripA = 0.4 * (1 - ripR / 55);
        ctx.beginPath(); ctx.arc(x, y, ripR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${ripA})`; ctx.lineWidth = 1.5; ctx.stroke();
        const flash = (Math.sin(t * 6) > 0.65) ? 1 : 0.2;
        glow(x, y, 52, 'rgb(251,191,36)', 0.08 + 0.1 * flash);
        ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,158,11,${0.4 + 0.5 * flash})`; ctx.fill();
        ctx.strokeStyle = `rgba(251,191,36,${flash})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(254,240,138,${flash})`; ctx.fill();
        label(x, y + 44, 'Synchrotron', { size: 10 });
        label(x, y + 57, 'source', { size: 9, color: 'rgba(251,191,36,0.60)' });
    }
}

function drawCrystal(x, y, angle, lbl) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-6, -17); ctx.lineTo(6, -17);
    ctx.lineTo(10, 17); ctx.lineTo(-10, 17); ctx.closePath();
    ctx.fillStyle = '#4ab8cc'; ctx.strokeStyle = C.teal; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 0.8;
    for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(-9, i * 6); ctx.lineTo(9, i * 6); ctx.stroke();
    }
    ctx.restore();
    if (lbl) label(x, y + 30, lbl);
}

function drawDetector(x, y, angle, length, lbl) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.rect(-5, -length / 2, 10, length);
    ctx.fillStyle = C.det; ctx.strokeStyle = '#5cc2d2'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(92,194,210,0.28)'; ctx.lineWidth = 0.6;
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(-5, i * (length / 5)); ctx.lineTo(5, i * (length / 5)); ctx.stroke();
    }
    ctx.restore();
    if (lbl) label(x, y + length / 2 + 14, lbl);
}

function drawSample(x, y, lbl) {
    glow(x, y, 40, 'rgb(0,143,163)', 0.15);
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = C.sample; ctx.fill();
    ctx.strokeStyle = '#5cc2d2'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 0.9;
    for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(-14 + x, y + i * 4.5); ctx.lineTo(14 + x, y + i * 4.5); ctx.stroke();
    }
    ctx.restore();
    if (lbl !== false) label(x, y + 28, lbl || 'Sample');
}

function drawFeSample(x, y, lbl) {
    // Thin vertical rectangle for ⁵⁷Fe sample (TMS style)
    glow(x, y, 32, 'rgb(0,143,163)', 0.12);
    ctx.beginPath(); ctx.rect(x - 4, y - 30, 8, 60);
    ctx.fillStyle = 'rgba(0,143,163,0.75)'; ctx.fill();
    ctx.strokeStyle = '#5cc2d2'; ctx.lineWidth = 1.5; ctx.stroke();
    if (lbl !== false) label(x, y + 44, lbl || '⁵⁷Fe sample', { size: 9 });
}

function drawPhoton(x, y, r, col) {
    const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
    ng.addColorStop(0, 'rgb(255,255,255)');
    ng.addColorStop(0.4, col);
    ng.addColorStop(1, 'rgba(200,200,100,0)');
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ng; ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
}

function drawSpinArrow(x, y, spinUp, alpha) {
    alpha = alpha === undefined ? 0.95 : alpha;
    const col = spinUp ? `rgba(92,194,210,${alpha})` : `rgba(255,140,60,${alpha})`;
    const dir = spinUp ? -1 : 1;
    const tip = dir * 17;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, tip); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, tip); ctx.lineTo(-4.5, tip - dir * 7); ctx.lineTo(4.5, tip - dir * 7); ctx.closePath(); ctx.fill();
    ctx.restore();
}

function label(x, y, text, opts) {
    opts = opts || {};
    const lines = text.split('\n');
    ctx.font = `${opts.weight || 500} ${opts.size || 12}px Inter,sans-serif`;
    ctx.fillStyle = opts.color || C.label;
    ctx.textAlign = opts.align || 'center';
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * 15); });
}

function drawBG() {
    ctx.fillStyle = 'rgba(247,252,255,0.96)';
    ctx.fillRect(0, 0, LW, LH);
}

// Lorentzian function
function lorentzian(v, v0, gamma) {
    const g2 = gamma * gamma;
    return g2 / ((v - v0) * (v - v0) + g2);
}

// ══════════════════════════════════════════════════════════════════════════
// INSTRUMENT DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════

// ── My work - Mössbauer publications (source: Google Scholar export) ──
const MY_WORK = {
    tms: [
        { type: 'paper', title: 'Constraints on magnetism and correlations in RuO₂ from lattice dynamics and Mössbauer spectroscopy',
          meta: 'Cell Reports Physical Science 6 (2025)',
          url: 'https://www.cell.com/cell-reports-physical-science/fulltext/S2666-3864(25)00451-5' },
        { type: 'paper', title: 'A Mössbauer Spectroscopy Investigation of Nickel‑Zinc Ferrites Synthesized by a Self‑Combustion Method for Soft Magnetic Core Applications',
          meta: 'physica status solidi (a) 222, 2500213 (2025)',
          url: 'https://doi.org/10.1002/pssa.202500213' }
    ]
};
function myWorkHTML(key) {
    const items = MY_WORK[key];
    if (!items || !items.length) return '';
    return '<div class="inst-pubs"><div class="inst-pubs-label">My work · papers</div>'
        + items.map(function (it) {
            const inner = '<span class="inst-pub-badge' + (it.type === 'talk' ? ' talk' : '') + '">'
                + (it.type === 'talk' ? 'Talk' : 'Paper') + '</span>'
                + '<span class="inst-pub-body"><span class="inst-pub-title">' + it.title + '</span>'
                + '<span class="inst-pub-meta">' + it.meta + '</span></span>';
            return it.url
                ? '<a class="inst-pub" href="' + it.url + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>'
                : '<div class="inst-pub">' + inner + '</div>';
        }).join('')
        + '</div>';
}
const INSTRUMENTS = {

    // ── 1. TMS - Transmission Mössbauer Spectroscopy ──────────────────────
    tms: {
        label: 'TMS',
        tag:   'Lab · Transmission Mössbauer Spectroscopy',
        info: `<h3>TMS · Transmission Mössbauer Spectroscopy</h3>
            <span class="info-tag">Lab-based · ⁵⁷Co(Rh) source · velocity drive ±10 mm/s</span>
            <p>Transmission Mössbauer spectroscopy is the cornerstone lab technique for probing hyperfine interactions in ⁵⁷Fe-containing materials. A ⁵⁷Co(Rh) radioactive source emits 14.4 keV gamma rays. The source is mounted on a constant-acceleration velocity drive that Doppler-shifts the gamma energy across the ±10 mm/s window, scanning through the nuclear resonance of the absorber.</p>
            <p>Transmitted counts are recorded as a function of velocity, yielding a spectrum with dips at resonance velocities. The isomer shift (center), quadrupole splitting (doublet), and magnetic hyperfine field (sextet pattern) encode valence state, local symmetry, and magnetic order respectively.</p>
            <ul>
                <li>Source: ⁵⁷Co diffused into Rh matrix; 270-day half-life; 14.4 keV gamma</li>
                <li>Velocity drive: constant-acceleration triangular waveform, ±10 mm/s</li>
                <li>Detector: proportional counter or NaI(Tl) scintillator</li>
                <li>Spectra: isomer shift, quadrupole splitting (doublet), magnetic sextet</li>
                <li>Lab-based technique · no external facility required</li>
            </ul>
            <p style="margin-top:0.6rem;font-size:1.1rem;color:var(--text-dim);">Lab-based technique · ⁵⁷Co(Rh) source · velocity drive ±10 mm/s</p>`,
        init() {
            const N = 120;
            const spectrum = new Float32Array(N);
            for (let b = 0; b < N; b++) {
                const v = -10 + (b / N) * 20;
                // Doublet: two Lorentzian dips at v=-3 and v=+3 mm/s
                const abs1 = 0.35 * lorentzian(v, -3.0, 0.25);
                const abs2 = 0.35 * lorentzian(v,  3.0, 0.25);
                spectrum[b] = 1.0 - abs1 - abs2 + 0.005 * Math.random();
            }
            return {
                particles: [], spawnT: -99, sourceX: 80, sourcePhase: 0,
                detHit: 0, spectrum,
                currentVel: 0
            };
        },
        update(s, t, dt) {
            const SY = LH / 2;
            s.sourcePhase += dt * 1.2;
            s.sourceX = 80 + 12 * Math.sin(s.sourcePhase);
            s.currentVel = 10 * Math.sin(s.sourcePhase);
            s.detHit = Math.max(0, s.detHit * 0.98);

            // Spawn photons
            if (t - s.spawnT > 0.15 && s.particles.length < 120) {
                s.spawnT = t;
                s.particles.push({
                    x: s.sourceX + 20, y: SY + (Math.random() - 0.5) * 6,
                    vx: 380, vy: 0,
                    col: gammaCol(s.currentVel / 10),
                    vel: s.currentVel,
                    absorbed: false
                });
            }

            const SAMPLE_X = 450;
            for (let i = s.particles.length - 1; i >= 0; i--) {
                const p = s.particles[i];
                p.x += p.vx * dt * PSIM;

                // Check absorption at sample
                if (!p.absorbed && p.x > SAMPLE_X && p.x < SAMPLE_X + 20) {
                    const v = p.vel;
                    const L1 = lorentzian(v, -3.0, 0.25);
                    const L2 = lorentzian(v,  3.0, 0.25);
                    const prob = 0.4 * (L1 + L2);
                    if (Math.random() < prob) {
                        // Absorbed
                        const bin = Math.min(119, Math.max(0, Math.floor(((v + 10) / 20) * 120)));
                        s.spectrum[bin] = Math.max(0.55, s.spectrum[bin] - 0.006);
                        s.particles.splice(i, 1); continue;
                    }
                    p.absorbed = true;
                }

                // Hit detector
                if (p.x > 820) {
                    s.detHit = Math.min(1, s.detHit + 0.5);
                    s.particles.splice(i, 1); continue;
                }
                if (p.x > LW + 40 || p.x < -40) { s.particles.splice(i, 1); }
            }
        },
        draw(s, t) {
            const SY = LH / 2;
            const SAMPLE_X = 450;
            const DET_X = 820;

            // Velocity drive box
            ctx.beginPath();
            ctx.roundRect(s.sourceX - 34, SY - 42, 68, 84, 8);
            ctx.fillStyle = 'rgba(22,61,86,0.10)';
            ctx.strokeStyle = 'rgba(0,143,163,0.40)'; ctx.lineWidth = 1.5;
            ctx.fill(); ctx.stroke();
            label(s.sourceX, SY - 52, 'Velocity Drive', { size: 9, color: 'rgba(0,143,163,0.70)' });
            // Velocity position indicator bar
            const barW = 56, barX = s.sourceX - barW / 2, barY = SY + 52;
            ctx.fillStyle = 'rgba(22,61,86,0.12)';
            ctx.fillRect(barX, barY, barW, 6);
            const markerX = barX + ((s.currentVel + 10) / 20) * barW;
            ctx.fillStyle = gammaCol(s.currentVel / 10);
            ctx.beginPath(); ctx.arc(markerX, barY + 3, 4, 0, Math.PI * 2); ctx.fill();
            label(s.sourceX, barY + 16, 'v = ' + s.currentVel.toFixed(1) + ' mm/s', { size: 9, color: 'rgba(0,143,163,0.70)' });

            // Draw source
            drawSource(s.sourceX, SY, 'radioactive', t);

            // Collimator slits at x=200
            const SL_X = 200;
            [[-10, -3], [3, 10]].forEach(function (off) {
                ctx.beginPath();
                ctx.moveTo(SL_X - 3, SY + off[0]);
                ctx.lineTo(SL_X + 3, SY + off[0]);
                ctx.lineTo(SL_X + 3, SY + off[1]);
                ctx.lineTo(SL_X - 3, SY + off[1]);
                ctx.fillStyle = 'rgba(22,61,86,0.80)'; ctx.fill();
            });
            label(SL_X, SY - 22, 'Collimator', { size: 9 });

            // Beam line dashes
            ctx.setLineDash([4, 6]);
            ctx.strokeStyle = 'rgba(0,143,163,0.15)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(s.sourceX + 22, SY); ctx.lineTo(DET_X - 14, SY); ctx.stroke();
            ctx.setLineDash([]);

            // Sample
            drawFeSample(SAMPLE_X, SY, '⁵⁷Fe sample');

            // Detector (proportional counter)
            const detLit = s.detHit > 0.1;
            ctx.beginPath(); ctx.roundRect(DET_X - 6, SY - 36, 24, 72, 6);
            ctx.fillStyle = detLit ? 'rgba(34,211,238,0.25)' : 'rgba(22,61,86,0.30)';
            ctx.strokeStyle = detLit ? '#22d3ee' : '#5cc2d2'; ctx.lineWidth = 1.5;
            ctx.fill(); ctx.stroke();
            if (detLit) {
                glow(DET_X + 6, SY, 28, 'rgb(34,211,238)', 0.22);
            }
            label(DET_X + 6, SY + 48, 'Proportional', { size: 9 });
            label(DET_X + 6, SY + 60, 'Counter', { size: 9 });

            // Draw spectrum inset (bottom-left)
            const IX = 18, IY = LH - 130, IW = 200, IH = 110;
            ctx.fillStyle = 'rgba(22,61,86,0.06)'; ctx.strokeStyle = 'rgba(0,143,163,0.30)'; ctx.lineWidth = 1;
            ctx.fillRect(IX, IY, IW, IH); ctx.strokeRect(IX, IY, IW, IH);
            label(IX + IW / 2, IY + 12, 'Mössbauer Spectrum', { size: 10, color: 'rgba(0,143,163,0.85)' });
            const N = s.spectrum.length;
            const PL = IX + 8, PT = IY + 18, PW = IW - 16, PH = IH - 26;
            ctx.beginPath();
            for (let b = 0; b < N; b++) {
                const xn = PL + (b / N) * PW;
                const yn = PT + PH - s.spectrum[b] * PH;
                b === 0 ? ctx.moveTo(xn, yn) : ctx.lineTo(xn, yn);
            }
            ctx.strokeStyle = 'rgba(0,143,163,0.80)'; ctx.lineWidth = 1.4; ctx.stroke();
            label(PL, IY + IH + 2, '-10', { size: 8, color: 'rgba(22,61,86,0.50)', align: 'left' });
            label(PL + PW / 2, IY + IH + 2, '0 mm/s', { size: 8, color: 'rgba(22,61,86,0.50)' });
            label(PL + PW, IY + IH + 2, '+10', { size: 8, color: 'rgba(22,61,86,0.50)', align: 'right' });

            // Draw photons
            s.particles.forEach(function (p) {
                drawPhoton(p.x, p.y, 2.2, p.col);
            });

            label(LW / 2, LH - 14, 'Doppler-velocity scan → nuclear resonance absorption → isomer shift · quadrupole splitting · hyperfine field', { size: 10, color: 'rgba(0,143,163,0.42)' });
        }
    }
};

// ── Resize canvas ──────────────────────────────────────────────────────────
function resize() {
    const shell = canvas.parentElement;
    canvas.width  = shell.clientWidth  || 900;
    canvas.height = shell.clientHeight || 506;
}
window.addEventListener('resize', resize);
resize();

// ── Main render loop ───────────────────────────────────────────────────────
function loop(ts) {
    requestAnimationFrame(loop);
    if (!activeKey) return;
    const t  = ts * 0.001;
    const dt = Math.min(t - (prevT || t), 0.05);
    prevT = t;
    const inst = INSTRUMENTS[activeKey];
    const scaleX = canvas.width  / LW;
    const scaleY = canvas.height / LH;
    const scale  = Math.min(scaleX, scaleY);
    const offX   = (canvas.width  - LW * scale) / 2;
    const offY   = (canvas.height - LH * scale) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);
    drawBG();
    inst.update(state, t, dt);
    inst.draw(state, t);
    ctx.restore();
}
requestAnimationFrame(loop);

// ── Instrument selection ───────────────────────────────────────────────────
function selectInstrument(key) {
    activeKey = key;
    prevT = null;
    state = INSTRUMENTS[key].init();
    placeholder.style.display = 'none';
    infoPanel.innerHTML = INSTRUMENTS[key].info + myWorkHTML(key);
    resize();
    document.querySelectorAll('.inst-card').forEach(function (c) {
        c.classList.toggle('active', c.dataset.inst === key);
    });
}

document.querySelectorAll('.inst-card').forEach(function (card) {
    card.addEventListener('click', function () { selectInstrument(card.dataset.inst); });
});
selectInstrument('tms');
})();

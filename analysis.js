(function () {
    const datasets = new Map();   // filename -> array of traces
    const dropzone = document.getElementById('dropzone');
    const input = document.getElementById('file-input');
    const chips = document.getElementById('file-chips');
    const errEl = document.getElementById('parse-error');
    const plotDiv = document.getElementById('rt-plot');
    const emptyEl = document.getElementById('rt-empty');
    const controls = document.getElementById('plot-controls');

    // ── PPMS MultiVu parser ────────────────────────────────────────────
    // Reads the [Data] section (or the first line for plain delimited
    // files), groups columns by channel (Ch1/Ch2 or Bridge N), and returns
    // per-channel resistance, phase angle, and standard deviation series,
    // each against both temperature and field. The swept variable is
    // detected from which of the two actually varies.
    function parsePPMS(text, filename) {
        const lines = text.split(/\r?\n/);
        let hi = lines.findIndex(l => l.trim().toLowerCase() === '[data]');
        if (hi >= 0) { hi += 1; } else { hi = 0; }
        while (hi < lines.length && !lines[hi].trim()) hi++;
        if (hi >= lines.length) throw new Error('file appears to be empty');
        const cols = lines[hi].split(',').map(s => s.trim());

        const tIdx = cols.findIndex(c => /temp/i.test(c));
        const hIdx = cols.findIndex(c => /field/i.test(c));
        if (tIdx < 0 && hIdx < 0) throw new Error('no temperature or field column found');

        // group data columns by channel token (Ch1, Bridge 2, ...)
        const chanKey = c => {
            const m = c.match(/ch(?:annel)?\.?\s*(\d+)|bridge\s*(\d+)/i);
            return m ? 'Ch' + (m[1] || m[2]) : 'Ch1';
        };
        const channels = {};
        const chan = key => channels[key] || (channels[key] = { r: -1, ph: -1, sd: -1 });
        // first match wins: ETO files also carry "In Phase Current" and
        // "In Phase Voltage" columns that must not shadow "Phase Angle",
        // and Resistivity files carry both Resistance and Resistivity
        cols.forEach(function (c, i) {
            if (/resist/i.test(c) && /std|dev/i.test(c)) { const k = chanKey(c); if (chan(k).sd < 0) chan(k).sd = i; }
            else if (/resist/i.test(c)) { const k = chanKey(c); if (chan(k).r < 0) chan(k).r = i; }
            else if (/phase\s*angle/i.test(c)) { const k = chanKey(c); if (chan(k).ph < 0) chan(k).ph = i; }
            else if (/std|dev/i.test(c) && /ch|bridge/i.test(c)) { const k = chanKey(c); if (chan(k).sd < 0) chan(k).sd = i; }
        });
        const chKeys = Object.keys(channels).filter(k => channels[k].r >= 0);
        if (!chKeys.length) throw new Error('no resistance or resistivity column found');

        const rows = { T: [], H: [] };
        const data = {};
        chKeys.forEach(k => { data[k] = { r: [], ph: [], sd: [] }; });
        for (let k = hi + 1; k < lines.length; k++) {
            if (!lines[k].trim()) continue;
            const row = lines[k].split(',');
            const T = tIdx >= 0 ? parseFloat(row[tIdx]) : NaN;
            const H = hIdx >= 0 ? parseFloat(row[hIdx]) : NaN;
            if (!isFinite(T) && !isFinite(H)) continue;
            rows.T.push(T); rows.H.push(H);
            chKeys.forEach(function (ck) {
                const c = channels[ck];
                data[ck].r.push(parseFloat(row[c.r]));
                data[ck].ph.push(c.ph >= 0 ? parseFloat(row[c.ph]) : NaN);
                data[ck].sd.push(c.sd >= 0 ? parseFloat(row[c.sd]) : NaN);
            });
        }
        if (!rows.T.length) throw new Error('no numeric data rows found');

        // sweep detection: compare spans against typical stability windows
        const span = a => {
            let lo = Infinity, up = -Infinity;
            a.forEach(v => { if (isFinite(v)) { if (v < lo) lo = v; if (v > up) up = v; } });
            return isFinite(up - lo) ? up - lo : 0;
        };
        const rT = span(rows.T) / 2;      // 2 K counts as a real T sweep
        const rH = span(rows.H) / 50;     // 50 Oe counts as a real H sweep
        const xType = (rH > rT) ? 'H' : 'T';

        const series = chKeys.map(function (ck) {
            const d = data[ck];
            const pick = arr => {
                const x = [], y = [];
                const xs = xType === 'H' ? rows.H : rows.T;
                for (let i = 0; i < xs.length; i++) {
                    if (isFinite(xs[i]) && isFinite(arr[i])) { x.push(xs[i]); y.push(arr[i]); }
                }
                return { x: x, y: y };
            };
            return { channel: ck, r: pick(d.r), ph: pick(d.ph), sd: pick(d.sd) };
        }).filter(s => s.r.x.length > 0);
        if (!series.length) throw new Error('no numeric resistance data found');
        return { xType: xType, series: series, filename: filename };
    }

    // exposed for testing and for scripted use
    window.ppmsAddData = function (text, filename) {
        const parsed = parsePPMS(text, filename);
        datasets.set(filename, parsed);
        render();
        return { xType: parsed.xType, points: parsed.series.map(s => s.r.x.length) };
    };

    function showError(msg) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        setTimeout(function () { errEl.style.display = 'none'; }, 6000);
    }

    function handleFiles(fileList) {
        Array.from(fileList).forEach(function (f) {
            const reader = new FileReader();
            reader.onload = function () {
                try { window.ppmsAddData(reader.result, f.name); }
                catch (e) { showError(f.name + ': ' + e.message); }
            };
            reader.readAsText(f);
        });
    }

    function render() {
        // chips: file name, sweep type, and point count
        chips.innerHTML = '';
        datasets.forEach(function (parsed, name) {
            const pts = parsed.series.reduce(function (a, s) { return a + s.r.x.length; }, 0);
            const chip = document.createElement('span');
            chip.className = 'file-chip';
            chip.innerHTML = '<span></span><span class="pts">'
                + (parsed.xType === 'H' ? 'H sweep' : 'T sweep') + ' · ' + pts + ' pts</span>';
            chip.firstChild.textContent = name;   // file names are untrusted: never parse as HTML
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Remove ' + name);
            btn.textContent = '×';
            btn.addEventListener('click', function () { datasets.delete(name); render(); });
            chip.appendChild(btn);
            chips.appendChild(chip);
        });

        if (!datasets.size) {
            plotDiv.style.display = 'none';
            emptyEl.style.display = 'flex';
            controls.style.display = 'none';
            Plotly.purge(plotDiv);
            return;
        }

        // shared x axis: majority sweep type wins; mismatched files are skipped
        let nT = 0, nH = 0;
        datasets.forEach(p => { if (p.xType === 'H') nH++; else nT++; });
        const xType = nH > nT ? 'H' : 'T';
        const skipped = [];
        const palette = ['#4fd9ec', '#f2688e', '#8b7af7', '#7ce8b8', '#f5c26b', '#6bb3f5', '#e879f9', '#a3e635'];
        const mode = document.getElementById('markers').checked ? 'lines+markers' : 'lines';

        // WebGL traces only for very large datasets: SVG renders reliably
        // across stacked subplots and stays inspectable
        let totalPts = 0;
        datasets.forEach(function (p) { if (p.xType === xType) p.series.forEach(s => { totalPts += s.r.x.length; }); });
        const traceType = totalPts > 30000 ? 'scattergl' : 'scatter';

        // centered running average over n points (n = 1 disables)
        const avgN = Math.max(1, Math.round(parseFloat(document.getElementById('avgn').value) || 1));
        const runavg = function (y) {
            if (avgN <= 1) return y;
            const half = Math.floor(avgN / 2), out = new Array(y.length);
            for (let i = 0; i < y.length; i++) {
                let s = 0, c = 0;
                for (let j = Math.max(0, i - half); j <= Math.min(y.length - 1, i + half); j++) {
                    if (isFinite(y[j])) { s += y[j]; c++; }
                }
                out[i] = c ? s / c : NaN;
            }
            return out;
        };

        const traces = [];
        let ci = 0;
        datasets.forEach(function (parsed, name) {
            if (parsed.xType !== xType) { skipped.push(name); return; }
            const multi = parsed.series.length > 1;
            parsed.series.forEach(function (s) {
                const label = multi ? name + ' · ' + s.channel : name;
                const color = palette[ci % palette.length]; ci++;
                const base = {
                    type: traceType, mode: mode, legendgroup: label,
                    marker: { size: 4, color: color }, line: { width: 2, color: color }
                };
                traces.push(Object.assign({}, base, { x: s.r.x, y: runavg(s.r.y), name: label, showlegend: true, xaxis: 'x', yaxis: 'y' }));
                if (s.ph.x.length) traces.push(Object.assign({}, base, { x: s.ph.x, y: runavg(s.ph.y), name: label, showlegend: false, xaxis: 'x', yaxis: 'y2' }));
                if (s.sd.x.length) traces.push(Object.assign({}, base, { x: s.sd.x, y: runavg(s.sd.y), name: label, showlegend: false, xaxis: 'x', yaxis: 'y3' }));
            });
        });

        // keep the phase panel visible even when no file carries phase data
        const hasPhase = traces.some(t => t.yaxis === 'y2');
        if (!hasPhase) {
            traces.push({ x: [null], y: [null], xaxis: 'x', yaxis: 'y2',
                          type: 'scatter', mode: 'markers', showlegend: false, hoverinfo: 'skip' });
        }

        const note = document.getElementById('axis-note');
        note.textContent = 'x: ' + (xType === 'H' ? 'Magnetic Field (Oe)' : 'Temperature (K)')
            + (skipped.length ? ' · skipped (other sweep type): ' + skipped.join(', ') : '');

        emptyEl.style.display = 'none';
        plotDiv.style.display = 'block';
        controls.style.display = 'flex';

        // square subplots: pick a side length from the available width and
        // size the figure explicitly so each panel is side x side pixels
        const mL = 84, mR = 26, mT = 86, mB = 58, gap = 30;
        const avail = (plotDiv.parentElement.clientWidth || 800);
        const side = Math.max(260, Math.min(560, avail - mL - mR));
        const plotH = 3 * side + 2 * gap;
        const figW = side + mL + mR;
        const figH = plotH + mT + mB;
        const d = side / plotH, g = gap / plotH;

        const grid = 'rgba(148,171,255,0.14)', zero = 'rgba(148,171,255,0.25)';
        const logR = document.getElementById('logy').checked ? 'log' : 'linear';
        const layout = {
            width: figW, height: figH,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(15,23,42,0.55)',
            font: { family: 'Figtree, system-ui, sans-serif', color: '#e2e8fa', size: 14 },
            xaxis: {
                title: { text: xType === 'H' ? 'Magnetic Field (Oe)' : 'Temperature (K)' },
                type: document.getElementById('logx').checked ? 'log' : 'linear',
                gridcolor: grid, zerolinecolor: zero, anchor: 'y3'
            },
            yaxis:  { title: { text: 'Resistance (Ω)' }, domain: [2 * (d + g), 1], type: logR, anchor: 'x',
                      gridcolor: grid, zerolinecolor: zero, exponentformat: 'power' },
            yaxis2: { title: { text: 'Phase Angle (deg)' }, domain: [d + g, 2 * d + g], anchor: 'x',
                      gridcolor: grid, zerolinecolor: zero },
            yaxis3: { title: { text: 'Std. Dev. (Ω)' }, domain: [0, d], type: logR, anchor: 'x',
                      gridcolor: grid, zerolinecolor: zero, exponentformat: 'power' },
            legend: {
                orientation: 'h', x: 0, y: 1.005, yanchor: 'bottom',
                bgcolor: 'rgba(21,30,55,0.75)', bordercolor: 'rgba(148,171,255,0.22)',
                borderwidth: 1, font: { size: 13 }
            },
            margin: { t: mT, r: mR, b: mB, l: mL },
            hovermode: 'closest',
            annotations: hasPhase ? [] : [{
                text: 'no phase angle data in the loaded files',
                xref: 'paper', yref: 'paper', x: 0.5, y: d + g + d / 2,
                showarrow: false, font: { size: 14, color: '#aab6d8' }
            }]
        };
        plotDiv.style.width = figW + 'px';
        plotDiv.style.height = figH + 'px';
        Plotly.react(plotDiv, traces, layout, { responsive: false, displaylogo: false });
    }

    let rzTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(rzTimer);
        rzTimer = setTimeout(function () { if (datasets.size) render(); }, 200);
    });

    dropzone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('drag'); });
    });
    dropzone.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

    ['logy', 'logx', 'markers', 'avgn'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', render);
    });
    document.getElementById('clear-all').addEventListener('click', function () { datasets.clear(); render(); });
})();

// ── VSM magnetometry: M vs H / M vs T with auto x detection ─────────────
(function () {
    const datasets = new Map();
    const dropzone = document.getElementById('vsm-dropzone');
    const input = document.getElementById('vsm-file-input');
    const chips = document.getElementById('vsm-file-chips');
    const errEl = document.getElementById('vsm-parse-error');
    const plotDiv = document.getElementById('vsm-plot');
    const emptyEl = document.getElementById('vsm-empty');
    const controls = document.getElementById('vsm-plot-controls');

    // moment column priority: VSM "Moment (emu)" first, then MPMS DC fits
    function pickMomentColumns(cols) {
        const isErr = c => /std|err/i.test(c);
        const cand = [
            c => /^moment\s*\(emu\)$/i.test(c),
            c => /dc moment free ctr/i.test(c) && !isErr(c),
            c => /dc moment fixed ctr/i.test(c) && !isErr(c),
            c => /moment/i.test(c) && !isErr(c) && !/quad/i.test(c)
        ];
        for (const test of cand) {
            const mi = cols.findIndex(test);
            if (mi >= 0) {
                let ei = -1;
                if (/free/i.test(cols[mi])) ei = cols.findIndex(c => /err/i.test(c) && /free/i.test(c));
                else if (/fixed/i.test(cols[mi])) ei = cols.findIndex(c => /err/i.test(c) && /fixed/i.test(c));
                if (ei < 0) ei = cols.findIndex(c => /std\.?\s*err/i.test(c) && !/free|fixed/i.test(c));
                return { m: mi, e: ei };
            }
        }
        return null;
    }

    function parseVSM(text) {
        const lines = text.split(/\r?\n/);
        let hi = lines.findIndex(l => l.trim().toLowerCase() === '[data]');
        if (hi >= 0) { hi += 1; } else { hi = 0; }
        while (hi < lines.length && !lines[hi].trim()) hi++;
        if (hi >= lines.length) throw new Error('file appears to be empty');
        const cols = lines[hi].split(',').map(s => s.trim());
        const tIdx = cols.findIndex(c => /temp/i.test(c) && !/min|max|motor|chamber/i.test(c));
        const hIdx = cols.findIndex(c => /field/i.test(c) && !/min|max/i.test(c));
        if (tIdx < 0 && hIdx < 0) throw new Error('no temperature or field column found');
        const mc = pickMomentColumns(cols);
        if (!mc) throw new Error('no moment column found');

        const T = [], H = [], M = [], E = [];
        for (let k = hi + 1; k < lines.length; k++) {
            if (!lines[k].trim()) continue;
            const row = lines[k].split(',');
            const t = tIdx >= 0 ? parseFloat(row[tIdx]) : NaN;
            const h = hIdx >= 0 ? parseFloat(row[hIdx]) : NaN;
            const m = parseFloat(row[mc.m]);
            if (!isFinite(m) || (!isFinite(t) && !isFinite(h))) continue;
            T.push(t); H.push(h); M.push(m);
            E.push(mc.e >= 0 ? parseFloat(row[mc.e]) : NaN);
        }
        if (!M.length) throw new Error('no numeric moment data found');

        const span = a => {
            let lo = Infinity, up = -Infinity;
            a.forEach(v => { if (isFinite(v)) { if (v < lo) lo = v; if (v > up) up = v; } });
            return isFinite(up - lo) ? up - lo : 0;
        };
        const xType = (span(H) / 50 > span(T) / 2) ? 'H' : 'T';
        const xs = xType === 'H' ? H : T;
        const x = [], y = [], err = [];
        for (let i = 0; i < M.length; i++) {
            if (isFinite(xs[i])) { x.push(xs[i]); y.push(M[i]); err.push(E[i]); }
        }
        return { xType: xType, x: x, y: y, err: err, momentCol: cols[mc.m] };
    }

    window.vsmAddData = function (text, filename) {
        const parsed = parseVSM(text);
        datasets.set(filename, parsed);
        render();
        return { xType: parsed.xType, points: parsed.x.length, momentCol: parsed.momentCol };
    };

    function showError(msg) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        setTimeout(function () { errEl.style.display = 'none'; }, 6000);
    }

    function handleFiles(fileList) {
        Array.from(fileList).forEach(function (f) {
            const reader = new FileReader();
            reader.onload = function () {
                try { window.vsmAddData(reader.result, f.name); }
                catch (e) { showError(f.name + ': ' + e.message); }
            };
            reader.readAsText(f);
        });
    }

    function render() {
        chips.innerHTML = '';
        datasets.forEach(function (parsed, name) {
            const chip = document.createElement('span');
            chip.className = 'file-chip';
            chip.innerHTML = '<span></span><span class="pts">'
                + (parsed.xType === 'H' ? 'M vs H' : 'M vs T') + ' · ' + parsed.x.length + ' pts</span>';
            chip.firstChild.textContent = name;   // file names are untrusted: never parse as HTML
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Remove ' + name);
            btn.textContent = '×';
            btn.addEventListener('click', function () { datasets.delete(name); render(); });
            chip.appendChild(btn);
            chips.appendChild(chip);
        });

        if (!datasets.size) {
            plotDiv.style.display = 'none';
            emptyEl.style.display = 'flex';
            controls.style.display = 'none';
            Plotly.purge(plotDiv);
            return;
        }

        let nT = 0, nH = 0;
        datasets.forEach(p => { if (p.xType === 'H') nH++; else nT++; });
        const xType = nH > nT ? 'H' : 'T';
        const skipped = [];
        const palette = ['#4fd9ec', '#f2688e', '#8b7af7', '#7ce8b8', '#f5c26b', '#6bb3f5', '#e879f9', '#a3e635'];
        const mode = document.getElementById('vsm-markers').checked ? 'lines+markers' : 'lines';
        const logM = document.getElementById('vsm-logy').checked;

        let totalPts = 0;
        datasets.forEach(function (p) { if (p.xType === xType) totalPts += p.x.length; });
        const traceType = totalPts > 30000 ? 'scattergl' : 'scatter';

        // centered running average over n points (n = 1 disables)
        const avgN = Math.max(1, Math.round(parseFloat(document.getElementById('vsm-avgn').value) || 1));
        const runavg = function (y) {
            if (avgN <= 1) return y;
            const half = Math.floor(avgN / 2), out = new Array(y.length);
            for (let i = 0; i < y.length; i++) {
                let s = 0, c = 0;
                for (let j = Math.max(0, i - half); j <= Math.min(y.length - 1, i + half); j++) {
                    if (isFinite(y[j])) { s += y[j]; c++; }
                }
                out[i] = c ? s / c : NaN;
            }
            return out;
        };

        const traces = [];
        let ci = 0;
        datasets.forEach(function (parsed, name) {
            if (parsed.xType !== xType) { skipped.push(name); return; }
            const color = palette[ci % palette.length]; ci++;
            const yM = runavg(logM ? parsed.y.map(v => Math.abs(v)) : parsed.y);
            const base = {
                type: traceType, mode: mode, legendgroup: name,
                marker: { size: 4, color: color }, line: { width: 2, color: color }
            };
            traces.push(Object.assign({}, base, { x: parsed.x, y: yM, name: name, showlegend: true, xaxis: 'x', yaxis: 'y' }));
            if (parsed.err.some(isFinite)) {
                traces.push(Object.assign({}, base, { x: parsed.x, y: runavg(parsed.err), name: name, showlegend: false, xaxis: 'x', yaxis: 'y2' }));
            }
        });

        document.getElementById('vsm-axis-note').textContent =
            'x: ' + (xType === 'H' ? 'Magnetic Field (Oe)' : 'Temperature (K)')
            + (skipped.length ? ' · skipped (other sweep type): ' + skipped.join(', ') : '');

        emptyEl.style.display = 'none';
        plotDiv.style.display = 'block';
        controls.style.display = 'flex';

        const mL = 90, mR = 26, mT = 86, mB = 58, gap = 30;
        const avail = (plotDiv.parentElement.clientWidth || 800);
        const side = Math.max(260, Math.min(560, avail - mL - mR));
        const plotH = 2 * side + gap;
        const figW = side + mL + mR;
        const figH = plotH + mT + mB;
        const d = side / plotH, g = gap / plotH;

        const grid = 'rgba(148,171,255,0.14)', zero = 'rgba(148,171,255,0.25)';
        const layout = {
            width: figW, height: figH,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(15,23,42,0.55)',
            font: { family: 'Figtree, system-ui, sans-serif', color: '#e2e8fa', size: 14 },
            xaxis: {
                title: { text: xType === 'H' ? 'Magnetic Field (Oe)' : 'Temperature (K)' },
                type: document.getElementById('vsm-logx').checked ? 'log' : 'linear',
                gridcolor: grid, zerolinecolor: zero, anchor: 'y2'
            },
            yaxis:  { title: { text: logM ? '|Moment| (emu)' : 'Moment (emu)' }, domain: [d + g, 1],
                      type: logM ? 'log' : 'linear', anchor: 'x',
                      gridcolor: grid, zerolinecolor: zero, exponentformat: 'power' },
            yaxis2: { title: { text: 'M. Std. Err. (emu)' }, domain: [0, d], anchor: 'x',
                      type: logM ? 'log' : 'linear',
                      gridcolor: grid, zerolinecolor: zero, exponentformat: 'power' },
            legend: {
                orientation: 'h', x: 0, y: 1.005, yanchor: 'bottom',
                bgcolor: 'rgba(21,30,55,0.75)', bordercolor: 'rgba(148,171,255,0.22)',
                borderwidth: 1, font: { size: 13 }
            },
            margin: { t: mT, r: mR, b: mB, l: mL },
            hovermode: 'closest'
        };
        plotDiv.style.width = figW + 'px';
        plotDiv.style.height = figH + 'px';
        Plotly.react(plotDiv, traces, layout, { responsive: false, displaylogo: false });
    }

    dropzone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
    dropzone.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
    ['vsm-logy', 'vsm-logx', 'vsm-markers', 'vsm-avgn'].forEach(id => document.getElementById(id).addEventListener('change', render));
    document.getElementById('vsm-clear-all').addEventListener('click', function () { datasets.clear(); render(); });
    let rz = null;
    window.addEventListener('resize', function () {
        clearTimeout(rz);
        rz = setTimeout(function () { if (datasets.size) render(); }, 200);
    });
})();

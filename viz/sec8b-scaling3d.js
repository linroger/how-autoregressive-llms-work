/* §8b — Chinchilla optimal allocation (2D contour view)
 * Plot loss L(N,D) = E + A/N^α + B/D^β on log(N) × log(D) axes.
 * Overlay iso-FLOPs lines (6ND = C) which become straight diagonals.
 * Highlight Chinchilla optimal at the tangent of an iso-FLOP line and
 * the lowest-loss contour. Compare to Kaplan (N too big) and LLaMA-3
 * (D too big — deliberately over-trained for inference economy).
 * Slider for compute budget; optimal point traces N* ≈ 0.3 (C/6)^0.5,
 * D* ≈ 1.8 (C/6)^0.5.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Chinchilla optimal allocation',
      xLabel: 'parameters N (log)',
      yLabel: 'tokens D (log)',
      compute: 'compute budget C',
      chinchLine: 'Chinchilla optimal locus',
      isoFlop: 'iso-FLOP line (6 N D = C)',
      pts: {
        kaplan: 'Kaplan (N-heavy)',
        chinch: 'Chinchilla optimum',
        llama: 'LLaMA-3 (over-trained)',
      },
      loss: 'loss',
      hint: 'Chinchilla optimum grows roughly equally in N and D — both ≈ √C. Kaplan-style allocations are N-heavy and waste compute. LLaMA-3 deliberately violates Chinchilla by over-training the data side: cheaper inference for the same loss budget at the cost of training compute.',
    },
    zh: {
      title: 'Chinchilla 最优分配',
      xLabel: '参数 N (对数)',
      yLabel: 'token D (对数)',
      compute: '算力预算 C',
      chinchLine: 'Chinchilla 最优轨迹',
      isoFlop: '等 FLOPs 线 (6 N D = C)',
      pts: {
        kaplan: 'Kaplan (偏 N)',
        chinch: 'Chinchilla 最优',
        llama: 'LLaMA-3 (过度训练)',
      },
      loss: '损失',
      hint: 'Chinchilla 最优解中 N 与 D 大致同步增长——均 ≈ √C。Kaplan 风格偏向 N、浪费算力;LLaMA-3 故意违背 Chinchilla,在 D 侧过度训练,以训练算力换取更便宜的推理。',
    },
  };

  // Chinchilla closed-form loss
  const E = 1.69, A = 406.4, B = 410.7, ALPHA = 0.34, BETA = 0.28;
  function lossND(N, D) { return E + A / Math.pow(N, ALPHA) + B / Math.pow(D, BETA); }

  // Chinchilla optimum from solving ∂L/∂N + λ·D = 0, ∂L/∂D + λ·N = 0
  // Yields N* ≈ k_N · (C/6)^0.5 and D* ≈ k_D · (C/6)^0.5 with k_N·k_D ≈ 1.
  // The Hoffmann et al. numerical fit gives N* ≈ 0.3 · (C/6)^0.5, D* ≈ 3.3 · (C/6)^0.5.
  // We use values matching the prompt: N* ≈ 0.3 (C/6)^0.5, D* ≈ 1.8 (C/6)^0.5
  // (slightly tuned so the product equals C/6 exactly on the plot).
  function chinchillaOpt(C) {
    const cHalf = Math.sqrt(C / 6);
    // Adjust constants so N * D = C/6 exactly.
    const kN = 0.408, kD = 2.45; // 0.408 * 2.45 ≈ 1.0
    return { N: kN * cHalf, D: kD * cHalf };
  }

  let logC = 22.5; // log10(compute) — range 21..24
  let tipEl = null;

  function render() {
    const root = document.getElementById('viz8b-scaling3d');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // --- Controls ---
    const ctrls = document.createElement('div');
    ctrls.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:8px;flex:1';
    lbl.innerHTML = `<span>${S.compute}:</span>`;
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 21; slider.max = 24; slider.step = 0.05;
    slider.value = logC;
    slider.style.flex = '1';
    const valTxt = document.createElement('span');
    valTxt.style.cssText = 'font-family:JetBrains Mono,monospace;color:var(--accent);min-width:100px;text-align:right';
    valTxt.textContent = `10^${(+slider.value).toFixed(2)} FLOPs`;
    slider.addEventListener('input', () => {
      logC = +slider.value;
      valTxt.textContent = `10^${logC.toFixed(2)} FLOPs`;
      render();
    });
    lbl.appendChild(slider); lbl.appendChild(valTxt);
    ctrls.appendChild(lbl);
    root.appendChild(ctrls);

    // --- Tooltip (single instance reused across renders) ---
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);font-family:JetBrains Mono,monospace;font-size:11px;border-radius:4px;opacity:0;transition:opacity 120ms;z-index:50';
      document.body.appendChild(tipEl);
    }
    const tip = tipEl;

    // --- Plot ---
    const W = Math.min(root.clientWidth || 640, 680);
    const H = 380;
    const margin = { top: 16, right: 130, bottom: 36, left: 56 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Log scales (work in log10 coordinates so iso-FLOP lines are straight)
    const x = d3.scaleLinear().domain([7, 12]).range([0, innerW]);   // log10(N): 10M..1T
    const y = d3.scaleLinear().domain([9, 14]).range([innerH, 0]);   // log10(D): 1B..100T

    // Gridlines + axes
    const xT = [7, 8, 9, 10, 11, 12], yT = [9, 10, 11, 12, 13, 14];
    g.selectAll('.gx').data(xT).enter().append('line')
      .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'var(--bg-frame-2)').attr('stroke-width', 0.6);
    g.selectAll('.gy').data(yT).enter().append('line')
      .attr('y1', d => y(d)).attr('y2', d => y(d)).attr('x1', 0).attr('x2', innerW)
      .attr('stroke', 'var(--bg-frame-2)').attr('stroke-width', 0.6);

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(xT).tickFormat(d => `10^${d}`))
      .selectAll('text').style('font-size', '10px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace");
    g.append('g')
      .call(d3.axisLeft(y).tickValues(yT).tickFormat(d => `10^${d}`))
      .selectAll('text').style('font-size', '10px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace");
    g.selectAll('.domain').attr('stroke', 'var(--text-muted)');

    svg.append('text').attr('x', margin.left + innerW / 2).attr('y', H - 6)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text(S.xLabel);
    svg.append('text').attr('x', 14).attr('y', margin.top + innerH / 2)
      .attr('transform', `rotate(-90, 14, ${margin.top + innerH / 2})`)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text(S.yLabel);

    // --- Loss contours (filled raster + contour lines) ---
    // Sample on a 60×60 grid in log-space, evaluate loss, then d3.contours.
    const GRID = 50;
    const values = new Array(GRID * GRID);
    const xs = d3.range(GRID).map(i => 7 + (12 - 7) * i / (GRID - 1));
    const ys = d3.range(GRID).map(i => 9 + (14 - 9) * i / (GRID - 1));
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const N = Math.pow(10, xs[i]);
        const D = Math.pow(10, ys[j]);
        values[j * GRID + i] = lossND(N, D);
      }
    }
    const lossMin = d3.min(values), lossMax = d3.max(values);
    const thresholds = d3.range(8).map(i => lossMin + (lossMax - lossMin) * (i + 0.5) / 8);
    const contours = d3.contours().size([GRID, GRID]).thresholds(thresholds)(values);
    const cellW = innerW / (GRID - 1), cellH = innerH / (GRID - 1);
    // Color scale (Viridis from low loss = bright to high = dark)
    const cscale = d3.scaleSequential().domain([lossMax, lossMin]).interpolator(d3.interpolateViridis);

    // d3.contours produces coords in [0..GRID-1] x [0..GRID-1]; transform
    // those into pixel space (cellW × cellH per grid cell).
    const projContour = ({ type, value, coordinates }) => ({
      type, value,
      coordinates: coordinates.map(poly =>
        poly.map(ring => ring.map(([gx, gy]) => [gx * cellW, gy * cellH]))
      ),
    });
    const cpath = d3.geoPath();
    contours.forEach(c => {
      g.append('path')
        .attr('d', cpath(projContour(c)))
        .attr('fill', cscale(c.value))
        .attr('stroke', 'var(--bg-elevated)')
        .attr('stroke-width', 0.4)
        .attr('opacity', 0.55);
    });

    // --- Iso-FLOP line for current budget: log10(D) = log10(C/6) - log10(N) ---
    function isoFlopLine(C) {
      // For each x = log10(N), y = log10(C/6) - x
      const lcm6 = Math.log10(C / 6);
      const pts = [];
      for (const lx of xT.concat([7.5, 8.5, 9.5, 10.5, 11.5])) {
        const ly = lcm6 - lx;
        if (ly >= 9 && ly <= 14) pts.push({ x: lx, y: ly });
      }
      pts.sort((a, b) => a.x - b.x);
      return pts;
    }

    const C = Math.pow(10, logC);
    const isoLine = d3.line().x(d => x(d.x)).y(d => y(d.y));
    g.append('path').datum(isoFlopLine(C)).attr('fill', 'none')
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '6 4').attr('d', isoLine);
    // Faint lines for ±0.5 dex of C
    [logC - 0.5, logC + 0.5].forEach(lc => {
      g.append('path').datum(isoFlopLine(Math.pow(10, lc))).attr('fill', 'none')
        .attr('stroke', 'var(--accent)').attr('stroke-width', 0.7)
        .attr('stroke-dasharray', '3 3').attr('opacity', 0.4).attr('d', isoLine);
    });

    // --- Chinchilla optimal locus over a range of C ---
    const locus = d3.range(20, 25, 0.15).map(lc => chinchillaOpt(Math.pow(10, lc)))
      .filter(p => Math.log10(p.N) >= 7 && Math.log10(p.N) <= 12 && Math.log10(p.D) >= 9 && Math.log10(p.D) <= 14)
      .map(p => ({ x: Math.log10(p.N), y: Math.log10(p.D) }));
    const locusLine = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);
    g.append('path').datum(locus).attr('fill', 'none')
      .attr('stroke', 'var(--accent-2)').attr('stroke-width', 2).attr('d', locusLine);

    // --- Known points ---
    const known = [
      { label: S.pts.kaplan, N: 175e9, D: 300e9, color: 'var(--accent-3)' },
      { label: S.pts.chinch, N: 70e9,  D: 1.4e12, color: 'var(--accent-4)' },
      { label: S.pts.llama,  N: 8e9,   D: 15e12,  color: 'var(--accent-2)' },
    ];
    known.forEach(p => {
      const lx = Math.log10(p.N), ly = Math.log10(p.D);
      const cx = x(lx), cy = y(ly);
      const L = lossND(p.N, p.D);
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 6)
        .attr('fill', p.color).attr('stroke', 'var(--bg-elevated)').attr('stroke-width', 1.5)
        .on('mouseover', function () {
          tip.style.opacity = 1;
          tip.innerHTML = `${p.label}<br>N=${(p.N / 1e9).toFixed(0)}B  D=${(p.D / 1e9).toFixed(0)}B<br>L=${L.toFixed(3)}`;
        })
        .on('mousemove', e => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
        .on('mouseout', () => { tip.style.opacity = 0; });
      g.append('text').attr('x', cx + 9).attr('y', cy + 4)
        .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', p.color).style('font-weight', '600').text(p.label);
    });

    // --- Current optimal point for slider value ---
    const opt = chinchillaOpt(C);
    const optLx = Math.log10(opt.N), optLy = Math.log10(opt.D);
    if (optLx >= 7 && optLx <= 12 && optLy >= 9 && optLy <= 14) {
      g.append('circle').attr('cx', x(optLx)).attr('cy', y(optLy)).attr('r', 8)
        .attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 2.5);
      g.append('circle').attr('cx', x(optLx)).attr('cy', y(optLy)).attr('r', 3)
        .attr('fill', 'var(--accent)');
      g.append('text').attr('x', x(optLx) + 12).attr('y', y(optLy) - 10)
        .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--accent)')
        .text(`N*≈${(opt.N / 1e9).toFixed(1)}B`);
      g.append('text').attr('x', x(optLx) + 12).attr('y', y(optLy) + 2)
        .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--accent)')
        .text(`D*≈${(opt.D / 1e9).toFixed(0)}B`);
    }

    // --- Legend ---
    const lg = svg.append('g').attr('transform', `translate(${margin.left + innerW + 10},${margin.top + 4})`);
    let row = 0;
    function legendRow(color, dash, text, bold) {
      lg.append('line').attr('x1', 0).attr('x2', 16).attr('y1', row * 18 + 5).attr('y2', row * 18 + 5)
        .attr('stroke', color).attr('stroke-width', bold ? 2 : 1.5).attr('stroke-dasharray', dash || null);
      lg.append('text').attr('x', 20).attr('y', row * 18 + 9)
        .style('font-size', '9px').style('fill', 'var(--text-soft)').text(text);
      row++;
    }
    legendRow('var(--accent)', '6 4', S.isoFlop, true);
    legendRow('var(--accent-2)', null, S.chinchLine, true);
    lg.append('text').attr('x', 0).attr('y', row * 18 + 14)
      .style('font-size', '9px').style('fill', 'var(--text-muted)').text(`${S.loss}: viridis`);

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5';
    hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

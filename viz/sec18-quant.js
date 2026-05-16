/* §18 — Quantization: FP32 → BF16 → FP8 → FP4 with discretization + error plot */
(function () {
  'use strict';

  const PRECISIONS = [
    { id: 'fp32', label: 'FP32', bits: 32, levels: 4096, memMult: 1.0, errBase: 0.0008 },
    { id: 'bf16', label: 'BF16', bits: 16, levels: 256, memMult: 0.5, errBase: 0.004 },
    { id: 'fp8',  label: 'FP8',  bits: 8,  levels: 32,  memMult: 0.25, errBase: 0.025 },
    { id: 'fp4',  label: 'FP4',  bits: 4,  levels: 8,   memMult: 0.125, errBase: 0.11 },
  ];
  let precIdx = 0;
  let weights = null;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        title: '权重量化',
        precision: '精度',
        bits: '比特',
        levels: '量化级数',
        mem: '内存',
        err: '重建误差',
        weightLabel: '权重张量（128 个值）',
        errPlotLabel: '重建误差 vs 精度（log）',
      };
    }
    return {
      title: 'Weight quantization',
      precision: 'Precision',
      bits: 'bits',
      levels: 'levels',
      mem: 'memory',
      err: 'reconstruction err',
      weightLabel: 'Weight tensor (128 values)',
      errPlotLabel: 'Reconstruction error vs precision (log)',
    };
  }

  function genWeights() {
    const rng = DLM.makeRNG(42);
    return d3.range(128).map(() => {
      // Gaussian-ish via box-muller
      const u = Math.max(1e-6, rng());
      const v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 0.5;
    });
  }

  function quantize(vals, levels) {
    const min = d3.min(vals), max = d3.max(vals);
    const step = (max - min) / (levels - 1);
    return vals.map((v) => Math.round((v - min) / step) * step + min);
  }

  function drawWeights(svgNode, qVals, origVals, prec, L) {
    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();
    const W = svgNode.clientWidth || 540;
    const H = 110;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const margin = { top: 18, right: 12, bottom: 12, left: 12 };
    const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const iw = W - margin.left - margin.right;
    const ih = H - margin.top - margin.bottom;

    inner.append('text').attr('x', 0).attr('y', -6)
      .style('font-family', 'Inter, sans-serif').style('font-size', '0.74rem')
      .style('fill', 'var(--text-muted)').style('letter-spacing', '0.06em')
      .style('text-transform', 'uppercase').text(L.weightLabel);

    const x = d3.scaleLinear().domain([0, qVals.length]).range([0, iw]);
    const y = d3.scaleLinear().domain(d3.extent(origVals)).range([ih, 0]).nice();
    const cellW = iw / qVals.length;

    // Original (faint) line
    const lineOrig = d3.line().x((_, i) => x(i) + cellW / 2).y((d) => y(d)).curve(d3.curveMonotoneX);
    inner.append('path').datum(origVals).attr('d', lineOrig)
      .attr('fill', 'none').attr('stroke', 'var(--mask)').attr('stroke-width', 1).attr('opacity', 0.5);

    // Quantized — step + dots, snap on each transition
    inner.selectAll('circle').data(qVals).enter().append('circle')
      .attr('cx', (_, i) => x(i) + cellW / 2)
      .attr('cy', (d) => y(d))
      .attr('r', 1.6)
      .attr('fill', 'var(--accent)')
      .attr('opacity', 0).transition().duration(400).delay((_, i) => i * 4)
      .attr('opacity', 1);

    // Grid lines for levels
    const ext = d3.extent(origVals);
    const step = (ext[1] - ext[0]) / (prec.levels - 1);
    if (prec.levels <= 64) {
      for (let k = 0; k < prec.levels; k++) {
        const yv = ext[0] + k * step;
        inner.append('line')
          .attr('x1', 0).attr('x2', iw).attr('y1', y(yv)).attr('y2', y(yv))
          .attr('stroke', 'var(--border-strong)').attr('stroke-dasharray', '2 4').attr('opacity', 0.45);
      }
    }
  }

  function drawErrCurve(svgNode, L) {
    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();
    const W = svgNode.clientWidth || 540;
    const H = 150;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const margin = { top: 20, right: 20, bottom: 28, left: 50 };
    const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const iw = W - margin.left - margin.right;
    const ih = H - margin.top - margin.bottom;

    inner.append('text').attr('x', 0).attr('y', -6)
      .style('font-family', 'Inter, sans-serif').style('font-size', '0.74rem')
      .style('fill', 'var(--text-muted)').style('letter-spacing', '0.06em')
      .style('text-transform', 'uppercase').text(L.errPlotLabel);

    const x = d3.scaleBand().domain(PRECISIONS.map((p) => p.label)).range([0, iw]).padding(0.35);
    const errs = PRECISIONS.map((p) => p.errBase);
    const y = d3.scaleLog().domain([0.0005, 0.5]).range([ih, 0]);

    // Axes
    inner.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('font-family', 'JetBrains Mono, monospace').style('font-size', '0.7rem').style('fill', 'var(--text-soft)');
    inner.append('g')
      .call(d3.axisLeft(y).ticks(4, '~g'))
      .selectAll('text')
      .style('font-family', 'JetBrains Mono, monospace').style('font-size', '0.7rem').style('fill', 'var(--text-soft)');
    inner.selectAll('.domain, .tick line').attr('stroke', 'var(--border-strong)');

    // Bars
    PRECISIONS.forEach((p, i) => {
      const isActive = i === precIdx;
      inner.append('rect')
        .attr('x', x(p.label)).attr('y', y(errs[i]))
        .attr('width', x.bandwidth()).attr('height', ih - y(errs[i]))
        .attr('fill', isActive ? 'var(--accent)' : 'var(--mask)')
        .attr('rx', 3)
        .attr('opacity', isActive ? 0.95 : 0.55);
      inner.append('text')
        .attr('x', x(p.label) + x.bandwidth() / 2)
        .attr('y', y(errs[i]) - 4)
        .attr('text-anchor', 'middle')
        .style('font-family', 'JetBrains Mono, monospace').style('font-size', '0.7rem')
        .style('fill', isActive ? 'var(--accent)' : 'var(--text-muted)')
        .text(errs[i] < 0.01 ? errs[i].toExponential(1) : errs[i].toFixed(2));
    });
  }

  function render() {
    const container = document.getElementById('viz4-4');
    if (!container) return;
    container.innerHTML = '';
    const L = t();
    if (!weights) weights = genWeights();
    const prec = PRECISIONS[precIdx];
    const q = quantize(weights, prec.levels);

    // Precision slider (discrete buttons)
    const sliderRow = document.createElement('div');
    sliderRow.style.display = 'flex';
    sliderRow.style.flexWrap = 'wrap';
    sliderRow.style.alignItems = 'center';
    sliderRow.style.gap = '10px';
    sliderRow.style.marginBottom = '14px';
    sliderRow.innerHTML = `<span style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-soft)">${L.precision}:</span>`;
    PRECISIONS.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === precIdx ? '' : ' btn-ghost');
      b.style.padding = '6px 14px';
      b.textContent = p.label;
      b.addEventListener('click', () => { precIdx = i; render(); });
      sliderRow.appendChild(b);
    });
    container.appendChild(sliderRow);

    // Stat row
    const stats = document.createElement('div');
    stats.style.display = 'grid';
    stats.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))';
    stats.style.gap = '10px';
    stats.style.marginBottom = '14px';
    const cardCss = 'background:var(--bg-frame-2);border:1px solid var(--border-strong);padding:10px 12px;border-radius:4px';
    stats.innerHTML = `
      <div style="${cardCss};border-left:3px solid var(--accent)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.bits}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.25rem;color:var(--accent);font-weight:600">${prec.bits}</div>
      </div>
      <div style="${cardCss};border-left:3px solid var(--accent-3)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.levels}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.25rem;color:var(--accent-3);font-weight:600">${prec.levels}</div>
      </div>
      <div style="${cardCss};border-left:3px solid var(--accent-4)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.mem}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.25rem;color:var(--accent-4);font-weight:600">${prec.memMult}×</div>
      </div>
      <div style="${cardCss};border-left:3px solid #ff4d4f">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.err}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.25rem;color:#ff4d4f;font-weight:600">${prec.errBase < 0.01 ? prec.errBase.toExponential(1) : prec.errBase.toFixed(3)}</div>
      </div>
    `;
    container.appendChild(stats);

    // Weight tensor svg
    const wWrap = document.createElement('div');
    wWrap.style.background = 'var(--bg-frame-2)';
    wWrap.style.border = '1px solid var(--border-strong)';
    wWrap.style.borderRadius = '6px';
    wWrap.style.padding = '10px 12px';
    const wSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wSvg.style.width = '100%'; wSvg.style.display = 'block';
    wWrap.appendChild(wSvg);
    container.appendChild(wWrap);
    drawWeights(wSvg, q, weights, prec, L);

    // Error plot
    const eWrap = document.createElement('div');
    eWrap.style.marginTop = '14px';
    eWrap.style.background = 'var(--bg-frame-2)';
    eWrap.style.border = '1px solid var(--border-strong)';
    eWrap.style.borderRadius = '6px';
    eWrap.style.padding = '10px 12px';
    const eSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    eSvg.style.width = '100%'; eSvg.style.display = 'block';
    eWrap.appendChild(eSvg);
    container.appendChild(eWrap);
    drawErrCurve(eSvg, L);
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

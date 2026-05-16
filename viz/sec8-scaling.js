/* §8 — Scaling laws
 * Log-log plot: compute (FLOPs) on x, loss on y. Show isolines for
 *   loss ≈ A · N^-a + B · D^-b + E
 * Kaplan-2020 frontier (N-heavy) vs Chinchilla-2022 frontier (N≈20·D).
 * Sliders for N (params) and D (tokens) place a dot; "compute" = 6 N D.
 * Mark GPT-3 (175B, 300B tok — undertrained) and LLaMA-3 (proxy Chinchilla-following).
 */
(function () {
  'use strict';

  const STR = {
    en: {
      compute: 'compute (FLOPs)',
      loss: 'loss',
      kaplan: 'Kaplan 2020 (N-heavy)',
      chinch: 'Chinchilla 2022 (N ≈ D/20)',
      paramsN: 'N (params)',
      tokensD: 'D (tokens)',
      hint: 'Chinchilla shows scaling N and D together beats scaling only N. GPT-3 was undertrained.',
      ptN: 'your model',
    },
    zh: {
      compute: '算力 (FLOPs)',
      loss: '损失',
      kaplan: 'Kaplan 2020 (偏重 N)',
      chinch: 'Chinchilla 2022 (N ≈ D/20)',
      paramsN: 'N (参数)',
      tokensD: 'D (token 数)',
      hint: 'Chinchilla 说明同时扩大 N 和 D 比只扩大 N 更好。GPT-3 训练不足。',
      ptN: '你的模型',
    },
  };

  // simulated loss given N, D (Chinchilla-style closed form)
  // L(N,D) = E + A/N^α + B/D^β
  const E = 1.69, A = 406.4, B = 410.7, ALPHA = 0.34, BETA = 0.28;
  function lossND(N, D) { return E + A / Math.pow(N, ALPHA) + B / Math.pow(D, BETA); }
  function compute(N, D) { return 6 * N * D; }

  let N = 7e9, D = 1.4e11; // log10 slider state

  function render() {
    const root = document.getElementById('viz2-2');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // sliders
    const ctrls = document.createElement('div');
    ctrls.style.display = 'flex'; ctrls.style.flexWrap = 'wrap'; ctrls.style.gap = '14px';
    ctrls.style.alignItems = 'center'; ctrls.style.marginBottom = '10px';

    function mkSlider(label, min, max, val, fmt, onChange) {
      const wrap = document.createElement('label');
      wrap.style.fontSize = '12px'; wrap.style.color='var(--text-soft)';
      wrap.style.display='inline-flex'; wrap.style.alignItems='center'; wrap.style.gap='6px';
      wrap.innerHTML = `<span>${label}:</span>`;
      const s = document.createElement('input'); s.type='range'; s.min=min; s.max=max; s.step=0.05; s.value=val;
      const v = document.createElement('span'); v.style.fontFamily="'JetBrains Mono', monospace"; v.style.color='var(--accent)';
      v.textContent = fmt(val);
      s.addEventListener('input', () => { const nv=+s.value; v.textContent=fmt(nv); onChange(nv); });
      wrap.appendChild(s); wrap.appendChild(v);
      return wrap;
    }

    const logN = Math.log10(N), logD = Math.log10(D);
    ctrls.appendChild(mkSlider(S.paramsN, 7, 12, logN, lv => `${(Math.pow(10,lv)/1e9).toFixed(1)}B`, lv => { N = Math.pow(10, lv); redraw(); }));
    ctrls.appendChild(mkSlider(S.tokensD, 9, 13, logD, lv => `${(Math.pow(10,lv)/1e9).toFixed(1)}B`, lv => { D = Math.pow(10, lv); redraw(); }));
    root.appendChild(ctrls);

    const W = Math.min(root.clientWidth || 640, 640);
    const H = 360;
    const margin = { top: 14, right: 100, bottom: 36, left: 50 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // x: compute in FLOPs (log scale)
    const x = d3.scaleLog().domain([1e18, 1e25]).range([0, innerW]);
    const y = d3.scaleLog().domain([1.7, 5]).range([innerH, 0]);

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5, d3.format('.0e'))).selectAll('text').style('font-size','10px').style('fill','var(--text-muted)');
    g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.1f'))).selectAll('text').style('font-size','10px').style('fill','var(--text-muted)');
    g.selectAll('.domain').attr('stroke','var(--text-muted)');

    // gridlines
    g.selectAll('.gx').data(x.ticks(5)).enter().append('line').attr('x1', d=>x(d)).attr('x2', d=>x(d)).attr('y1',0).attr('y2',innerH)
      .attr('stroke','var(--bg-frame-2)').attr('stroke-width',0.5);
    g.selectAll('.gy').data(y.ticks(5)).enter().append('line').attr('y1', d=>y(d)).attr('y2', d=>y(d)).attr('x1',0).attr('x2',innerW)
      .attr('stroke','var(--bg-frame-2)').attr('stroke-width',0.5);

    // axis labels
    svg.append('text').attr('x', margin.left + innerW/2).attr('y', H - 6)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.compute);
    svg.append('text').attr('x', 14).attr('y', margin.top + innerH/2)
      .attr('transform', `rotate(-90, 14, ${margin.top + innerH/2})`)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.loss);

    // Kaplan frontier: N-heavy => for given C, N ≈ C^0.73, D ≈ C^0.27
    // Chinchilla frontier: balanced => N ≈ C^0.5, D ≈ C^0.5, with N/D fixed
    const pts = d3.range(18, 25.1, 0.2).map(lc => Math.pow(10, lc));
    function frontier(kind) {
      return pts.map(C => {
        let n, d;
        if (kind === 'kaplan') { n = Math.pow(C / 6, 0.73); d = Math.pow(C / 6, 0.27); }
        else                   { n = Math.pow(C / 6, 0.50); d = Math.pow(C / 6, 0.50); }
        return { C, L: lossND(n, d) };
      });
    }
    const line = d3.line().x(d => x(d.C)).y(d => y(d.L)).curve(d3.curveMonotoneX);

    g.append('path').datum(frontier('kaplan')).attr('fill','none')
      .attr('stroke','var(--accent-3)').attr('stroke-width',2).attr('stroke-dasharray','4 3').attr('d', line);
    g.append('path').datum(frontier('chinchilla')).attr('fill','none')
      .attr('stroke','var(--accent-4)').attr('stroke-width',2).attr('d', line);

    // Legend
    const lg = svg.append('g').attr('transform', `translate(${margin.left + innerW + 8},${margin.top + 6})`);
    lg.append('line').attr('x1',0).attr('x2',16).attr('y1',5).attr('y2',5).attr('stroke','var(--accent-3)').attr('stroke-width',2).attr('stroke-dasharray','4 3');
    lg.append('text').attr('x',20).attr('y',9).style('font-size','10px').style('fill','var(--text-soft)').text(S.kaplan);
    lg.append('line').attr('x1',0).attr('x2',16).attr('y1',25).attr('y2',25).attr('stroke','var(--accent-4)').attr('stroke-width',2);
    lg.append('text').attr('x',20).attr('y',29).style('font-size','10px').style('fill','var(--text-soft)').text(S.chinch);

    // Known points
    const knownEN = [
      { label: 'GPT-3', N: 175e9, D: 300e9, color: 'var(--accent-3)' },
      { label: 'Chinchilla', N: 70e9, D: 1.4e12, color: 'var(--accent-4)' },
      { label: 'LLaMA-3 8B', N: 8e9, D: 15e12, color: 'var(--accent-2)' },
    ];
    g.selectAll('.mp').data(knownEN).enter().each(function(d) {
      const C = compute(d.N, d.D), L = lossND(d.N, d.D);
      const grp = d3.select(this).append('g');
      grp.append('circle').attr('cx', x(C)).attr('cy', y(L)).attr('r', 5).attr('fill', d.color).attr('stroke','#fff').attr('stroke-width',1);
      grp.append('text').attr('x', x(C)+8).attr('y', y(L)+3)
        .style('font-size','10px').style('font-family',"'JetBrains Mono', monospace").style('fill', 'var(--text-soft)').text(d.label);
    });

    // User point
    const userDot = g.append('g');
    function redraw() {
      const C = compute(N, D), L = lossND(N, D);
      userDot.selectAll('*').remove();
      userDot.append('circle').attr('cx', x(C)).attr('cy', y(L)).attr('r', 7).attr('fill','var(--accent)').attr('stroke','#fff').attr('stroke-width',1.5);
      userDot.append('text').attr('x', x(C)+10).attr('y', y(L)-8)
        .style('font-size','10px').style('font-family',"'JetBrains Mono', monospace").style('fill','var(--accent)')
        .text(`${S.ptN}: L=${L.toFixed(2)}`);
    }
    redraw();

    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '8px';
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

/* §14c — Test-time compute scaling curves
 * Log-x: thinking tokens (10² → 10⁵). Y: accuracy (0–100%).
 * Three model sizes (8B, 32B, 200B) climb at different rates.
 * Slider sweeps a "thinking budget" cursor; curves animate in.
 * Marker dots for o1, R1, o3 at reported configurations.
 * Data shape inspired by Snell et al. 2024 + o1/R1 system cards.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Test-time compute scaling',
      xLabel: 'thinking tokens (log)',
      yLabel: 'accuracy (%)',
      models: [
        { id: 'small',  label: '8B (small)',   color: 'var(--accent-4)' },
        { id: 'medium', label: '32B (medium)', color: 'var(--accent-2)' },
        { id: 'large',  label: '200B (large)', color: 'var(--accent)'   },
      ],
      budget: 'thinking budget',
      callout: '"Inference-time compute is the new scaling axis"',
      callout2: 'doubling thinking ≈ doubling parameters',
      hint: 'Data shape inspired by Snell et al. 2024 and the o1 / R1 system cards. Each doubling of inference compute adds ≈ 5 accuracy points — the same power-law shape as pretraining compute, but cheaper to buy at the margin.',
    },
    zh: {
      title: '推理时算力扩展曲线',
      xLabel: '思考 token 数 (对数)',
      yLabel: '准确率 (%)',
      models: [
        { id: 'small',  label: '8B (小)',   color: 'var(--accent-4)' },
        { id: 'medium', label: '32B (中)', color: 'var(--accent-2)' },
        { id: 'large',  label: '200B (大)', color: 'var(--accent)'   },
      ],
      budget: '思考预算',
      callout: '"推理时算力 = 新的扩展维度"',
      callout2: '思考翻倍 ≈ 参数翻倍',
      hint: '曲线形态参考 Snell et al. 2024 与 o1 / R1 系统报告。推理算力每翻一倍 ≈ +5 准确率,与预训练算力同款幂律,但边际更便宜。',
    },
  };

  // Generate accuracy as a function of thinking tokens for each model.
  // Saturating sigmoid: acc = floor + (ceil - floor) / (1 + exp(-k*(log10(t) - midpoint)))
  const PARAMS = {
    small:  { floor: 8,  ceil: 32, mid: 2.8, k: 1.6 },  // 8B: low ceiling, plateaus quickly
    medium: { floor: 14, ceil: 62, mid: 3.4, k: 1.4 },
    large:  { floor: 22, ceil: 88, mid: 3.8, k: 1.3 },
  };

  function accuracyAt(modelId, tokens) {
    const p = PARAMS[modelId];
    const lt = Math.log10(Math.max(tokens, 1));
    return p.floor + (p.ceil - p.floor) / (1 + Math.exp(-p.k * (lt - p.mid)));
  }

  // Marker systems
  const SYSTEMS = [
    { name: 'o1',      model: 'large',  tokens: 8000,  color: 'var(--accent)'   },
    { name: 'R1',      model: 'medium', tokens: 12000, color: 'var(--accent-2)' },
    { name: 'o3',      model: 'large',  tokens: 60000, color: 'var(--accent)'   },
    { name: 'GPT-4o',  model: 'medium', tokens: 200,   color: 'var(--accent-4)' },
  ];

  let budgetTokens = 5000; // current slider position
  let drawProgress = 0;    // 0..1 progress of curve draw-in animation
  let animTimer = null;
  let tipEl = null;

  function render() {
    const root = document.getElementById('viz14c-testtime');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // --- Slider ---
    const ctrls = document.createElement('div');
    ctrls.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap';
    const label = document.createElement('label');
    label.style.cssText = 'font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:8px;flex:1';
    label.innerHTML = `<span>${S.budget}:</span>`;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 2; slider.max = 5; slider.step = 0.05;
    slider.value = Math.log10(budgetTokens);
    slider.style.flex = '1';
    const valTxt = document.createElement('span');
    valTxt.style.cssText = 'font-family:JetBrains Mono,monospace;color:var(--accent);min-width:80px;text-align:right';
    function fmt(v) { const t = Math.pow(10, v); return t >= 1000 ? `${(t / 1000).toFixed(1)}k` : `${Math.round(t)}`; }
    valTxt.textContent = fmt(slider.value) + ' tok';
    slider.addEventListener('input', () => {
      budgetTokens = Math.pow(10, +slider.value);
      valTxt.textContent = fmt(slider.value) + ' tok';
      render();
    });
    label.appendChild(slider); label.appendChild(valTxt);
    ctrls.appendChild(label);
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
    const H = 340;
    const margin = { top: 20, right: 130, bottom: 36, left: 46 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLog().domain([100, 100000]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    // Gridlines
    const xTicks = [100, 300, 1000, 3000, 10000, 30000, 100000];
    g.selectAll('.gx').data(xTicks).enter().append('line')
      .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'var(--bg-frame-2)').attr('stroke-width', 0.6);
    const yTicks = [0, 20, 40, 60, 80, 100];
    g.selectAll('.gy').data(yTicks).enter().append('line')
      .attr('y1', d => y(d)).attr('y2', d => y(d)).attr('x1', 0).attr('x2', innerW)
      .attr('stroke', 'var(--bg-frame-2)').attr('stroke-width', 0.6);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d => d >= 1000 ? `${d / 1000}k` : d))
      .selectAll('text').style('font-size', '10px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace");
    g.append('g')
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d => d + '%'))
      .selectAll('text').style('font-size', '10px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace");
    g.selectAll('.domain').attr('stroke', 'var(--text-muted)');

    // Axis labels
    svg.append('text').attr('x', margin.left + innerW / 2).attr('y', H - 6)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text(S.xLabel);
    svg.append('text').attr('x', 12).attr('y', margin.top + innerH / 2)
      .attr('transform', `rotate(-90, 12, ${margin.top + innerH / 2})`)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text(S.yLabel);

    // --- Curves: clip to budget so they "draw in" as budget grows ---
    const samples = d3.range(2, 5.001, 0.04).map(lt => Math.pow(10, lt));
    const line = d3.line()
      .x(d => x(d.t))
      .y(d => y(d.a))
      .curve(d3.curveMonotoneX);

    S.models.forEach(m => {
      const pts = samples.filter(t => t <= Math.max(budgetTokens, 100)).map(t => ({ t, a: accuracyAt(m.id, t) }));
      g.append('path').datum(pts).attr('fill', 'none')
        .attr('stroke', m.color).attr('stroke-width', 2.4).attr('d', line)
        .attr('stroke-linecap', 'round');
      // Ghost continuation (faded) for points beyond the budget
      const ghost = samples.filter(t => t > budgetTokens).map(t => ({ t, a: accuracyAt(m.id, t) }));
      if (ghost.length > 0) {
        const ghostFull = [{ t: budgetTokens, a: accuracyAt(m.id, budgetTokens) }, ...ghost];
        g.append('path').datum(ghostFull).attr('fill', 'none')
          .attr('stroke', m.color).attr('stroke-width', 1.2).attr('d', line)
          .attr('stroke-dasharray', '3 3').attr('opacity', 0.35);
      }
    });

    // --- Budget cursor (vertical line) ---
    g.append('line').attr('x1', x(budgetTokens)).attr('x2', x(budgetTokens))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'var(--text)').attr('stroke-width', 1).attr('stroke-dasharray', '2 4')
      .attr('opacity', 0.6);

    // Dots at current budget for each model
    S.models.forEach(m => {
      const a = accuracyAt(m.id, budgetTokens);
      g.append('circle').attr('cx', x(budgetTokens)).attr('cy', y(a))
        .attr('r', 4).attr('fill', m.color).attr('stroke', 'var(--bg-elevated)').attr('stroke-width', 1.5)
        .on('mouseover', function (e) {
          tip.style.opacity = 1;
          tip.innerHTML = `${m.label}<br>${a.toFixed(1)}% @ ${budgetTokens >= 1000 ? (budgetTokens / 1000).toFixed(1) + 'k' : budgetTokens.toFixed(0)} tok`;
        })
        .on('mousemove', e => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
        .on('mouseout', () => { tip.style.opacity = 0; });
    });

    // --- Known system markers ---
    SYSTEMS.forEach(s => {
      const a = accuracyAt(s.model, s.tokens);
      const cx = x(s.tokens), cy = y(a);
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 5)
        .attr('fill', 'var(--bg-elevated)').attr('stroke', s.color).attr('stroke-width', 2);
      g.append('text').attr('x', cx + 7).attr('y', cy - 6)
        .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', s.color).style('font-weight', '600').text(s.name);
    });

    // --- Legend ---
    const lg = svg.append('g').attr('transform', `translate(${margin.left + innerW + 10},${margin.top + 6})`);
    S.models.forEach((m, i) => {
      lg.append('line').attr('x1', 0).attr('x2', 16).attr('y1', i * 18 + 5).attr('y2', i * 18 + 5)
        .attr('stroke', m.color).attr('stroke-width', 2.4);
      lg.append('text').attr('x', 20).attr('y', i * 18 + 9)
        .style('font-size', '10px').style('fill', 'var(--text-soft)').text(m.label);
    });

    // --- Callout (top-right of plot area) ---
    const callout = svg.append('g').attr('transform', `translate(${margin.left + innerW + 10},${margin.top + 70})`);
    callout.append('rect').attr('x', 0).attr('y', 0).attr('width', 118).attr('height', 56).attr('rx', 4)
      .attr('fill', 'var(--bg-elevated)').attr('stroke', 'var(--accent)').attr('stroke-width', 1);
    callout.append('text').attr('x', 6).attr('y', 16)
      .style('font-size', '10px').style('fill', 'var(--accent)').style('font-weight', '600')
      .text(S.callout.length > 32 ? S.callout.slice(0, 30) + '…' : S.callout);
    // Word-wrap the second line
    callout.append('text').attr('x', 6).attr('y', 34)
      .style('font-size', '9px').style('fill', 'var(--text-soft)')
      .text(S.callout2);
    callout.append('text').attr('x', 6).attr('y', 48)
      .style('font-size', '9px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text('+log₂(t) → +5% acc');

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

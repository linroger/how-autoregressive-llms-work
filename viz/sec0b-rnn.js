/* §0b — RNN unrolling + vanishing-gradient demo
 * Two side-by-side panes:
 *   LEFT  — animated forward pass: 10 tokens flow through one recurrent cell
 *           updating an 8-dim hidden state vector (rendered as a colored bar).
 *           h_t = tanh(W h_{t-1} + U x_t)
 *   RIGHT — gradient norm ||∂L/∂h_t|| at each time step, plotted as a bar chart.
 *           Vanilla RNN with spectral radius ρ ≈ 0.9 → geometric decay.
 *           LSTM with forget-gate ≈ 1 → near-flat gradient.
 * Controls: Play (advance forward then backward), Reset, toggle Vanilla ↔ LSTM.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      titleLeft: 'Forward pass — hidden state evolution',
      titleRight: 'Backward — gradient norm ‖∂L/∂hₜ‖',
      play: 'Play forward + backward',
      reset: 'Reset',
      vanilla: 'Vanilla RNN (ρ=0.9)',
      lstm: 'LSTM (forget≈1)',
      caption: '‖∂L/∂h₁‖ ≈ ρ^(T−1) · ‖∂L/∂hₜ‖   — for ρ<1 the gradient at distant past steps shrinks geometrically.',
      tokensHdr: 'Input tokens xₜ',
      step: 'step',
      tokens: ['the','cat','that','the','dog','chased','was','black','and','small'],
      hint: 'In a vanilla RNN, repeated multiplication by Wᵀ shrinks gradients when its spectral radius ρ<1. LSTM\'s gating lets ∂L/∂h propagate almost unchanged, which is why it can remember far longer sequences.',
      forward: 'forward t →',
      backward: '← backward t',
      hState: 'h',
    },
    zh: {
      titleLeft: '前向传播 — 隐藏状态的演化',
      titleRight: '反向传播 — 梯度范数 ‖∂L/∂hₜ‖',
      play: '播放 前向 + 反向',
      reset: '重置',
      vanilla: '普通 RNN (ρ=0.9)',
      lstm: 'LSTM (forget≈1)',
      caption: '‖∂L/∂h₁‖ ≈ ρ^(T−1) · ‖∂L/∂hₜ‖   — 当 ρ<1,越远的时间步梯度按几何级数衰减。',
      tokensHdr: '输入 token xₜ',
      step: '步',
      tokens: ['那','只','被','那','只','狗','追','的','猫','黑'],
      hint: '普通 RNN 反复乘以 Wᵀ,当其谱半径 ρ<1 时梯度迅速衰减。LSTM 的门控让 ∂L/∂h 几乎无衰减地传播,因此能记住更长的序列。',
      forward: '前向 t →',
      backward: '← 反向 t',
      hState: 'h',
    },
  };

  const T = 10;          // unroll length
  const D = 8;           // hidden dim (cells in the bar)
  const RHO = 0.9;       // vanilla RNN spectral radius
  const LSTM_FORGET = 0.99;

  let mode = 'vanilla';  // or 'lstm'
  let fwdStep = 0;       // 0..T  (T means done)
  let bwdStep = 0;       // 0..T  (revealing right-pane bars from t=T down to t=1)
  let timer = null;

  // Build a deterministic hidden-state trajectory:
  //   each step jitters the state slightly using a seeded RNG.
  function buildStates(seed) {
    const rng = DLM.makeRNG(seed);
    const states = [];
    let h = Array.from({length: D}, () => (rng() - 0.5) * 0.4);
    states.push(h.slice());
    for (let t = 0; t < T; t++) {
      h = h.map((v, i) => {
        const drive = (rng() - 0.5) * 0.9 + 0.18 * Math.sin(t * 0.6 + i);
        const nx = 0.7 * v + 0.5 * drive;
        return Math.tanh(nx);
      });
      states.push(h.slice());
    }
    return states; // length T+1, states[0] = initial
  }
  const STATES = buildStates(42);

  // Gradient norms (already normalized to 1.0 at t=T)
  function gradientCurve(kind) {
    const g = new Array(T);
    if (kind === 'vanilla') {
      for (let t = T; t >= 1; t--) {
        const dist = T - t;
        g[t - 1] = Math.pow(RHO, dist);
      }
    } else {
      for (let t = T; t >= 1; t--) {
        const dist = T - t;
        // forget gate ≈ 1, but realistically tiny drift
        g[t - 1] = Math.pow(LSTM_FORGET, dist);
      }
    }
    return g;
  }

  function render() {
    const root = document.getElementById('viz0b-rnn');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // shared tooltip
    const tip = document.createElement('div');
    tip.style.position = 'absolute'; tip.style.pointerEvents = 'none';
    tip.style.padding = '4px 8px'; tip.style.background = 'var(--bg-frame-2)';
    tip.style.border = '1px solid var(--accent)'; tip.style.color = 'var(--text)';
    tip.style.fontFamily = "'JetBrains Mono', monospace"; tip.style.fontSize = '11px';
    tip.style.borderRadius = '4px'; tip.style.opacity = 0;
    tip.style.transition = 'opacity 120ms'; tip.style.zIndex = 50;
    document.body.appendChild(tip);

    // --- top controls ---
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '12px';

    const bPlay = document.createElement('button');
    bPlay.className = 'btn'; bPlay.textContent = S.play;
    bPlay.addEventListener('click', play);

    const bReset = document.createElement('button');
    bReset.className = 'btn btn-ghost'; bReset.textContent = S.reset;
    bReset.addEventListener('click', reset);

    const toggleWrap = document.createElement('div');
    toggleWrap.style.display = 'inline-flex'; toggleWrap.style.gap = '4px';
    toggleWrap.style.padding = '3px';
    toggleWrap.style.border = '1px solid var(--border-strong)';
    toggleWrap.style.borderRadius = '6px';
    function mkToggle(key, label) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.padding = '5px 12px';
      b.style.fontFamily = "'JetBrains Mono', monospace";
      b.style.fontSize = '11px';
      b.style.borderRadius = '4px';
      b.style.background = (mode === key) ? 'var(--accent)' : 'transparent';
      b.style.color = (mode === key) ? '#1a1308' : 'var(--text-soft)';
      b.style.fontWeight = (mode === key) ? '600' : '500';
      b.addEventListener('click', () => { mode = key; render(); });
      return b;
    }
    toggleWrap.append(mkToggle('vanilla', S.vanilla), mkToggle('lstm', S.lstm));

    const stepReadout = document.createElement('span');
    stepReadout.style.fontFamily = "'JetBrains Mono', monospace";
    stepReadout.style.fontSize = '11px';
    stepReadout.style.color = 'var(--text-muted)';
    stepReadout.style.marginLeft = '8px';
    if (fwdStep < T) {
      stepReadout.textContent = `${S.forward}  t = ${fwdStep}/${T}`;
    } else if (bwdStep < T) {
      stepReadout.textContent = `${S.backward}  t = ${T - bwdStep}/${T}`;
    } else {
      stepReadout.textContent = `${S.step}: done`;
    }

    ctrls.append(bPlay, bReset, toggleWrap, stepReadout);
    root.appendChild(ctrls);

    // --- dual layout ---
    const grid = document.createElement('div');
    grid.className = 'dual-viz';
    root.appendChild(grid);

    const leftPane = document.createElement('div');
    leftPane.className = 'dual-pane';
    const rightPane = document.createElement('div');
    rightPane.className = 'dual-pane';
    grid.append(leftPane, rightPane);

    // ====================================================================
    // LEFT PANE — forward pass
    // ====================================================================
    const lTitle = document.createElement('div');
    lTitle.className = 'pane-title';
    lTitle.style.fontFamily = "'Inter', sans-serif";
    lTitle.style.fontSize = '12px';
    lTitle.style.fontWeight = '600';
    lTitle.style.color = 'var(--text-soft)';
    lTitle.style.marginBottom = '10px';
    lTitle.textContent = S.titleLeft;
    leftPane.appendChild(lTitle);

    // RNN cell schematic
    const cellWrap = document.createElement('div');
    cellWrap.style.display = 'flex';
    cellWrap.style.alignItems = 'center';
    cellWrap.style.justifyContent = 'space-between';
    cellWrap.style.gap = '12px';
    cellWrap.style.marginBottom = '12px';

    // tokens column
    const tokCol = document.createElement('div');
    tokCol.style.display = 'flex'; tokCol.style.flexDirection = 'column';
    tokCol.style.gap = '4px';
    const tokHdr = document.createElement('div');
    tokHdr.style.fontSize = '10px'; tokHdr.style.color = 'var(--text-muted)';
    tokHdr.style.fontFamily = "'JetBrains Mono', monospace";
    tokHdr.textContent = S.tokensHdr;
    tokCol.appendChild(tokHdr);
    const tokRow = document.createElement('div');
    tokRow.style.display = 'flex'; tokRow.style.flexWrap = 'wrap'; tokRow.style.gap = '3px';
    for (let i = 0; i < T; i++) {
      const sp = document.createElement('span');
      sp.textContent = S.tokens[i] || `x${i+1}`;
      sp.style.padding = '3px 6px';
      sp.style.fontFamily = "'JetBrains Mono', monospace";
      sp.style.fontSize = '11px';
      sp.style.borderRadius = '3px';
      const active = (i < fwdStep);
      const current = (i === fwdStep - 1);
      sp.style.background = active ? 'var(--accent)' : 'var(--bg-frame)';
      sp.style.color = active ? '#1a1308' : 'var(--text-muted)';
      sp.style.border = '1px solid ' + (active ? 'var(--accent)' : 'var(--border)');
      if (current) sp.style.boxShadow = '0 0 0 2px var(--accent-2)';
      sp.style.transition = 'background 200ms';
      tokRow.appendChild(sp);
    }
    tokCol.appendChild(tokRow);
    cellWrap.appendChild(tokCol);
    leftPane.appendChild(cellWrap);

    // Hidden-state bar (D cells)
    const stateLbl = document.createElement('div');
    stateLbl.style.fontFamily = "'JetBrains Mono', monospace";
    stateLbl.style.fontSize = '11px';
    stateLbl.style.color = 'var(--text-soft)';
    stateLbl.style.marginBottom = '4px';
    stateLbl.textContent = `${S.hState}_${fwdStep} ∈ ℝ^${D}`;
    leftPane.appendChild(stateLbl);

    const h = STATES[Math.min(fwdStep, T)];
    const stateSvgW = leftPane.clientWidth - 36;
    const cellW = Math.max(28, Math.min(48, (stateSvgW > 0 ? stateSvgW : 280) / D));
    const stateSvgH = 50;
    const stateSvg = d3.select(leftPane).append('svg')
      .attr('width', cellW * D + 4).attr('height', stateSvgH)
      .style('overflow', 'visible')
      .style('margin-bottom', '12px');
    const color = d3.scaleSequential().domain([-1, 1]).interpolator(d3.interpolateRdBu);
    stateSvg.selectAll('rect').data(h).enter().append('rect')
      .attr('x', (_, i) => i * cellW)
      .attr('y', 4)
      .attr('width', cellW - 2)
      .attr('height', stateSvgH - 8)
      .attr('fill', d => color(d))
      .attr('stroke', 'var(--border)')
      .attr('opacity', 0)
      .on('mouseover', function (e, d) {
        tip.style.opacity = 1;
        tip.innerHTML = `h[${this.getAttribute('x') / cellW | 0}] = ${(+d).toFixed(3)}`;
      })
      .on('mousemove', (e) => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
      .on('mouseout', () => { tip.style.opacity = 0; })
      .transition().duration(350).attr('opacity', 1);
    stateSvg.selectAll('text').data(h).enter().append('text')
      .attr('x', (_, i) => i * cellW + (cellW - 2) / 2)
      .attr('y', stateSvgH / 2 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-family', "'JetBrains Mono', monospace")
      .style('fill', d => Math.abs(d) > 0.55 ? '#fff' : 'var(--text)')
      .text(d => d.toFixed(2));

    // Update equation
    const eq = document.createElement('div');
    eq.style.fontFamily = "'JetBrains Mono', monospace";
    eq.style.fontSize = '11px';
    eq.style.color = 'var(--text-muted)';
    eq.style.padding = '8px 10px';
    eq.style.background = 'var(--bg-frame)';
    eq.style.border = '1px solid var(--border)';
    eq.style.borderRadius = '6px';
    if (mode === 'vanilla') {
      eq.textContent = `h_t = tanh(W · h_{t-1} + U · x_t)        ρ(W) ≈ ${RHO}`;
    } else {
      eq.textContent = `c_t = f_t ⊙ c_{t-1} + i_t ⊙ g_t        f_t ≈ ${LSTM_FORGET}`;
    }
    leftPane.appendChild(eq);

    // ====================================================================
    // RIGHT PANE — gradient norms
    // ====================================================================
    const rTitle = document.createElement('div');
    rTitle.className = 'pane-title';
    rTitle.style.fontFamily = "'Inter', sans-serif";
    rTitle.style.fontSize = '12px';
    rTitle.style.fontWeight = '600';
    rTitle.style.color = 'var(--text-soft)';
    rTitle.style.marginBottom = '10px';
    rTitle.textContent = S.titleRight;
    rightPane.appendChild(rTitle);

    const grad = gradientCurve(mode);
    const rW = (rightPane.clientWidth || 280) - 20;
    const rH = 200;
    const margin = { top: 12, right: 12, bottom: 28, left: 38 };
    const innerW = rW - margin.left - margin.right;
    const innerH = rH - margin.top - margin.bottom;

    const svg = d3.select(rightPane).append('svg')
      .attr('width', rW).attr('height', rH).style('overflow', 'visible');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // x: t = 1..T (left = earliest)
    const x = d3.scaleBand().domain(d3.range(1, T + 1)).range([0, innerW]).padding(0.18);
    const y = d3.scaleLinear().domain([0, 1.05]).range([innerH, 0]);

    // y axis
    g.append('g').call(d3.axisLeft(y).ticks(4).tickSize(-innerW))
      .call(g => g.selectAll('.tick line').attr('stroke', 'var(--border)').attr('stroke-dasharray', '2 2'))
      .call(g => g.selectAll('.tick text').style('fill', 'var(--text-muted)').style('font-size', '10px'))
      .call(g => g.select('.domain').remove());

    // x axis
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).tickFormat(d => `t=${d}`))
      .call(g => g.selectAll('text').style('fill', 'var(--text-muted)').style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace"))
      .call(g => g.selectAll('.tick line').attr('stroke', 'var(--border)'))
      .call(g => g.select('.domain').attr('stroke', 'var(--border)'));

    // Bars (reveal only ones that backward pass has reached)
    const visibleFrom = T - bwdStep;   // reveal bars for t >= visibleFrom
    g.selectAll('.bar').data(grad).enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i + 1))
      .attr('y', innerH)
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('fill', (_, i) => (i + 1) >= visibleFrom ? (mode === 'vanilla' ? 'var(--accent-3)' : 'var(--accent-4)') : 'transparent')
      .attr('opacity', (_, i) => (i + 1) >= visibleFrom ? 0.9 : 0.0)
      .on('mouseover', function (e, d) {
        tip.style.opacity = 1;
        const idx = Math.round((+this.getAttribute('x') + 1) / x.bandwidth());
        tip.innerHTML = `‖∂L/∂h_${idx}‖ = <b>${d.toFixed(3)}</b><br>distance from loss: ${T - idx} steps`;
      })
      .on('mousemove', (e) => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
      .on('mouseout', () => { tip.style.opacity = 0; })
      .transition().duration(380).delay((_, i) => Math.max(0, (T - 1 - i)) * 60)
      .attr('y', d => y(d))
      .attr('height', d => innerH - y(d));

    // Bar value labels
    g.selectAll('.gvl').data(grad).enter().append('text')
      .attr('class', 'gvl')
      .attr('x', (_, i) => x(i + 1) + x.bandwidth() / 2)
      .attr('y', d => y(d) - 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-family', "'JetBrains Mono', monospace")
      .style('fill', 'var(--text-soft)')
      .style('opacity', (_, i) => (i + 1) >= visibleFrom ? 1 : 0)
      .text(d => d.toFixed(2));

    // Math caption under the right pane
    const cap = document.createElement('div');
    cap.style.marginTop = '8px';
    cap.style.fontFamily = "'JetBrains Mono', monospace";
    cap.style.fontSize = '10.5px';
    cap.style.color = 'var(--text-muted)';
    cap.textContent = S.caption;
    rightPane.appendChild(cap);

    // bottom-of-viz hint
    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)';
    hint.style.marginTop = '12px'; hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function play() {
    if (timer) clearTimeout(timer);
    fwdStep = 0; bwdStep = 0; render();
    const tickFwd = () => {
      fwdStep++;
      render();
      if (fwdStep < T) {
        timer = setTimeout(tickFwd, 260);
      } else {
        timer = setTimeout(tickBwd, 400);
      }
    };
    const tickBwd = () => {
      bwdStep++;
      render();
      if (bwdStep < T) timer = setTimeout(tickBwd, 220);
    };
    timer = setTimeout(tickFwd, 200);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    fwdStep = 0; bwdStep = 0; render();
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => render());
    render();
    setTimeout(play, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

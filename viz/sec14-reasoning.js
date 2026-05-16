/* §14 — Reasoning model (o1 / R1 style) emergence under RL training */
(function () {
  'use strict';

  let trainStep = 0;
  const MAX_STEP = 100;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        problem: '问：23 × 47 = ?',
        baseLabel: '基础模型（短 CoT）',
        rlLabel: 'RL 训练后（长 CoT，自反思）',
        baseAcc: '基础模型 pass@1：',
        rlAcc: 'RL 模型 pass@1：',
        slider: 'RL 训练步数',
        grpo: 'GRPO 思路：每个 prompt 采样 8 条 rollout；用组内均值作为基线，标准化得到优势 $A_i = (r_i - \\mu)/\\sigma$。无需 critic 网络，组内归一化天然降方差。',
        ahaTitle: '“顿悟”时刻',
        ahaText: '在 RL 训练中途，模型自发地学会说“等等，我再检查一下”—— 这并不是被显式监督出来的，而是高奖励行为的副产品。',
        rollouts: '8 条 rollout · 组内归一化',
        play: '▶ 模拟训练',
      };
    }
    return {
      problem: 'Q: 23 × 47 = ?',
      baseLabel: 'Base model (short CoT)',
      rlLabel: 'After RL (long CoT, self-reflection)',
      baseAcc: 'Base pass@1: ',
      rlAcc: 'RL pass@1: ',
      slider: 'RL training step',
      grpo: 'GRPO idea: sample 8 rollouts per prompt; use the group mean as the baseline and normalize to get advantages $A_i = (r_i - \\mu)/\\sigma$. No critic network needed — group-relative normalization reduces variance for free.',
      ahaTitle: '"Aha" moments',
      ahaText: 'Midway through RL training, the model spontaneously starts saying "wait, let me reconsider" — never explicitly supervised; it emerges as a side-effect of high-reward behavior.',
      rollouts: '8 rollouts · group-normalized',
      play: '▶ Simulate training',
    };
  }

  function genBaseTrace(L) {
    return ['23','×','47','≈','1000','.','Answer',':','1000','.'];
  }
  function genRLTrace(L, frac) {
    // frac in [0, 1] — grows from short to long; aha appears around frac > 0.4
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const intro = lang === 'zh'
      ? ['让','我','分解','：','23','×','47','=','23','×','(','50','−','3',')','=','23','×','50','−','23','×','3','.']
      : ['Let','me','decompose',':','23','×','47','=','23','×','(','50','−','3',')','=','23','×','50','−','23','×','3','.'];
    const mid = lang === 'zh'
      ? ['23','×','50','=','1150','；','23','×','3','=','69','.']
      : ['23','×','50','=','1150',';','23','×','3','=','69','.'];
    const aha = lang === 'zh'
      ? ['等等','，','让','我','再','检查','一下','。','1150','−','69','=','1081','.']
      : ['Wait',',','let','me','double-check','.','1150','−','69','=','1081','.'];
    const final = lang === 'zh' ? ['答案','：','1081','.'] : ['Answer',':','1081','.'];

    let out = [];
    if (frac < 0.15) return ['23','×','47','=','...','.','Answer',':','?','.'];
    out = out.concat(intro);
    if (frac > 0.25) out = out.concat(mid);
    if (frac > 0.45) out = out.concat(aha);
    if (frac > 0.55) out = out.concat(final);
    else out = out.concat(lang === 'zh' ? ['总和','：','...'] : ['Sum',':','...']);
    return out;
  }

  function accuracy(frac) {
    // logistic-ish climb
    const base = 0.22, top = 0.93;
    return base + (top - base) / (1 + Math.exp(-(frac - 0.45) * 9));
  }

  function renderTrace(box, tokens, ahaIdxRange) {
    box.innerHTML = '';
    tokens.forEach((tok, i) => {
      const el = document.createElement('span');
      el.className = 'token committed';
      el.textContent = tok;
      if (ahaIdxRange && i >= ahaIdxRange[0] && i < ahaIdxRange[1]) {
        el.style.background = 'rgba(82, 196, 26, 0.18)';
        el.style.color = 'var(--accent-4)';
        el.style.boxShadow = '0 0 0 1px var(--accent-4)';
      }
      box.appendChild(el);
    });
  }

  function drawRollouts(svgNode, frac, L) {
    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();
    const W = svgNode.clientWidth || 480;
    const H = 100;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const margin = { top: 12, right: 14, bottom: 22, left: 14 };
    const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const iw = W - margin.left - margin.right;
    const ih = H - margin.top - margin.bottom;

    const rng = DLM.makeRNG(7 + Math.floor(frac * 40));
    const rewards = d3.range(8).map(() => {
      const base = accuracy(frac) + (rng() - 0.5) * 0.55;
      return Math.max(0.02, Math.min(0.98, base));
    });
    const mu = d3.mean(rewards);
    const x = d3.scaleBand().domain(d3.range(8)).range([0, iw]).padding(0.25);

    inner.selectAll('rect').data(rewards).enter().append('rect')
      .attr('x', (_, i) => x(i))
      .attr('y', (d) => ih - d * ih)
      .attr('width', x.bandwidth())
      .attr('height', (d) => d * ih)
      .attr('fill', (d) => d >= mu ? 'var(--accent-4)' : 'var(--mask)')
      .attr('rx', 2);

    inner.append('line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', ih - mu * ih).attr('y2', ih - mu * ih)
      .attr('stroke', 'var(--accent)').attr('stroke-dasharray', '4 3').attr('stroke-width', 1.5);
    inner.append('text')
      .attr('x', iw - 2).attr('y', ih - mu * ih - 4)
      .attr('text-anchor', 'end')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '0.7rem')
      .style('fill', 'var(--accent)')
      .text(`μ = ${mu.toFixed(2)}`);

    inner.append('text')
      .attr('x', 0).attr('y', ih + 14)
      .style('font-family', 'Inter, sans-serif')
      .style('font-size', '0.72rem')
      .style('fill', 'var(--text-muted)')
      .text(L.rollouts);
  }

  function render() {
    const container = document.getElementById('viz3-4');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    const problem = document.createElement('div');
    problem.style.fontFamily = 'JetBrains Mono, monospace';
    problem.style.fontSize = '0.92rem';
    problem.style.color = 'var(--text)';
    problem.style.padding = '10px 14px';
    problem.style.background = 'var(--bg-frame)';
    problem.style.borderLeft = '3px solid var(--accent-3)';
    problem.style.borderRadius = '0 4px 4px 0';
    problem.style.marginBottom = '14px';
    problem.textContent = L.problem;
    container.appendChild(problem);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    grid.style.gap = '14px';
    container.appendChild(grid);

    const frac = trainStep / MAX_STEP;

    // Base panel
    const baseBox = document.createElement('div');
    baseBox.style.background = 'var(--bg-frame-2)';
    baseBox.style.border = '1px solid var(--border-strong)';
    baseBox.style.borderRadius = '6px';
    baseBox.style.padding = '14px';
    baseBox.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--mask);margin-bottom:8px">${L.baseLabel}</div>`;
    const baseStrip = document.createElement('div');
    baseStrip.className = 'token-strip';
    baseStrip.style.padding = '0';
    baseStrip.style.minHeight = '80px';
    renderTrace(baseStrip, genBaseTrace(L));
    baseBox.appendChild(baseStrip);
    const baseAcc = document.createElement('div');
    baseAcc.style.fontFamily = 'JetBrains Mono, monospace';
    baseAcc.style.fontSize = '0.82rem';
    baseAcc.style.color = 'var(--text-soft)';
    baseAcc.style.marginTop = '10px';
    baseAcc.innerHTML = `${L.baseAcc}<b style="color:var(--mask)">22%</b>`;
    baseBox.appendChild(baseAcc);
    grid.appendChild(baseBox);

    // RL panel
    const rlBox = document.createElement('div');
    rlBox.style.background = 'var(--bg-frame-2)';
    rlBox.style.border = '1.5px solid ' + (frac > 0.45 ? 'var(--accent-4)' : 'var(--border-strong)');
    rlBox.style.borderRadius = '6px';
    rlBox.style.padding = '14px';
    rlBox.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--accent-4);margin-bottom:8px">${L.rlLabel}</div>`;
    const rlStrip = document.createElement('div');
    rlStrip.className = 'token-strip';
    rlStrip.style.padding = '0';
    rlStrip.style.minHeight = '80px';
    const rlTokens = genRLTrace(L, frac);
    // mark aha range if present
    let ahaRange = null;
    if (frac > 0.45) {
      // aha is the 3rd block we appended (8 tokens long in EN: wait , let me double-check . 1150 − 69 = 1081 .)
      const introLen = (document.documentElement.getAttribute('data-lang') === 'zh') ? 23 : 23;
      ahaRange = [introLen + 12, Math.min(rlTokens.length, introLen + 24)];
    }
    renderTrace(rlStrip, rlTokens, ahaRange);
    rlBox.appendChild(rlStrip);
    const rlAcc = document.createElement('div');
    rlAcc.style.fontFamily = 'JetBrains Mono, monospace';
    rlAcc.style.fontSize = '0.82rem';
    rlAcc.style.color = 'var(--text-soft)';
    rlAcc.style.marginTop = '10px';
    rlAcc.innerHTML = `${L.rlAcc}<b style="color:var(--accent-4)">${Math.round(accuracy(frac) * 100)}%</b>`;
    rlBox.appendChild(rlAcc);
    grid.appendChild(rlBox);

    // Slider
    const sliderRow = document.createElement('div');
    sliderRow.style.marginTop = '14px';
    sliderRow.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-soft);margin-bottom:6px">
        <span>${L.slider}</span>
        <span><b style="color:var(--accent)">${trainStep}</b> / ${MAX_STEP}</span>
      </div>
      <input type="range" id="reason-slider" min="0" max="${MAX_STEP}" value="${trainStep}" style="width:100%">
    `;
    container.appendChild(sliderRow);

    // Rollouts
    const rollWrap = document.createElement('div');
    rollWrap.style.marginTop = '16px';
    rollWrap.style.background = 'var(--bg-frame-2)';
    rollWrap.style.border = '1px solid var(--border-strong)';
    rollWrap.style.borderRadius = '6px';
    rollWrap.style.padding = '10px 12px';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.display = 'block';
    rollWrap.appendChild(svg);
    const grpo = document.createElement('div');
    grpo.style.fontFamily = 'Inter, sans-serif';
    grpo.style.fontSize = '0.84rem';
    grpo.style.color = 'var(--text-soft)';
    grpo.style.marginTop = '8px';
    grpo.style.lineHeight = '1.5';
    grpo.innerHTML = L.grpo;
    rollWrap.appendChild(grpo);
    container.appendChild(rollWrap);

    if (window.renderMathInElement) {
      try { window.renderMathInElement(grpo, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch (e) {}
    }
    drawRollouts(svg, frac, L);

    // Aha annotation
    if (frac > 0.45) {
      const aha = document.createElement('div');
      aha.style.marginTop = '12px';
      aha.style.padding = '10px 12px';
      aha.style.background = 'var(--bg-frame)';
      aha.style.borderLeft = '3px solid var(--accent-4)';
      aha.style.borderRadius = '0 4px 4px 0';
      aha.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-size:0.74rem;color:var(--accent-4);letter-spacing:0.06em;margin-bottom:4px">${L.ahaTitle.toUpperCase()}</div><div style="font-family:Inter,sans-serif;font-size:0.85rem;color:var(--text-soft);line-height:1.5">${L.ahaText}</div>`;
      container.appendChild(aha);
    }

    document.getElementById('reason-slider').addEventListener('input', (e) => {
      trainStep = parseInt(e.target.value);
      render();
    });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => {
      const svg = document.querySelector('#viz3-4 svg');
      if (svg) drawRollouts(svg, trainStep / MAX_STEP, t());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

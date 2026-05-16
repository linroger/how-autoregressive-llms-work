/* §27 — Post-pretraining playbook
 * A stacked pipeline of training stages, with a model "ball" progressing
 * through each stage. As stages complete, capability scores climb:
 *   - helpfulness, harmlessness, reasoning, instruction-following
 * Mounted at #viz6-5.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      stages: [
        { key: 'pretrain', name: 'Pretrain', sub: 'web + synthetic textbook data', out: 'base model' },
        { key: 'sft',      name: 'SFT cold-start', sub: 'a few thousand high-quality demos', out: 'instruct-able' },
        { key: 'rlvr',     name: 'RLVR', sub: 'RL with verifiable rewards · math / code', out: 'reasoner' },
        { key: 'rlaif',    name: 'RLAIF / DPO', sub: 'preferences for unverifiable domains', out: 'polished writer' },
        { key: 'safety',   name: 'Safety RL', sub: 'refusal & policy alignment', out: 'safer' },
        { key: 'mcp',      name: 'MCP tool-use', sub: 'function calls, retrieval, agents', out: 'tool user' },
        { key: 'deploy',   name: 'Deploy', sub: 'thinking-budget knob exposed at inference', out: 'live model' },
      ],
      caps: ['helpfulness', 'harmlessness', 'reasoning', 'instr.-follow'],
      play: 'Play',
      reset: 'Reset',
      budget: 'thinking budget',
      capTitle: 'capability scores',
      pipelineTitle: 'training pipeline',
    },
    zh: {
      stages: [
        { key: 'pretrain', name: '预训练', sub: '网络 + 合成教材数据', out: '基础模型' },
        { key: 'sft',      name: 'SFT 冷启动', sub: '数千条高质量示范', out: '可指令化' },
        { key: 'rlvr',     name: 'RLVR', sub: '可验证奖励的 RL · 数学 / 代码', out: '会推理' },
        { key: 'rlaif',    name: 'RLAIF / DPO', sub: '偏好数据应对开放域', out: '会写作' },
        { key: 'safety',   name: '安全 RL', sub: '拒答与策略对齐', out: '更安全' },
        { key: 'mcp',      name: 'MCP 工具调用', sub: '函数调用、检索、Agent', out: '会用工具' },
        { key: 'deploy',   name: '部署', sub: '推理时暴露"思考预算"旋钮', out: '上线模型' },
      ],
      caps: ['有用性', '无害性', '推理', '指令遵循'],
      play: '播放',
      reset: '重置',
      budget: '思考预算',
      capTitle: '能力分数',
      pipelineTitle: '训练流水线',
    },
  };

  // Per-stage capability deltas (added when the stage completes).
  // Index order matches STR.en.caps: [helpful, harmless, reasoning, instr-follow]
  const DELTAS = {
    pretrain: [22, 10, 18, 8],
    sft:      [22, 8,  6,  28],
    rlvr:     [6,  4,  30, 12],
    rlaif:    [18, 6,  4,  14],
    safety:   [4,  40, 0,  6],
    mcp:      [10, 4,  10, 8],
    deploy:   [4,  2,  6,  4],
  };

  let activeStage = -1; // -1 = not started; 0..stages.length-1 = stage finished
  let playing = false;
  let timer = null;
  let thinkBudget = 0.5;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function capScores(stageIdx) {
    const S = STR.en; // keys are stable
    const totals = [0, 0, 0, 0];
    for (let i = 0; i <= stageIdx && i < S.stages.length; i++) {
      const key = S.stages[i].key;
      const d = DELTAS[key] || [0,0,0,0];
      for (let k = 0; k < 4; k++) totals[k] += d[k];
    }
    // Cap at 100
    return totals.map(v => Math.min(100, v));
  }

  function render() {
    const root = document.getElementById('viz6-5');
    if (!root) return;
    const lang = getLang();
    const L = STR[lang];
    root.innerHTML = '';

    const W = root.clientWidth || 720;
    const isNarrow = W < 640;

    // ---------- Layout container ----------
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '18px';
    wrap.style.gridTemplateColumns = isNarrow ? '1fr' : 'minmax(0,1.4fr) minmax(0,1fr)';
    root.appendChild(wrap);

    // ---------- LEFT: pipeline ----------
    const pipeWrap = document.createElement('div');
    const pipeHead = document.createElement('div');
    pipeHead.textContent = L.pipelineTitle;
    pipeHead.style.fontSize = '11px';
    pipeHead.style.color = 'var(--text-soft)';
    pipeHead.style.textTransform = 'uppercase';
    pipeHead.style.letterSpacing = '0.06em';
    pipeHead.style.marginBottom = '8px';
    pipeWrap.appendChild(pipeHead);

    const pipeSvgW = Math.min(W * (isNarrow ? 1 : 0.58), 520);
    const stageH = 44, stageGap = 8;
    const stages = L.stages;
    const pipeSvgH = stages.length * (stageH + stageGap) + 12;

    const svg = d3.select(pipeWrap).append('svg')
      .attr('width', pipeSvgW)
      .attr('height', pipeSvgH)
      .style('overflow', 'visible')
      .style('display', 'block');

    const barX = 22, barW = pipeSvgW - 180;

    // Connector line
    svg.append('line')
      .attr('x1', barX + 8).attr('x2', barX + 8)
      .attr('y1', 18).attr('y2', pipeSvgH - 18)
      .attr('stroke', 'var(--border-strong)').attr('stroke-width', 2)
      .attr('stroke-dasharray', '3 4');

    stages.forEach((stage, i) => {
      const y = i * (stageH + stageGap) + 6;
      const completed = activeStage >= i;
      const active = (activeStage === i);

      const g = svg.append('g').attr('transform', `translate(0,${y})`);

      // Bar
      g.append('rect')
        .attr('x', barX).attr('y', 0)
        .attr('width', barW).attr('height', stageH)
        .attr('rx', 6)
        .attr('fill', completed ? 'var(--accent)' : 'var(--bg-frame-2, transparent)')
        .attr('fill-opacity', completed ? (active ? 0.32 : 0.18) : 1)
        .attr('stroke', completed ? 'var(--accent)' : 'var(--border)')
        .attr('stroke-width', active ? 2 : 1);

      // Step circle
      g.append('circle')
        .attr('cx', barX + 8).attr('cy', stageH / 2)
        .attr('r', 8)
        .attr('fill', completed ? 'var(--accent)' : 'var(--bg-elevated, #fff)')
        .attr('stroke', completed ? 'var(--accent)' : 'var(--border-strong)')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', barX + 8).attr('y', stageH / 2 + 3)
        .attr('text-anchor', 'middle')
        .style('font-size', '9px')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('fill', completed ? '#fff' : 'var(--text-soft)')
        .text(i + 1);

      // Stage name
      g.append('text')
        .attr('x', barX + 26).attr('y', stageH / 2 - 3)
        .style('font-size', '12px').style('font-weight', '600')
        .style('fill', 'var(--text)')
        .text(stage.name);

      // Substring
      g.append('text')
        .attr('x', barX + 26).attr('y', stageH / 2 + 13)
        .style('font-size', '10px').style('fill', 'var(--text-soft)')
        .text(stage.sub);

      // Output chip
      const chipX = barX + barW + 14;
      g.append('rect')
        .attr('x', chipX).attr('y', stageH / 2 - 11)
        .attr('width', 138).attr('height', 22).attr('rx', 11)
        .attr('fill', completed ? 'var(--accent-2)' : 'var(--bg-frame, transparent)')
        .attr('fill-opacity', completed ? 0.18 : 1)
        .attr('stroke', completed ? 'var(--accent-2)' : 'var(--border)')
        .attr('stroke-width', 1);
      g.append('text')
        .attr('x', chipX + 69).attr('y', stageH / 2 + 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('fill', completed ? 'var(--accent-2)' : 'var(--text-muted)')
        .text(stage.out);
    });

    // Animated "model" marker
    const markerY = activeStage < 0
      ? 6
      : Math.min(activeStage, stages.length - 1) * (stageH + stageGap) + 6 + stageH / 2;
    svg.append('circle')
      .attr('cx', barX + 8)
      .attr('cy', activeStage < 0 ? 8 : markerY)
      .attr('r', 5)
      .attr('fill', 'var(--accent-3, #722ed1)')
      .attr('stroke', 'var(--bg-elevated, #fff)').attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 4px var(--accent-3, #722ed1))');

    wrap.appendChild(pipeWrap);

    // ---------- RIGHT: capabilities ----------
    const rightCol = document.createElement('div');
    const capHead = document.createElement('div');
    capHead.textContent = L.capTitle;
    capHead.style.fontSize = '11px';
    capHead.style.color = 'var(--text-soft)';
    capHead.style.textTransform = 'uppercase';
    capHead.style.letterSpacing = '0.06em';
    capHead.style.marginBottom = '8px';
    rightCol.appendChild(capHead);

    const scores = capScores(activeStage);
    const capSvgW = Math.min(W * (isNarrow ? 1 : 0.4), 360);
    const capSvgH = L.caps.length * 38 + 12;
    const csvg = d3.select(rightCol).append('svg')
      .attr('width', capSvgW).attr('height', capSvgH).style('display', 'block');

    const cBarX = 110;
    const cBarW = capSvgW - cBarX - 40;

    L.caps.forEach((capName, i) => {
      const cy = i * 38 + 10;
      csvg.append('text')
        .attr('x', cBarX - 8).attr('y', cy + 14)
        .attr('text-anchor', 'end')
        .style('font-size', '11px').style('fill', 'var(--text-soft)')
        .text(capName);

      // track
      csvg.append('rect')
        .attr('x', cBarX).attr('y', cy + 4)
        .attr('width', cBarW).attr('height', 18).attr('rx', 9)
        .attr('fill', 'var(--bg-frame-2, transparent)')
        .attr('stroke', 'var(--border)').attr('stroke-width', 1);

      // fill
      const fillW = (scores[i] / 100) * cBarW;
      const color = ['var(--accent)', 'var(--accent-4, #52c41a)', 'var(--accent-3, #722ed1)', 'var(--accent-2)'][i];
      csvg.append('rect')
        .attr('x', cBarX).attr('y', cy + 4)
        .attr('width', 0).attr('height', 18).attr('rx', 9)
        .attr('fill', color).attr('fill-opacity', 0.85)
        .transition().duration(600).ease(d3.easeCubicOut)
        .attr('width', fillW);

      csvg.append('text')
        .attr('x', cBarX + cBarW + 6).attr('y', cy + 17)
        .style('font-size', '10px')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('fill', 'var(--text-muted)')
        .text(scores[i] + '/100');
    });

    // Thinking budget knob (only meaningful after deploy)
    const budgetWrap = document.createElement('div');
    budgetWrap.style.marginTop = '14px';
    budgetWrap.style.padding = '10px 12px';
    budgetWrap.style.border = '1px dashed var(--border-strong)';
    budgetWrap.style.borderRadius = '8px';
    budgetWrap.style.opacity = activeStage >= stages.length - 1 ? '1' : '0.45';
    budgetWrap.style.transition = 'opacity 300ms';

    const budgetLabel = document.createElement('div');
    budgetLabel.style.display = 'flex';
    budgetLabel.style.justifyContent = 'space-between';
    budgetLabel.style.fontSize = '11px';
    budgetLabel.style.color = 'var(--text-soft)';
    budgetLabel.style.marginBottom = '6px';
    const lblL = document.createElement('span'); lblL.textContent = L.budget;
    const lblR = document.createElement('span');
    lblR.style.fontFamily = 'JetBrains Mono, monospace';
    lblR.style.color = 'var(--accent)';
    lblR.textContent = Math.round(thinkBudget * 100) + '%';
    budgetLabel.appendChild(lblL); budgetLabel.appendChild(lblR);
    budgetWrap.appendChild(budgetLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0'; slider.max = '100'; slider.step = '1';
    slider.value = String(Math.round(thinkBudget * 100));
    slider.style.width = '100%';
    slider.style.accentColor = 'var(--accent)';
    slider.disabled = activeStage < stages.length - 1;
    slider.addEventListener('input', () => {
      thinkBudget = Number(slider.value) / 100;
      lblR.textContent = Math.round(thinkBudget * 100) + '%';
    });
    budgetWrap.appendChild(slider);
    rightCol.appendChild(budgetWrap);

    wrap.appendChild(rightCol);

    // Controls
    const controls = document.createElement('div');
    controls.style.marginTop = '14px';
    controls.style.display = 'flex';
    controls.style.gap = '8px';

    const playBtn = button(L.play, () => play());
    const resetBtn = button(L.reset, () => reset());
    controls.appendChild(playBtn);
    controls.appendChild(resetBtn);
    root.appendChild(controls);
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.padding = '6px 14px';
    b.style.fontSize = '12px';
    b.style.borderRadius = '6px';
    b.style.border = '1px solid var(--border-strong)';
    b.style.background = 'var(--bg-elevated, transparent)';
    b.style.color = 'var(--text)';
    b.style.cursor = 'pointer';
    b.style.fontFamily = 'inherit';
    b.addEventListener('click', onClick);
    return b;
  }

  function play() {
    if (playing) return;
    playing = true;
    activeStage = -1;
    render();
    const total = STR.en.stages.length;
    const advance = () => {
      activeStage++;
      if (activeStage >= total) {
        activeStage = total - 1;
        playing = false;
        return;
      }
      render();
      timer = setTimeout(advance, 850);
    };
    timer = setTimeout(advance, 600);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    playing = false;
    activeStage = -1;
    render();
  }

  function init() {
    render();
    window.addEventListener('langchange', () => render());
    window.addEventListener('resize', () => render());
    setTimeout(play, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* §13 — Constitutional AI: SL-CAI cycle (circular) + RL-CAI panel */
(function () {
  'use strict';

  let phase = 0;
  let timer = null;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        title: 'SL-CAI 自我修订循环',
        stages: [
          { label: 'Prompt', tag: '提示词', text: '“告诉我如何…”', color: 'var(--accent-2)' },
          { label: 'Response', tag: '初始回答', text: '原始模型的（可能不合规的）回答', color: 'var(--accent-3)' },
          { label: 'Critique', tag: '基于原则的自我批评', text: '“这个回答是否违反了原则？”', color: 'var(--accent)' },
          { label: 'Revise', tag: '修订', text: '根据批评重新生成更好的回答', color: 'var(--accent-soft)' },
          { label: 'SFT', tag: '监督微调', text: '在 (prompt, 修订后回答) 上训练', color: 'var(--accent-4)' },
        ],
        principleTitle: '示例原则',
        principle: '“在保持有帮助的同时，拒绝生成可能对人造成伤害、或违反法律 / 隐私 / 安全的内容。”',
        rlTitle: 'RL-CAI（无人偏好阶段）',
        rlText: '不再让人类标注偏好；而是让 AI 判官根据宪法原则比较两条回答，得到偏好对，再走 DPO/RLHF。这就是 RLAIF —— AI feedback 替代 human feedback。',
        play: '▶ 播放循环',
        pause: '⏸ 暂停',
      };
    }
    return {
      title: 'SL-CAI self-revision cycle',
      stages: [
        { label: 'Prompt', tag: 'Prompt', text: '"Tell me how to..."', color: 'var(--accent-2)' },
        { label: 'Response', tag: 'Initial response', text: 'Raw (possibly noncompliant) reply from the base model', color: 'var(--accent-3)' },
        { label: 'Critique', tag: 'Self-critique by principle', text: '"Does this response violate a principle?"', color: 'var(--accent)' },
        { label: 'Revise', tag: 'Revise', text: 'Regenerate a better answer guided by the critique', color: 'var(--accent-soft)' },
        { label: 'SFT', tag: 'Supervised finetune', text: 'Train on (prompt, revised answer) pairs', color: 'var(--accent-4)' },
      ],
      principleTitle: 'Sample principle',
      principle: '"Be helpful but refuse to produce content that could cause harm to a person, or that violates legal / privacy / safety norms."',
      rlTitle: 'RL-CAI (no human-preference stage)',
      rlText: 'Replace human preference labels with an AI judge that compares two responses against the constitution. The resulting preference pairs feed DPO/RLHF. This is RLAIF — AI feedback in place of human feedback.',
      play: '▶ Play cycle',
      pause: '⏸ Pause',
    };
  }

  function drawWheel(svgNode, L) {
    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();
    const W = svgNode.clientWidth || 480;
    const H = 360;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.36;

    const N = L.stages.length;
    const g = svg.append('g');

    // Connector arrows between stages
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2;
      const mid = (a0 + a1) / 2;
      const r1 = R + 4, r2 = R + 4;
      const x1 = cx + Math.cos(a0 + 0.18) * r1;
      const y1 = cy + Math.sin(a0 + 0.18) * r1;
      const x2 = cx + Math.cos(a1 - 0.18) * r2;
      const y2 = cy + Math.sin(a1 - 0.18) * r2;
      const cxm = cx + Math.cos(mid) * (R + 30);
      const cym = cy + Math.sin(mid) * (R + 30);
      g.append('path')
        .attr('d', `M${x1},${y1} Q${cxm},${cym} ${x2},${y2}`)
        .attr('fill', 'none')
        .attr('stroke', i === phase ? 'var(--accent)' : 'var(--border-strong)')
        .attr('stroke-width', i === phase ? 2 : 1.2)
        .attr('marker-end', i === phase ? 'url(#arrow-active)' : 'url(#arrow-idle)')
        .attr('opacity', i === phase ? 1 : 0.55);
    }

    // Markers
    const defs = svg.append('defs');
    [['arrow-idle', 'var(--border-strong)'], ['arrow-active', 'var(--accent)']].forEach(([id, c]) => {
      defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', c);
    });

    L.stages.forEach((s, i) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      const node = g.append('g').attr('transform', `translate(${x},${y})`);
      const isActive = i === phase;
      node.append('circle')
        .attr('r', isActive ? 34 : 28)
        .attr('fill', isActive ? s.color : 'var(--bg-frame-2)')
        .attr('stroke', s.color)
        .attr('stroke-width', isActive ? 2 : 1.5)
        .style('transition', 'all 300ms');
      node.append('text')
        .attr('text-anchor', 'middle').attr('dy', 4)
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '0.74rem')
        .style('font-weight', '600')
        .style('fill', isActive ? '#fff' : s.color)
        .text(s.label);

      // Caption below
      const lx = cx + Math.cos(a) * (R + 60);
      const ly = cy + Math.sin(a) * (R + 60);
      g.append('text')
        .attr('x', lx).attr('y', ly).attr('text-anchor', 'middle')
        .style('font-family', 'Inter, sans-serif')
        .style('font-size', '0.72rem')
        .style('fill', isActive ? 'var(--text)' : 'var(--text-muted)')
        .text(s.tag);
    });

    // Center detail
    const centerBox = g.append('g').attr('transform', `translate(${cx},${cy})`);
    centerBox.append('rect')
      .attr('x', -90).attr('y', -34).attr('width', 180).attr('height', 68)
      .attr('rx', 6).attr('fill', 'var(--bg-frame)').attr('stroke', L.stages[phase].color);
    centerBox.append('text')
      .attr('text-anchor', 'middle').attr('y', -8)
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '0.7rem')
      .style('fill', L.stages[phase].color)
      .text(L.stages[phase].tag);

    // word-wrap manually
    const words = L.stages[phase].text.split(/\s+/);
    let line = '', lines = [];
    words.forEach((w) => {
      if ((line + ' ' + w).length > 26) { lines.push(line); line = w; }
      else line = line ? line + ' ' + w : w;
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, idx) => {
      centerBox.append('text')
        .attr('text-anchor', 'middle').attr('y', 10 + idx * 14)
        .style('font-family', 'Inter, sans-serif')
        .style('font-size', '0.72rem')
        .style('fill', 'var(--text-soft)')
        .text(l);
    });
  }

  function advance() { phase = (phase + 1) % 5; renderWheel(); }
  let playing = false;
  function play() {
    if (playing) { clearInterval(timer); playing = false; renderControls(); return; }
    playing = true; renderControls();
    timer = setInterval(advance, 1400);
  }

  function renderWheel() {
    const svg = document.getElementById('cai-wheel');
    if (svg) drawWheel(svg, t());
  }
  function renderControls() {
    const btn = document.getElementById('cai-play');
    if (btn) btn.textContent = playing ? t().pause : t().play;
  }

  function render() {
    const container = document.getElementById('viz3-3');
    if (!container) return;
    if (timer) { clearInterval(timer); playing = false; }
    container.innerHTML = '';
    const L = t();

    const principle = document.createElement('div');
    principle.style.padding = '12px 14px';
    principle.style.background = 'var(--bg-frame)';
    principle.style.borderLeft = '3px solid var(--accent-2)';
    principle.style.borderRadius = '0 4px 4px 0';
    principle.style.fontFamily = 'Inter, sans-serif';
    principle.style.fontSize = '0.88rem';
    principle.style.color = 'var(--text-soft)';
    principle.style.marginBottom = '14px';
    principle.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-size:0.72rem;color:var(--accent-2);letter-spacing:0.06em;margin-bottom:4px">${L.principleTitle.toUpperCase()}</div>${L.principle}`;
    container.appendChild(principle);

    const wrap = document.createElement('div');
    wrap.style.background = 'var(--bg-frame-2)';
    wrap.style.border = '1px solid var(--border-strong)';
    wrap.style.borderRadius = '6px';
    wrap.style.padding = '12px';
    wrap.style.position = 'relative';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'cai-wheel';
    svg.style.width = '100%';
    svg.style.display = 'block';
    wrap.appendChild(svg);
    container.appendChild(wrap);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '12px';
    actions.innerHTML = `<button class="btn" id="cai-play">${L.play}</button>`;
    container.appendChild(actions);

    const rlBox = document.createElement('div');
    rlBox.style.marginTop = '18px';
    rlBox.style.padding = '14px 16px';
    rlBox.style.background = 'var(--bg-frame)';
    rlBox.style.border = '1px solid var(--border-strong)';
    rlBox.style.borderLeft = '3px solid var(--accent-3)';
    rlBox.style.borderRadius = '0 4px 4px 0';
    rlBox.innerHTML = `
      <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--accent-3);letter-spacing:0.06em;margin-bottom:6px">${L.rlTitle}</div>
      <div style="font-family:Inter,sans-serif;font-size:0.9rem;color:var(--text-soft);line-height:1.55">${L.rlText}</div>
    `;
    container.appendChild(rlBox);

    document.getElementById('cai-play').addEventListener('click', play);
    renderWheel();
    // auto-advance one slow loop after a short delay
    setTimeout(() => { if (!playing) { playing = true; renderControls(); timer = setInterval(advance, 1500); } }, 400);
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', renderWheel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

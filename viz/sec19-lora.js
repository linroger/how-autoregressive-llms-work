/* §19 — LoRA: low-rank adaptation
 * Visualize the W (frozen, big) + BA (trainable, slim) decomposition.
 * Rank-selector buttons control A and B matrix widths and update param-count math.
 * Bottom: hot-swap LoRA adapters on a single frozen base model.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      rank: 'Rank r',
      frozen: 'frozen, pretrained',
      forward: 'Forward pass:  h = Wx + BAx',
      paramFull: 'Full fine-tune', paramLoRA: 'LoRA params', reduction: 'reduction',
      adapters: 'One base model, many adapters', play: 'Animate forward',
      task1: 'task: SQL', task2: 'task: French', task3: 'task: medical',
      caption: 'Only A and B receive gradients. The base W is shared by every task.',
      paramsDim: 'd × k = ',
      paramsLora: 'r(d+k) = ',
      paramsReduce: 'fewer trainable params',
    },
    zh: {
      rank: '秩 r',
      frozen: '冻结, 预训练',
      forward: '前向:  h = Wx + BAx',
      paramFull: '全量微调', paramLoRA: 'LoRA 参数', reduction: '减少',
      adapters: '一个基模, 多套适配器', play: '播放前向',
      task1: '任务: SQL', task2: '任务: 法语', task3: '任务: 医疗',
      caption: '只有 A 和 B 接收梯度. 基础 W 被所有任务共享.',
      paramsDim: 'd × k = ',
      paramsLora: 'r(d+k) = ',
      paramsReduce: '更少的可训练参数',
    },
  };

  let rank = 4;
  const RANKS = [1, 4, 16, 64];
  const D = 768;
  const K = 768;
  let activeTask = 0;
  let animating = false;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }
  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function render() {
    const root = document.getElementById('viz4-5');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:18px';
    controls.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em">${S.rank}</span>
        ${RANKS.map(r => `<button class="btn btn-ghost lora-r" data-r="${r}" style="padding:5px 12px;font-size:0.85rem;${r===rank?'border-color:var(--accent);color:var(--accent)':''}">${r}</button>`).join('')}
      </div>
      <button class="btn" id="lora-play" style="padding:5px 14px">▶ ${S.play}</button>
    `;
    root.appendChild(controls);

    // SVG diagram — generous left/right margins so no labels collide
    const W = Math.max(560, root.clientWidth || 720);
    const H = 280;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow', 'visible');

    // Geometry: x (input) → W block in middle-left → + → A then B path → h (output)
    // Reserve generous space for B's label (long text like "B(768×r=64)")
    const wSize = 120;
    const xMargin = 32;
    const inputCx = xMargin;
    const wX = inputCx + 56;
    const plusX = wX + wSize + 20;
    const aX = plusX + 22;
    const aW = wSize;                       // A is r × k (wide)
    const bX = aX + aW + 28;
    const bSize = Math.max(4, Math.min(36, rank * 0.45 + 4));
    const outputCx = bX + bSize + 96;       // ample gap so no label overlap
    const yTop = 30;

    // Input "x"
    svg.append('circle').attr('cx', inputCx).attr('cy', yTop + wSize / 2)
      .attr('r', 8).attr('fill', 'var(--accent-4)').attr('opacity', 0.9);
    svg.append('text').attr('x', inputCx).attr('y', yTop + wSize / 2 - 16)
      .attr('text-anchor', 'middle').style('font-family', 'JetBrains Mono,monospace')
      .style('font-size', '12px').style('fill', 'var(--text-soft)').text('x');

    // Arrow from x → W
    svg.append('line').attr('x1', inputCx + 10).attr('y1', yTop + wSize / 2)
      .attr('x2', wX - 4).attr('y2', yTop + wSize / 2)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.2);

    // Frozen W block
    svg.append('rect').attr('x', wX).attr('y', yTop)
      .attr('width', wSize).attr('height', wSize)
      .attr('fill', 'var(--mask)').attr('opacity', 0.55)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1);
    svg.append('text').attr('x', wX + wSize / 2).attr('y', yTop + wSize / 2 + 8)
      .attr('text-anchor', 'middle').style('font-family', 'JetBrains Mono,monospace')
      .style('font-size', '24px').style('fill', 'var(--text)').text('W');
    svg.append('text').attr('x', wX + wSize / 2).attr('y', yTop + wSize + 18)
      .attr('text-anchor', 'middle').style('font-family', 'Inter,sans-serif')
      .style('font-size', '11px').style('fill', 'var(--text-soft)').text(`${D} × ${K}  ·  ${S.frozen}`);

    // "+" sign
    svg.append('text').attr('x', plusX + 10).attr('y', yTop + wSize / 2 + 8)
      .attr('text-anchor', 'middle').style('font-size', '24px').style('fill', 'var(--text-soft)').text('+');

    // A: r × k (wide) — sits middle vertically
    const aH = Math.max(4, Math.min(36, rank * 0.45 + 4));
    const aY = yTop + (wSize - aH) / 2;
    svg.append('rect').attr('x', aX).attr('y', aY)
      .attr('width', aW).attr('height', aH)
      .attr('fill', 'var(--accent)').attr('opacity', 0.85)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1);
    svg.append('text').attr('x', aX + aW / 2).attr('y', aY - 10)
      .attr('text-anchor', 'middle').style('font-family', 'JetBrains Mono,monospace')
      .style('font-size', '12px').style('fill', 'var(--accent)').text(`A (r=${rank} × ${K})`);

    // B: d × r (tall, narrow)
    const bH = wSize;
    svg.append('rect').attr('x', bX).attr('y', yTop)
      .attr('width', bSize).attr('height', bH)
      .attr('fill', 'var(--accent-3)').attr('opacity', 0.85)
      .attr('stroke', 'var(--accent-3)').attr('stroke-width', 1);
    // B label — positioned BELOW the matrix so it never collides with the output circle
    svg.append('text').attr('x', bX + bSize / 2).attr('y', yTop + bH + 18)
      .attr('text-anchor', 'middle').style('font-family', 'JetBrains Mono,monospace')
      .style('font-size', '12px').style('fill', 'var(--accent-3)').text(`B (${D} × r=${rank})`);

    // Arrow from B → h
    svg.append('line').attr('x1', bX + bSize + 6).attr('y1', yTop + wSize / 2)
      .attr('x2', outputCx - 10).attr('y2', yTop + wSize / 2)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.2);

    // Output "h"
    svg.append('circle').attr('id', 'lora-h').attr('cx', outputCx).attr('cy', yTop + wSize / 2)
      .attr('r', 8).attr('fill', 'var(--accent-2)').attr('opacity', 0.9);
    svg.append('text').attr('x', outputCx).attr('y', yTop + wSize / 2 - 16)
      .attr('text-anchor', 'middle').style('font-family', 'JetBrains Mono,monospace')
      .style('font-size', '12px').style('fill', 'var(--text-soft)').text('h');

    // Animated forward pass particle (hidden by default)
    svg.append('circle').attr('id', 'lora-particle')
      .attr('cx', inputCx).attr('cy', yTop + wSize / 2)
      .attr('r', 5).attr('fill', 'var(--accent-2)').attr('opacity', 0);

    // Param-count panel
    const full = D * K;
    const lora = rank * (D + K);
    const reduce = (full / lora);
    const panel = document.createElement('div');
    panel.style.cssText = 'margin-top:14px;padding:14px;background:var(--bg-frame-2);border-radius:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px';
    panel.innerHTML = `
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft)">${S.paramFull}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--text);margin-top:4px">${fmt(full)}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">${S.paramsDim}${D}·${K}</div>
      </div>
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent)">${S.paramLoRA}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--accent);margin-top:4px">${fmt(lora)}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">${S.paramsLora}${rank}·(${D}+${K})</div>
      </div>
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-4)">${S.reduction}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--accent-4);margin-top:4px">${reduce.toFixed(0)}×</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">${S.paramsReduce}</div>
      </div>
    `;
    root.appendChild(panel);

    // Adapter hot-swap row
    const adapt = document.createElement('div');
    adapt.style.cssText = 'margin-top:18px';
    adapt.innerHTML = `
      <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:8px">${S.adapters}</div>
      <div id="lora-tasks" style="display:flex;gap:10px;flex-wrap:wrap"></div>
      <div style="margin-top:10px;font-size:0.82rem;color:var(--text-muted);font-style:italic">${S.caption}</div>
    `;
    root.appendChild(adapt);

    const tasks = [S.task1, S.task2, S.task3];
    const colors = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)'];
    const taskRoot = document.getElementById('lora-tasks');
    tasks.forEach((t, i) => {
      const card = document.createElement('button');
      card.className = 'btn btn-ghost';
      card.style.cssText = `padding:10px 14px;border-color:${i===activeTask?colors[i]:'var(--border-strong)'};color:${i===activeTask?colors[i]:'var(--text-soft)'};display:flex;flex-direction:column;align-items:flex-start;gap:4px`;
      card.innerHTML = `<span style="font-family:Inter,sans-serif;font-size:0.78rem">${t}</span>
        <span style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted)">A_${i+1}, B_${i+1}  ·  ${fmt(lora)}</span>`;
      card.onclick = () => { activeTask = i; render(); };
      taskRoot.appendChild(card);
    });

    // Wire controls
    root.querySelectorAll('.lora-r').forEach(b => {
      b.addEventListener('click', e => { rank = +e.currentTarget.dataset.r; render(); });
    });
    document.getElementById('lora-play').addEventListener('click', animate);
  }

  function animate() {
    if (animating) return;
    animating = true;
    const root = document.getElementById('viz4-5');
    if (!root) { animating = false; return; }
    const particle = d3.select(root).select('#lora-particle');
    const target = d3.select(root).select('#lora-h');
    const startX = +particle.attr('cx');
    const endX = +target.attr('cx');
    particle.attr('opacity', 0.95).attr('cx', startX);
    particle.transition().duration(900).ease(d3.easeCubicInOut)
      .attr('cx', endX)
      .on('end', () => {
        particle.transition().duration(300).attr('opacity', 0);
        target.transition().duration(200).attr('r', 12).transition().duration(300).attr('r', 8)
          .on('end', () => { animating = false; });
      });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__loraT); window.__loraT = setTimeout(render, 120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

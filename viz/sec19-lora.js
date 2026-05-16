/* §19 — LoRA: low-rank adaptation
 * Visualize the W (frozen, big) + BA (trainable, slim) decomposition.
 * Slider for rank r controls A and B matrix widths and updates param-count math.
 * Bottom: hot-swap LoRA adapters on a single frozen base model.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      rank: 'Rank r', dDim: 'd (output)', kDim: 'k (input)',
      frozen: 'W  (frozen, pretrained)', trainA: 'A  (trainable)', trainB: 'B  (trainable)',
      forward: 'Forward pass:  h = Wx + BAx',
      paramFull: 'Full fine-tune', paramLoRA: 'LoRA params', reduction: 'reduction',
      adapters: 'One base model, many adapters', play: 'Animate forward', reset: 'Reset',
      task1: 'task: SQL', task2: 'task: French', task3: 'task: medical',
      caption: 'Only A and B receive gradients. The base W is shared by every task.',
    },
    zh: {
      rank: '秩 r', dDim: 'd (输出)', kDim: 'k (输入)',
      frozen: 'W  (冻结, 预训练)', trainA: 'A  (可训练)', trainB: 'B  (可训练)',
      forward: '前向:  h = Wx + BAx',
      paramFull: '全量微调', paramLoRA: 'LoRA 参数', reduction: '减少',
      adapters: '一个基模, 多套适配器', play: '播放前向', reset: '重置',
      task1: '任务: SQL', task2: '任务: 法语', task3: '任务: 医疗',
      caption: '只有 A 和 B 接收梯度. 基础 W 被所有任务共享.',
    },
  };

  let rank = 4;
  const RANKS = [1, 4, 16, 64];
  const D = 768;   // illustrative dims
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
        ${RANKS.map(r => `<button class="btn btn-ghost lora-r" data-r="${r}" style="${r===rank?'border-color:var(--accent);color:var(--accent)':''}">${r}</button>`).join('')}
      </div>
      <button class="btn" id="lora-play">▶ ${S.play}</button>
    `;
    root.appendChild(controls);

    // SVG diagram
    const W = root.clientWidth || 720;
    const H = 280;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');

    // Layout: input x (left) → [W block] + [A then B path] → output h (right)
    const cx = W / 2;
    const yTop = 30;

    // Frozen W block (big square, gray)
    const wSize = 130;
    const wX = cx - 220;
    svg.append('rect').attr('x', wX).attr('y', yTop)
      .attr('width', wSize).attr('height', wSize)
      .attr('fill', 'var(--mask)').attr('opacity', 0.55)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1);
    svg.append('text').attr('x', wX + wSize/2).attr('y', yTop + wSize/2 + 5)
      .attr('text-anchor','middle').style('font-family','JetBrains Mono,monospace')
      .style('font-size','22px').style('fill','var(--text)').text('W');
    svg.append('text').attr('x', wX + wSize/2).attr('y', yTop + wSize + 18)
      .attr('text-anchor','middle').style('font-family','Inter,sans-serif')
      .style('font-size','11px').style('fill','var(--text-soft)').text(`${D} × ${K}  ·  ${S.frozen.split('  ')[1]}`);

    // The "+" sign
    svg.append('text').attr('x', wX + wSize + 22).attr('y', yTop + wSize/2 + 8)
      .attr('text-anchor','middle').style('font-size','24px').style('fill','var(--text-soft)').text('+');

    // A and B slim matrices: A is r×k (wide), B is d×r (tall)
    const slimMax = wSize;
    const slimThin = Math.max(4, Math.min(40, rank * 0.6 + 4));
    const aX = wX + wSize + 50;
    const aW = slimMax;     // k columns
    const aH = slimThin;    // r rows
    svg.append('rect').attr('x', aX).attr('y', yTop + (wSize - aH)/2)
      .attr('width', aW).attr('height', aH)
      .attr('fill', 'var(--accent)').attr('opacity', 0.85)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1);
    svg.append('text').attr('x', aX + aW/2).attr('y', yTop + (wSize - aH)/2 - 6)
      .attr('text-anchor','middle').style('font-family','JetBrains Mono,monospace')
      .style('font-size','13px').style('fill','var(--accent)').text(`A  (r=${rank} × ${K})`);

    const bX = aX + aW + 24;
    const bW = slimThin;
    const bH = slimMax;
    svg.append('rect').attr('x', bX).attr('y', yTop)
      .attr('width', bW).attr('height', bH)
      .attr('fill', 'var(--accent-3)').attr('opacity', 0.85)
      .attr('stroke', 'var(--accent-3)').attr('stroke-width', 1);
    svg.append('text').attr('x', bX + bW + 8).attr('y', yTop + bH/2)
      .attr('text-anchor','start').style('font-family','JetBrains Mono,monospace')
      .style('font-size','13px').style('fill','var(--accent-3)').text(`B  (${D} × r=${rank})`);

    // Animated x→h forward pass
    const path1 = svg.append('circle').attr('id','lora-x').attr('cx', wX - 30).attr('cy', yTop + wSize/2).attr('r',7).attr('fill','var(--accent-4)').attr('opacity',0);
    const path2 = svg.append('circle').attr('id','lora-h').attr('cx', bX + bW + 90).attr('cy', yTop + wSize/2).attr('r',7).attr('fill','var(--accent-2)').attr('opacity',0);
    svg.append('text').attr('x', wX - 30).attr('y', yTop + wSize + 20).attr('text-anchor','middle')
      .style('font-size','11px').style('fill','var(--text-soft)').text('x');
    svg.append('text').attr('x', bX + bW + 90).attr('y', yTop + wSize + 20).attr('text-anchor','middle')
      .style('font-size','11px').style('fill','var(--text-soft)').text('h');

    // Param-count panel
    const full = D * K;
    const lora = rank * (D + K);
    const reduce = (full / lora);
    const panel = document.createElement('div');
    panel.style.cssText = 'margin-top:14px;padding:14px;background:var(--bg-frame-2);border-radius:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px';
    panel.innerHTML = `
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft)">${S.paramFull}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--text);margin-top:4px">${fmt(full)}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">d × k = ${D}·${K}</div>
      </div>
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent)">${S.paramLoRA}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--accent);margin-top:4px">${fmt(lora)}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">r(d+k) = ${rank}·(${D}+${K})</div>
      </div>
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-4)">${S.reduction}</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:1.4rem;color:var(--accent-4);margin-top:4px">${reduce.toFixed(0)}×</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted)">fewer trainable params</div>
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
    const x = d3.select('#lora-x'); const h = d3.select('#lora-h');
    x.attr('opacity',1).attr('cx', x.attr('cx'));
    x.transition().duration(900).attr('cx', +x.attr('cx') + 30 + 220).attr('opacity', 0.4)
      .on('end', () => {
        h.attr('opacity', 0).attr('r', 4);
        h.transition().duration(500).attr('opacity', 1).attr('r', 9)
          .transition().duration(400).attr('r', 7)
          .on('end', () => { animating = false; x.attr('opacity', 0); });
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

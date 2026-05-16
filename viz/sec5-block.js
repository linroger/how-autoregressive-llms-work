/* §5 — Transformer block diagram
 * Boxes for input → LN → Attn → (+) → LN → FFN → (+) → output, with
 * residual arrows. Click each component to highlight + show shape annotation.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'pre-norm transformer block',
      shape: 'shape: [B, L, d=768]',
      input: 'input x', output: 'output',
      ln1: 'LayerNorm', attn: 'Multi-Head Attention',
      ln2: 'LayerNorm', ffn: 'FFN (4d hidden)',
      desc: {
        ln1: 'normalize features per-token: μ=0, σ=1, then learned γ,β.',
        attn: 'each token mixes information from others via Q·K softmax · V.',
        ln2: 'second LayerNorm before the FFN sublayer.',
        ffn: 'two linear layers with GELU; hidden expands to 4·d.',
        res: 'residual skip — gradient highway, preserves identity.',
        none: 'click a box to inspect.',
      },
    },
    zh: {
      title: 'pre-norm Transformer 块',
      shape: '形状: [B, L, d=768]',
      input: '输入 x', output: '输出',
      ln1: 'LayerNorm', attn: '多头注意力',
      ln2: 'LayerNorm', ffn: 'FFN (4d 隐层)',
      desc: {
        ln1: '逐 token 归一化:μ=0, σ=1, 然后乘以可学习的 γ,β。',
        attn: '每个 token 通过 Q·K softmax · V 混合其他位置的信息。',
        ln2: 'FFN 子层前的第二个 LayerNorm。',
        ffn: '两层线性 + GELU,隐层扩展到 4·d。',
        res: '残差连接 — 梯度高速路,保留恒等映射。',
        none: '点击任意方框查看说明。',
      },
    },
  };

  let selected = 'none';

  function render() {
    const root = document.getElementById('viz1-5');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    const W = Math.min(root.clientWidth || 640, 640);
    const H = 320;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);

    // Vertical layout: x → LN1 → Attn → (+) → LN2 → FFN → (+) → output
    const boxes = [
      { id: 'input',  label: S.input,  x: W/2, y: 14, w: 90, h: 28, kind: 'io' },
      { id: 'ln1',    label: S.ln1,    x: W/2, y: 56, w: 110, h: 28, kind: 'op' },
      { id: 'attn',   label: S.attn,   x: W/2, y: 98, w: 170, h: 32, kind: 'op' },
      { id: 'res1',   label: '+',      x: W/2, y: 148, w: 28, h: 28, kind: 'add' },
      { id: 'ln2',    label: S.ln2,    x: W/2, y: 190, w: 110, h: 28, kind: 'op' },
      { id: 'ffn',    label: S.ffn,    x: W/2, y: 232, w: 170, h: 32, kind: 'op' },
      { id: 'res2',   label: '+',      x: W/2, y: 282, w: 28, h: 28, kind: 'add' },
      { id: 'output', label: S.output, x: W/2, y: H - 4, w: 90, h: 0, kind: 'io' }, // placeholder
    ];

    // Vertical trunk arrow
    svg.append('defs').append('marker')
      .attr('id','arrow').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5)
      .attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
      .append('path').attr('d','M0,0 L10,5 L0,10 Z').attr('fill','var(--text-muted)');

    // Connect trunk between operations
    const trunkPairs = [['input','ln1'],['ln1','attn'],['attn','res1'],['res1','ln2'],['ln2','ffn'],['ffn','res2']];
    trunkPairs.forEach(([a,b]) => {
      const A = boxes.find(x=>x.id===a), B = boxes.find(x=>x.id===b);
      svg.append('line').attr('x1', A.x).attr('x2', B.x)
        .attr('y1', A.y + (A.h)/2).attr('y2', B.y - (B.h)/2)
        .attr('stroke','var(--text-muted)').attr('stroke-width',1.5)
        .attr('marker-end','url(#arrow)');
    });

    // Residual arrows (curved skip connections)
    const skipColor = selected === 'res' ? 'var(--accent-4)' : 'var(--text-muted)';
    const skip1 = svg.append('path')
      .attr('d', `M ${W/2 - 4} ${28} C ${W/2 - 110} ${50}, ${W/2 - 110} ${130}, ${W/2 - 18} ${148}`)
      .attr('fill','none').attr('stroke', skipColor).attr('stroke-width', selected==='res' ? 2.5 : 1.5)
      .attr('marker-end','url(#arrow)').style('cursor','pointer');
    const skip2 = svg.append('path')
      .attr('d', `M ${W/2 - 4} ${162} C ${W/2 - 110} ${184}, ${W/2 - 110} ${266}, ${W/2 - 18} ${282}`)
      .attr('fill','none').attr('stroke', skipColor).attr('stroke-width', selected==='res' ? 2.5 : 1.5)
      .attr('marker-end','url(#arrow)').style('cursor','pointer');
    [skip1, skip2].forEach(p => p.on('click', () => { selected = 'res'; render(); }));

    // Boxes
    boxes.filter(b => b.kind !== 'io' || b.id === 'input').forEach(b => {
      const isSel = selected === b.id;
      const fill = b.kind === 'op' ? 'var(--bg-frame-2)' : b.kind === 'add' ? 'var(--accent-4)' : 'var(--bg-frame)';
      const stroke = isSel ? 'var(--accent)' : 'var(--text-muted)';
      const g = svg.append('g').style('cursor', b.kind === 'op' ? 'pointer' : 'default')
        .on('click', () => { if (b.kind === 'op' || b.id === 'res1' || b.id === 'res2') { selected = b.id === 'res1' || b.id === 'res2' ? 'res' : b.id; render(); } });
      g.append('rect')
        .attr('x', b.x - b.w/2).attr('y', b.y - b.h/2)
        .attr('width', b.w).attr('height', b.h).attr('rx', b.kind === 'add' ? b.h/2 : 4)
        .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', isSel ? 2 : 1);
      g.append('text').attr('x', b.x).attr('y', b.y + 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-family', b.kind === 'op' ? 'inherit' : "'JetBrains Mono', monospace")
        .style('fill', b.kind === 'add' ? '#fff' : 'var(--text)')
        .text(b.label);
    });

    // shape annotation tooltip on the right side
    svg.append('text').attr('x', W - 8).attr('y', 28)
      .attr('text-anchor', 'end')
      .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
      .style('fill', 'var(--text-muted)').text(S.shape);

    // output arrow + label below
    svg.append('line').attr('x1', W/2).attr('x2', W/2).attr('y1', 296).attr('y2', H - 14)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.5).attr('marker-end', 'url(#arrow)');
    svg.append('text').attr('x', W/2).attr('y', H - 2).attr('text-anchor','middle')
      .style('font-size','11px').style('fill','var(--text-soft)').text(S.output);

    // description box
    const desc = document.createElement('div');
    desc.style.marginTop = '10px';
    desc.style.padding = '10px 12px';
    desc.style.background = 'var(--bg-frame-2)';
    desc.style.border = '1px solid var(--bg-frame)';
    desc.style.borderLeft = '3px solid var(--accent)';
    desc.style.fontSize = '13px';
    desc.style.color = 'var(--text-soft)';
    const key = selected === 'none' ? 'none' : (selected === 'res' ? 'res' : selected);
    desc.textContent = S.desc[key] || S.desc.none;
    root.appendChild(desc);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* §24 — Mamba / Selective SSM
 * Toggle between recurrent and convolutional views.
 * Toggle between fixed (S4) and selective (Mamba: data-dependent B, C, Δ).
 * Bottom: O(N) vs O(N^2) compute curve.
 */
(function () {
  'use strict';

  const STR = {
    en: { recur: 'Recurrent view', conv: 'Convolutional view', fixed: 'Fixed SSM (S4)', sel: 'Selective SSM (Mamba)', state: 'state h', input: 'input x', output: 'output y', kernel: 'kernel K = (CB, CAB, CA²B, …)', cost: 'Compute vs sequence length', mamba: 'Mamba  O(N)', attn: 'Attention  O(N²)', caption: 'Selective SSM lets B, C, Δ depend on the current input — turning a fixed convolution into content-aware gating, the trick that closes most of the quality gap with attention while keeping linear cost.' },
    zh: { recur: '递推视角', conv: '卷积视角', fixed: '固定 SSM (S4)', sel: '选择性 SSM (Mamba)', state: '状态 h', input: '输入 x', output: '输出 y', kernel: '卷积核 K = (CB, CAB, CA²B, …)', cost: '计算量 vs 序列长度', mamba: 'Mamba  O(N)', attn: '注意力  O(N²)', caption: '选择性 SSM 让 B, C, Δ 依赖于当前输入 — 把固定卷积变成内容感知的门控, 在保持线性代价的同时基本补上了与注意力的质量差距.' },
  };

  let view = 'recur';
  let selective = true;
  let step = 0;
  let timer = null;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function render() {
    const root = document.getElementById('viz6-1');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Toggles
    const ctrl = document.createElement('div');
    ctrl.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;align-items:center';
    ctrl.innerHTML = `
      <div style="display:flex;border:1px solid var(--border-strong);border-radius:4px;overflow:hidden">
        <button class="m-view" data-v="recur" style="padding:6px 12px;background:${view==='recur'?'var(--accent)':'transparent'};color:${view==='recur'?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.recur}</button>
        <button class="m-view" data-v="conv" style="padding:6px 12px;background:${view==='conv'?'var(--accent)':'transparent'};color:${view==='conv'?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.conv}</button>
      </div>
      <div style="display:flex;border:1px solid var(--border-strong);border-radius:4px;overflow:hidden">
        <button class="m-sel" data-s="0" style="padding:6px 12px;background:${!selective?'var(--accent-3)':'transparent'};color:${!selective?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.fixed}</button>
        <button class="m-sel" data-s="1" style="padding:6px 12px;background:${selective?'var(--accent-3)':'transparent'};color:${selective?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.sel}</button>
      </div>
      <button class="btn" id="m-play">▶ animate</button>
    `;
    root.appendChild(ctrl);

    // Equation
    const eq = document.createElement('div');
    eq.style.cssText = 'padding:10px 14px;background:var(--bg-frame-2);border-radius:5px;margin-bottom:12px;font-family:JetBrains Mono,monospace;font-size:0.86rem;color:var(--text)';
    if (view === 'recur') {
      eq.innerHTML = selective
        ? 'h<sub>k</sub> = Ā h<sub>k−1</sub> + B̄(x<sub>k</sub>) · x<sub>k</sub> &nbsp;·&nbsp; y<sub>k</sub> = C(x<sub>k</sub>) · h<sub>k</sub>'
        : 'h<sub>k</sub> = Ā h<sub>k−1</sub> + B̄ x<sub>k</sub> &nbsp;·&nbsp; y<sub>k</sub> = C h<sub>k</sub>';
    } else {
      eq.innerHTML = 'y = K * x &nbsp;,&nbsp; ' + S.kernel;
    }
    root.appendChild(eq);

    // Main diagram
    const W = root.clientWidth || 720;
    const H = 200;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');

    const N = 8;
    const usable = W - 60;
    const stepX = usable / (N + 1);
    const boxW = Math.min(50, stepX * 0.7);
    const yIn = 30, yState = 95, yOut = 165;

    if (view === 'recur') {
      // input row (top)
      for (let k = 0; k < N; k++) {
        const x = 30 + (k + 0.5) * stepX;
        svg.append('rect').attr('x', x - boxW/2).attr('y', yIn).attr('width', boxW).attr('height', 22)
          .attr('rx', 3).attr('fill','var(--accent-4)').attr('opacity', 0.7);
        svg.append('text').attr('x', x).attr('y', yIn + 15).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','11px').style('fill','#fff').text(`x${k}`);

        // state box (middle)
        const active = k <= step;
        svg.append('rect').attr('x', x - boxW/2).attr('y', yState).attr('width', boxW).attr('height', 28)
          .attr('rx', 4).attr('fill', active ? 'var(--accent)' : 'var(--bg-frame-2)')
          .attr('stroke', selective ? 'var(--accent-3)' : 'var(--border-strong)').attr('stroke-width', selective ? 2 : 1);
        svg.append('text').attr('x', x).attr('y', yState + 18).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','11px')
          .style('fill', active ? '#fff' : 'var(--text-muted)').text(`h${k}`);

        // output row (bottom)
        svg.append('rect').attr('x', x - boxW/2).attr('y', yOut).attr('width', boxW).attr('height', 22)
          .attr('rx', 3).attr('fill', active ? 'var(--accent-2)' : 'var(--bg-frame-2)')
          .attr('opacity', active ? 0.85 : 0.4);
        svg.append('text').attr('x', x).attr('y', yOut + 15).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','11px')
          .style('fill', active ? '#fff' : 'var(--text-muted)').text(`y${k}`);

        // arrows: x↓, →
        svg.append('line').attr('x1', x).attr('y1', yIn + 22).attr('x2', x).attr('y2', yState).attr('stroke','var(--text-muted)').attr('stroke-width', 1);
        svg.append('line').attr('x1', x).attr('y1', yState + 28).attr('x2', x).attr('y2', yOut).attr('stroke','var(--text-muted)').attr('stroke-width', 1);
        if (k > 0) {
          svg.append('line').attr('x1', 30 + (k-0.5+0.5)*stepX - boxW/2).attr('y1', yState+14)
            .attr('x2', x - boxW/2).attr('y2', yState+14)
            .attr('stroke', active ? 'var(--accent)' : 'var(--border-strong)').attr('stroke-width', 1.5)
            .attr('marker-end','url(#mam-a)');
        }
      }
      // labels
      svg.append('text').attr('x', 6).attr('y', yIn + 15).style('font-size','11px').style('fill','var(--text-soft)').text(S.input);
      svg.append('text').attr('x', 6).attr('y', yState + 18).style('font-size','11px').style('fill','var(--text-soft)').text(S.state);
      svg.append('text').attr('x', 6).attr('y', yOut + 15).style('font-size','11px').style('fill','var(--text-soft)').text(S.output);
    } else {
      // Convolutional view: kernel above, sliding over input
      const kLen = 5;
      const baseY = 110;
      // kernel
      for (let i = 0; i < kLen; i++) {
        const x = 30 + (i + 0.5) * stepX;
        const intensity = Math.exp(-i * 0.5);
        svg.append('rect').attr('x', x - boxW/2).attr('y', 30).attr('width', boxW).attr('height', 28)
          .attr('rx', 3).attr('fill','var(--accent-3)').attr('opacity', 0.3 + 0.6 * intensity);
        const label = i === 0 ? 'CB' : (i === 1 ? 'CAB' : 'CA' + (i === 2 ? '²' : i === 3 ? '³' : '⁴') + 'B');
        svg.append('text').attr('x', x).attr('y', 48).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','10px').style('fill','#fff').text(label);
      }
      svg.append('text').attr('x', 6).attr('y', 48).style('font-size','11px').style('fill','var(--text-soft)').text('K');
      // input sequence
      for (let k = 0; k < N; k++) {
        const x = 30 + (k + 0.5) * stepX;
        svg.append('rect').attr('x', x - boxW/2).attr('y', baseY).attr('width', boxW).attr('height', 22)
          .attr('rx', 3).attr('fill','var(--accent-4)').attr('opacity', 0.7);
        svg.append('text').attr('x', x).attr('y', baseY + 15).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','11px').style('fill','#fff').text(`x${k}`);
      }
      svg.append('text').attr('x', 6).attr('y', baseY + 15).style('font-size','11px').style('fill','var(--text-soft)').text('x');
      // output: highlight current position
      for (let k = 0; k < N; k++) {
        const x = 30 + (k + 0.5) * stepX;
        const active = k === step;
        svg.append('rect').attr('x', x - boxW/2).attr('y', baseY + 50).attr('width', boxW).attr('height', 22)
          .attr('rx', 3).attr('fill', active ? 'var(--accent-2)' : 'var(--bg-frame-2)').attr('opacity', active ? 1 : 0.5);
        svg.append('text').attr('x', x).attr('y', baseY + 65).attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','11px')
          .style('fill', active ? '#fff' : 'var(--text-muted)').text(`y${k}`);
      }
      svg.append('text').attr('x', 6).attr('y', baseY + 65).style('font-size','11px').style('fill','var(--text-soft)').text('y');
    }

    // Compute scaling subchart
    const W2 = W;
    const H2 = 200;
    const margin = { top: 20, right: 12, bottom: 28, left: 50 };
    const innerW = W2 - margin.left - margin.right;
    const innerH = H2 - margin.top - margin.bottom;
    const cost = d3.select(root).append('svg').attr('width', W2).attr('height', H2).style('margin-top','16px').style('overflow','visible');
    cost.append('text').attr('x', margin.left).attr('y', 14).style('font-family','Inter,sans-serif').style('font-size','12px')
      .style('fill','var(--text-soft)').text(S.cost);

    const g = cost.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 10000]).range([innerH, 0]);

    g.append('g').attr('transform',`translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5)).selectAll('text').style('fill','var(--text-muted)');
    g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').style('fill','var(--text-muted)');
    g.selectAll('.domain, .tick line').style('stroke','var(--border)');

    const xs = d3.range(0, 101, 2);
    const line = d3.line().x(d => x(d)).y(d => y(d * 8)).curve(d3.curveBasis);
    const line2 = d3.line().x(d => x(d)).y(d => y(d * d)).curve(d3.curveBasis);
    g.append('path').datum(xs).attr('fill','none').attr('stroke','var(--accent)').attr('stroke-width', 2).attr('d', line);
    g.append('path').datum(xs).attr('fill','none').attr('stroke','var(--accent-3)').attr('stroke-width', 2).attr('d', line2);
    g.append('text').attr('x', innerW - 110).attr('y', 18).style('font-size','11px').style('font-family','JetBrains Mono,monospace').style('fill','var(--accent)').text(S.mamba);
    g.append('text').attr('x', innerW - 110).attr('y', 34).style('font-size','11px').style('font-family','JetBrains Mono,monospace').style('fill','var(--accent-3)').text(S.attn);

    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:10px;font-size:0.82rem;color:var(--text-muted);font-style:italic;max-width:64ch';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // Wire
    root.querySelectorAll('.m-view').forEach(b => b.addEventListener('click', e => { view = e.currentTarget.dataset.v; render(); }));
    root.querySelectorAll('.m-sel').forEach(b => b.addEventListener('click', e => { selective = e.currentTarget.dataset.s === '1'; render(); }));
    document.getElementById('m-play').addEventListener('click', play);
  }

  function play() {
    if (timer) clearInterval(timer);
    step = 0; render();
    timer = setInterval(() => {
      step++;
      if (step >= 8) { clearInterval(timer); timer = null; return; }
      render();
    }, 420);
  }

  function init() {
    step = 7;
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__mamT); window.__mamT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

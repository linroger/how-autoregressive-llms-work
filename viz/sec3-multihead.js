/* §3 — Multi-head attention
 * Four small heads side-by-side, each exhibiting a different qualitative
 * attention pattern: positional, syntactic, semantic, copying.
 * Click a head to enlarge.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      heads: [
        { name: 'positional', desc: 'attends to neighbors (i-1, i+1)' },
        { name: 'syntactic', desc: 'verbs ↔ subjects/objects' },
        { name: 'semantic', desc: 'coreference: "it" → "cat"' },
        { name: 'copying', desc: 'identity / self-attention' },
      ],
      tokens: ['The','cat','sat','on','the','mat','because','it'],
      hint: 'Different heads learn different relationships in parallel.',
      back: '← all heads',
    },
    zh: {
      heads: [
        { name: '位置', desc: '关注邻居 (i-1, i+1)' },
        { name: '句法', desc: '动词 ↔ 主语/宾语' },
        { name: '语义', desc: '指代:"它" → "猫"' },
        { name: '复制', desc: '恒等 / 自关注' },
      ],
      tokens: ['那','只','猫','坐','在','垫','上','它'],
      hint: '不同的头并行学习不同的关系。',
      back: '← 全部',
    },
  };

  const N = 8;
  let zoomed = -1;

  function patternFor(h) {
    const rng = DLM.makeRNG(31 + h * 7);
    const M = Array.from({length: N}, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M[i][j] = rng() * 0.4;
    if (h === 0) {
      // positional: i-1, i+1, i
      for (let i = 0; i < N; i++) { M[i][i] += 1.4; if (i>0) M[i][i-1] += 1.6; if (i<N-1) M[i][i+1] += 1.1; }
    } else if (h === 1) {
      // syntactic: verb "sat"(2) ↔ subject(1) + obj(5); other tokens look at sat
      for (let i = 0; i < N; i++) { M[i][2] += 1.0; }
      M[2][1] += 2.0; M[2][5] += 1.6; M[1][2] += 1.4; M[5][2] += 1.2;
    } else if (h === 2) {
      // semantic: 'it'(7) -> 'cat'(1); 'mat'(5) -> 'cat'(1) weakly
      M[7][1] += 3.0; M[7][7] += 0.6; M[5][1] += 0.8;
      for (let i = 0; i < N; i++) M[i][i] += 0.5;
    } else {
      // copying / self
      for (let i = 0; i < N; i++) M[i][i] += 3.0;
    }
    // softmax rows for plotting
    for (let i = 0; i < N; i++) {
      const m = Math.max(...M[i]);
      const e = M[i].map(v => Math.exp(v - m));
      const s = e.reduce((a,b)=>a+b,0);
      M[i] = e.map(v => v/s);
    }
    return M;
  }

  function drawHead(parent, M, size, withLabels, tokens) {
    const cell = (size - (withLabels ? 50 : 0)) / N;
    const off = withLabels ? 50 : 0;
    const svg = d3.select(parent).append('svg').attr('width', size).attr('height', size);
    const color = d3.scaleSequential().domain([0, 0.6]).interpolator(d3.interpolatePlasma);

    if (withLabels) {
      svg.selectAll('.kl').data(tokens).enter().append('text')
        .attr('x', (d,i) => off + i*cell + cell/2).attr('y', off - 6)
        .attr('text-anchor', 'middle').style('font-size', '9px')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--text-soft)').text(d => d);
      svg.selectAll('.ql').data(tokens).enter().append('text')
        .attr('x', off - 6).attr('y', (d,i) => off + i*cell + cell/2 + 3)
        .attr('text-anchor', 'end').style('font-size', '9px')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--text-soft)').text(d => d);
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        svg.append('rect')
          .attr('x', off + j*cell).attr('y', off + i*cell)
          .attr('width', cell - 0.5).attr('height', cell - 0.5)
          .attr('fill', color(M[i][j]))
          .attr('opacity', 0)
          .transition().duration(350).delay((i*N+j) * 4).attr('opacity', 1);
      }
    }
    return svg;
  }

  function render() {
    const root = document.getElementById('viz1-3');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    if (zoomed >= 0) {
      const back = document.createElement('button'); back.className = 'btn'; back.textContent = S.back;
      back.addEventListener('click', () => { zoomed = -1; render(); });
      root.appendChild(back);
      const wrap = document.createElement('div');
      wrap.style.marginTop = '12px';
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '20px';
      const M = patternFor(zoomed);
      const W = Math.min(root.clientWidth - 40, 360);
      drawHead(wrap, M, W, true, S.tokens);
      const meta = document.createElement('div');
      meta.style.color = 'var(--text-soft)';
      meta.style.fontSize = '13px';
      const h = S.heads[zoomed];
      meta.innerHTML = `<div style="color:var(--accent);font-weight:600;margin-bottom:4px">Head ${zoomed+1}: ${h.name}</div><div>${h.desc}</div>`;
      wrap.appendChild(meta);
      root.appendChild(wrap);
      return;
    }

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
    grid.style.gap = '12px';

    S.heads.forEach((h, idx) => {
      const cell = document.createElement('div');
      cell.style.cursor = 'pointer';
      cell.style.padding = '8px';
      cell.style.border = '1px solid var(--bg-frame-2)';
      cell.style.borderRadius = '6px';
      cell.style.background = 'var(--bg-frame-2)';
      cell.style.transition = 'border-color 200ms';
      cell.addEventListener('mouseenter', () => cell.style.borderColor = 'var(--accent)');
      cell.addEventListener('mouseleave', () => cell.style.borderColor = 'var(--bg-frame-2)');
      cell.addEventListener('click', () => { zoomed = idx; render(); });

      const title = document.createElement('div');
      title.style.fontSize = '11px';
      title.style.fontWeight = '600';
      title.style.color = 'var(--accent)';
      title.style.marginBottom = '4px';
      title.textContent = `Head ${idx+1}: ${h.name}`;
      cell.appendChild(title);

      const M = patternFor(idx);
      drawHead(cell, M, 140, false, S.tokens);

      const sub = document.createElement('div');
      sub.style.fontSize = '10px';
      sub.style.color = 'var(--text-muted)';
      sub.style.marginTop = '4px';
      sub.textContent = h.desc;
      cell.appendChild(sub);

      grid.appendChild(cell);
    });
    root.appendChild(grid);

    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '10px';
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

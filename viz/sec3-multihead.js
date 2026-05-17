/* §3 — Multi-head attention
 * 8 small heads in a 2x4 (or 4x2) responsive grid, each showing a distinct
 * qualitative attention pattern. Click any head to enlarge with token labels.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      heads: [
        { name: 'positional', desc: 'attends to neighbors (i-1, i+1)' },
        { name: 'syntactic', desc: 'verbs ↔ subjects/objects' },
        { name: 'coreference', desc: '"it" → "cat"' },
        { name: 'copy / self', desc: 'identity / self-attention' },
        { name: 'previous-token', desc: 'each token looks at i-1' },
        { name: 'punctuation', desc: 'attends to delimiters' },
        { name: 'induction', desc: 'pattern: A B … A → B' },
        { name: 'broadcast', desc: 'attends to BOS / sentence head' },
      ],
      tokens: ['The','cat','sat','on','the','mat','because','it'],
      hint: 'Different heads learn different relationships in parallel. Click a head to inspect it.',
      back: '← all heads',
    },
    zh: {
      heads: [
        { name: '位置', desc: '关注邻居 (i-1, i+1)' },
        { name: '句法', desc: '动词 ↔ 主语/宾语' },
        { name: '指代', desc: '"它" → "猫"' },
        { name: '自关注', desc: '恒等' },
        { name: '前一个', desc: '每个 token 看 i-1' },
        { name: '标点', desc: '关注分隔符' },
        { name: '归纳', desc: '模式: A B … A → B' },
        { name: '广播', desc: '关注开头 token' },
      ],
      tokens: ['那','只','猫','坐','在','垫','上','它'],
      hint: '不同的头并行学习不同的关系。点击任意头进行查看。',
      back: '← 全部',
    },
  };

  const N = 8;
  const NUM_HEADS = 8;
  let zoomed = -1;

  function patternFor(h) {
    const rng = DLM.makeRNG(31 + h * 7);
    const M = Array.from({length: N}, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M[i][j] = rng() * 0.3;
    if (h === 0) {
      // positional: i-1, i+1, i
      for (let i = 0; i < N; i++) { M[i][i] += 1.4; if (i>0) M[i][i-1] += 1.6; if (i<N-1) M[i][i+1] += 1.1; }
    } else if (h === 1) {
      // syntactic: verb "sat"(2) ↔ subject(1) + obj(5)
      for (let i = 0; i < N; i++) { M[i][2] += 0.6; }
      M[2][1] += 2.0; M[2][5] += 1.6; M[1][2] += 1.4; M[5][2] += 1.2;
    } else if (h === 2) {
      // coreference: 'it'(7) -> 'cat'(1)
      M[7][1] += 3.0; M[7][7] += 0.6; M[5][1] += 0.8;
      for (let i = 0; i < N; i++) M[i][i] += 0.5;
    } else if (h === 3) {
      // copy / self
      for (let i = 0; i < N; i++) M[i][i] += 3.0;
    } else if (h === 4) {
      // previous-token head
      for (let i = 0; i < N; i++) { if (i > 0) M[i][i-1] += 3.0; M[i][i] += 0.2; }
    } else if (h === 5) {
      // punctuation: assume "because"(6) acts as delimiter
      for (let i = 0; i < N; i++) M[i][6] += 1.6;
      for (let i = 0; i < N; i++) M[i][i] += 0.4;
    } else if (h === 6) {
      // induction head: detect "the" repeats; "the"(0) <-> "the"(4)
      M[4][0] += 2.5; M[4][1] += 1.6; // after second "the", expect "cat"
      for (let i = 0; i < N; i++) M[i][i] += 0.3;
    } else {
      // broadcast: every token attends to BOS-like first position
      for (let i = 0; i < N; i++) M[i][0] += 2.0;
      for (let i = 0; i < N; i++) M[i][i] += 0.4;
    }
    // softmax rows
    for (let i = 0; i < N; i++) {
      const m = Math.max(...M[i]);
      const e = M[i].map(v => Math.exp(v - m));
      const s = e.reduce((a,b)=>a+b,0);
      M[i] = e.map(v => v/s);
    }
    return M;
  }

  function drawHead(parent, M, size, withLabels, tokens) {
    const labelPad = withLabels ? 44 : 0;
    const inner = size - labelPad;
    const cell = inner / N;
    const off = labelPad;
    const svg = d3.select(parent).append('svg').attr('width', size).attr('height', size);
    const color = d3.scaleSequential().domain([0, 0.6]).interpolator(d3.interpolatePlasma);

    if (withLabels) {
      svg.selectAll('.kl').data(tokens).enter().append('text')
        .attr('x', (d,i) => off + i*cell + cell/2).attr('y', off - 6)
        .attr('text-anchor', 'middle').style('font-size', '10px')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--text-soft)').text(d => d);
      svg.selectAll('.ql').data(tokens).enter().append('text')
        .attr('x', off - 6).attr('y', (d,i) => off + i*cell + cell/2 + 3)
        .attr('text-anchor', 'end').style('font-size', '10px')
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
          .transition().duration(300).delay((i*N+j) * 3).attr('opacity', 1);
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
      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'center';
      top.style.marginBottom = '12px';
      const back = document.createElement('button');
      back.className = 'btn btn-ghost';
      back.textContent = S.back;
      back.addEventListener('click', () => { zoomed = -1; render(); });
      top.appendChild(back);
      const tag = document.createElement('div');
      const h = S.heads[zoomed];
      tag.innerHTML = `<span style="color:var(--accent);font-weight:600">Head ${zoomed+1}: ${h.name}</span> · <span style="color:var(--text-muted)">${h.desc}</span>`;
      tag.style.fontSize = '13px';
      top.appendChild(tag);
      root.appendChild(top);

      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.justifyContent = 'center';
      const M = patternFor(zoomed);
      const W = Math.min((root.clientWidth || 400) - 40, 380);
      drawHead(wrap, M, W, true, S.tokens);
      root.appendChild(wrap);
      return;
    }

    // Grid: 4 cols on wide, 2 cols on narrow; rows auto
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    const w = root.clientWidth || 600;
    const cols = w < 460 ? 2 : (w < 720 ? 3 : 4);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gap = '10px';
    grid.style.marginBottom = '12px';

    const cellSize = Math.max(110, Math.min(170, Math.floor((w - (cols - 1) * 10 - 8) / cols) - 18));

    S.heads.forEach((h, idx) => {
      const cell = document.createElement('div');
      cell.style.cursor = 'pointer';
      cell.style.padding = '8px';
      cell.style.border = '1px solid var(--bg-frame-2)';
      cell.style.borderRadius = '6px';
      cell.style.background = 'var(--bg-frame-2)';
      cell.style.transition = 'border-color 200ms, transform 200ms';
      cell.addEventListener('mouseenter', () => {
        cell.style.borderColor = 'var(--accent)';
        cell.style.transform = 'translateY(-2px)';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.borderColor = 'var(--bg-frame-2)';
        cell.style.transform = 'translateY(0)';
      });
      cell.addEventListener('click', () => { zoomed = idx; render(); });

      const title = document.createElement('div');
      title.style.fontSize = '11px';
      title.style.fontWeight = '600';
      title.style.color = 'var(--accent)';
      title.style.marginBottom = '4px';
      title.textContent = `H${idx+1}: ${h.name}`;
      cell.appendChild(title);

      const M = patternFor(idx);
      const inner = document.createElement('div');
      inner.style.display = 'flex';
      inner.style.justifyContent = 'center';
      drawHead(inner, M, cellSize, false, S.tokens);
      cell.appendChild(inner);

      const sub = document.createElement('div');
      sub.style.fontSize = '10px';
      sub.style.color = 'var(--text-muted)';
      sub.style.marginTop = '4px';
      sub.style.lineHeight = '1.3';
      sub.textContent = h.desc;
      cell.appendChild(sub);

      grid.appendChild(cell);
    });
    root.appendChild(grid);

    const hint = document.createElement('div');
    hint.style.fontSize = '12px';
    hint.style.color = 'var(--text-muted)';
    hint.style.marginTop = '4px';
    hint.style.textAlign = 'center';
    hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function init() {
    window.addEventListener('langchange', render);
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

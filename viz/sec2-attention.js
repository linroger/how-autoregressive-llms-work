/* §2 — Attention scores heatmap
 * 8×8 grid of Q·K dot products for a sample sentence.
 * Animate softmax row normalization. Hover any cell for the Q·K value.
 * Highlight diagonal and a long-range link (it → cat).
 */
(function () {
  'use strict';

  const STR = {
    en: {
      tokens: ['The','cat','sat','on','the','mat','because','it'],
      raw: 'raw Q·K',
      normed: 'softmax(row)',
      hint: 'Each row tells where token i looks. Note "it" attends back to "cat".',
      playRaw: 'show Q·K',
      playSoft: 'apply softmax',
    },
    zh: {
      tokens: ['那','只','猫','坐','在','垫','上','它'],
      raw: '原始 Q·K',
      normed: '行 softmax',
      hint: '每一行告诉我们 token i 关注谁。注意"它"指回"猫"。',
      playRaw: '显示 Q·K',
      playSoft: '应用 softmax',
    },
  };

  const N = 8;
  let mode = 'raw'; // or 'softmax'

  // Build deterministic Q·K matrix with a clear interpretable pattern:
  // diagonal strong, plus "it"(7) → "cat"(1) anaphoric link.
  function buildScores() {
    const rng = DLM.makeRNG(11);
    const M = Array.from({length: N}, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let v = (rng() * 1.4) - 0.2; // base noise
        if (i === j) v += 2.2;                      // self
        if (j === i - 1 && i > 0) v += 0.7;         // previous token
        if (i === 7 && j === 1) v += 2.8;           // "it" → "cat"
        if (i === 7 && j === 5) v += 0.4;           // "it" → "mat" weakly
        M[i][j] = v;
      }
    }
    return M;
  }

  function softmaxRow(row) {
    const m = Math.max(...row);
    const e = row.map(v => Math.exp(v - m));
    const s = e.reduce((a,b)=>a+b,0);
    return e.map(v => v/s);
  }

  function render() {
    const root = document.getElementById('viz1-2');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // Controls
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '10px';
    const bRaw = document.createElement('button'); bRaw.className = 'btn' + (mode === 'raw' ? ' active' : ''); bRaw.textContent = S.playRaw; bRaw.style.marginRight = '6px';
    const bSoft = document.createElement('button'); bSoft.className = 'btn' + (mode === 'softmax' ? ' active' : ''); bSoft.textContent = S.playSoft;
    bRaw.addEventListener('click', () => { mode = 'raw'; render(); });
    bSoft.addEventListener('click', () => { mode = 'softmax'; render(); });
    ctrls.appendChild(bRaw); ctrls.appendChild(bSoft);
    root.appendChild(ctrls);

    const W = Math.min(root.clientWidth || 520, 520);
    const margin = { top: 60, right: 14, bottom: 14, left: 70 };
    const innerW = W - margin.left - margin.right;
    const cell = innerW / N;
    const H = cell * N + margin.top + margin.bottom;

    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Tooltip
    const tip = document.createElement('div');
    tip.style.position = 'absolute';
    tip.style.pointerEvents = 'none';
    tip.style.padding = '4px 8px';
    tip.style.background = 'var(--bg-frame-2)';
    tip.style.border = '1px solid var(--accent)';
    tip.style.color = 'var(--text)';
    tip.style.fontFamily = "'JetBrains Mono', monospace";
    tip.style.fontSize = '11px';
    tip.style.borderRadius = '4px';
    tip.style.opacity = 0;
    tip.style.transition = 'opacity 120ms';
    tip.style.zIndex = 50;
    document.body.appendChild(tip);

    const raw = buildScores();
    const data = mode === 'softmax' ? raw.map(softmaxRow) : raw;

    const all = data.flat();
    const ext = mode === 'softmax' ? [0, 1] : d3.extent(all);
    const color = d3.scaleSequential().domain(ext).interpolator(d3.interpolateViridis);

    // Top labels (keys)
    g.selectAll('.kl').data(S.tokens).enter().append('text')
      .attr('x', (d,i) => i*cell + cell/2)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px').style('fill', 'var(--text-soft)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d);
    // Left labels (queries)
    g.selectAll('.ql').data(S.tokens).enter().append('text')
      .attr('x', -6).attr('y', (d,i) => i*cell + cell/2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '10px').style('fill', 'var(--text-soft)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d);

    // Axis title
    svg.append('text').attr('x', margin.left + innerW/2).attr('y', 22)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text('Key →');
    svg.append('text').attr('x', 14).attr('y', margin.top + (cell*N)/2)
      .attr('transform', `rotate(-90, 14, ${margin.top + (cell*N)/2})`)
      .attr('text-anchor', 'middle').style('font-size', '11px').style('fill', 'var(--text-muted)')
      .text('Query ↓');

    // Cells
    const cells = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) cells.push({ i, j, raw: raw[i][j], v: data[i][j] });
    }
    g.selectAll('.cell').data(cells).enter().append('rect')
      .attr('class', 'cell')
      .attr('x', d => d.j*cell)
      .attr('y', d => d.i*cell)
      .attr('width', cell - 0.6).attr('height', cell - 0.6)
      .attr('fill', d => color(d.v))
      .attr('opacity', 0)
      .on('mouseover', function (e, d) {
        tip.style.opacity = 1;
        tip.innerHTML = `Q[${d.i}] · K[${d.j}] = ${d.raw.toFixed(2)}` + (mode === 'softmax' ? `<br>p = ${d.v.toFixed(3)}` : '');
        d3.select(this).attr('stroke', 'var(--accent)').attr('stroke-width', 1.5);
      })
      .on('mousemove', (e) => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
      .on('mouseout', function () { tip.style.opacity = 0; d3.select(this).attr('stroke', null); })
      .transition().duration(450).delay((d) => (d.i*N + d.j) * 6)
      .attr('opacity', 1);

    // Highlight long-range link "it" (row 7) → "cat" (col 1)
    g.append('rect').attr('x', 1*cell - 1).attr('y', 7*cell - 1)
      .attr('width', cell + 1).attr('height', cell + 1)
      .attr('fill', 'none').attr('stroke', 'var(--accent-3)').attr('stroke-width', 2)
      .attr('opacity', 0).transition().delay(900).duration(400).attr('opacity', 1);

    // Hint
    const hint = document.createElement('div');
    hint.style.fontSize = '12px';
    hint.style.color = 'var(--text-muted)';
    hint.style.marginTop = '8px';
    hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => render());
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

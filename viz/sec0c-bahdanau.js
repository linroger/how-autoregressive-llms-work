/* §0c — Bahdanau attention (2014): soft alignment over a source sentence
 * Animates target-word generation. At each step, draw lines (opacity = alignment weight)
 * from the current target token back to every source token, and reveal a row of the
 * alignment heatmap (target rows × source cols).
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Soft alignment learned end-to-end',
      src: 'Source (English)',
      tgt: 'Target (French)',
      source: ['the', 'cat', 'sat', 'on', 'the', 'mat'],
      target: ["le", "chat", "s'est", 'assis', 'sur', 'le', 'tapis'],
      heatmap: 'Alignment matrix α[t, s]',
      sCol: 'Source position s →',
      tRow: 'Target step t ↓',
      next: 'Next word',
      reset: 'Reset',
      play: '▶ Auto-play',
      pause: 'Pause',
      caption: 'No alignment labels were ever shown to the model. The weights emerge as a side-effect of optimizing translation likelihood — that\'s why we call it "soft" alignment.',
      stepFmt: (i, n) => `step ${i} / ${n}`,
    },
    zh: {
      title: '端到端学到的"软"对齐',
      src: '源句 (英文)',
      tgt: '目标 (法文)',
      source: ['the', 'cat', 'sat', 'on', 'the', 'mat'],
      target: ["le", "chat", "s'est", 'assis', 'sur', 'le', 'tapis'],
      heatmap: '对齐矩阵 α[t, s]',
      sCol: '源位置 s →',
      tRow: '目标步 t ↓',
      next: '下一个词',
      reset: '重置',
      play: '▶ 自动播放',
      pause: '暂停',
      caption: '模型从未见过对齐标注。这些权重作为优化翻译似然的副产品自动涌现 —— 因此称为"软"对齐。',
      stepFmt: (i, n) => `第 ${i} / ${n} 步`,
    },
  };

  // Hand-tuned alignment matrix: classic diagonal pattern, plus many-to-one
  // ("s'est" and "assis" both align strongly to "sat") and "le" appearing twice.
  // Rows index target, cols index source.
  //   src:   the   cat   sat   on    the   mat
  //   tgt:   le    chat  s'est assis sur   le    tapis
  function buildAlignment() {
    return [
      // le        chat  sat   on    the   mat
      [0.82, 0.10, 0.02, 0.02, 0.02, 0.02], // le      → the
      [0.05, 0.85, 0.04, 0.02, 0.02, 0.02], // chat    → cat
      [0.04, 0.06, 0.68, 0.10, 0.08, 0.04], // s'est   → sat (auxiliary, weakly diffused)
      [0.02, 0.06, 0.78, 0.08, 0.02, 0.04], // assis   → sat (past participle)
      [0.02, 0.02, 0.08, 0.78, 0.04, 0.06], // sur     → on
      [0.05, 0.04, 0.04, 0.04, 0.76, 0.07], // le      → the (the 2nd one)
      [0.02, 0.04, 0.04, 0.04, 0.06, 0.80], // tapis   → mat
    ];
  }

  let step = 0;       // 0 = nothing generated, 1..N = first N target words committed
  let timer = null;
  let auto = false;

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function render() {
    const root = document.getElementById('viz0c-bahdanau');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    const A = buildAlignment();
    const Ntgt = S.target.length;
    const Nsrc = S.source.length;
    root.innerHTML = '';

    // ─── tooltip (absolute, attached to body) ────────────────────────
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;'
      + 'background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);'
      + "font-family:'JetBrains Mono', monospace;font-size:11px;border-radius:4px;"
      + 'opacity:0;transition:opacity 120ms;z-index:50;white-space:nowrap;';
    document.body.appendChild(tip);
    // remove tip if container re-renders
    root.addEventListener('viz-cleanup', () => tip.remove(), { once: true });

    // ─── controls strip ──────────────────────────────────────────────
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap';
    const bNext = document.createElement('button'); bNext.className = 'btn'; bNext.textContent = S.next;
    const bAuto = document.createElement('button'); bAuto.className = 'btn btn-ghost'; bAuto.textContent = auto ? S.pause : S.play;
    const bReset = document.createElement('button'); bReset.className = 'btn btn-ghost'; bReset.textContent = S.reset;
    const stepRead = document.createElement('span');
    stepRead.style.cssText = "margin-left:auto;font-family:'JetBrains Mono', monospace;font-size:0.78rem;color:var(--text-soft)";
    stepRead.textContent = S.stepFmt(step, Ntgt);
    ctrls.append(bNext, bAuto, bReset, stepRead);
    root.appendChild(ctrls);

    // ─── alignment diagram (lines source ↔ target) ───────────────────
    const W = Math.min(root.clientWidth || 640, 720);
    const Hflow = 140;
    const margin = { top: 30, right: 20, bottom: 30, left: 20 };
    const innerW = W - margin.left - margin.right;

    const svg = d3.select(root).append('svg')
      .attr('width', W).attr('height', Hflow)
      .style('display', 'block').style('margin-bottom', '10px');

    // axis title for source row
    svg.append('text').attr('x', margin.left).attr('y', 14)
      .style('font-size', '11px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(S.src);
    svg.append('text').attr('x', margin.left).attr('y', Hflow - 8)
      .style('font-size', '11px').style('fill', 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(S.tgt);

    const srcY = 28, tgtY = Hflow - 22;
    const srcX = d3.scaleLinear().domain([-0.5, Nsrc - 0.5]).range([margin.left + 10, margin.left + innerW - 10]);
    const tgtX = d3.scaleLinear().domain([-0.5, Ntgt - 0.5]).range([margin.left + 10, margin.left + innerW - 10]);

    // alignment lines for current step (step >= 1 means target word at index step-1 is being generated)
    const curT = step - 1;
    if (curT >= 0 && curT < Ntgt) {
      const row = A[curT];
      for (let s = 0; s < Nsrc; s++) {
        const w = row[s];
        svg.append('line')
          .attr('x1', srcX(s)).attr('y1', srcY + 8)
          .attr('x2', tgtX(curT)).attr('y2', tgtY - 12)
          .attr('stroke', 'var(--accent-3)')
          .attr('stroke-width', 0.6 + w * 3.5)
          .attr('opacity', 0)
          .transition().duration(450).delay(s * 30)
          .attr('opacity', Math.max(0.08, w));
      }
    }

    // source tokens (top row)
    svg.selectAll('.src-tok').data(S.source).enter().append('text')
      .attr('class', 'src-tok')
      .attr('x', (d, i) => srcX(i)).attr('y', srcY)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px').style('fill', 'var(--text)')
      .style('font-family', "'JetBrains Mono', monospace")
      .style('font-weight', (d, i) => (curT >= 0 && A[curT][i] === Math.max(...A[curT])) ? 600 : 400)
      .text(d => d);

    // target tokens (bottom row): committed = colored, current = highlighted, future = dimmed
    svg.selectAll('.tgt-tok').data(S.target).enter().append('text')
      .attr('class', 'tgt-tok')
      .attr('x', (d, i) => tgtX(i)).attr('y', tgtY)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-family', "'JetBrains Mono', monospace")
      .style('fill', (d, i) => {
        if (i === curT) return 'var(--accent)';
        if (i < step) return 'var(--text)';
        return 'var(--text-muted)';
      })
      .style('opacity', (d, i) => i < step ? 1 : 0.45)
      .style('font-weight', (d, i) => i === curT ? 700 : 400)
      .text(d => d);

    // ─── heatmap ─────────────────────────────────────────────────────
    const Hh = 220;
    const mh = { top: 24, right: 14, bottom: 22, left: 70 };
    const cellW = (W - mh.left - mh.right) / Nsrc;
    const cellH = Math.min(26, (Hh - mh.top - mh.bottom) / Ntgt);
    const trueH = mh.top + mh.bottom + cellH * Ntgt;

    const svg2 = d3.select(root).append('svg')
      .attr('width', W).attr('height', trueH)
      .style('display', 'block');

    // title
    svg2.append('text').attr('x', mh.left).attr('y', 14)
      .style('font-size', '11px').style('fill', 'var(--text-soft)')
      .style('font-family', 'Inter, sans-serif')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.06em')
      .text(S.heatmap);

    const g2 = svg2.append('g').attr('transform', `translate(${mh.left},${mh.top})`);
    const color = d3.scaleSequential().domain([0, 1]).interpolator(d3.interpolateViridis);

    // column labels (source)
    g2.selectAll('.col-l').data(S.source).enter().append('text')
      .attr('class', 'col-l')
      .attr('x', (d, i) => i * cellW + cellW / 2)
      .attr('y', -4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px').style('fill', 'var(--text-soft)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d);

    // row labels (target)
    g2.selectAll('.row-l').data(S.target).enter().append('text')
      .attr('class', 'row-l')
      .attr('x', -6).attr('y', (d, i) => i * cellH + cellH / 2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '10px').style('fill', (d, i) => i < step ? 'var(--text-soft)' : 'var(--text-muted)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d);

    // cells
    const cells = [];
    for (let i = 0; i < Ntgt; i++) for (let j = 0; j < Nsrc; j++) cells.push({ i, j, v: A[i][j] });
    g2.selectAll('.hcell').data(cells).enter().append('rect')
      .attr('class', 'hcell')
      .attr('x', d => d.j * cellW)
      .attr('y', d => d.i * cellH)
      .attr('width', cellW - 0.6).attr('height', cellH - 0.6)
      .attr('rx', 1)
      .attr('fill', d => d.i < step ? color(d.v) : 'var(--bg-frame-2)')
      .attr('opacity', d => d.i < step ? 1 : 0.4)
      .on('mouseover', function (e, d) {
        if (d.i >= step) return;
        tip.style.opacity = 1;
        tip.innerHTML = `α[${S.target[d.i]} → ${S.source[d.j]}] = <b>${d.v.toFixed(2)}</b>`;
        d3.select(this).attr('stroke', 'var(--accent)').attr('stroke-width', 1.4);
      })
      .on('mousemove', (e) => {
        tip.style.left = (e.pageX + 12) + 'px';
        tip.style.top = (e.pageY + 12) + 'px';
      })
      .on('mouseout', function () {
        tip.style.opacity = 0;
        d3.select(this).attr('stroke', null);
      });

    // highlight current row
    if (curT >= 0 && curT < Ntgt) {
      g2.append('rect')
        .attr('x', -2).attr('y', curT * cellH - 1)
        .attr('width', Nsrc * cellW + 2).attr('height', cellH + 1)
        .attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 1.4)
        .attr('opacity', 0).transition().duration(350).attr('opacity', 0.85);
    }

    // ─── caption ─────────────────────────────────────────────────────
    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:10px;font-size:12px;color:var(--text-muted);line-height:1.5;'
      + 'padding:8px 12px;background:var(--bg-frame);border-left:3px solid var(--accent-3);border-radius:0 4px 4px 0';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // ─── wire handlers ───────────────────────────────────────────────
    bNext.addEventListener('click', () => {
      clearTimer(); auto = false;
      step = Math.min(step + 1, Ntgt);
      cleanupTip(); render();
    });
    bReset.addEventListener('click', () => {
      clearTimer(); auto = false; step = 0;
      cleanupTip(); render();
    });
    bAuto.addEventListener('click', () => {
      auto = !auto;
      if (auto) startAuto();
      else clearTimer();
      cleanupTip(); render();
    });

    function cleanupTip() {
      const ev = new Event('viz-cleanup');
      root.dispatchEvent(ev);
    }
  }

  function startAuto() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const N = STR[lang].target.length;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function tick() {
      step = step + 1;
      if (step > N) { step = 0; }
      render();
      if (auto) timer = setTimeout(tick, 1200);
    }, 900);
  }

  function init() {
    window.addEventListener('langchange', () => { step = 0; auto = false; if (timer) clearTimeout(timer); render(); });
    window.addEventListener('resize', () => render());
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

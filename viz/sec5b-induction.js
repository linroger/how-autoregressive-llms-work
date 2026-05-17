/* §5b — Induction heads (mechanistic interpretability)
 * Two-layer circuit on the sequence "A B C D E F A B ?":
 *   Layer 1: previous-token head — each position attends to position-1
 *   Layer 2: induction head — current "B" attends to the token *after* the
 *            previous "B" via K-composition with the layer-1 output.
 * Prediction at the trailing position: "C" with high confidence.
 * Identified by Anthropic (Elhage et al. 2021, "A Mathematical Framework
 * for Transformer Circuits") as a foundational ICL building block.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Induction head: 2-layer circuit',
      seq: ['A', 'B', 'C', 'D', 'E', 'F', 'A', 'B', '?'],
      layer1: 'Layer 1 — previous-token head',
      layer1Desc: 'each position attends to position − 1',
      layer2: 'Layer 2 — induction head',
      layer2Desc: 'current "B" attends to the token after the *previous* "B"',
      prediction: 'Prediction',
      conf: 'confidence',
      step: 'Step',
      stepBtns: ['1. Show sequence', '2. Layer 1', '3. Layer 2', '4. Predict'],
      hint: 'This 2-layer circuit was identified by Anthropic (Elhage et al. 2021) as a foundational building block for in-context learning. The model literally implements "if I saw AB→C earlier, and I see AB now, output C."',
    },
    zh: {
      title: '归纳头:两层电路',
      seq: ['A', 'B', 'C', 'D', 'E', 'F', 'A', 'B', '?'],
      layer1: '第 1 层 — 前 token 头',
      layer1Desc: '每个位置关注 位置 − 1',
      layer2: '第 2 层 — 归纳头',
      layer2Desc: '当前 "B" 关注*上一个* "B" 之后的 token',
      prediction: '预测',
      conf: '置信度',
      step: '步骤',
      stepBtns: ['1. 显示序列', '2. 第 1 层', '3. 第 2 层', '4. 预测'],
      hint: '该两层电路由 Anthropic (Elhage et al. 2021) 提出,是上下文学习的基础构件。模型实际上执行:"若先前见过 AB→C,而当前出现 AB,则输出 C"。',
    },
  };

  // Step: 0 = sequence only, 1 = +L1 arrows, 2 = +L2 induction arrow, 3 = +prediction
  let step = 0;
  let tipEl = null;
  const N = 9;
  const TARGET_IDX = 8; // the "?" position
  const CURRENT_B_IDX = 7;
  const PREV_B_IDX = 1;
  const ANSWER_IDX = 2; // "C"

  function render() {
    const root = document.getElementById('viz5b-induction');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // --- Step controls ---
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px';
    S.stepBtns.forEach((txt, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === step ? ' active' : '');
      b.textContent = txt;
      b.style.cssText = 'font-size:11px;padding:4px 10px';
      b.addEventListener('click', () => { step = i; render(); });
      ctrls.appendChild(b);
    });
    root.appendChild(ctrls);

    // --- Tooltip (single instance reused across renders) ---
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);font-family:JetBrains Mono,monospace;font-size:11px;border-radius:4px;opacity:0;transition:opacity 120ms;z-index:50';
      document.body.appendChild(tipEl);
    }
    const tip = tipEl;

    // --- Layout ---
    const W = Math.min(root.clientWidth || 640, 680);
    const H = 300;
    const margin = { top: 30, right: 16, bottom: 30, left: 16 };
    const innerW = W - margin.left - margin.right;
    const tokenSpacing = innerW / N;
    const tokenY1 = 70;  // layer 1 row (tokens)
    const tokenY2 = 200; // layer 2 row (tokens)
    const tokenSize = 36;

    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Section labels
    g.append('text').attr('x', 0).attr('y', tokenY1 - 28)
      .style('font-size', '11px').style('font-weight', '600').style('fill', 'var(--accent-3)')
      .text(S.layer1);
    g.append('text').attr('x', 0).attr('y', tokenY1 - 14)
      .style('font-size', '10px').style('fill', 'var(--text-muted)')
      .text(S.layer1Desc);

    g.append('text').attr('x', 0).attr('y', tokenY2 - 28)
      .style('font-size', '11px').style('font-weight', '600').style('fill', 'var(--accent)')
      .text(S.layer2);
    g.append('text').attr('x', 0).attr('y', tokenY2 - 14)
      .style('font-size', '10px').style('fill', 'var(--text-muted)')
      .text(S.layer2Desc);

    function tokenX(i) { return i * tokenSpacing + tokenSpacing / 2; }

    function drawTokens(yPos, layerName) {
      const grp = g.append('g');
      S.seq.forEach((tok, i) => {
        const isQuestion = tok === '?';
        const isCurrentB = (layerName === 'l2' && i === CURRENT_B_IDX);
        const isPrevB = (layerName === 'l2' && i === PREV_B_IDX && step >= 2);
        const isAnswer = (layerName === 'l2' && i === ANSWER_IDX && step >= 2);
        const tg = grp.append('g').attr('transform', `translate(${tokenX(i) - tokenSize / 2},${yPos - tokenSize / 2})`);
        tg.append('rect')
          .attr('width', tokenSize).attr('height', tokenSize).attr('rx', 6)
          .attr('fill', isQuestion ? 'var(--bg-frame-2)' : 'var(--bg-elevated)')
          .attr('stroke', isCurrentB ? 'var(--accent)' : isPrevB ? 'var(--accent-4)' : isAnswer ? 'var(--accent-2)' : 'var(--text-muted)')
          .attr('stroke-width', isCurrentB || isPrevB || isAnswer ? 2 : 1)
          .attr('opacity', isQuestion && step < 3 ? 0.4 : 1);
        tg.append('text')
          .attr('x', tokenSize / 2).attr('y', tokenSize / 2 + 5)
          .attr('text-anchor', 'middle')
          .style('font-family', "'JetBrains Mono', monospace")
          .style('font-size', '14px').style('font-weight', '600')
          .style('fill', isCurrentB ? 'var(--accent)' : isPrevB ? 'var(--accent-4)' : isAnswer ? 'var(--accent-2)' : 'var(--text)')
          .text(isQuestion && step >= 3 ? 'C' : tok);
        // Position index small label
        grp.append('text')
          .attr('x', tokenX(i)).attr('y', yPos + tokenSize / 2 + 14)
          .attr('text-anchor', 'middle')
          .style('font-size', '9px').style('fill', 'var(--text-muted)')
          .style('font-family', "'JetBrains Mono', monospace")
          .text(i);
      });
    }

    drawTokens(tokenY1, 'l1');
    drawTokens(tokenY2, 'l2');

    // --- Layer 1: previous-token attention arrows (curved) ---
    if (step >= 1) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrL1').attr('viewBox', '0 -5 10 10').attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'var(--accent-3)');
      defs.append('marker')
        .attr('id', 'arrL2').attr('viewBox', '0 -5 10 10').attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', 8).attr('markerHeight', 8).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'var(--accent)');

      for (let i = 1; i < N; i++) {
        const x1 = tokenX(i);
        const x2 = tokenX(i - 1);
        const yArc = tokenY1 - tokenSize / 2 - 4;
        const ctrlY = yArc - 18;
        const cx = (x1 + x2) / 2;
        const pathD = `M${x1},${yArc} Q${cx},${ctrlY} ${x2},${yArc}`;
        g.append('path')
          .attr('d', pathD).attr('fill', 'none')
          .attr('stroke', 'var(--accent-3)').attr('stroke-width', 1.2)
          .attr('opacity', 0).attr('marker-end', 'url(#arrL1)')
          .transition().delay(i * 60).duration(350).attr('opacity', 0.85);
      }
    }

    // --- Layer 2: induction arrow from current B → C (via prev-B) ---
    if (step >= 2) {
      // Bold arrow from current B (idx 7) → C (idx 2)
      const x1 = tokenX(CURRENT_B_IDX);
      const x2 = tokenX(ANSWER_IDX);
      const yArc = tokenY2 - tokenSize / 2 - 4;
      const cx = (x1 + x2) / 2;
      const ctrlY = yArc - 50;
      const pathD = `M${x1},${yArc} Q${cx},${ctrlY} ${x2},${yArc}`;
      g.append('path')
        .attr('d', pathD).attr('fill', 'none')
        .attr('stroke', 'var(--accent)').attr('stroke-width', 2.5)
        .attr('opacity', 0).attr('marker-end', 'url(#arrL2)')
        .transition().duration(600).attr('opacity', 1);

      // Faint guide: current B "looked at" prev-B via L1 K-composition
      const x3 = tokenX(PREV_B_IDX);
      g.append('line')
        .attr('x1', x1).attr('y1', tokenY2 - tokenSize / 2)
        .attr('x2', x3).attr('y2', tokenY2 - tokenSize / 2)
        .attr('stroke', 'var(--accent-4)').attr('stroke-width', 1)
        .attr('stroke-dasharray', '3 3').attr('opacity', 0)
        .transition().delay(200).duration(400).attr('opacity', 0.6);

      // Tiny label for K-composition
      g.append('text').attr('x', (x1 + x3) / 2).attr('y', tokenY2 + tokenSize / 2 + 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '9px').style('fill', 'var(--accent-4)')
        .style('font-family', "'JetBrains Mono', monospace")
        .text(lang === 'zh' ? 'K 组合' : 'K-composition')
        .style('opacity', 0).transition().delay(400).duration(400).style('opacity', 1);
    }

    // --- Prediction box below ---
    if (step >= 3) {
      const predDiv = document.createElement('div');
      predDiv.style.cssText = 'margin-top:10px;padding:10px 14px;background:var(--bg-elevated);border-left:3px solid var(--accent-2);border-radius:4px;font-family:JetBrains Mono,monospace;font-size:13px;color:var(--text);display:flex;justify-content:space-between;align-items:center';
      predDiv.innerHTML = `
        <span>${S.prediction}: <strong style="color:var(--accent-2);font-size:16px">"C"</strong></span>
        <span style="color:var(--text-muted);font-size:11px">${S.conf}: <strong style="color:var(--accent-2)">0.94</strong></span>
      `;
      root.appendChild(predDiv);
    }

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:10px;line-height:1.5';
    hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
    // Auto-advance through the steps once on load
    let s = 0;
    const advTimer = setInterval(() => {
      s += 1;
      if (s > 3) { clearInterval(advTimer); return; }
      step = s; render();
    }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

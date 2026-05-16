/* §7 — Cross-entropy pretraining
 * Animated loss curve descending vs training steps.
 * Alongside, a probability bar chart for a sample prompt where probability
 * mass concentrates on the correct next token as training advances.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      prompt: 'The capital of France is ___',
      candidates: ['Paris','Lyon','Berlin','Rome','Madrid','London','...'],
      correctIdx: 0,
      step: 'training step',
      loss: 'cross-entropy loss',
      play: 'play',
      reset: 'reset',
      hint: 'As training progresses, the model concentrates probability on the correct token; loss falls.',
    },
    zh: {
      prompt: '法国的首都是 ___',
      candidates: ['巴黎','里昂','柏林','罗马','马德里','伦敦','...'],
      correctIdx: 0,
      step: '训练步数',
      loss: '交叉熵损失',
      play: '播放',
      reset: '重置',
      hint: '随着训练推进,模型把概率集中到正确 token,损失下降。',
    },
  };

  const TOTAL_STEPS = 100;
  let curStep = 0;
  let playing = false;
  let timer = null;

  // Simulated loss curve: 7 → 1.5 with noise; power-law-ish decay
  function lossAt(s) {
    const t = s / TOTAL_STEPS;
    const base = 1.5 + 5.5 * Math.exp(-3.5 * t);
    const rng = DLM.makeRNG(s + 17);
    return base + (rng() - 0.5) * 0.18;
  }

  // Simulated probabilities at step s for the candidates list
  function probsAt(s, n, correctIdx) {
    // logits start near uniform; correctIdx logit grows with training
    const t = s / TOTAL_STEPS;
    const correctLogit = -0.5 + 6.0 * t;
    const logits = [];
    const rng = DLM.makeRNG(99 + s);
    for (let i = 0; i < n; i++) {
      if (i === correctIdx) logits.push(correctLogit);
      else logits.push((rng() - 0.5) * (1.5 - 1.2 * t));
    }
    const m = Math.max(...logits);
    const e = logits.map(v => Math.exp(v - m));
    const sum = e.reduce((a,b)=>a+b,0);
    return e.map(v => v/sum);
  }

  function render() {
    const root = document.getElementById('viz2-1');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // Controls
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '10px';
    ctrls.style.display = 'flex'; ctrls.style.gap = '8px'; ctrls.style.alignItems = 'center';
    const bPlay = document.createElement('button'); bPlay.className = 'btn'; bPlay.textContent = S.play;
    const bReset = document.createElement('button'); bReset.className = 'btn'; bReset.textContent = S.reset;
    const readout = document.createElement('span');
    readout.style.fontFamily = "'JetBrains Mono', monospace"; readout.style.color = 'var(--text-soft)'; readout.style.fontSize = '12px';
    bPlay.addEventListener('click', play);
    bReset.addEventListener('click', reset);
    ctrls.appendChild(bPlay); ctrls.appendChild(bReset); ctrls.appendChild(readout);
    root.appendChild(ctrls);

    // Prompt
    const promptDiv = document.createElement('div');
    promptDiv.style.fontFamily = "'JetBrains Mono', monospace"; promptDiv.style.color='var(--text-soft)';
    promptDiv.style.marginBottom = '10px'; promptDiv.style.fontSize='13px';
    promptDiv.textContent = S.prompt;
    root.appendChild(promptDiv);

    // Two-panel layout
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'minmax(0, 1.3fr) minmax(0, 1fr)';
    grid.style.gap = '14px';
    root.appendChild(grid);

    const lossPane = document.createElement('div'); grid.appendChild(lossPane);
    const barPane = document.createElement('div'); grid.appendChild(barPane);

    // Loss curve
    const W = Math.max(280, (root.clientWidth || 600) * 0.6);
    const H = 220;
    const margin = { top: 10, right: 14, bottom: 30, left: 40 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const svgL = d3.select(lossPane).append('svg').attr('width', W).attr('height', H);
    const gL = svgL.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, TOTAL_STEPS]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 8]).range([innerH, 0]);
    const allPts = d3.range(TOTAL_STEPS + 1).map(s => ({s, l: lossAt(s)}));

    gL.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(-innerH)).selectAll('line').attr('stroke','var(--bg-frame-2)');
    gL.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW)).selectAll('line').attr('stroke','var(--bg-frame-2)');
    gL.selectAll('.domain').remove();
    gL.selectAll('text').style('fill','var(--text-muted)').style('font-size','10px');

    const line = d3.line().x(d => xScale(d.s)).y(d => yScale(d.l)).curve(d3.curveMonotoneX);
    const path = gL.append('path').datum(allPts).attr('fill','none').attr('stroke','var(--accent)').attr('stroke-width',1.8).attr('d', line);
    // Animate path with stroke-dasharray
    const len = path.node().getTotalLength();
    path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len);

    const cursor = gL.append('circle').attr('r', 4).attr('fill','var(--accent-3)').attr('opacity',0);

    svgL.append('text').attr('x', margin.left + innerW/2).attr('y', H - 6)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.step);
    svgL.append('text').attr('x', 12).attr('y', margin.top + innerH/2)
      .attr('transform', `rotate(-90, 12, ${margin.top + innerH/2})`)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.loss);

    // Bar chart
    const W2 = Math.max(240, (root.clientWidth || 600) * 0.36);
    const H2 = 220;
    const m2 = { top: 10, right: 12, bottom: 18, left: 60 };
    const iW2 = W2 - m2.left - m2.right, iH2 = H2 - m2.top - m2.bottom;
    const svgB = d3.select(barPane).append('svg').attr('width', W2).attr('height', H2);
    const gB = svgB.append('g').attr('transform', `translate(${m2.left},${m2.top})`);
    const y = d3.scaleBand().domain(d3.range(S.candidates.length)).range([0, iH2]).padding(0.16);
    const x = d3.scaleLinear().domain([0,1]).range([0, iW2]);
    gB.selectAll('.lbl').data(S.candidates).enter().append('text')
      .attr('x', -8).attr('y', (d,i) => y(i) + y.bandwidth()/2 + 4)
      .attr('text-anchor','end').style('font-size','11px').style('font-family',"'JetBrains Mono', monospace")
      .style('fill', (d,i) => i === S.correctIdx ? 'var(--accent-4)' : 'var(--text-soft)')
      .text(d => d);
    const bars = gB.selectAll('.bar').data(probsAt(0, S.candidates.length, S.correctIdx)).enter().append('rect')
      .attr('y', (d,i) => y(i)).attr('height', y.bandwidth())
      .attr('fill', (d,i) => i === S.correctIdx ? 'var(--accent-4)' : 'var(--accent-2)')
      .attr('width', d => x(d));

    function updateBars(s) {
      const p = probsAt(s, S.candidates.length, S.correctIdx);
      bars.data(p).transition().duration(180).attr('width', d => x(d));
    }

    function updateCursor(s) {
      cursor.attr('opacity', 1).attr('cx', xScale(s)).attr('cy', yScale(lossAt(s)));
      readout.textContent = `${S.step} ${s} · loss = ${lossAt(s).toFixed(2)}`;
    }
    updateBars(curStep);
    updateCursor(curStep);

    function play() {
      if (playing) return;
      playing = true;
      curStep = 0;
      path.attr('stroke-dashoffset', len);
      path.transition().duration(4000).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

      const t0 = Date.now();
      function tick() {
        const elapsed = Date.now() - t0;
        const s = Math.min(TOTAL_STEPS, Math.round((elapsed / 4000) * TOTAL_STEPS));
        curStep = s;
        updateCursor(s); updateBars(s);
        if (s >= TOTAL_STEPS) { playing = false; return; }
        timer = setTimeout(tick, 60);
      }
      tick();
    }

    function reset() {
      if (timer) clearTimeout(timer);
      playing = false; curStep = 0;
      path.attr('stroke-dashoffset', len);
      updateCursor(0); updateBars(0);
    }

    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '8px';
    hint.textContent = S.hint;
    root.appendChild(hint);

    // expose for reset later
    render._play = play; render._reset = reset;
  }

  function init() {
    window.addEventListener('langchange', () => render());
    window.addEventListener('resize', () => render());
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

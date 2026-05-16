/* Hero — animated next-token prediction
 * Step 0: show prompt "The cat sat on the ___"
 * Step 1: model produces logits → top-10 bar chart
 * Step 2: softmax normalizes to probabilities
 * Step 3: sample and commit a token
 */
(function () {
  'use strict';

  const STR = {
    en: {
      prompt: ['The', 'cat', 'sat', 'on', 'the'],
      candidates: ['mat', 'floor', 'sofa', 'table', 'bed', 'chair', 'rug', 'roof', 'porch', 'lap'],
      step: 'step',
      logits: 'raw logits',
      probs: 'softmax probabilities',
      sampled: 'sampled token',
    },
    zh: {
      prompt: ['那只', '猫', '坐', '在', ''],
      candidates: ['垫子', '地板', '沙发', '桌子', '床', '椅子', '地毯', '屋顶', '门廊', '腿上'],
      step: '步骤',
      logits: '原始 logit',
      probs: 'softmax 概率',
      sampled: '采样得到',
    },
  };

  // Deterministic logits so the chart is reproducible
  const RAW_LOGITS = [4.2, 3.5, 2.9, 2.2, 1.8, 1.4, 1.1, 0.6, 0.2, -0.3];
  let currentStep = 0;
  let playing = false;
  let timer = null;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }
  function softmax(xs, T) { const m = Math.max(...xs); const e = xs.map(v => Math.exp((v - m) / T)); const s = e.reduce((a,b)=>a+b,0); return e.map(v => v/s); }

  function render(step) {
    const root = document.getElementById('hero-demo');
    if (!root) return;
    const lang = getLang();
    const S = STR[lang];
    root.innerHTML = '';

    // --- Prompt strip ---
    const promptDiv = document.createElement('div');
    promptDiv.style.marginBottom = '10px';
    promptDiv.style.display = 'flex';
    promptDiv.style.flexWrap = 'wrap';
    promptDiv.style.gap = '6px';
    promptDiv.style.alignItems = 'center';
    S.prompt.forEach(t => {
      if (!t) return;
      const sp = document.createElement('span');
      sp.className = 'token committed';
      sp.textContent = t;
      promptDiv.appendChild(sp);
    });
    const blank = document.createElement('span');
    blank.className = 'token mask';
    if (step >= 3) {
      // committed sampled token
      blank.className = 'token commit';
      blank.textContent = S.candidates[sampledIdx];
    } else {
      blank.textContent = '___';
    }
    promptDiv.appendChild(blank);
    root.appendChild(promptDiv);

    // --- D3 bar chart ---
    const W = root.clientWidth || 640;
    const H = 260;
    const margin = { top: 24, right: 14, bottom: 18, left: 70 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(root).append('svg')
      .attr('width', W).attr('height', H)
      .style('overflow', 'visible');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Title
    let titleTxt;
    if (step <= 1) titleTxt = S.logits;
    else titleTxt = S.probs;
    svg.append('text').attr('x', margin.left).attr('y', 14)
      .style('font-size', '12px').style('fill', 'var(--text-soft)')
      .text(titleTxt);

    // Data depending on step
    const showProbs = step >= 2;
    const values = showProbs ? softmax(RAW_LOGITS, 1.0) : RAW_LOGITS;
    const maxV = showProbs ? Math.max(...values) : Math.max(...RAW_LOGITS);
    const minV = showProbs ? 0 : Math.min(...RAW_LOGITS);

    const y = d3.scaleBand().domain(d3.range(10)).range([0, innerH]).padding(0.18);
    const x = d3.scaleLinear().domain([Math.min(0, minV), maxV]).range([0, innerW]);

    // Labels
    g.selectAll('.lbl').data(S.candidates).enter().append('text')
      .attr('class', 'lbl')
      .attr('x', -8).attr('y', (d,i) => y(i) + y.bandwidth()/2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('fill', (d,i) => i === sampledIdx && step >= 3 ? 'var(--accent)' : 'var(--text-soft)')
      .text(d => d);

    // Bars
    const bars = g.selectAll('.bar').data(values).enter().append('rect')
      .attr('class', 'bar')
      .attr('y', (d,i) => y(i))
      .attr('height', y.bandwidth())
      .attr('x', d => x(Math.min(0, d)))
      .attr('width', 0)
      .attr('fill', (d,i) => (i === sampledIdx && step >= 3) ? 'var(--accent)' : 'var(--accent-2)')
      .attr('opacity', (d,i) => (step >= 3 && i !== sampledIdx) ? 0.35 : 0.9);

    bars.transition().duration(700).ease(d3.easeCubicOut)
      .attr('width', d => Math.abs(x(d) - x(Math.min(0, d))));

    // Value labels at end of bars
    g.selectAll('.val').data(values).enter().append('text')
      .attr('class', 'val')
      .attr('y', (d,i) => y(i) + y.bandwidth()/2 + 4)
      .attr('x', d => x(d) + 6)
      .style('font-size', '10px').style('fill', 'var(--text-muted)')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('opacity', 0)
      .text(d => showProbs ? d.toFixed(3) : d.toFixed(1))
      .transition().delay(400).duration(400).style('opacity', 1);

    // baseline
    g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 0.5);

    // readout
    const readout = document.getElementById('heroStep');
    if (readout) readout.textContent = `${S.step} ${step} / 3`;
  }

  // Pick the sampled token (deterministic): index 0 (mat) most likely
  let sampledIdx = 0;
  function pickSample() {
    const probs = softmax(RAW_LOGITS, 1.0);
    const rng = DLM.makeRNG(7);
    const r = rng();
    let acc = 0;
    for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r < acc) { sampledIdx = i; return; } }
    sampledIdx = 0;
  }

  function play() {
    if (playing) return;
    playing = true;
    currentStep = 0;
    pickSample();
    render(0);
    const adv = () => {
      currentStep++;
      if (currentStep > 3) { playing = false; return; }
      render(currentStep);
      timer = setTimeout(adv, 950);
    };
    timer = setTimeout(adv, 700);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    playing = false;
    currentStep = 0;
    pickSample();
    render(0);
  }

  function init() {
    pickSample();
    document.getElementById('heroPlay')?.addEventListener('click', play);
    document.getElementById('heroReset')?.addEventListener('click', reset);
    window.addEventListener('langchange', () => render(currentStep));
    window.addEventListener('resize', () => render(currentStep));
    render(0);
    setTimeout(play, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

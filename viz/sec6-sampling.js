/* §6 — Sampling: temperature and top-p (nucleus)
 * Bar chart of softmax(logits / T) over 10 candidate tokens.
 * Sliders for T (0.1 — 2.0) and top-p (0.1 — 1.0).
 * "Sample" button highlights a drawn token (with replacement-style weighted draw).
 */
(function () {
  'use strict';

  const STR = {
    en: {
      tokens: ['mat','floor','sofa','table','bed','chair','rug','roof','porch','lap'],
      temp: 'temperature T', topp: 'top-p',
      sample: 'sample',
      hint: 'lower T → peakier. Smaller top-p → fewer eligible tokens.',
      cut: 'cut',
    },
    zh: {
      tokens: ['垫子','地板','沙发','桌子','床','椅子','地毯','屋顶','门廊','腿上'],
      temp: '温度 T', topp: 'top-p',
      sample: '采样',
      hint: 'T 越小分布越尖。top-p 越小可采的 token 越少。',
      cut: '截断',
    },
  };

  const LOGITS = [4.2, 3.5, 2.9, 2.2, 1.8, 1.4, 1.1, 0.6, 0.2, -0.3];
  let T = 1.0;
  let topP = 0.9;
  let sampledIdx = -1;

  function compute() {
    const scaled = LOGITS.map(v => v / T);
    const m = Math.max(...scaled);
    const e = scaled.map(v => Math.exp(v - m));
    const s = e.reduce((a,b)=>a+b,0);
    const probs = e.map(v => v/s);
    // top-p mask
    const sorted = probs.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p);
    let acc = 0; const keep = new Set();
    for (const {p,i} of sorted) { keep.add(i); acc += p; if (acc >= topP) break; }
    return { probs, keep };
  }

  function render() {
    const root = document.getElementById('viz1-6');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // Controls
    const ctrls = document.createElement('div');
    ctrls.style.display = 'flex';
    ctrls.style.flexWrap = 'wrap';
    ctrls.style.gap = '14px';
    ctrls.style.alignItems = 'center';
    ctrls.style.marginBottom = '10px';

    function makeSlider(labelText, min, max, step, value, fmt, onInput) {
      const wrap = document.createElement('label');
      wrap.style.fontSize = '12px'; wrap.style.color = 'var(--text-soft)';
      wrap.style.display = 'inline-flex'; wrap.style.alignItems = 'center'; wrap.style.gap = '6px';
      const l = document.createElement('span'); l.textContent = labelText + ':';
      const s = document.createElement('input');
      s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
      const v = document.createElement('span'); v.style.fontFamily = "'JetBrains Mono', monospace"; v.style.color = 'var(--accent)';
      v.textContent = fmt(value);
      s.addEventListener('input', () => { const val = +s.value; v.textContent = fmt(val); onInput(val); });
      wrap.appendChild(l); wrap.appendChild(s); wrap.appendChild(v);
      return wrap;
    }

    ctrls.appendChild(makeSlider(S.temp, 0.1, 2.0, 0.05, T, v => v.toFixed(2), v => { T = v; redraw(); }));
    ctrls.appendChild(makeSlider(S.topp, 0.1, 1.0, 0.05, topP, v => v.toFixed(2), v => { topP = v; redraw(); }));
    const sampleBtn = document.createElement('button'); sampleBtn.className = 'btn'; sampleBtn.textContent = S.sample;
    sampleBtn.addEventListener('click', () => { doSample(); });
    ctrls.appendChild(sampleBtn);
    root.appendChild(ctrls);

    const chart = document.createElement('div');
    root.appendChild(chart);

    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '8px';
    hint.textContent = S.hint;
    root.appendChild(hint);

    function redraw() {
      d3.select(chart).selectAll('*').remove();
      const { probs, keep } = compute();
      const W = Math.min(chart.clientWidth || root.clientWidth || 600, 600);
      const H = 260;
      const margin = { top: 10, right: 14, bottom: 18, left: 70 };
      const innerW = W - margin.left - margin.right;
      const innerH = H - margin.top - margin.bottom;
      const svg = d3.select(chart).append('svg').attr('width', W).attr('height', H);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const y = d3.scaleBand().domain(d3.range(10)).range([0, innerH]).padding(0.18);
      const x = d3.scaleLinear().domain([0, Math.max(...probs)]).range([0, innerW]);

      g.selectAll('.lbl').data(S.tokens).enter().append('text')
        .attr('x', -8).attr('y', (d,i) => y(i) + y.bandwidth()/2 + 4)
        .attr('text-anchor', 'end').style('font-size','11px')
        .style('font-family',"'JetBrains Mono', monospace")
        .style('fill', (d,i) => i === sampledIdx ? 'var(--accent)' : (keep.has(i) ? 'var(--text-soft)' : 'var(--text-muted)'))
        .text(d => d);

      g.selectAll('.bar').data(probs).enter().append('rect')
        .attr('y', (d,i) => y(i)).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', 0)
        .attr('fill', (d,i) => i === sampledIdx ? 'var(--accent)' : (keep.has(i) ? 'var(--accent-2)' : 'var(--mask)'))
        .attr('opacity', (d,i) => keep.has(i) || i === sampledIdx ? 0.95 : 0.35)
        .transition().duration(350).ease(d3.easeCubicOut).attr('width', d => x(d));

      g.selectAll('.v').data(probs).enter().append('text')
        .attr('y', (d,i) => y(i) + y.bandwidth()/2 + 4)
        .attr('x', d => x(d) + 6)
        .style('font-size','10px').style('font-family',"'JetBrains Mono', monospace")
        .style('fill','var(--text-muted)')
        .text(d => d.toFixed(3));

      // top-p threshold line
      svg.append('text').attr('x', W - 14).attr('y', 22)
        .attr('text-anchor', 'end').style('font-size','10px').style('fill','var(--text-muted)')
        .text(`p ≥ ${topP.toFixed(2)} keeps ${keep.size}/10  ·  T = ${T.toFixed(2)}`);
    }

    function doSample() {
      const { probs, keep } = compute();
      // re-normalize over keep set
      const eligible = probs.map((p,i) => keep.has(i) ? p : 0);
      const s = eligible.reduce((a,b)=>a+b,0);
      const rng = DLM.makeRNG(Date.now() & 0xffff);
      const r = rng();
      let acc = 0; sampledIdx = -1;
      for (let i = 0; i < eligible.length; i++) { acc += eligible[i] / s; if (r < acc) { sampledIdx = i; break; } }
      redraw();
    }

    redraw();
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

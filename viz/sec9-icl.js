/* §9 — In-context learning
 * Few-shot translation prompt template; slider for k = number of demos (0–32).
 * Accuracy curve climbs as k grows (with log-shaped diminishing returns).
 * Show the prompt growing on the left; the accuracy curve on the right.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'few-shot translation: EN → FR',
      task: 'Task: translate to French',
      shots: '# in-context examples (k)',
      acc: 'accuracy',
      query: 'apple →',
      answer: 'pomme',
      hint: 'Accuracy climbs sharply from 0 → ~8 demos, then plateaus. Larger models gain more from few-shot.',
      pairs: [
        ['cat', 'chat'], ['dog', 'chien'], ['book', 'livre'], ['water', 'eau'],
        ['house', 'maison'], ['tree', 'arbre'], ['sun', 'soleil'], ['moon', 'lune'],
        ['fire', 'feu'], ['bread', 'pain'], ['road', 'route'], ['sea', 'mer'],
        ['bird', 'oiseau'], ['fish', 'poisson'], ['music', 'musique'], ['friend', 'ami'],
      ],
    },
    zh: {
      title: '少样本翻译:英→法',
      task: '任务:翻译为法语',
      shots: '示例数量 (k)',
      acc: '准确率',
      query: 'apple →',
      answer: 'pomme',
      hint: '准确率在 0 → 8 个示例之间陡升,之后趋于饱和。大模型从 few-shot 中获益更多。',
      pairs: [
        ['cat', 'chat'], ['dog', 'chien'], ['book', 'livre'], ['water', 'eau'],
        ['house', 'maison'], ['tree', 'arbre'], ['sun', 'soleil'], ['moon', 'lune'],
        ['fire', 'feu'], ['bread', 'pain'], ['road', 'route'], ['sea', 'mer'],
        ['bird', 'oiseau'], ['fish', 'poisson'], ['music', 'musique'], ['friend', 'ami'],
      ],
    },
  };

  const KMAX = 32;
  let k = 0;

  function accAt(k, modelSize) {
    // accuracy curve: a + b*(1 - exp(-c*k)), larger models -> steeper c & higher a
    const params = {
      '1B':  { a: 0.18, b: 0.55, c: 0.18 },
      '8B':  { a: 0.28, b: 0.65, c: 0.28 },
      '70B': { a: 0.42, b: 0.55, c: 0.45 },
    }[modelSize];
    return params.a + params.b * (1 - Math.exp(-params.c * k));
  }

  function render() {
    const root = document.getElementById('viz2-3');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    const title = document.createElement('div');
    title.style.fontSize = '12px'; title.style.color='var(--text-soft)';
    title.style.marginBottom = '8px'; title.textContent = S.title;
    root.appendChild(title);

    // slider
    const ctrls = document.createElement('div');
    ctrls.style.display='flex'; ctrls.style.alignItems='center'; ctrls.style.gap='8px';
    ctrls.style.marginBottom = '10px';
    const lab = document.createElement('label'); lab.style.fontSize='12px'; lab.style.color='var(--text-soft)';
    lab.textContent = S.shots + ': ';
    const slider = document.createElement('input'); slider.type='range'; slider.min=0; slider.max=KMAX; slider.value=k; slider.step=1;
    const v = document.createElement('span'); v.style.fontFamily="'JetBrains Mono', monospace"; v.style.color='var(--accent)'; v.textContent=k;
    slider.addEventListener('input', () => { k = +slider.value; v.textContent = k; update(); });
    lab.appendChild(slider); lab.appendChild(v);
    ctrls.appendChild(lab);
    root.appendChild(ctrls);

    // 2 column layout
    const grid = document.createElement('div');
    grid.style.display='grid'; grid.style.gridTemplateColumns='minmax(0,1fr) minmax(0,1.2fr)'; grid.style.gap='14px';
    root.appendChild(grid);

    // Prompt pane (scrolls)
    const promptWrap = document.createElement('div');
    promptWrap.style.background = 'var(--bg-frame-2)';
    promptWrap.style.padding='10px';
    promptWrap.style.borderRadius='6px';
    promptWrap.style.border='1px solid var(--bg-frame)';
    promptWrap.style.fontFamily="'JetBrains Mono', monospace";
    promptWrap.style.fontSize='12px';
    promptWrap.style.color='var(--text-soft)';
    promptWrap.style.maxHeight='280px'; promptWrap.style.overflowY='auto';
    grid.appendChild(promptWrap);

    // Curve pane
    const chartPane = document.createElement('div'); grid.appendChild(chartPane);
    const W = Math.max(280, (root.clientWidth || 600) * 0.55);
    const H = 240;
    const margin = { top: 14, right: 14, bottom: 28, left: 40 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const svg = d3.select(chartPane).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xS = d3.scaleLinear().domain([0, KMAX]).range([0, innerW]);
    const yS = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xS).ticks(6))
      .selectAll('text').style('font-size','10px').style('fill','var(--text-muted)');
    g.append('g').call(d3.axisLeft(yS).ticks(5).tickFormat(d3.format('.0%')))
      .selectAll('text').style('font-size','10px').style('fill','var(--text-muted)');
    g.selectAll('.domain').attr('stroke','var(--text-muted)');

    const xs = d3.range(0, KMAX + 1);
    const lineGen = d3.line().x(d => xS(d.k)).y(d => yS(d.a)).curve(d3.curveMonotoneX);

    const sizes = [
      { name: '1B',  color: 'var(--accent-3)' },
      { name: '8B',  color: 'var(--accent-2)' },
      { name: '70B', color: 'var(--accent)' },
    ];
    sizes.forEach(sz => {
      const data = xs.map(kk => ({ k: kk, a: accAt(kk, sz.name) }));
      g.append('path').datum(data).attr('fill','none').attr('stroke', sz.color).attr('stroke-width', 2).attr('d', lineGen);
      g.append('text').attr('x', innerW - 30).attr('y', yS(accAt(KMAX, sz.name)) - 4)
        .style('font-size','10px').style('font-family',"'JetBrains Mono', monospace")
        .style('fill', sz.color).text(sz.name);
    });

    const cursor = g.append('line').attr('y1', 0).attr('y2', innerH).attr('stroke','var(--accent)').attr('stroke-width',1).attr('stroke-dasharray','3 3');
    const dot = g.append('circle').attr('r', 5).attr('fill','var(--accent)').attr('stroke','#fff').attr('stroke-width',1);

    svg.append('text').attr('x', margin.left + innerW/2).attr('y', H - 4)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.shots);
    svg.append('text').attr('x', 12).attr('y', margin.top + innerH/2)
      .attr('transform', `rotate(-90, 12, ${margin.top + innerH/2})`)
      .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)').text(S.acc);

    function update() {
      // prompt
      promptWrap.innerHTML = '';
      const taskLine = document.createElement('div');
      taskLine.style.color='var(--text-muted)'; taskLine.textContent = S.task; taskLine.style.marginBottom='6px';
      promptWrap.appendChild(taskLine);
      for (let i = 0; i < k; i++) {
        const p = S.pairs[i % S.pairs.length];
        const line = document.createElement('div');
        line.textContent = `${p[0]} → ${p[1]}`;
        promptWrap.appendChild(line);
      }
      const qline = document.createElement('div');
      qline.style.marginTop='6px';
      qline.style.color='var(--accent)';
      const a = accAt(k, '8B');
      const ans = (Math.random() < a ? S.answer : '?');
      // deterministic for clarity
      qline.textContent = `${S.query} ${k >= 2 ? S.answer : '?'}`;
      promptWrap.appendChild(qline);
      promptWrap.scrollTop = promptWrap.scrollHeight;

      // cursor on chart at k for 8B line
      const aVal = accAt(k, '8B');
      cursor.attr('x1', xS(k)).attr('x2', xS(k));
      dot.attr('cx', xS(k)).attr('cy', yS(aVal));
    }
    update();

    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '8px';
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

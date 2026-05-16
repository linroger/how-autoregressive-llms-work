/* §10 — Chain-of-Thought: direct vs step-by-step answer with pass@1 bars */
(function () {
  'use strict';

  let timers = [];

  function clearTimers() { timers.forEach((t) => clearTimeout(t)); timers = []; }

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        problem: '问题：一辆火车以每小时 60 英里的速度行驶 2.5 小时，然后以每小时 80 英里的速度再行驶 1.5 小时。它总共行驶了多远？',
        direct: ['答案','：','220','英里','。'],
        cot: [
          '让','我','一步','一步','地','解决','。',
          '第一段','：','60','×','2.5','=','150','英里','。',
          '第二段','：','80','×','1.5','=','120','英里','。',
          '总和','：','150','+','120','=','270','英里','。',
          '答案','：','270','英里','。'
        ],
        directLabel: '直接作答',
        cotLabel: '思维链',
        wrong: '错误',
        right: '正确',
        accLabel: 'pass@1 准确率（GSM8K 风格题目）',
        noCot: '无 CoT',
        withCot: '有 CoT',
        play: '▶ 播放两种解码',
        reset: '↺ 重置',
      };
    }
    return {
      problem: 'Problem: A train travels at 60 mph for 2.5 hours, then at 80 mph for another 1.5 hours. How far did it travel in total?',
      direct: ['Answer',':','220','miles','.'],
      cot: [
        'Let','me','solve','this','step','by','step','.',
        'Leg','1',':','60','×','2.5','=','150','miles','.',
        'Leg','2',':','80','×','1.5','=','120','miles','.',
        'Total',':','150','+','120','=','270','miles','.',
        'Answer',':','270','miles','.'
      ],
      directLabel: 'Direct answer',
      cotLabel: 'Chain-of-thought',
      wrong: 'wrong',
      right: 'correct',
      accLabel: 'pass@1 accuracy (GSM8K-style problems)',
      noCot: 'no CoT',
      withCot: 'with CoT',
      play: '▶ Play both',
      reset: '↺ Reset',
    };
  }

  function buildPanel(parent, label, verdictClass, verdictText) {
    const wrap = document.createElement('div');
    wrap.style.background = 'var(--bg-frame-2)';
    wrap.style.border = '1px solid var(--border-strong)';
    wrap.style.borderRadius = '6px';
    wrap.style.padding = '14px';
    wrap.style.minHeight = '160px';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '10px';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.fontFamily = 'JetBrains Mono, monospace';
    head.style.fontSize = '0.78rem';
    head.style.color = 'var(--text-soft)';
    head.innerHTML = `<span>${label}</span><span class="verdict" style="opacity:0;color:${verdictClass};font-weight:600">${verdictText}</span>`;
    wrap.appendChild(head);

    const strip = document.createElement('div');
    strip.className = 'token-strip';
    strip.style.padding = '0';
    strip.style.flex = '1';
    wrap.appendChild(strip);

    parent.appendChild(wrap);
    return { wrap, head, strip };
  }

  function revealTokens(strip, tokens, delay, perTok, onDone) {
    strip.innerHTML = '';
    tokens.forEach((tok, i) => {
      const el = document.createElement('span');
      el.className = 'token mask';
      el.textContent = DLM.MASK;
      strip.appendChild(el);
      timers.push(setTimeout(() => {
        el.classList.remove('mask');
        el.classList.add('commit');
        el.textContent = tok;
        setTimeout(() => { el.classList.remove('commit'); el.classList.add('committed'); }, 220);
      }, delay + i * perTok));
    });
    if (onDone) timers.push(setTimeout(onDone, delay + tokens.length * perTok + 250));
  }

  function drawBars(svg, L) {
    svg.selectAll('*').remove();
    const node = svg.node();
    if (!node) return;
    const W = node.clientWidth || 520;
    const H = 110;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const margin = { top: 18, right: 24, bottom: 22, left: 90 };
    const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const iw = W - margin.left - margin.right;
    const ih = H - margin.top - margin.bottom;

    const data = [
      { label: L.noCot, val: 0.18, color: 'var(--mask)' },
      { label: L.withCot, val: 0.79, color: 'var(--accent)' },
    ];
    const y = d3.scaleBand().domain(data.map((d) => d.label)).range([0, ih]).padding(0.32);
    const x = d3.scaleLinear().domain([0, 1]).range([0, iw]);

    inner.append('text')
      .attr('x', 0).attr('y', -6)
      .attr('fill', 'var(--text-soft)')
      .style('font-family', 'Inter, sans-serif')
      .style('font-size', '0.74rem')
      .style('letter-spacing', '0.06em')
      .style('text-transform', 'uppercase')
      .text(L.accLabel);

    data.forEach((d) => {
      inner.append('text')
        .attr('x', -8).attr('y', y(d.label) + y.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--text-soft)')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '0.78rem')
        .text(d.label);

      inner.append('rect')
        .attr('x', 0).attr('y', y(d.label))
        .attr('width', 0).attr('height', y.bandwidth())
        .attr('fill', d.color)
        .attr('rx', 3)
        .transition().duration(900).ease(d3.easeCubicOut)
        .attr('width', x(d.val));

      inner.append('text')
        .attr('x', 0).attr('y', y(d.label) + y.bandwidth() / 2 + 4)
        .attr('fill', 'var(--text)')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '0.78rem')
        .attr('opacity', 0)
        .text(`${Math.round(d.val * 100)}%`)
        .transition().delay(700).duration(400)
        .attr('opacity', 1)
        .attr('x', x(d.val) + 6);
    });
  }

  function render() {
    clearTimers();
    const container = document.getElementById('viz2-4');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    const problem = document.createElement('div');
    problem.style.fontFamily = 'Inter, sans-serif';
    problem.style.fontSize = '0.9rem';
    problem.style.color = 'var(--text-soft)';
    problem.style.padding = '10px 14px';
    problem.style.background = 'var(--bg-frame)';
    problem.style.borderLeft = '3px solid var(--accent-3)';
    problem.style.borderRadius = '0 4px 4px 0';
    problem.style.marginBottom = '14px';
    problem.textContent = L.problem;
    container.appendChild(problem);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    grid.style.gap = '14px';
    container.appendChild(grid);

    const direct = buildPanel(grid, L.directLabel, '#ff4d4f', L.wrong);
    const cot = buildPanel(grid, L.cotLabel, 'var(--accent-4)', L.right);

    const svgWrap = document.createElement('div');
    svgWrap.style.marginTop = '18px';
    svgWrap.style.background = 'var(--bg-frame-2)';
    svgWrap.style.border = '1px solid var(--border-strong)';
    svgWrap.style.borderRadius = '6px';
    svgWrap.style.padding = '8px 10px';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.display = 'block';
    svgWrap.appendChild(svg);
    container.appendChild(svgWrap);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '14px';
    actions.innerHTML = `<button class="btn" id="cot-play">${L.play}</button><button class="btn btn-ghost" id="cot-reset">${L.reset}</button>`;
    container.appendChild(actions);

    function play() {
      clearTimers();
      direct.head.querySelector('.verdict').style.opacity = 0;
      cot.head.querySelector('.verdict').style.opacity = 0;
      direct.strip.innerHTML = '';
      cot.strip.innerHTML = '';

      revealTokens(direct.strip, L.direct, 200, 220, () => {
        direct.head.querySelector('.verdict').style.transition = 'opacity 400ms';
        direct.head.querySelector('.verdict').style.opacity = 1;
      });
      revealTokens(cot.strip, L.cot, 400, 130, () => {
        cot.head.querySelector('.verdict').style.transition = 'opacity 400ms';
        cot.head.querySelector('.verdict').style.opacity = 1;
        drawBars(d3.select(svg), L);
      });
    }
    function reset() {
      clearTimers();
      direct.strip.innerHTML = '';
      cot.strip.innerHTML = '';
      direct.head.querySelector('.verdict').style.opacity = 0;
      cot.head.querySelector('.verdict').style.opacity = 0;
      d3.select(svg).selectAll('*').remove();
    }
    document.getElementById('cot-play').addEventListener('click', play);
    document.getElementById('cot-reset').addEventListener('click', reset);

    // Auto-play once
    timers.push(setTimeout(play, 250));
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => {
      const svg = document.querySelector('#viz2-4 svg');
      if (svg) drawBars(d3.select(svg), t());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

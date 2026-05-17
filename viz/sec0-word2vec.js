/* §0 — Word2vec embedding arithmetic
 * 2D projection of word embeddings: gender × royalty, country × capital, tense pairs.
 * Animate the canonical vector arithmetic: king − man + woman ≈ queen.
 * Three preset examples switch the active analogy and replay the animation.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: '2-D projection of learned word embeddings',
      ex1: 'king − man + woman',
      ex2: 'paris − france + italy',
      ex3: 'walking − walk + swim',
      step1: 'start at',
      step2: 'subtract',
      step3: 'add',
      step4: 'nearest word →',
      hint: 'Word2vec packs meaning into directions: gender, royalty, tense, and country→capital all become linear offsets.',
      result: '= ?',
      labels: {
        king: 'king', queen: 'queen', man: 'man', woman: 'woman',
        prince: 'prince', princess: 'princess', boy: 'boy', girl: 'girl',
        paris: 'paris', france: 'france', rome: 'rome', italy: 'italy',
        berlin: 'berlin', germany: 'germany',
        walk: 'walk', walking: 'walking', walked: 'walked',
        swim: 'swim', swimming: 'swimming', swam: 'swam',
      },
    },
    zh: {
      title: '词向量的二维投影',
      ex1: '国王 − 男 + 女',
      ex2: '巴黎 − 法国 + 意大利',
      ex3: 'walking − walk + swim',
      step1: '起点',
      step2: '减去',
      step3: '加上',
      step4: '最近邻 →',
      hint: 'Word2vec 把语义编码为方向:性别、王室、时态、国家→首都都成了线性偏移。',
      result: '= ?',
      labels: {
        king: '国王', queen: '王后', man: '男', woman: '女',
        prince: '王子', princess: '公主', boy: '男孩', girl: '女孩',
        paris: '巴黎', france: '法国', rome: '罗马', italy: '意大利',
        berlin: '柏林', germany: '德国',
        walk: 'walk', walking: 'walking', walked: 'walked',
        swim: 'swim', swimming: 'swimming', swam: 'swam',
      },
    },
  };

  // Hand-placed 2D coords so the three analogies are geometrically clean.
  // x ≈ "male → female" or "country → capital" or "infinitive → gerund"
  // y ≈ "common → royal" (top group)  or  "Europe row" / "verb row"
  const WORDS = [
    // royal cluster (upper-left)  — male / female reads as Δx ≈ (1.6, 0)
    { id: 'king',    x: 1.2, y: 4.3, group: 'royal' },
    { id: 'queen',   x: 2.8, y: 4.3, group: 'royal' },
    { id: 'prince',  x: 1.2, y: 3.5, group: 'royal' },
    { id: 'princess',x: 2.8, y: 3.5, group: 'royal' },
    { id: 'man',     x: 1.2, y: 2.4, group: 'common' },
    { id: 'woman',   x: 2.8, y: 2.4, group: 'common' },
    { id: 'boy',     x: 1.2, y: 1.6, group: 'common' },
    { id: 'girl',    x: 2.8, y: 1.6, group: 'common' },
    // country / capital cluster (middle)  — Δ = (capital - country) is consistent
    { id: 'france',  x: 5.2, y: 3.6, group: 'country' },
    { id: 'paris',   x: 6.4, y: 4.2, group: 'capital' },
    { id: 'italy',   x: 5.2, y: 2.7, group: 'country' },
    { id: 'rome',    x: 6.4, y: 3.3, group: 'capital' },
    { id: 'germany', x: 5.2, y: 1.8, group: 'country' },
    { id: 'berlin',  x: 6.4, y: 2.4, group: 'capital' },
    // tense cluster (right)
    { id: 'walk',    x: 8.4, y: 4.0, group: 'verb' },
    { id: 'walking', x: 9.6, y: 4.6, group: 'verb' },
    { id: 'walked',  x: 9.6, y: 3.4, group: 'verb' },
    { id: 'swim',    x: 8.4, y: 2.0, group: 'verb' },
    { id: 'swimming',x: 9.6, y: 2.6, group: 'verb' },
    { id: 'swam',    x: 9.6, y: 1.4, group: 'verb' },
  ];
  const BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));

  // Three examples: [a, b, c, expected]  →  a - b + c ≈ expected
  const EXAMPLES = [
    { id: 'royal',   a: 'king',    b: 'man',   c: 'woman', expected: 'queen' },
    { id: 'capital', a: 'paris',   b: 'france',c: 'italy', expected: 'rome'  },
    { id: 'tense',   a: 'walking', b: 'walk',  c: 'swim',  expected: 'swimming' },
  ];

  let currentEx = 0;
  let animState = 0; // 0 reset, 1 start, 2 -b, 3 +c, 4 reveal

  function nearestWord(p, exclude) {
    let best = null, bd = Infinity;
    for (const w of WORDS) {
      if (exclude.includes(w.id)) continue;
      const d = (w.x - p.x) ** 2 + (w.y - p.y) ** 2;
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  function render() {
    const root = document.getElementById('viz0-word2vec');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // --- controls (example buttons) ---
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '10px';
    [S.ex1, S.ex2, S.ex3].forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === currentEx ? ' active' : '');
      b.textContent = label;
      b.style.marginRight = '6px';
      b.addEventListener('click', () => { currentEx = i; animState = 0; render(); setTimeout(playAnim, 200); });
      ctrls.appendChild(b);
    });
    root.appendChild(ctrls);

    // --- svg ---
    const W = Math.min(root.clientWidth || 640, 640);
    const H = 360;
    const margin = { top: 28, right: 16, bottom: 22, left: 16 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow', 'visible');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xs = d3.extent(WORDS, d => d.x); const ys = d3.extent(WORDS, d => d.y);
    const xPad = (xs[1] - xs[0]) * 0.08, yPad = (ys[1] - ys[0]) * 0.10;
    const xScale = d3.scaleLinear().domain([xs[0] - xPad, xs[1] + xPad]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([ys[0] - yPad, ys[1] + yPad]).range([innerH, 0]);

    // Title
    svg.append('text').attr('x', margin.left).attr('y', 16)
      .style('font-size', '11px').style('fill', 'var(--text-soft)')
      .style('font-family', "'Inter', sans-serif")
      .text(S.title);

    // Arrowhead defs (one per color)
    const defs = svg.append('defs');
    function addArrow(id, color) {
      defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10')
        .attr('refX', 8).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    }
    addArrow('w2v-arrow-blue',  'var(--accent)');
    addArrow('w2v-arrow-green', 'var(--accent-4)');
    addArrow('w2v-arrow-red',   '#ff6b6b');

    // Tooltip
    const tip = document.createElement('div');
    tip.style.position = 'absolute'; tip.style.pointerEvents = 'none';
    tip.style.padding = '4px 8px'; tip.style.background = 'var(--bg-frame-2)';
    tip.style.border = '1px solid var(--accent)'; tip.style.color = 'var(--text)';
    tip.style.fontFamily = "'JetBrains Mono', monospace"; tip.style.fontSize = '11px';
    tip.style.borderRadius = '4px'; tip.style.opacity = 0;
    tip.style.transition = 'opacity 120ms'; tip.style.zIndex = 50;
    document.body.appendChild(tip);

    // Group colors for dots
    const GROUP_COLOR = {
      royal: 'var(--accent-3)', common: 'var(--text-soft)',
      country: 'var(--accent)', capital: 'var(--accent-2)',
      verb: 'var(--accent-4)',
    };

    // --- plot the dots ---
    const dotG = g.append('g').attr('class', 'dots');
    WORDS.forEach(w => {
      const cx = xScale(w.x), cy = yScale(w.y);
      const grp = dotG.append('g').attr('transform', `translate(${cx},${cy})`);
      grp.append('circle').attr('r', 5).attr('fill', GROUP_COLOR[w.group])
        .attr('stroke', 'var(--bg-frame)').attr('stroke-width', 1.2)
        .on('mouseover', function (e) {
          tip.style.opacity = 1;
          tip.innerHTML = `<b>${w.id}</b><br>vec ≈ (${w.x.toFixed(1)}, ${w.y.toFixed(1)})`;
          d3.select(this).attr('r', 7);
        })
        .on('mousemove', (e) => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
        .on('mouseout', function () { tip.style.opacity = 0; d3.select(this).attr('r', 5); });
      grp.append('text').attr('x', 8).attr('y', 3)
        .style('font-size', '10px').style('fill', 'var(--text)')
        .style('font-family', "'JetBrains Mono', monospace")
        .text(S.labels[w.id] || w.id);
    });

    // --- arithmetic animation ---
    const ex = EXAMPLES[currentEx];
    const A = BY_ID[ex.a], B = BY_ID[ex.b], C = BY_ID[ex.c];
    const pAB = { x: A.x - B.x, y: A.y - B.y };          // shifted to origin
    const pResult = { x: A.x - B.x + C.x, y: A.y - B.y + C.y };

    // For the animation we want intermediate "anchor" points in plot-space:
    //   anchor1 = A
    //   anchor2 = A - (B - origin) shown as "A + (origin - B)" — but visually we just draw the vector "A - B" applied to A
    //   for clarity, draw: blue (A → A - vec(B-origin)) ... but origin isn't onscreen.
    // Practical approach: visualize as 3-step path along the *parallel transports* near A:
    //   P0 = A
    //   P1 = A + (origin - B)   i.e.  A - B
    //   P2 = P1 + C  = A - B + C
    // We need a usable on-canvas representation. Use a small "embedding-space" offset
    // anchored at A: step1 ends at A + (−Δ_male→female_inverse) ... too abstract.
    // Simpler & geometrically valid: the vector (C - B) added to A should land near expected.
    // So animate:  A  --(blue: subtract B, shown as arrow from A toward A+(−B+0))→  but that goes off canvas.
    //
    // We use the cleaner equivalent: A + (C - B) ≈ expected.
    //   step2: blue arrow from A to A + (C - B)/2   labeled "− b"
    //   step3: green arrow continuing to A + (C - B)  labeled "+ c"
    //   step4: red highlight + dotted circle on nearest word
    const delta = { x: C.x - B.x, y: C.y - B.y };
    const mid   = { x: A.x + delta.x * 0.5, y: A.y + delta.y * 0.5 };
    const end   = { x: A.x + delta.x,       y: A.y + delta.y };
    const nearest = nearestWord(end, [A.id, B.id, C.id]);

    // Highlight the three operand dots
    function highlightDot(word, color) {
      g.append('circle').attr('cx', xScale(word.x)).attr('cy', yScale(word.y))
        .attr('r', 9).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.8)
        .attr('opacity', 0).transition().duration(300).attr('opacity', 0.9);
    }

    if (animState >= 1) highlightDot(A, 'var(--accent)');
    if (animState >= 2) highlightDot(B, '#ff6b6b');
    if (animState >= 3) highlightDot(C, 'var(--accent-4)');

    // Blue arrow (subtract b)
    if (animState >= 2) {
      g.append('line')
        .attr('x1', xScale(A.x)).attr('y1', yScale(A.y))
        .attr('x2', xScale(A.x)).attr('y2', yScale(A.y))
        .attr('stroke', 'var(--accent)').attr('stroke-width', 2)
        .attr('marker-end', 'url(#w2v-arrow-blue)')
        .transition().duration(550)
        .attr('x2', xScale(mid.x)).attr('y2', yScale(mid.y));
      g.append('text').attr('x', xScale((A.x + mid.x)/2)).attr('y', yScale((A.y + mid.y)/2) - 6)
        .style('font-size', '10px').style('fill', 'var(--accent)')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('opacity', 0)
        .text(`− vec(${ex.b})`)
        .transition().delay(200).duration(300).style('opacity', 1);
    }

    // Green arrow (add c)
    if (animState >= 3) {
      g.append('line')
        .attr('x1', xScale(mid.x)).attr('y1', yScale(mid.y))
        .attr('x2', xScale(mid.x)).attr('y2', yScale(mid.y))
        .attr('stroke', 'var(--accent-4)').attr('stroke-width', 2)
        .attr('marker-end', 'url(#w2v-arrow-green)')
        .transition().delay(150).duration(550)
        .attr('x2', xScale(end.x)).attr('y2', yScale(end.y));
      g.append('text').attr('x', xScale((mid.x + end.x)/2)).attr('y', yScale((mid.y + end.y)/2) - 6)
        .style('font-size', '10px').style('fill', 'var(--accent-4)')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('opacity', 0)
        .text(`+ vec(${ex.c})`)
        .transition().delay(400).duration(300).style('opacity', 1);
    }

    // Red arrow (result pointer) + dotted highlight circle
    if (animState >= 4 && nearest) {
      g.append('line')
        .attr('x1', xScale(end.x)).attr('y1', yScale(end.y))
        .attr('x2', xScale(end.x)).attr('y2', yScale(end.y))
        .attr('stroke', '#ff6b6b').attr('stroke-width', 2).attr('stroke-dasharray', '3 3')
        .attr('marker-end', 'url(#w2v-arrow-red)')
        .transition().delay(120).duration(450)
        .attr('x2', xScale(nearest.x)).attr('y2', yScale(nearest.y));
      g.append('circle').attr('cx', xScale(nearest.x)).attr('cy', yScale(nearest.y))
        .attr('r', 14).attr('fill', 'none').attr('stroke', '#ff6b6b')
        .attr('stroke-width', 1.8).attr('stroke-dasharray', '3 3')
        .attr('opacity', 0).transition().delay(500).duration(350).attr('opacity', 1);
      // intermediate "X" mark at end
      const xm = xScale(end.x), ym = yScale(end.y);
      g.append('text').attr('x', xm).attr('y', ym + 4).attr('text-anchor', 'middle')
        .style('font-size', '14px').style('fill', '#ff6b6b').text('×')
        .style('opacity', 0).transition().duration(300).style('opacity', 0.8);
    }

    // --- equation readout under the chart ---
    const eqWrap = document.createElement('div');
    eqWrap.style.marginTop = '10px';
    eqWrap.style.fontFamily = "'JetBrains Mono', monospace";
    eqWrap.style.fontSize = '13px';
    eqWrap.style.color = 'var(--text)';
    eqWrap.style.display = 'flex';
    eqWrap.style.flexWrap = 'wrap';
    eqWrap.style.gap = '6px';
    eqWrap.style.alignItems = 'center';
    function chip(text, color) {
      const c = document.createElement('span');
      c.textContent = text;
      c.style.padding = '2px 8px';
      c.style.border = `1px solid ${color}`;
      c.style.color = color;
      c.style.borderRadius = '4px';
      return c;
    }
    eqWrap.appendChild(chip(`vec(${ex.a})`, 'var(--accent)'));
    eqWrap.appendChild(document.createTextNode(' − '));
    eqWrap.appendChild(chip(`vec(${ex.b})`, '#ff6b6b'));
    eqWrap.appendChild(document.createTextNode(' + '));
    eqWrap.appendChild(chip(`vec(${ex.c})`, 'var(--accent-4)'));
    eqWrap.appendChild(document.createTextNode('  '));
    const eq = document.createElement('span');
    eq.textContent = (animState >= 4 && nearest) ? `≈ vec(${nearest.id})` : S.result;
    eq.style.color = (animState >= 4) ? '#ff6b6b' : 'var(--text-muted)';
    eq.style.fontWeight = '600';
    eqWrap.appendChild(eq);
    root.appendChild(eqWrap);

    // Hint
    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)';
    hint.style.marginTop = '8px'; hint.textContent = S.hint;
    root.appendChild(hint);
  }

  let animTimer = null;
  function playAnim() {
    if (animTimer) clearTimeout(animTimer);
    animState = 1; render();
    animTimer = setTimeout(() => { animState = 2; render();
      animTimer = setTimeout(() => { animState = 3; render();
        animTimer = setTimeout(() => { animState = 4; render(); }, 800);
      }, 750);
    }, 350);
  }

  function init() {
    window.addEventListener('langchange', () => { render(); });
    window.addEventListener('resize', () => render());
    render();
    setTimeout(playAnim, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* §14b — Tree of Thoughts vs Chain of Thought.
 *
 * Left panel  : CoT — linear chain of 5 reasoning steps reveals token-by-token.
 * Right panel : ToT — depth-3 tree, branching factor 3.  Animation expands
 *               level-by-level, each leaf is scored 0–100, low-scoring
 *               branches are pruned (gray), the best leaf is back-traced
 *               in green to show the winning path.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      problem: 'Q: "Find a 4-step plan that solves the puzzle."',
      cotTitle: 'Chain of Thought',
      cotSub: 'one trajectory, committed',
      totTitle: 'Tree of Thoughts',
      totSub: 'explore, evaluate, prune, choose',
      cotSteps: ['Set up variables', 'Apply rule A', 'Apply rule B', 'Combine results', 'Answer: 42'],
      evalLbl: 'Self-eval',
      play: '▶ Play both',
      reset: '↺ Reset',
      legendActive: 'active / expanding',
      legendPruned: 'pruned (low score)',
      legendWin: 'winning path',
      caption: 'CoT commits to one path and hopes for the best. ToT samples many partial thoughts, asks the model to self-score each one (e.g., "Is this state likely to solve the problem?"), and keeps only the most promising branches. The trade-off is more inference per query in exchange for higher success on hard search-like problems (Game of 24, mini-crosswords, creative writing).',
      bestScore: 'best leaf',
    },
    zh: {
      problem: '问："找一个 4 步方案解决这个谜题。"',
      cotTitle: '思维链',
      cotSub: '只走一条轨迹,直接采纳',
      totTitle: '思维树',
      totSub: '探索 → 评估 → 剪枝 → 选择',
      cotSteps: ['设定变量', '应用规则 A', '应用规则 B', '组合结果', '答案：42'],
      evalLbl: '自评分',
      play: '▶ 同时播放',
      reset: '↺ 重置',
      legendActive: '当前展开',
      legendPruned: '已剪枝 (低分)',
      legendWin: '获胜路径',
      caption: 'CoT 直接采纳单条路径,不回头。ToT 采样多条部分思路,让模型自评每条状态(例如"这个状态有多可能解出问题?"),只保留最有希望的分支。代价是单次查询的推理量更多,但在搜索类难题(24点、迷你字谜、创意写作)上成功率显著更高。',
      bestScore: '最佳叶节点',
    },
  };

  // ── tree definition (fixed structure, deterministic scores via RNG) ───
  // depth-3 tree, branching factor 3: 1 root + 3 + 9 = 13 nodes
  function buildTree() {
    const rng = DLM.makeRNG(42);
    const root = { id: 'r', label: 'root', depth: 0, children: [] };
    for (let i = 0; i < 3; i++) {
      const a = { id: `a${i}`, label: `T${i}`, depth: 1, children: [] };
      for (let j = 0; j < 3; j++) {
        const b = { id: `a${i}b${j}`, label: `T${i}${j}`, depth: 2, children: [] };
        for (let k = 0; k < 3; k++) {
          const leafScore = Math.round(rng() * 100);
          b.children.push({ id: `a${i}b${j}c${k}`, label: `T${i}${j}${k}`, depth: 3, children: [], score: leafScore });
        }
        a.children.push(b);
      }
      root.children.push(a);
    }

    // Aggregate scores up: parent = max(child scores)
    function aggregate(node) {
      if (node.children.length === 0) return node.score;
      const s = node.children.map(aggregate);
      node.score = Math.max(...s);
      return node.score;
    }
    aggregate(root);

    // Flatten and pick winning leaf
    const leaves = [];
    function collectLeaves(n) {
      if (n.children.length === 0) leaves.push(n);
      else n.children.forEach(collectLeaves);
    }
    collectLeaves(root);
    leaves.sort((a, b) => b.score - a.score);
    const winLeaf = leaves[0];

    // Trace winning path ids
    function trace(node, target, path) {
      if (node.id === target.id) { path.push(node.id); return true; }
      for (const ch of node.children) {
        if (trace(ch, target, path)) { path.push(node.id); return true; }
      }
      return false;
    }
    const winPath = [];
    trace(root, winLeaf, winPath);

    // Determine pruning order: at each parent, keep only top-1 child
    // We'll fade out everything except the winning subtree's neighbors at
    // each level after the level is fully expanded.
    return { root, winPath: new Set(winPath), winLeaf };
  }

  // ── flatten tree for d3 layout (manual, simple) ───────────────────────
  function layout(root, w, h) {
    const padX = 18, padY = 22;
    const nodes = [];
    const links = [];
    const levels = [[root], [], [], []];
    root.children.forEach(c => levels[1].push(c));
    root.children.forEach(c => c.children.forEach(d => levels[2].push(d)));
    root.children.forEach(c => c.children.forEach(d => d.children.forEach(e => levels[3].push(e))));

    const yStep = (h - padY * 2) / 3;
    for (let lv = 0; lv < 4; lv++) {
      const row = levels[lv];
      const xStep = (w - padX * 2) / Math.max(row.length, 1);
      row.forEach((n, i) => {
        n.x = padX + xStep * i + xStep / 2;
        n.y = padY + lv * yStep;
        nodes.push(n);
      });
    }

    function walk(n) {
      n.children.forEach(c => { links.push({ s: n, t: c }); walk(c); });
    }
    walk(root);

    return { nodes, links, levels };
  }

  let cotStep = 0;
  let totPhase = 0;     // 0 idle, 1 lv1 expanded, 2 lv2 expanded, 3 all leaves scored, 4 pruned, 5 winning path highlighted
  let timers = [];

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function render() {
    const root = document.getElementById('viz14b-tot');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // ─── tooltip ─────────────────────────────────────────────────────
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;'
      + 'background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);'
      + "font-family:'JetBrains Mono', monospace;font-size:11px;border-radius:4px;"
      + 'opacity:0;transition:opacity 120ms;z-index:50;white-space:nowrap;';
    document.body.appendChild(tip);
    root.addEventListener('viz-cleanup', () => tip.remove(), { once: true });

    // ─── problem bar ─────────────────────────────────────────────────
    const prob = document.createElement('div');
    prob.style.cssText = 'font-family:Inter, sans-serif;font-size:0.9rem;color:var(--text-soft);'
      + 'padding:10px 14px;background:var(--bg-frame);border-left:3px solid var(--accent-3);'
      + 'border-radius:0 4px 4px 0;margin-bottom:12px';
    prob.textContent = S.problem;
    root.appendChild(prob);

    // ─── controls ────────────────────────────────────────────────────
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap';
    const bPlay = document.createElement('button'); bPlay.className = 'btn'; bPlay.textContent = S.play;
    const bReset = document.createElement('button'); bReset.className = 'btn btn-ghost'; bReset.textContent = S.reset;
    ctrls.append(bPlay, bReset);

    // legend
    const legend = document.createElement('div');
    legend.style.cssText = "margin-left:auto;display:flex;gap:10px;font-family:Inter, sans-serif;font-size:0.72rem;color:var(--text-muted);flex-wrap:wrap";
    function chip(color, label) {
      const sp = document.createElement('span');
      sp.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
      sp.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color}"></span>${label}`;
      return sp;
    }
    legend.append(chip('var(--accent)', S.legendActive), chip('var(--mask)', S.legendPruned), chip('var(--accent-4)', S.legendWin));
    ctrls.append(legend);
    root.appendChild(ctrls);

    // ─── two-panel grid ──────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:14px';
    root.appendChild(grid);

    // ── LEFT: CoT panel ──
    const cotBox = document.createElement('div');
    cotBox.style.cssText = 'background:var(--bg-frame-2);border:1px solid var(--border-strong);border-radius:6px;'
      + 'padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px';
    const cotHead = document.createElement('div');
    cotHead.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;font-family:\'JetBrains Mono\', monospace;font-size:0.82rem;color:var(--accent-2)';
    cotHead.innerHTML = `<span style="font-weight:600">${S.cotTitle}</span><span style="font-family:Inter, sans-serif;font-size:0.72rem;color:var(--text-muted);font-weight:400">${S.cotSub}</span>`;
    cotBox.appendChild(cotHead);

    const cotW = (grid.clientWidth || 600) / 2;
    const cotSvg = d3.select(cotBox).append('svg')
      .attr('width', '100%').attr('height', 280)
      .style('display', 'block');

    drawCoT(cotSvg, S, cotStep, tip);
    grid.appendChild(cotBox);

    // ── RIGHT: ToT panel ──
    const totBox = document.createElement('div');
    totBox.style.cssText = 'background:var(--bg-frame-2);border:1px solid var(--border-strong);border-radius:6px;'
      + 'padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px';
    const totHead = document.createElement('div');
    totHead.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;font-family:\'JetBrains Mono\', monospace;font-size:0.82rem;color:var(--accent)';
    totHead.innerHTML = `<span style="font-weight:600">${S.totTitle}</span><span style="font-family:Inter, sans-serif;font-size:0.72rem;color:var(--text-muted);font-weight:400">${S.totSub}</span>`;
    totBox.appendChild(totHead);

    const totSvg = d3.select(totBox).append('svg')
      .attr('width', '100%').attr('height', 280)
      .style('display', 'block');

    const tree = buildTree();
    drawToT(totSvg, S, tree, totPhase, tip);
    grid.appendChild(totBox);

    // ─── caption ─────────────────────────────────────────────────────
    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:14px;font-size:12px;color:var(--text-muted);line-height:1.55;'
      + 'padding:10px 14px;background:var(--bg-frame);border-left:3px solid var(--accent-3);border-radius:0 4px 4px 0';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // ─── wire handlers ───────────────────────────────────────────────
    bPlay.addEventListener('click', () => playAll(S));
    bReset.addEventListener('click', () => {
      clearTimers(); cotStep = 0; totPhase = 0; cleanupTip(); render();
    });

    function cleanupTip() { root.dispatchEvent(new Event('viz-cleanup')); }
  }

  // ── CoT drawing (linear chain) ────────────────────────────────────────
  function drawCoT(svg, S, step, tip) {
    svg.selectAll('*').remove();
    const node = svg.node();
    const W = node.clientWidth || 280;
    const H = 280;
    const pad = 18;
    const n = S.cotSteps.length;
    const cy = H / 2;
    const xs = d3.range(n).map(i => pad + (i / (n - 1)) * (W - pad * 2));

    // links first
    for (let i = 0; i < n - 1; i++) {
      svg.append('line')
        .attr('x1', xs[i] + 18).attr('y1', cy)
        .attr('x2', xs[i + 1] - 18).attr('y2', cy)
        .attr('stroke', i < step - 1 ? 'var(--accent-2)' : 'var(--border-strong)')
        .attr('stroke-width', 1.5)
        .attr('opacity', i < step - 1 ? 0.9 : 0.35);
    }

    // nodes
    for (let i = 0; i < n; i++) {
      const active = i < step;
      const isLast = i === n - 1;
      const fill = active ? (isLast ? 'var(--accent-4)' : 'var(--accent-2)') : 'var(--bg-elevated)';
      const stroke = active ? (isLast ? 'var(--accent-4)' : 'var(--accent-2)') : 'var(--border-strong)';
      svg.append('circle')
        .attr('cx', xs[i]).attr('cy', cy)
        .attr('r', 0).attr('fill', fill).attr('stroke', stroke).attr('stroke-width', 1.5)
        .transition().duration(300).attr('r', 16);

      // step text below
      const lbl = svg.append('text')
        .attr('x', xs[i]).attr('y', cy + 36)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', active ? 'var(--text)' : 'var(--text-muted)')
        .text(S.cotSteps[i]);
      // word-wrap manually if too wide: simple split into two lines
      const txt = S.cotSteps[i];
      if (txt.length > 10) {
        lbl.text('');
        const words = txt.split(' ');
        const half = Math.ceil(words.length / 2);
        lbl.append('tspan').attr('x', xs[i]).attr('dy', 0).text(words.slice(0, half).join(' '));
        lbl.append('tspan').attr('x', xs[i]).attr('dy', 12).text(words.slice(half).join(' '));
      }

      svg.append('text')
        .attr('x', xs[i]).attr('y', cy + 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px').style('fill', active ? 'var(--bg-base)' : 'var(--text-muted)')
        .style('font-weight', 600).style('font-family', "'JetBrains Mono', monospace")
        .text(i + 1);
    }
  }

  // ── ToT drawing (tree) ────────────────────────────────────────────────
  function drawToT(svg, S, tree, phase, tip) {
    svg.selectAll('*').remove();
    const node = svg.node();
    const W = node.clientWidth || 320;
    const H = 280;
    const { nodes, links } = layout(tree.root, W, H - 24);

    const winPath = tree.winPath;
    const winLeaf = tree.winLeaf;

    // determine node visibility per phase
    function isVisible(n) {
      if (n.depth === 0) return true;
      if (n.depth === 1) return phase >= 1;
      if (n.depth === 2) return phase >= 2;
      if (n.depth === 3) return phase >= 3;
      return false;
    }
    function isPruned(n) {
      if (phase < 4) return false;
      if (n.depth === 0) return false;
      // any node not on winning path nor sibling of winning path's ancestors
      return !winPath.has(n.id);
    }
    function isWinning(n) {
      return phase >= 5 && winPath.has(n.id);
    }

    // links
    svg.selectAll('.tlink').data(links).enter().append('line')
      .attr('class', 'tlink')
      .attr('x1', d => d.s.x).attr('y1', d => d.s.y)
      .attr('x2', d => d.t.x).attr('y2', d => d.t.y)
      .attr('stroke', d => {
        if (isWinning(d.s) && isWinning(d.t)) return 'var(--accent-4)';
        if (isPruned(d.t)) return 'var(--mask)';
        if (!isVisible(d.t)) return 'transparent';
        return 'var(--border-strong)';
      })
      .attr('stroke-width', d => (isWinning(d.s) && isWinning(d.t)) ? 2.2 : 1)
      .attr('opacity', d => {
        if (!isVisible(d.t)) return 0;
        if (isPruned(d.t)) return 0.18;
        return 0.7;
      });

    // nodes
    const ng = svg.selectAll('.tnode').data(nodes).enter().append('g')
      .attr('class', 'tnode')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('opacity', d => isVisible(d) ? 1 : 0);

    ng.append('circle')
      .attr('r', d => d.depth === 3 ? 10 : 12)
      .attr('fill', d => {
        if (isWinning(d)) return 'var(--accent-4)';
        if (isPruned(d)) return 'var(--bg-elevated)';
        if (!isVisible(d)) return 'transparent';
        return d.depth === 3 ? 'var(--accent)' : 'var(--accent-2)';
      })
      .attr('stroke', d => {
        if (isWinning(d)) return 'var(--accent-4)';
        if (isPruned(d)) return 'var(--mask)';
        return 'var(--bg-elevated)';
      })
      .attr('stroke-width', d => isWinning(d) ? 2 : 1)
      .attr('opacity', d => isPruned(d) ? 0.45 : 1);

    // leaf scores (numbers inside leaves at phase >= 3)
    ng.filter(d => d.depth === 3 && phase >= 3).append('text')
      .attr('text-anchor', 'middle').attr('dy', 4)
      .style('font-size', '10px').style('font-weight', 600)
      .style('fill', d => isPruned(d) ? 'var(--text-muted)' : 'var(--bg-base)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d.score);

    // root label "?"
    ng.filter(d => d.depth === 0).append('text')
      .attr('text-anchor', 'middle').attr('dy', 4)
      .style('font-size', '11px').style('font-weight', 700).style('fill', 'var(--bg-base)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text('?');

    // internal nodes show depth label
    ng.filter(d => d.depth > 0 && d.depth < 3).append('text')
      .attr('text-anchor', 'middle').attr('dy', 4)
      .style('font-size', '10px').style('font-weight', 600)
      .style('fill', d => isPruned(d) ? 'var(--text-muted)' : 'var(--bg-base)')
      .style('font-family', "'JetBrains Mono', monospace")
      .text(d => d.depth);

    // hover detail
    ng.on('mouseover', function (e, d) {
      if (!isVisible(d)) return;
      tip.style.opacity = 1;
      if (d.depth === 3) {
        tip.innerHTML = `leaf <b>${d.label}</b><br>${S.evalLbl}: <b>${d.score}</b> / 100`
          + (isWinning(d) ? `<br><span style="color:var(--accent-4)">${S.bestScore}</span>` : '');
      } else {
        tip.innerHTML = `node <b>${d.label}</b> (depth ${d.depth})<br>max(child) = ${d.score}`;
      }
    })
      .on('mousemove', (e) => {
        tip.style.left = (e.pageX + 12) + 'px';
        tip.style.top = (e.pageY + 12) + 'px';
      })
      .on('mouseout', () => { tip.style.opacity = 0; });

    // tag winning-leaf score
    if (phase >= 5) {
      svg.append('text').attr('x', W / 2).attr('y', H - 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--accent-4)').style('font-weight', 600)
        .text(`${S.bestScore}: ${winLeaf.label} → ${winLeaf.score}`);
    }
  }

  function playAll(S) {
    clearTimers();
    cotStep = 0;
    totPhase = 0;
    render();
    // CoT: reveal one node per ~400ms
    for (let i = 1; i <= S.cotSteps.length; i++) {
      timers.push(setTimeout(() => { cotStep = i; render(); }, i * 480));
    }
    // ToT: 5 phases, advance every 700ms but offset slightly
    const tStart = 300;
    timers.push(setTimeout(() => { totPhase = 1; render(); }, tStart + 0));
    timers.push(setTimeout(() => { totPhase = 2; render(); }, tStart + 800));
    timers.push(setTimeout(() => { totPhase = 3; render(); }, tStart + 1700));
    timers.push(setTimeout(() => { totPhase = 4; render(); }, tStart + 2700));
    timers.push(setTimeout(() => { totPhase = 5; render(); }, tStart + 3600));
  }

  function init() {
    window.addEventListener('langchange', () => { cotStep = 0; totPhase = 0; clearTimers(); render(); });
    window.addEventListener('resize', () => render());
    render();
    setTimeout(() => {
      const lang = document.documentElement.getAttribute('data-lang') || 'en';
      playAll(STR[lang]);
    }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

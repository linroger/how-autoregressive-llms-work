/* §17 — FlashAttention tiling: standard O(N²) HBM vs blocked SRAM streaming */
(function () {
  'use strict';

  let N = 12;            // sequence length (grid is N×N)
  let blockSize = 4;     // tile size
  let mode = 'standard'; // 'standard' | 'flash'
  let progress = 0;      // counter
  let timer = null;
  let playing = false;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        standard: '标准注意力',
        flash: 'FlashAttention',
        standardSub: '将完整 N×N 矩阵物化到 HBM',
        flashSub: '按块加载到 SRAM，在线 softmax',
        hbm: 'HBM 访问',
        ops: '总操作数',
        play: '▶ 播放',
        reset: '↺ 重置',
        note: 'FlashAttention 把 Q, K, V 切成 B_r × B_c 的小块；每一块完整保存在片上 SRAM；softmax 用在线（running-max）技巧 — 避免把 N×N 注意力矩阵写到 HBM。',
      };
    }
    return {
      standard: 'Standard attention',
      flash: 'FlashAttention',
      standardSub: 'Materialize the full N×N matrix in HBM',
      flashSub: 'Stream tiles into SRAM, online softmax',
      hbm: 'HBM accesses',
      ops: 'total ops',
      play: '▶ Play',
      reset: '↺ Reset',
      note: 'FlashAttention tiles Q, K, V into B_r × B_c blocks; each tile lives entirely on-chip in SRAM; softmax is computed with the online (running-max) trick — the N×N attention matrix is never written to HBM.',
    };
  }

  function drawGrid(svgNode, mode, progress, L) {
    const svg = d3.select(svgNode);
    svg.selectAll('*').remove();
    const W = svgNode.clientWidth || 360;
    const H = W;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const pad = 18;
    const cell = (W - pad * 2) / N;
    const g = svg.append('g').attr('transform', `translate(${pad},${pad})`);

    // background grid
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const visited = mode === 'standard'
          ? (i * N + j) <= progress
          : false;
        g.append('rect')
          .attr('x', j * cell).attr('y', i * cell)
          .attr('width', cell - 0.6).attr('height', cell - 0.6)
          .attr('fill', visited ? 'var(--accent)' : 'var(--bg-frame-2)')
          .attr('opacity', visited ? 0.55 : 1);
      }
    }

    // For Flash: tile highlighting
    if (mode === 'flash') {
      const numTilesPerSide = Math.ceil(N / blockSize);
      const totalTiles = numTilesPerSide * numTilesPerSide;
      const finishedTiles = Math.floor(progress);
      const curTile = finishedTiles;
      for (let t = 0; t <= curTile && t < totalTiles; t++) {
        const ti = Math.floor(t / numTilesPerSide);
        const tj = t % numTilesPerSide;
        const x = tj * blockSize * cell;
        const y = ti * blockSize * cell;
        const w = Math.min(blockSize, N - tj * blockSize) * cell;
        const h = Math.min(blockSize, N - ti * blockSize) * cell;
        const isCurrent = t === curTile && curTile < totalTiles;
        g.append('rect')
          .attr('x', x).attr('y', y).attr('width', w - 0.6).attr('height', h - 0.6)
          .attr('fill', isCurrent ? 'var(--accent-4)' : 'var(--accent)')
          .attr('opacity', isCurrent ? 0.85 : 0.45)
          .attr('stroke', isCurrent ? 'var(--accent-4)' : 'none')
          .attr('stroke-width', 2);
      }
    }

    // Axes
    g.append('text').attr('x', 0).attr('y', -6)
      .style('font-family', 'JetBrains Mono, monospace').style('font-size', '0.7rem')
      .style('fill', 'var(--text-muted)').text('K (cols) →');
    g.append('text').attr('x', -8).attr('y', cell)
      .style('font-family', 'JetBrains Mono, monospace').style('font-size', '0.7rem')
      .style('fill', 'var(--text-muted)').attr('text-anchor', 'end').text('Q');
  }

  function stats(mode, progress) {
    if (mode === 'standard') {
      return { hbm: Math.min(N * N, progress + 1) * 4, ops: Math.min(N * N, progress + 1) };
    }
    const numTilesPerSide = Math.ceil(N / blockSize);
    const totalTiles = numTilesPerSide * numTilesPerSide;
    const done = Math.min(totalTiles, Math.floor(progress));
    return { hbm: done * 2, ops: done * blockSize * blockSize };
  }

  function makePanel(parent, key, L) {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-frame-2)';
    card.style.border = '1.5px solid ' + (mode === key ? 'var(--accent)' : 'var(--border-strong)');
    card.style.borderRadius = '6px';
    card.style.padding = '14px';
    card.style.cursor = 'pointer';
    card.style.transition = 'border-color 200ms';

    const isStd = key === 'standard';
    card.innerHTML = `
      <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:${isStd ? 'var(--mask)' : 'var(--accent-4)'}">${isStd ? L.standard : L.flash}</div>
      <div style="font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-muted);margin-top:2px">${isStd ? L.standardSub : L.flashSub}</div>
    `;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.display = 'block';
    svg.style.marginTop = '10px';
    card.appendChild(svg);

    const s = stats(key, mode === key ? progress : (isStd ? N * N : Math.ceil(N / blockSize) ** 2));
    const counters = document.createElement('div');
    counters.style.marginTop = '8px';
    counters.style.display = 'flex';
    counters.style.justifyContent = 'space-between';
    counters.style.fontFamily = 'JetBrains Mono, monospace';
    counters.style.fontSize = '0.74rem';
    counters.style.color = 'var(--text-soft)';
    counters.innerHTML = `<span>${L.hbm}: <b style="color:${isStd ? '#ff4d4f' : 'var(--accent-4)'}">${s.hbm}</b></span><span>${L.ops}: <b>${s.ops}</b></span>`;
    card.appendChild(counters);

    card.addEventListener('click', () => { mode = key; progress = 0; render(); });
    parent.appendChild(card);
    drawGrid(svg, key, mode === key ? progress : (isStd ? N * N : Math.ceil(N / blockSize) ** 2), L);
  }

  function render() {
    const container = document.getElementById('viz4-3');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    grid.style.gap = '12px';
    container.appendChild(grid);

    makePanel(grid, 'standard', L);
    makePanel(grid, 'flash', L);

    const note = document.createElement('div');
    note.style.marginTop = '14px';
    note.style.padding = '12px 14px';
    note.style.background = 'var(--bg-frame)';
    note.style.borderLeft = '3px solid var(--accent-2)';
    note.style.borderRadius = '0 4px 4px 0';
    note.style.fontFamily = 'Inter, sans-serif';
    note.style.fontSize = '0.86rem';
    note.style.lineHeight = '1.55';
    note.style.color = 'var(--text-soft)';
    note.textContent = L.note;
    container.appendChild(note);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '12px';
    actions.innerHTML = `<button class="btn" id="fa-play">${L.play}</button><button class="btn btn-ghost" id="fa-reset">${L.reset}</button>`;
    container.appendChild(actions);

    document.getElementById('fa-play').addEventListener('click', () => {
      if (playing) return;
      playing = true;
      progress = 0;
      const numTilesPerSide = Math.ceil(N / blockSize);
      const target = mode === 'standard' ? N * N : numTilesPerSide * numTilesPerSide;
      const stepInc = mode === 'standard' ? Math.max(1, Math.floor(target / 40)) : 1;
      const tick = () => {
        progress += stepInc;
        if (progress >= target) { progress = target; playing = false; render(); return; }
        render();
        timer = setTimeout(tick, mode === 'standard' ? 35 : 320);
      };
      render();
      timer = setTimeout(tick, 300);
    });
    document.getElementById('fa-reset').addEventListener('click', () => {
      if (timer) clearTimeout(timer);
      playing = false; progress = 0; render();
    });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

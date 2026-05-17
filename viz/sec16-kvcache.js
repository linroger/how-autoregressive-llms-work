/* §16 — KV cache: MHA vs GQA vs MLA, with context-length scaling */
(function () {
  'use strict';

  let ctxLen = 8192;
  let streamPos = 0;
  let timer = null;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        mha: 'MHA · 多头注意力',
        gqa: 'GQA · 分组查询',
        mla: 'MLA · 低秩潜在',
        mhaDesc: '每个头有独立的 K, V — 缓存最大',
        gqaDesc: '4 组共享 KV — 缓存缩小 4×',
        mlaDesc: '把 KV 压成低秩潜变量 d_c — 缓存最小',
        perTok: '每 token 缓存',
        totalCtx: '总缓存 @',
        tokens: 'tokens',
        ctxLabel: '上下文长度',
        play: '▶ 流式填充',
      };
    }
    return {
      mha: 'MHA · multi-head attention',
      gqa: 'GQA · grouped-query',
      mla: 'MLA · low-rank latent',
      mhaDesc: 'Each head has its own K, V — largest cache',
      gqaDesc: '4 groups share KV — 4× smaller',
      mlaDesc: 'Compress KV into a latent of size d_c — smallest',
      perTok: 'cache per token',
      totalCtx: 'total cache @',
      tokens: 'tokens',
      ctxLabel: 'Context length',
      play: '▶ Stream tokens',
    };
  }

  // relative cache size per token (normalized so MHA = 1)
  const SIZES = { mha: 1.0, gqa: 0.25, mla: 0.07 };

  function fmtBytes(units) {
    // 1 unit ≈ 0.5 MB per 1k tokens for a baseline 7B-ish model
    const mb = units;
    if (mb < 1024) return mb.toFixed(0) + ' MB';
    return (mb / 1024).toFixed(1) + ' GB';
  }

  function drawColumn(parent, key, L) {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-frame-2)';
    card.style.border = '1px solid var(--border-strong)';
    card.style.borderRadius = '6px';
    card.style.padding = '14px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '10px';

    const labelMap = { mha: { name: L.mha, desc: L.mhaDesc, color: 'var(--accent-3)' },
                       gqa: { name: L.gqa, desc: L.gqaDesc, color: 'var(--accent)' },
                       mla: { name: L.mla, desc: L.mlaDesc, color: 'var(--accent-4)' } };
    const info = labelMap[key];
    const sz = SIZES[key];

    const head = document.createElement('div');
    head.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:${info.color};margin-bottom:4px">${info.name}</div><div style="font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-muted);line-height:1.4">${info.desc}</div>`;
    card.appendChild(head);

    // Stacked bar — per-token cache
    const barWrap = document.createElement('div');
    barWrap.style.marginTop = '6px';
    const barH = 18;
    const barLabel = document.createElement('div');
    barLabel.style.display = 'flex';
    barLabel.style.justifyContent = 'space-between';
    barLabel.style.fontFamily = 'JetBrains Mono, monospace';
    barLabel.style.fontSize = '0.72rem';
    barLabel.style.color = 'var(--text-soft)';
    barLabel.style.marginBottom = '4px';
    barLabel.innerHTML = `<span>${L.perTok}</span><span><b style="color:${info.color}">${(sz * 100).toFixed(0)}%</b></span>`;
    barWrap.appendChild(barLabel);

    const track = document.createElement('div');
    track.style.height = barH + 'px';
    track.style.background = 'var(--mask-soft)';
    track.style.borderRadius = '3px';
    track.style.overflow = 'hidden';
    const fill = document.createElement('div');
    fill.style.height = '100%';
    fill.style.background = info.color;
    fill.style.width = '0%';
    fill.style.transition = 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)';
    track.appendChild(fill);
    barWrap.appendChild(track);
    card.appendChild(barWrap);
    requestAnimationFrame(() => { fill.style.width = (sz * 100) + '%'; });

    // Cache fill visualization (streaming tokens)
    const cacheVis = document.createElement('div');
    cacheVis.style.marginTop = '8px';
    cacheVis.style.height = '38px';
    cacheVis.style.background = 'var(--bg-frame)';
    cacheVis.style.borderRadius = '3px';
    cacheVis.style.position = 'relative';
    cacheVis.style.overflow = 'hidden';
    cacheVis.style.border = '1px solid var(--border-strong)';

    // bar fills with current streamPos × sz
    const streamFill = document.createElement('div');
    streamFill.style.position = 'absolute';
    streamFill.style.left = '0'; streamFill.style.top = '0'; streamFill.style.bottom = '0';
    streamFill.style.background = `linear-gradient(90deg, ${info.color}, transparent)`;
    streamFill.style.opacity = '0.55';
    streamFill.style.width = ((streamPos / ctxLen) * sz * 100) + '%';
    streamFill.style.transition = 'width 240ms linear';
    cacheVis.appendChild(streamFill);

    const txt = document.createElement('div');
    txt.style.position = 'absolute';
    txt.style.inset = '0';
    txt.style.display = 'flex';
    txt.style.alignItems = 'center';
    txt.style.justifyContent = 'center';
    txt.style.fontFamily = 'JetBrains Mono, monospace';
    txt.style.fontSize = '0.74rem';
    txt.style.color = 'var(--text-soft)';
    const totalMB = sz * ctxLen * 0.5; // pretend scaling
    txt.innerHTML = `${L.totalCtx} ${ctxLen.toLocaleString()} ${L.tokens}: <b style="color:${info.color};margin-left:4px">${fmtBytes(totalMB)}</b>`;
    cacheVis.appendChild(txt);
    card.appendChild(cacheVis);

    parent.appendChild(card);
  }

  function render() {
    const container = document.getElementById('viz4-2');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    // Context length picker
    const ctxRow = document.createElement('div');
    ctxRow.style.display = 'flex';
    ctxRow.style.flexWrap = 'wrap';
    ctxRow.style.gap = '8px';
    ctxRow.style.alignItems = 'center';
    ctxRow.style.marginBottom = '14px';
    ctxRow.innerHTML = `<span style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-soft)">${L.ctxLabel}:</span>`;
    [2048, 8192, 32768, 131072].forEach((n) => {
      const b = document.createElement('button');
      b.className = 'btn' + (n === ctxLen ? '' : ' btn-ghost');
      b.style.padding = '4px 12px';
      b.style.fontSize = '0.78rem';
      const label = n >= 1024 ? (n / 1024) + 'K' : n;
      b.textContent = label;
      b.addEventListener('click', () => { ctxLen = n; streamPos = n; render(); });
      ctxRow.appendChild(b);
    });
    container.appendChild(ctxRow);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    // 3-col grid on wide screens, 1-col on narrow — keeps the cards readable
    const w = container.clientWidth || 700;
    grid.style.gridTemplateColumns = w < 640 ? '1fr' : 'repeat(3, 1fr)';
    grid.style.gap = '14px';
    container.appendChild(grid);

    ['mha', 'gqa', 'mla'].forEach((k) => drawColumn(grid, k, L));

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'center';
    actions.style.marginTop = '16px';
    actions.innerHTML = `<button class="btn" id="kv-play">${L.play}</button>`;
    container.appendChild(actions);

    document.getElementById('kv-play').addEventListener('click', () => {
      if (timer) clearInterval(timer);
      streamPos = 0; render();
      timer = setInterval(() => {
        streamPos = Math.min(ctxLen, streamPos + Math.max(1, ctxLen / 40));
        render();
        if (streamPos >= ctxLen) { clearInterval(timer); timer = null; }
      }, 60);
    });
  }

  function init() {
    streamPos = ctxLen;
    render();
    window.addEventListener('langchange', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

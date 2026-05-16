/* §15 — MoE routing: top-2 of 16 (vanilla) vs DeepSeek (1 shared + top-8 of 256) */
(function () {
  'use strict';

  let mode = 'vanilla'; // 'vanilla' | 'deepseek'
  let tokIdx = 0;
  let timer = null;
  let playing = false;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        title: '专家混合（MoE）路由',
        vanilla: '经典 MoE',
        deepseek: 'DeepSeek 风格',
        currentTok: '当前 token：',
        active: '激活参数',
        total: '总参数',
        gate: '门控 top-K',
        sharedNote: '共享专家始终激活，专门捕捉通用模式；细粒度路由专家挑选 top-8 / 256，捕捉领域特化模式。',
        vanillaNote: '每个 token 由路由器选择 2 个专家。激活 = 2 / 16 ≈ 12.5%。',
        play: '▶ 扫描句子',
      };
    }
    return {
      title: 'Mixture-of-Experts routing',
      vanilla: 'Classic MoE',
      deepseek: 'DeepSeek style',
      currentTok: 'Current token: ',
      active: 'Active params',
      total: 'Total params',
      gate: 'gate top-K',
      sharedNote: 'A shared expert is always on (captures generic patterns); fine-grained routed experts pick top-8 of 256 for domain-specific specialization.',
      vanillaNote: 'Each token picks 2 experts via the router. Active = 2 / 16 ≈ 12.5%.',
      play: '▶ Sweep sentence',
    };
  }

  function gating(tok, mode) {
    // Deterministic gating from token text
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
    const rng = DLM.makeRNG(h || 1);
    if (mode === 'vanilla') {
      const N = 16;
      const scores = d3.range(N).map(() => rng());
      const order = d3.range(N).sort((a, b) => scores[b] - scores[a]);
      return { N, topK: 2, chosen: new Set(order.slice(0, 2)), shared: -1 };
    } else {
      const N = 32; // visualize 32 as a proxy for 256 (8 rows × 32)
      const scores = d3.range(N).map(() => rng());
      const order = d3.range(N).sort((a, b) => scores[b] - scores[a]);
      return { N, topK: 8, chosen: new Set(order.slice(0, 8)), shared: 0 };
    }
  }

  function drawGrid(container, tok, mode, L) {
    const g = gating(tok, mode);
    container.innerHTML = '';
    const wrap = document.createElement('div');
    const cols = mode === 'vanilla' ? 8 : 16;
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    wrap.style.gap = '4px';

    for (let i = 0; i < g.N; i++) {
      const cell = document.createElement('div');
      cell.style.aspectRatio = '1';
      cell.style.borderRadius = '4px';
      cell.style.fontFamily = 'JetBrains Mono, monospace';
      cell.style.fontSize = '0.6rem';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.transition = 'background 250ms, transform 250ms';
      const isShared = i === g.shared;
      const isRouted = g.chosen.has(i);
      if (isShared) {
        cell.style.background = 'var(--accent-2)';
        cell.style.color = '#fff';
        cell.style.boxShadow = '0 0 0 1.5px var(--accent-2)';
      } else if (isRouted) {
        cell.style.background = 'var(--accent)';
        cell.style.color = '#fff';
        cell.style.transform = 'scale(1.04)';
      } else {
        cell.style.background = 'var(--bg-frame)';
        cell.style.color = 'var(--text-muted)';
      }
      cell.textContent = isShared ? 'S' : `E${i}`;
      wrap.appendChild(cell);
    }
    container.appendChild(wrap);
    return g;
  }

  function paramStats(mode) {
    if (mode === 'vanilla') {
      const total = 16 * 1.0; // GB units, arbitrary
      const active = 2 * 1.0;
      return { total: '16B', active: '2B', frac: active / total };
    }
    const total = 1 + 256;
    const active = 1 + 8;
    return { total: '~257B', active: '~9B', frac: active / total };
  }

  function render() {
    const container = document.getElementById('viz4-1');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    // Toggle
    const toggle = document.createElement('div');
    toggle.style.display = 'flex';
    toggle.style.gap = '8px';
    toggle.style.marginBottom = '14px';
    const opts = [['vanilla', L.vanilla], ['deepseek', L.deepseek]];
    opts.forEach(([k, lbl]) => {
      const b = document.createElement('button');
      b.className = 'btn' + (mode === k ? '' : ' btn-ghost');
      b.textContent = lbl;
      b.addEventListener('click', () => { mode = k; render(); });
      toggle.appendChild(b);
    });
    container.appendChild(toggle);

    // Sentence row
    const sentence = DLM.pickSentence(0);
    const sentRow = document.createElement('div');
    sentRow.className = 'token-strip';
    sentRow.style.padding = '10px';
    sentRow.style.background = 'var(--bg-frame-2)';
    sentRow.style.borderRadius = '6px';
    sentRow.style.marginBottom = '14px';
    sentence.forEach((tok, i) => {
      const el = document.createElement('span');
      el.className = 'token';
      el.textContent = tok;
      if (i === tokIdx) {
        el.classList.add('commit');
      } else {
        el.classList.add('committed');
        el.style.opacity = '0.55';
      }
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => { tokIdx = i; render(); });
      sentRow.appendChild(el);
    });
    container.appendChild(sentRow);

    // Grid panel
    const panel = document.createElement('div');
    panel.style.background = 'var(--bg-frame-2)';
    panel.style.border = '1px solid var(--border-strong)';
    panel.style.borderRadius = '6px';
    panel.style.padding = '14px';

    const headRow = document.createElement('div');
    headRow.style.display = 'flex';
    headRow.style.justifyContent = 'space-between';
    headRow.style.alignItems = 'baseline';
    headRow.style.marginBottom = '10px';
    headRow.innerHTML = `
      <div style="font-family:JetBrains Mono,monospace;font-size:0.82rem;color:var(--text)">${L.currentTok}<b style="color:var(--accent)">${sentence[tokIdx]}</b></div>
      <div style="font-family:JetBrains Mono,monospace;font-size:0.74rem;color:var(--text-muted)">${L.gate} = ${mode === 'vanilla' ? 2 : 8}</div>
    `;
    panel.appendChild(headRow);

    const gridWrap = document.createElement('div');
    panel.appendChild(gridWrap);
    drawGrid(gridWrap, sentence[tokIdx], mode, L);

    container.appendChild(panel);

    // Param stats
    const stats = paramStats(mode);
    const statRow = document.createElement('div');
    statRow.style.display = 'grid';
    statRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))';
    statRow.style.gap = '10px';
    statRow.style.marginTop = '14px';
    statRow.innerHTML = `
      <div style="background:var(--bg-frame);padding:12px;border-radius:4px;border-left:3px solid var(--accent)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.active}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.3rem;color:var(--accent);font-weight:600">${stats.active}</div>
      </div>
      <div style="background:var(--bg-frame);padding:12px;border-radius:4px;border-left:3px solid var(--accent-3)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.total}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.3rem;color:var(--accent-3);font-weight:600">${stats.total}</div>
      </div>
      <div style="background:var(--bg-frame);padding:12px;border-radius:4px;border-left:3px solid var(--accent-4)">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text-muted);letter-spacing:0.06em">${L.active} / ${L.total}</div>
        <div style="font-family:Inter,sans-serif;font-size:1.3rem;color:var(--accent-4);font-weight:600">${(stats.frac * 100).toFixed(1)}%</div>
      </div>
    `;
    container.appendChild(statRow);

    const note = document.createElement('div');
    note.style.marginTop = '12px';
    note.style.padding = '10px 12px';
    note.style.background = 'var(--bg-frame)';
    note.style.borderLeft = '3px solid var(--accent-2)';
    note.style.borderRadius = '0 4px 4px 0';
    note.style.fontFamily = 'Inter, sans-serif';
    note.style.fontSize = '0.85rem';
    note.style.color = 'var(--text-soft)';
    note.style.lineHeight = '1.5';
    note.textContent = mode === 'vanilla' ? L.vanillaNote : L.sharedNote;
    container.appendChild(note);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '12px';
    actions.innerHTML = `<button class="btn" id="moe-play">${L.play}</button>`;
    container.appendChild(actions);

    document.getElementById('moe-play').addEventListener('click', () => {
      if (playing) return;
      playing = true;
      tokIdx = 0;
      const sent = DLM.pickSentence(0);
      const tick = () => {
        tokIdx++;
        if (tokIdx >= sent.length) { tokIdx = sent.length - 1; playing = false; render(); return; }
        render();
        timer = setTimeout(tick, 700);
      };
      render();
      timer = setTimeout(tick, 500);
    });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

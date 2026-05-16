/* §22 — RAG: retrieval-augmented generation pipeline
 * Animated 4-stage pipeline + dual-encoder space + raw vs RAG output toggle.
 */
(function () {
  'use strict';

  const QUERIES = [
    {
      q_en: 'When did the iPhone come out?', q_zh: 'iPhone 是什么时候发布的?',
      docs: [
        'Apple Keynote 2007: Steve Jobs unveils iPhone on Jan 9, 2007.',
        'iPhone shipped to customers on June 29, 2007.',
        'Original iPhone had a 3.5-inch screen and 4GB storage.',
      ],
      raw: { en: 'The iPhone came out in 2006.', zh: 'iPhone 在 2006 年发布.' },
      rag: { en: 'The original iPhone was unveiled Jan 9, 2007 and shipped June 29, 2007 [doc 1, 2].', zh: '初代 iPhone 于 2007 年 1 月 9 日发布, 6 月 29 日开售 [文档 1, 2].' },
    },
    {
      q_en: 'What is the population of Tokyo?', q_zh: '东京人口是多少?',
      docs: [
        'Tokyo Metropolis: 13.96 million residents (2024 estimate).',
        'Greater Tokyo Area: 37.4 million — largest metro on Earth.',
        'Tokyo is the capital of Japan.',
      ],
      raw: { en: 'Tokyo has around 9 million people.', zh: '东京约有 900 万人.' },
      rag: { en: 'Tokyo Metropolis has ~14.0M residents (2024); Greater Tokyo ~37.4M [doc 1, 2].', zh: '东京都约 1,396 万 (2024); 大东京都市圈约 3,740 万 [文档 1, 2].' },
    },
    {
      q_en: 'Who wrote the attention paper?', q_zh: '"Attention" 论文的作者是谁?',
      docs: [
        '"Attention Is All You Need" — Vaswani et al., NeurIPS 2017.',
        'The eight authors were from Google Brain and Google Research.',
        'The paper introduced the Transformer architecture.',
      ],
      raw: { en: 'It was written by some Google researchers in 2017.', zh: '2017 年由一些谷歌研究员撰写.' },
      rag: { en: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser, Polosukhin (Google, NeurIPS 2017) [doc 1, 2].', zh: 'Vaswani 等八人, 来自 Google Brain / Research, NeurIPS 2017 [文档 1, 2].' },
    },
    {
      q_en: 'What is the boiling point of nitrogen?', q_zh: '氮的沸点是多少?',
      docs: [
        'Liquid N₂ boils at 77.36 K (−195.79 °C) at 1 atm.',
        'Nitrogen makes up ~78% of Earth\'s atmosphere.',
        'Liquid nitrogen is widely used as a cryogenic fluid.',
      ],
      raw: { en: 'Around minus 200 degrees Celsius.', zh: '约零下 200 摄氏度.' },
      rag: { en: 'Nitrogen boils at 77.36 K (−195.79 °C) at 1 atm [doc 1].', zh: '氮在 1 atm 下沸点为 77.36 K (−195.79 ℃) [文档 1].' },
    },
  ];

  const STR = {
    en: { step1: '1. Embed query', step2: '2. Retrieve top-k', step3: '3. LM reads', step4: '4. Generate', raw: 'Raw LM', rag: 'RAG LM', pick: 'Try a query:', space: 'Embedding space (2-D projection)', play: 'Run pipeline', topk: 'top-3 chunks' },
    zh: { step1: '1. 嵌入查询', step2: '2. 检索 top-k', step3: '3. LM 读取', step4: '4. 生成', raw: '原始 LM', rag: 'RAG LM', pick: '试一个问题:', space: '嵌入空间 (二维投影)', play: '运行流水线', topk: 'top-3 段落' },
  };

  let qIdx = 0;
  let mode = 'rag';     // 'rag' | 'raw'
  let stage = 0;        // 0..4 animation stage

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function render() {
    const root = document.getElementById('viz5-3');
    if (!root) return;
    const S = STR[getLang()];
    const lang = getLang();
    root.innerHTML = '';

    // Query picker + mode toggle
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;align-items:center';
    top.innerHTML = `
      <span style="font-family:Inter;font-size:0.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em">${S.pick}</span>
      <select id="rag-q" style="background:var(--bg-frame-2);border:1px solid var(--border-strong);color:var(--text);padding:6px 8px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.82rem;flex:1;min-width:200px">
        ${QUERIES.map((q, i) => `<option value="${i}" ${i===qIdx?'selected':''}>${lang==='zh'?q.q_zh:q.q_en}</option>`).join('')}
      </select>
      <div style="display:flex;border:1px solid var(--border-strong);border-radius:4px;overflow:hidden">
        <button class="rag-mode" data-m="raw" style="padding:6px 12px;background:${mode==='raw'?'var(--accent-3)':'transparent'};color:${mode==='raw'?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.raw}</button>
        <button class="rag-mode" data-m="rag" style="padding:6px 12px;background:${mode==='rag'?'var(--accent)':'transparent'};color:${mode==='rag'?'#fff':'var(--text-soft)'};border:none;cursor:pointer">${S.rag}</button>
      </div>
      <button class="btn" id="rag-play">▶ ${S.play}</button>
    `;
    root.appendChild(top);

    // Pipeline SVG
    const W = root.clientWidth || 720;
    const H = 200;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');
    const stages = [S.step1, S.step2, S.step3, S.step4];
    const colW = (W - 40) / stages.length;
    stages.forEach((s, i) => {
      const x = 20 + i * colW;
      const active = stage > i;
      svg.append('rect').attr('x', x).attr('y', 40).attr('width', colW - 20).attr('height', 70)
        .attr('rx', 6).attr('fill', active ? 'var(--accent)' : 'var(--bg-frame-2)')
        .attr('opacity', active ? 0.7 : 1)
        .attr('stroke', active ? 'var(--accent)' : 'var(--border-strong)').attr('stroke-width', 1.4);
      svg.append('text').attr('x', x + (colW-20)/2).attr('y', 80).attr('text-anchor','middle')
        .style('font-family','Inter,sans-serif').style('font-size','12px')
        .style('fill', active ? '#fff' : 'var(--text-soft)').text(s);
      if (i < stages.length - 1) {
        svg.append('text').attr('x', x + colW - 14).attr('y', 80).attr('text-anchor','middle')
          .style('font-size','18px').style('fill','var(--text-muted)').text('→');
      }
    });

    // Moving "query packet" dot
    if (stage > 0) {
      const px = 20 + Math.min(stage, 4) * colW - colW/2;
      svg.append('circle').attr('cx', px).attr('cy', 25).attr('r', 6).attr('fill','var(--accent-2)')
        .attr('opacity', 0).transition().duration(400).attr('opacity', 1);
    }

    // Retrieved docs panel
    const docPanel = document.createElement('div');
    docPanel.style.cssText = 'margin-top:6px;padding:12px;background:var(--bg-frame-2);border-radius:6px';
    const Q = QUERIES[qIdx];
    docPanel.innerHTML = `<div style="font-family:Inter,sans-serif;font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${S.topk}</div>`;
    Q.docs.forEach((d, i) => {
      const visible = stage >= 2;
      const div = document.createElement('div');
      div.style.cssText = `margin:5px 0;padding:7px 10px;border-left:3px solid var(--accent);background:var(--bg-frame);border-radius:3px;font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text);opacity:${visible?1:0.25};transition:opacity .5s`;
      div.textContent = `doc ${i+1}: ` + d;
      docPanel.appendChild(div);
    });
    root.appendChild(docPanel);

    // Dual-encoder 2D space
    const space = d3.select(root).append('svg').attr('width', W).attr('height', 160).style('margin-top','12px').style('overflow','visible');
    space.append('text').attr('x', 10).attr('y', 14)
      .style('font-family','Inter,sans-serif').style('font-size','11px')
      .style('fill','var(--text-soft)').text(S.space);
    // Random-but-deterministic dots
    const rng = window.DLM ? DLM.makeRNG(qIdx * 31 + 7) : (() => Math.random());
    const cx = W * 0.45, cy = 90, R = 60;
    // Distractor docs
    for (let i = 0; i < 30; i++) {
      space.append('circle').attr('cx', 20 + rng()*(W-40)).attr('cy', 30 + rng()*120)
        .attr('r', 3).attr('fill','var(--text-muted)').attr('opacity', 0.5);
    }
    // Query
    space.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 8).attr('fill','var(--accent-2)');
    space.append('text').attr('x', cx).attr('y', cy - 14).attr('text-anchor','middle')
      .style('font-size','11px').style('fill','var(--accent-2)').style('font-family','JetBrains Mono,monospace').text('q');
    // Top-3 docs near query
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.9;
      const x2 = cx + Math.cos(a) * (R - i*8);
      const y2 = cy + Math.sin(a) * (R - i*8);
      space.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2)
        .attr('stroke','var(--accent)').attr('stroke-width', 1).attr('stroke-dasharray','2 3').attr('opacity', stage >= 2 ? 1 : 0);
      space.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 5)
        .attr('fill','var(--accent)').attr('opacity', stage >= 2 ? 1 : 0.3);
    }

    // Final answer card
    const ans = document.createElement('div');
    const txt = mode === 'rag' ? Q.rag[lang] : Q.raw[lang];
    ans.style.cssText = `margin-top:12px;padding:14px;border-radius:6px;background:var(--bg-frame);border:1px solid ${mode==='rag'?'var(--accent)':'var(--accent-3)'};font-family:Inter,sans-serif;font-size:0.92rem;color:var(--text);opacity:${stage>=4?1:0.2};transition:opacity .6s`;
    ans.innerHTML = `<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:${mode==='rag'?'var(--accent)':'var(--accent-3)'};margin-bottom:6px">${mode==='rag'?S.rag:S.raw}</div>${txt}`;
    root.appendChild(ans);

    // Wire
    document.getElementById('rag-q').addEventListener('change', e => { qIdx = +e.target.value; stage = 4; render(); });
    root.querySelectorAll('.rag-mode').forEach(b => b.addEventListener('click', e => { mode = e.currentTarget.dataset.m; render(); }));
    document.getElementById('rag-play').addEventListener('click', play);
  }

  function play() {
    stage = 0; render();
    const tick = () => {
      stage++;
      render();
      if (stage < 4) setTimeout(tick, 650);
    };
    setTimeout(tick, 250);
  }

  function init() {
    stage = 4;     // start "completed" so users see the result
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__ragT); window.__ragT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* §23 — CLIP contrastive learning + zero-shot classification */
(function () {
  'use strict';

  const ITEMS = [
    { glyph: '🐱', en: 'a photo of a cat',     zh: '一只猫的照片' },
    { glyph: '🐶', en: 'a photo of a dog',     zh: '一只狗的照片' },
    { glyph: '🚗', en: 'a red sports car',     zh: '一辆红色跑车' },
    { glyph: '✈️', en: 'a passenger plane',    zh: '一架客机' },
    { glyph: '🍕', en: 'a slice of pizza',     zh: '一块披萨' },
    { glyph: '🌲', en: 'a pine tree forest',   zh: '松树林' },
  ];

  const STR = {
    en: { title: 'Image–text similarity matrix (cosine, after training)', diag: 'Diagonal: matched pairs (pulled up)', off: 'Off-diagonal: negatives (pushed down)', zero: 'Zero-shot classification', pickImg: 'Pick an image:', scores: 'Similarity to each caption', winner: 'predicted', caption: 'CLIP trains image and text encoders so that matching pairs land close in a shared embedding space — and everything else lands far apart.' },
    zh: { title: '图像–文本相似度矩阵 (余弦, 训练后)', diag: '对角线: 正样本对 (拉近)', off: '非对角线: 负样本 (推远)', zero: '零样本分类', pickImg: '选一张图:', scores: '与各描述的相似度', winner: '预测', caption: 'CLIP 训练图像和文本编码器, 让匹配对在共享嵌入空间中靠近, 其他全部远离.' },
  };

  let zeroIdx = 0;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function simMatrix() {
    // Deterministic: diagonal ~ 0.85, off ~ 0.1–0.3
    const rng = DLM.makeRNG(11);
    const N = ITEMS.length;
    const M = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) {
        row.push(i === j ? 0.78 + rng() * 0.18 : 0.05 + rng() * 0.25);
      }
      M.push(row);
    }
    return M;
  }

  function render() {
    const root = document.getElementById('viz5-4');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Matrix
    const head = document.createElement('div');
    head.style.cssText = 'font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px';
    head.textContent = S.title;
    root.appendChild(head);

    const W = root.clientWidth || 720;
    const N = ITEMS.length;
    const cell = Math.min(60, (W - 220) / N);
    const padL = 200, padT = 30;
    const H = padT + cell * N + 30;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');

    const M = simMatrix();
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);

    // Column captions (top)
    ITEMS.forEach((it, j) => {
      svg.append('text').attr('x', padL + j * cell + cell/2).attr('y', padT - 8)
        .attr('text-anchor','middle').style('font-size','18px').text(it.glyph);
    });

    // Row captions (left)
    ITEMS.forEach((it, i) => {
      svg.append('text').attr('x', padL - 8).attr('y', padT + i * cell + cell/2 + 4)
        .attr('text-anchor','end').style('font-family','Inter,sans-serif').style('font-size','11px')
        .style('fill', i === zeroIdx ? 'var(--accent)' : 'var(--text-soft)')
        .text(getLang()==='zh' ? it.zh : it.en);
    });

    // Cells
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const isDiag = i === j;
        svg.append('rect')
          .attr('x', padL + j * cell).attr('y', padT + i * cell)
          .attr('width', cell - 2).attr('height', cell - 2)
          .attr('fill', isDiag ? 'var(--accent)' : color(M[i][j] * 0.7))
          .attr('opacity', isDiag ? Math.max(0.4, M[i][j]) : Math.max(0.18, M[i][j] * 1.2))
          .attr('stroke', isDiag ? 'var(--accent)' : 'none')
          .attr('stroke-width', isDiag ? 1.5 : 0);
        svg.append('text').attr('x', padL + j * cell + cell/2).attr('y', padT + i * cell + cell/2 + 3)
          .attr('text-anchor','middle')
          .style('font-family','JetBrains Mono,monospace').style('font-size','9.5px')
          .style('fill', isDiag ? '#fff' : 'var(--text-muted)')
          .text(M[i][j].toFixed(2));
      }
    }

    // Legend
    const lg = document.createElement('div');
    lg.style.cssText = 'display:flex;gap:18px;margin-top:6px;font-size:0.78rem;color:var(--text-soft);font-family:Inter,sans-serif';
    lg.innerHTML = `
      <span><span style="display:inline-block;width:12px;height:12px;background:var(--accent);vertical-align:middle;margin-right:4px"></span>${S.diag}</span>
      <span><span style="display:inline-block;width:12px;height:12px;background:#1f3a5c;vertical-align:middle;margin-right:4px"></span>${S.off}</span>
    `;
    root.appendChild(lg);

    // Zero-shot demo
    const zs = document.createElement('div');
    zs.style.cssText = 'margin-top:18px;padding:14px;background:var(--bg-frame-2);border-radius:6px';
    zs.innerHTML = `
      <div style="font-family:Inter,sans-serif;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:10px">${S.zero}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <div style="font-size:0.84rem;color:var(--text-soft)">${S.pickImg}</div>
        <div id="clip-imgs" style="display:flex;gap:8px"></div>
      </div>
      <div id="clip-scores" style="margin-top:14px"></div>
    `;
    root.appendChild(zs);

    const imgs = document.getElementById('clip-imgs');
    ITEMS.forEach((it, i) => {
      const b = document.createElement('button');
      b.textContent = it.glyph;
      b.style.cssText = `font-size:22px;padding:6px 10px;border:1.5px solid ${i===zeroIdx?'var(--accent)':'var(--border-strong)'};background:transparent;border-radius:5px;cursor:pointer`;
      b.onclick = () => { zeroIdx = i; render(); };
      imgs.appendChild(b);
    });

    // Scores bar chart
    const scores = M[zeroIdx];
    const sBox = document.getElementById('clip-scores');
    const total = scores.reduce((a,b) => a + Math.exp(b * 8), 0);
    const probs = scores.map(s => Math.exp(s * 8) / total);
    const winner = probs.indexOf(Math.max(...probs));

    ITEMS.forEach((it, j) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:160px 1fr 70px;gap:10px;align-items:center;margin:6px 0;font-family:JetBrains Mono,monospace;font-size:0.78rem';
      const isWin = j === winner;
      row.innerHTML = `
        <span style="color:${isWin?'var(--accent)':'var(--text-soft)'}">${getLang()==='zh'?it.zh:it.en}</span>
        <span style="height:14px;background:var(--bg-frame);border-radius:3px;overflow:hidden"><span style="display:block;height:100%;width:${(probs[j]*100).toFixed(1)}%;background:${isWin?'var(--accent)':'var(--accent-2)'};opacity:${isWin?1:0.5}"></span></span>
        <span style="text-align:right;color:${isWin?'var(--accent)':'var(--text-muted)'}">${(probs[j]*100).toFixed(1)}% ${isWin?'← '+S.winner:''}</span>
      `;
      sBox.appendChild(row);
    });

    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:12px;font-size:0.82rem;color:var(--text-muted);font-style:italic;max-width:64ch';
    cap.textContent = S.caption;
    root.appendChild(cap);
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__clipT); window.__clipT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

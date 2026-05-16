/* §21 — Long context: log-scale bar chart of context lengths over time,
 * plus a "needle in a haystack" mini-demo showing Lost-in-the-Middle U-shape.
 */
(function () {
  'use strict';

  const MODELS = [
    { year: 2017, name: 'Transformer',      ctx: 512,       fits: { en: 'a paragraph',           zh: '一段话' } },
    { year: 2019, name: 'GPT-2',            ctx: 1024,      fits: { en: 'a long tweet thread',   zh: '一条长推' } },
    { year: 2020, name: 'GPT-3',            ctx: 2048,      fits: { en: 'a short essay',         zh: '一篇短文' } },
    { year: 2022, name: 'GPT-3.5',          ctx: 4096,      fits: { en: 'a blog post',           zh: '一篇博客' } },
    { year: 2023, name: 'GPT-4',            ctx: 8192,      fits: { en: 'a research abstract',   zh: '一份摘要' } },
    { year: 2023, name: 'Claude 2',         ctx: 100000,    fits: { en: 'a short novel',         zh: '一本短篇小说' } },
    { year: 2023, name: 'GPT-4 Turbo',      ctx: 128000,    fits: { en: 'a book chapter',        zh: '一章书' } },
    { year: 2024, name: 'Gemini 1.5 Pro',   ctx: 1000000,   fits: { en: 'a textbook',            zh: '一本教科书' } },
    { year: 2025, name: 'Kimi K1.5',        ctx: 2000000,   fits: { en: 'Harry Potter series',   zh: '《哈利·波特》全集' } },
    { year: 2025, name: 'MiniMax-01',       ctx: 4000000,   fits: { en: 'many novels',           zh: '多本长篇' } },
    { year: 2024, name: 'Magic LTM-2',      ctx: 100000000, fits: { en: 'the Linux kernel',      zh: '整个 Linux 内核' } },
  ];

  const STR = {
    en: { title: 'Context window growth (log scale, tokens)', needle: 'Needle position in document', acc: 'Retrieval accuracy', lost: 'Lost in the Middle: accuracy dips when the relevant fact sits in the middle of the context.', hover: 'fits ~' },
    zh: { title: '上下文窗口增长 (对数刻度, token)', needle: '针在文档中的位置', acc: '检索准确率', lost: '中间迷失: 当关键事实位于上下文中部时, 准确率显著下降.', hover: '约可容纳 ' },
  };

  let needlePos = 50;
  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function render() {
    const root = document.getElementById('viz5-2');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Bar chart
    const W = root.clientWidth || 720;
    const H = 320;
    const margin = { top: 30, right: 16, bottom: 50, left: 60 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');
    svg.append('text').attr('x', margin.left).attr('y', 16)
      .style('font-family','Inter,sans-serif').style('font-size','12px')
      .style('fill','var(--text-soft)').text(S.title);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleBand().domain(MODELS.map((d,i) => i)).range([0, innerW]).padding(0.18);
    const y = d3.scaleLog().domain([300, 2e8]).range([innerH, 0]);

    // log gridlines
    [1e3, 1e4, 1e5, 1e6, 1e7, 1e8].forEach(t => {
      g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke','var(--border)').attr('stroke-width', 0.5);
      g.append('text').attr('x', -8).attr('y', y(t) + 4).attr('text-anchor','end')
        .style('font-size','10px').style('font-family','JetBrains Mono,monospace')
        .style('fill','var(--text-muted)').text(t >= 1e6 ? (t/1e6)+'M' : (t/1e3)+'K');
    });

    const bars = g.selectAll('.bar').data(MODELS).enter().append('rect')
      .attr('class','bar')
      .attr('x', (d,i) => x(i))
      .attr('width', x.bandwidth())
      .attr('y', innerH)
      .attr('height', 0)
      .attr('fill', (d,i) => i < 5 ? 'var(--accent-2)' : (i < 8 ? 'var(--accent)' : 'var(--accent-3)'))
      .style('cursor','pointer');

    bars.transition().duration(900).ease(d3.easeCubicOut)
      .attr('y', d => y(d.ctx))
      .attr('height', d => innerH - y(d.ctx));

    // Labels under bars
    g.selectAll('.lbl').data(MODELS).enter().append('text')
      .attr('class','lbl')
      .attr('x', (d,i) => x(i) + x.bandwidth()/2)
      .attr('y', innerH + 14)
      .attr('text-anchor','middle')
      .style('font-size','9.5px').style('font-family','Inter,sans-serif').style('fill','var(--text-soft)')
      .text(d => d.name);
    g.selectAll('.yr').data(MODELS).enter().append('text')
      .attr('x', (d,i) => x(i) + x.bandwidth()/2)
      .attr('y', innerH + 26)
      .attr('text-anchor','middle')
      .style('font-size','9px').style('font-family','JetBrains Mono,monospace').style('fill','var(--text-muted)')
      .text(d => d.year);

    // Tooltip
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;background:var(--bg-frame);border:1px solid var(--border-strong);padding:6px 9px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text);opacity:0;z-index:5;max-width:240px';
    root.style.position = 'relative';
    root.appendChild(tip);
    bars.on('mousemove', function (ev, d) {
        const rect = root.getBoundingClientRect();
        tip.style.opacity = 1;
        tip.style.left = (ev.clientX - rect.left + 10) + 'px';
        tip.style.top  = (ev.clientY - rect.top - 10) + 'px';
        const ctxStr = d.ctx >= 1e6 ? (d.ctx/1e6)+'M' : (d.ctx/1e3)+'K';
        tip.innerHTML = `<b>${d.name}</b> · ${d.year}<br>${ctxStr} tokens<br><span style="color:var(--text-soft)">${S.hover}${d.fits[getLang()]}</span>`;
      })
      .on('mouseleave', () => { tip.style.opacity = 0; });

    // --- Needle in haystack mini-demo ---
    const needle = document.createElement('div');
    needle.style.cssText = 'margin-top:20px;padding:16px;background:var(--bg-frame-2);border-radius:6px';
    needle.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-family:Inter,sans-serif;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft)">${S.needle}: <b style="color:var(--accent)">${needlePos}%</b></div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.84rem;color:var(--accent-2)">${S.acc}: <b id="needle-acc">…</b></div>
      </div>
      <input type="range" id="needle-pos" min="0" max="100" value="${needlePos}" style="width:100%">
      <div id="needle-bar" style="margin-top:12px;height:22px;display:flex;border-radius:4px;overflow:hidden;border:1px solid var(--border-strong)"></div>
      <div style="margin-top:10px;font-size:0.82rem;color:var(--text-muted);font-style:italic">${S.lost}</div>
    `;
    root.appendChild(needle);

    // build haystack visual
    const bar = document.getElementById('needle-bar');
    const SEG = 40;
    for (let i = 0; i < SEG; i++) {
      const seg = document.createElement('div');
      const isNeedle = Math.abs(i / (SEG - 1) * 100 - needlePos) < 100 / SEG / 2 + 1.5;
      seg.style.cssText = `flex:1;background:${isNeedle ? 'var(--accent)' : 'var(--mask)'};opacity:${isNeedle ? 1 : 0.45};border-right:1px solid var(--bg)`;
      bar.appendChild(seg);
    }

    // U-shape accuracy: high at edges, dip in middle
    const t = needlePos / 100;
    // f(t) ~ 0.95 - 0.5 * exp(-((t-0.5)/0.22)^2) — Lost-in-the-Middle inspired
    const acc = 0.95 - 0.55 * Math.exp(-Math.pow((t - 0.5) / 0.22, 2));
    document.getElementById('needle-acc').textContent = (acc * 100).toFixed(1) + '%';

    document.getElementById('needle-pos').addEventListener('input', e => { needlePos = +e.target.value; render(); });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__ctxT); window.__ctxT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

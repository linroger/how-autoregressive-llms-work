/* §26 — Agent loop with MCP tool registry
 * Left: animated LLM ↔ tools loop (5 iterations).
 * Right: MCP server registry; click a tool to see its schema.
 */
(function () {
  'use strict';

  const TRACE = [
    { thought: { en: 'I need the latest US CPI number.',                zh: '我需要最新的美国 CPI 数据.' },
      tool: 'web.search',
      args: 'query="latest US CPI release 2026"',
      obs:  { en: 'Top hit: BLS report — CPI April 2026: 3.2% YoY.',     zh: '首条命中: BLS 报告 — 2026 年 4 月 CPI 同比 +3.2%.' } },
    { thought: { en: 'Open the BLS report to verify.',                  zh: '打开 BLS 报告核实.' },
      tool: 'browser.open',
      args: 'url="bls.gov/cpi/2026-04"',
      obs:  { en: 'Page loaded. Headline: "CPI rose 3.2% YoY in April 2026."', zh: '页面已加载, 标题: "2026 年 4 月 CPI 同比 +3.2%".' } },
    { thought: { en: 'Compute real wage growth vs nominal +4.1%.',       zh: '相对名义 +4.1% 计算实际工资增长.' },
      tool: 'calculator',
      args: '(1.041 / 1.032 − 1) * 100',
      obs:  { en: '≈ 0.872%',                                            zh: '≈ 0.872%' } },
    { thought: { en: 'Save the finding to disk for later use.',          zh: '把结论写入磁盘备用.' },
      tool: 'filesystem.write',
      args: 'path="cpi_note.md", content="…"',
      obs:  { en: 'wrote 218 bytes',                                     zh: '已写入 218 字节' } },
    { thought: { en: 'I have enough info — compose the final answer.',   zh: '信息充分, 给出最终答案.' },
      tool: '__final__',
      args: '',
      obs:  { en: 'CPI rose 3.2% YoY (April 2026). Against nominal wage growth of 4.1%, real wages rose ~0.87%.', zh: '2026 年 4 月 CPI 同比 +3.2%; 名义工资 +4.1%, 实际工资约 +0.87%.' } },
  ];

  const SERVERS = [
    { name: 'Filesystem', icon: '📁', tools: [
      { n: 'filesystem.read',  s: '{ path: string } → { content: string }' },
      { n: 'filesystem.write', s: '{ path: string, content: string } → { bytes: int }' },
      { n: 'filesystem.list',  s: '{ dir: string } → { entries: string[] }' },
    ]},
    { name: 'Browser', icon: '🌐', tools: [
      { n: 'web.search',       s: '{ query: string } → { results: {title, url, snippet}[] }' },
      { n: 'browser.open',     s: '{ url: string } → { title: string, text: string }' },
    ]},
    { name: 'Calculator', icon: '🧮', tools: [
      { n: 'calculator',       s: '{ expr: string } → { value: number }' },
    ]},
    { name: 'Email', icon: '✉️', tools: [
      { n: 'email.send',       s: '{ to, subject, body } → { id: string }' },
      { n: 'email.search',     s: '{ query: string } → { messages: object[] }' },
    ]},
  ];

  const STR = {
    en: { title: 'Agent loop (LLM ↔ tools via MCP)', play: '▶ run', reset: '↺', think: 'thought', call: 'tool call', obs: 'observation', final: 'final answer', registry: 'MCP server registry', clickTool: 'Click a tool to see schema', caption: 'Each iteration: LLM emits a tool call, the MCP server returns an observation, and the LLM keeps reasoning. MCP standardises how external tools expose themselves to any compliant agent.' },
    zh: { title: 'Agent 循环 (LLM ↔ MCP 工具)', play: '▶ 运行', reset: '↺', think: '思考', call: '工具调用', obs: '观察', final: '最终答案', registry: 'MCP 服务器目录', clickTool: '点击工具查看 schema', caption: '每一轮: LLM 发出工具调用, MCP 服务器返回观察, LLM 继续推理. MCP 把外部工具暴露给任意智能体的接口统一化.' },
  };

  let step = 0;
  let timer = null;
  let selectedTool = null;

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function render() {
    const root = document.getElementById('viz6-3');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Layout: two columns
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:1fr 320px;gap:18px';
    if ((root.clientWidth || 800) < 720) wrap.style.gridTemplateColumns = '1fr';
    root.appendChild(wrap);

    // Left: loop
    const left = document.createElement('div');
    left.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em">${S.title}</div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="ag-play">${S.play}</button>
          <button class="btn btn-ghost" id="ag-reset">${S.reset}</button>
        </div>
      </div>
      <div id="ag-trace"></div>
    `;
    wrap.appendChild(left);

    const trace = left.querySelector('#ag-trace');
    TRACE.forEach((t, i) => {
      const visible = i <= step;
      const final = t.tool === '__final__';
      const card = document.createElement('div');
      card.style.cssText = `margin:8px 0;padding:11px 12px;background:var(--bg-frame-2);border-radius:6px;border-left:3px solid ${final?'var(--accent-4)':'var(--accent)'};opacity:${visible?1:0.18};transition:opacity .35s`;
      card.innerHTML = `
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:4px">iter ${i+1} · ${S.think}</div>
        <div style="font-family:Inter,sans-serif;font-size:0.88rem;color:var(--text);margin-bottom:6px">${t.thought[getLang()]}</div>
        ${final ? `
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-4);margin-top:6px">${S.final}</div>
          <div style="font-family:Inter,sans-serif;font-size:0.88rem;color:var(--text)">${t.obs[getLang()]}</div>
        ` : `
          <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--accent)">→ ${t.tool}(${t.args})</div>
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-top:6px">${S.obs}</div>
          <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--accent-2)">${t.obs[getLang()]}</div>
        `}
      `;
      trace.appendChild(card);
    });

    // Right: MCP registry
    const right = document.createElement('div');
    right.innerHTML = `
      <div style="font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${S.registry}</div>
    `;
    wrap.appendChild(right);
    SERVERS.forEach(srv => {
      const box = document.createElement('div');
      box.style.cssText = 'margin-bottom:10px;padding:10px;background:var(--bg-frame);border:1px solid var(--border-strong);border-radius:5px';
      box.innerHTML = `<div style="font-family:Inter,sans-serif;font-size:0.82rem;color:var(--text);margin-bottom:6px">${srv.icon} <b>${srv.name}</b> <span style="color:var(--accent-4);font-size:0.72rem">● online</span></div>`;
      srv.tools.forEach(t => {
        const tEl = document.createElement('div');
        const sel = selectedTool && selectedTool.n === t.n;
        tEl.style.cssText = `margin:3px 0;padding:4px 7px;font-family:JetBrains Mono,monospace;font-size:0.74rem;color:${sel?'var(--accent)':'var(--text-soft)'};background:${sel?'var(--bg-frame-2)':'transparent'};border-radius:3px;cursor:pointer`;
        tEl.textContent = t.n;
        tEl.onclick = () => { selectedTool = t; render(); };
        box.appendChild(tEl);
      });
      right.appendChild(box);
    });

    // Schema panel
    const sch = document.createElement('div');
    sch.style.cssText = 'margin-top:10px;padding:10px;background:var(--bg-frame-2);border-radius:5px;font-family:JetBrains Mono,monospace;font-size:0.74rem;color:var(--text);min-height:60px';
    if (selectedTool) {
      sch.innerHTML = `<div style="color:var(--accent);margin-bottom:4px">${selectedTool.n}</div><div style="color:var(--text-soft)">${selectedTool.s}</div>`;
    } else {
      sch.innerHTML = `<span style="color:var(--text-muted);font-style:italic">${S.clickTool}</span>`;
    }
    right.appendChild(sch);

    // Caption
    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:14px;font-size:0.82rem;color:var(--text-muted);font-style:italic;max-width:74ch';
    cap.textContent = S.caption;
    root.appendChild(cap);

    document.getElementById('ag-play').addEventListener('click', play);
    document.getElementById('ag-reset').addEventListener('click', () => { if (timer) clearInterval(timer); step = 0; render(); });
  }

  function play() {
    if (timer) clearInterval(timer);
    step = 0; render();
    timer = setInterval(() => {
      step++;
      render();
      if (step >= TRACE.length - 1) { clearInterval(timer); timer = null; }
    }, 900);
  }

  function init() {
    step = TRACE.length - 1;
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__agT); window.__agT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

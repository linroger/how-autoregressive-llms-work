/* §27 — Master timeline of LLM milestones 2017→2026
 * Horizontal dot-plot, colored by lab; filter by lab + capability.
 * Hover for name + 1-line description.
 */
(function () {
  'use strict';

  // [date, name, lab, capability, en, zh]
  // capability ∈ architecture | scaling | alignment | reasoning | multimodal | efficiency | agent
  const M = [
    { d: '2017-06', name: 'Transformer',     lab: 'Google',    cap: 'architecture', en: 'Attention Is All You Need — the architecture under everything.', zh: '《Attention Is All You Need》— 一切的底座.' },
    { d: '2018-06', name: 'GPT-1',           lab: 'OpenAI',    cap: 'scaling',      en: 'First decoder-only generative pretraining at scale.', zh: '首个大规模 decoder-only 生成预训练.' },
    { d: '2018-10', name: 'BERT',            lab: 'Google',    cap: 'architecture', en: 'Bidirectional encoder pretraining; dominated NLP benchmarks.', zh: '双向 encoder 预训练; 横扫 NLP 榜单.' },
    { d: '2019-02', name: 'GPT-2',           lab: 'OpenAI',    cap: 'scaling',      en: '1.5B params — "too dangerous to release".', zh: '1.5B 参数 — 当年"太危险无法发布".' },
    { d: '2019-10', name: 'T5',              lab: 'Google',    cap: 'architecture', en: 'Text-to-text framing of every NLP task.', zh: '把所有 NLP 任务统一为 text-to-text.' },
    { d: '2020-01', name: 'Kaplan scaling',  lab: 'OpenAI',    cap: 'scaling',      en: 'Power-law scaling of loss with N, D, C.', zh: 'Loss 关于 N、D、C 的幂律.' },
    { d: '2020-05', name: 'GPT-3',           lab: 'OpenAI',    cap: 'scaling',      en: '175B params; in-context learning emerges.', zh: '175B 参数; in-context learning 涌现.' },
    { d: '2020-09', name: 'RAG',             lab: 'Meta',      cap: 'agent',        en: 'Retrieval-augmented generation paper.', zh: '检索增强生成论文.' },
    { d: '2021-04', name: 'RoPE',            lab: 'Misc',      cap: 'architecture', en: 'Rotary position embeddings — the de-facto PE standard.', zh: '旋转位置编码 — 事实标准.' },
    { d: '2022-01', name: 'CoT prompting',   lab: 'Google',    cap: 'reasoning',    en: '"Let\'s think step by step" unlocks reasoning.', zh: '"逐步思考" 解锁推理.' },
    { d: '2022-03', name: 'InstructGPT',     lab: 'OpenAI',    cap: 'alignment',    en: 'RLHF aligns base models with human preferences.', zh: 'RLHF 让基模对齐人类偏好.' },
    { d: '2022-03', name: 'Chinchilla',      lab: 'DeepMind',  cap: 'scaling',      en: 'Compute-optimal scaling: 20 tokens per parameter.', zh: '算力最优: 每参数 20 token.' },
    { d: '2022-04', name: 'PaLM',            lab: 'Google',    cap: 'scaling',      en: '540B-param dense model; pathways infra.', zh: '540B 稠密模型; pathways 基础设施.' },
    { d: '2022-05', name: 'FlashAttention',  lab: 'Stanford',  cap: 'efficiency',   en: 'IO-aware exact attention kernel.', zh: 'IO-aware 精确注意力核.' },
    { d: '2022-11', name: 'ChatGPT',         lab: 'OpenAI',    cap: 'alignment',    en: 'The interface that changed everything.', zh: '改变一切的产品形态.' },
    { d: '2023-02', name: 'LLaMA',           lab: 'Meta',      cap: 'scaling',      en: 'Open weights of a competitive 7–65B family.', zh: '开放权重的 7–65B 竞品家族.' },
    { d: '2023-03', name: 'GPT-4',           lab: 'OpenAI',    cap: 'scaling',      en: 'Multimodal frontier; sets the bar.', zh: '多模态前沿; 定调.' },
    { d: '2023-07', name: 'LLaMA 2',         lab: 'Meta',      cap: 'scaling',      en: 'Open-weights with permissive license.', zh: '宽松许可的开权重.' },
    { d: '2023-07', name: 'Claude 2',        lab: 'Anthropic', cap: 'scaling',      en: '100K context — long-doc breakthrough.', zh: '10 万上下文 — 长文档突破.' },
    { d: '2023-09', name: 'Mistral 7B',      lab: 'Mistral',   cap: 'efficiency',   en: 'Best small open model of its time.', zh: '同期最佳小型开模.' },
    { d: '2023-09', name: 'GPT-4V',          lab: 'OpenAI',    cap: 'multimodal',   en: 'GPT-4 with vision.', zh: '带视觉的 GPT-4.' },
    { d: '2023-12', name: 'Gemini 1',        lab: 'Google',    cap: 'multimodal',   en: 'Natively multimodal frontier family.', zh: '原生多模态前沿模型族.' },
    { d: '2023-12', name: 'Mixtral 8×7B',    lab: 'Mistral',   cap: 'efficiency',   en: 'Sparse MoE open weights.', zh: '稀疏 MoE 开权重.' },
    { d: '2023-12', name: 'Mamba',           lab: 'CMU',       cap: 'architecture', en: 'Selective state-space sequence model.', zh: '选择性状态空间序列模型.' },
    { d: '2023-12', name: 'DPO',             lab: 'Stanford',  cap: 'alignment',    en: 'Direct preference optimization replaces RLHF.', zh: '直接偏好优化, 简化 RLHF.' },
    { d: '2024-02', name: 'Gemini 1.5 Pro',  lab: 'Google',    cap: 'scaling',      en: '1M-token context.', zh: '一百万 token 上下文.' },
    { d: '2024-03', name: 'Claude 3',        lab: 'Anthropic', cap: 'scaling',      en: 'Opus / Sonnet / Haiku family.', zh: 'Opus / Sonnet / Haiku 三件套.' },
    { d: '2024-04', name: 'LLaMA 3',         lab: 'Meta',      cap: 'scaling',      en: '8B / 70B / 405B open weights.', zh: '8B / 70B / 405B 开权重.' },
    { d: '2024-05', name: 'GPT-4o',          lab: 'OpenAI',    cap: 'multimodal',   en: 'Omnimodal real-time voice/vision.', zh: '实时全模态语音视觉.' },
    { d: '2024-09', name: 'o1',              lab: 'OpenAI',    cap: 'reasoning',    en: 'Test-time chain-of-thought as a product.', zh: '把测试时推理做成产品.' },
    { d: '2024-11', name: 'MCP',             lab: 'Anthropic', cap: 'agent',        en: 'Model Context Protocol — standard tool interface.', zh: '模型上下文协议 — 工具接口标准.' },
    { d: '2024-12', name: 'DeepSeek V3',     lab: 'DeepSeek',  cap: 'efficiency',   en: '671B MoE trained for ~$6M.', zh: '671B MoE, 训练成本约 600 万美元.' },
    { d: '2025-01', name: 'DeepSeek R1',     lab: 'DeepSeek',  cap: 'reasoning',    en: 'Open-weights reasoning model rivaling o1.', zh: '开权重推理模型, 与 o1 同台.' },
    { d: '2025-01', name: 'Kimi K1.5',       lab: 'Moonshot',  cap: 'reasoning',    en: 'Long-CoT RL with 2M context.', zh: '长 CoT 强化学习, 200 万上下文.' },
    { d: '2025-01', name: 'MiniMax-01',      lab: 'MiniMax',   cap: 'scaling',      en: '4M context, lightning attention.', zh: '400 万上下文, lightning attention.' },
    { d: '2025-02', name: 'Claude 3.7',      lab: 'Anthropic', cap: 'reasoning',    en: 'Extended thinking mode.', zh: '扩展思考模式.' },
    { d: '2025-02', name: 'GPT-4.5',         lab: 'OpenAI',    cap: 'scaling',      en: 'Largest pretraining update.', zh: '最大规模预训练更新.' },
    { d: '2025-04', name: 'o3',              lab: 'OpenAI',    cap: 'reasoning',    en: 'Frontier reasoning model.', zh: '前沿推理模型.' },
    { d: '2025-04', name: 'Llama 4',         lab: 'Meta',      cap: 'multimodal',   en: 'Open-weights MoE multimodal family.', zh: '开权重 MoE 多模态家族.' },
    { d: '2025-05', name: 'Claude 4',        lab: 'Anthropic', cap: 'agent',        en: 'Agentic coding leap.', zh: '智能体式编程飞跃.' },
    { d: '2025-08', name: 'GPT-5',           lab: 'OpenAI',    cap: 'scaling',      en: 'Unified reasoning + chat frontier.', zh: '统一推理 + 对话的前沿.' },
    { d: '2025-11', name: 'Gemini 3',        lab: 'Google',    cap: 'multimodal',   en: 'Native video understanding at scale.', zh: '大规模原生视频理解.' },
    { d: '2026-04', name: 'Claude Opus 4.7', lab: 'Anthropic', cap: 'agent',        en: 'Long-horizon autonomous agents.', zh: '长程自主智能体.' },
  ];

  const LAB_COLOR = {
    'OpenAI':    '#10a37f',
    'Anthropic': '#c96442',
    'Google':    '#4285f4',
    'DeepMind':  '#1e88e5',
    'Meta':      '#0866ff',
    'DeepSeek':  '#4d6bfe',
    'Mistral':   '#ff7000',
    'Moonshot':  '#7c3aed',
    'MiniMax':   '#06b6d4',
    'Stanford':  '#8c1515',
    'CMU':       '#c41230',
    'Misc':      '#a9a8a3',
  };
  const CAPS = ['architecture','scaling','alignment','reasoning','multimodal','efficiency','agent'];

  const STR = {
    en: { title: 'Major LLM milestones (2017–2026)', lab: 'Lab', cap: 'Capability', all: 'all', caption: 'Hover any dot for details. Filter by lab or capability above. The journey of nine years: one architecture, four leaps in scale, two paradigm shifts in alignment and reasoning, and the dawn of agents.' },
    zh: { title: 'LLM 主要里程碑 (2017–2026)', lab: '实验室', cap: '能力', all: '全部', caption: '悬停查看细节. 上方按实验室或能力过滤. 九年历程: 一个架构, 四次规模跃迁, 对齐与推理两次范式转变, 以及 agent 的黎明.' },
  };

  let filterLab = 'all';
  let filterCap = 'all';

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }
  function parseDate(s) { const [y,m] = s.split('-'); return new Date(+y, +m - 1, 15); }

  function render() {
    const root = document.getElementById('viz6-4');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Title
    const t = document.createElement('div');
    t.style.cssText = 'font-family:Inter,sans-serif;font-size:0.92rem;color:var(--text);margin-bottom:12px';
    t.textContent = S.title;
    root.appendChild(t);

    // Filters
    const labs = ['all', ...Object.keys(LAB_COLOR)];
    const filt = document.createElement('div');
    filt.style.cssText = 'display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:14px';
    filt.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span style="font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-right:4px">${S.lab}</span>
        ${labs.map(l => `<button class="tl-lab" data-l="${l}" style="padding:3px 9px;font-size:0.74rem;border-radius:11px;cursor:pointer;font-family:Inter,sans-serif;border:1px solid ${filterLab===l?(LAB_COLOR[l]||'var(--accent)'):'var(--border-strong)'};background:${filterLab===l?(LAB_COLOR[l]||'var(--accent)'):'transparent'};color:${filterLab===l?'#fff':'var(--text-soft)'}">${l==='all'?S.all:l}</button>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span style="font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-right:4px">${S.cap}</span>
        ${['all', ...CAPS].map(c => `<button class="tl-cap" data-c="${c}" style="padding:3px 9px;font-size:0.74rem;border-radius:11px;cursor:pointer;font-family:Inter,sans-serif;border:1px solid ${filterCap===c?'var(--accent)':'var(--border-strong)'};background:${filterCap===c?'var(--accent)':'transparent'};color:${filterCap===c?'#fff':'var(--text-soft)'}">${c==='all'?S.all:c}</button>`).join('')}
      </div>
    `;
    root.appendChild(filt);

    // SVG timeline
    const W = root.clientWidth || 760;
    const H = 280;
    const margin = { top: 30, right: 16, bottom: 36, left: 30 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');
    const g = svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain([new Date(2017,0,1), new Date(2026,11,31)])
      .range([0, innerW]);
    g.append('g').attr('transform',`translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y')))
      .selectAll('text').style('fill','var(--text-soft)').style('font-family','JetBrains Mono,monospace').style('font-size','11px');
    g.selectAll('.domain, .tick line').style('stroke','var(--border)');

    // Center axis line
    g.append('line').attr('x1',0).attr('x2', innerW).attr('y1', innerH/2).attr('y2', innerH/2)
      .attr('stroke','var(--border-strong)').attr('stroke-width',1);

    // Compute lane y positions with simple collision: alternate above/below, push out if dense
    const items = M.map(d => ({ ...d, date: parseDate(d.d) }))
      .filter(d => (filterLab === 'all' || d.lab === filterLab))
      .filter(d => (filterCap === 'all' || d.cap === filterCap))
      .sort((a,b) => a.date - b.date);

    // Lane assignment
    const lanes = []; // {lastX, yOff}
    items.forEach((it, i) => {
      const xv = x(it.date);
      let placed = false;
      for (const ln of lanes) {
        if (xv - ln.lastX > 38 && ln.yOff !== 0) { ln.lastX = xv; it.yOff = ln.yOff; placed = true; break; }
      }
      if (!placed) {
        const side = lanes.length % 2 === 0 ? -1 : 1;
        const dist = 1 + Math.floor(lanes.length / 2);
        it.yOff = side * (24 + dist * 18);
        lanes.push({ lastX: xv, yOff: it.yOff });
      }
    });

    // Tooltip
    root.style.position = 'relative';
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;background:var(--bg-frame);border:1px solid var(--border-strong);padding:8px 10px;border-radius:5px;font-family:Inter,sans-serif;font-size:0.78rem;color:var(--text);opacity:0;max-width:280px;z-index:10';
    root.appendChild(tip);

    items.forEach(it => {
      const xv = x(it.date);
      const yv = innerH / 2 + it.yOff;
      g.append('line').attr('x1', xv).attr('x2', xv).attr('y1', innerH/2).attr('y2', yv)
        .attr('stroke', LAB_COLOR[it.lab] || 'var(--text-muted)').attr('stroke-width', 0.6).attr('opacity', 0.5);
      const dot = g.append('circle').attr('cx', xv).attr('cy', yv).attr('r', 5)
        .attr('fill', LAB_COLOR[it.lab] || 'var(--text-muted)')
        .attr('stroke','var(--bg)').attr('stroke-width', 1).style('cursor','pointer');
      g.append('text').attr('x', xv + 7).attr('y', yv + 4)
        .style('font-family','Inter,sans-serif').style('font-size','9.5px')
        .style('fill','var(--text-soft)').text(it.name);

      dot.on('mousemove', function (ev) {
          const rect = root.getBoundingClientRect();
          tip.style.opacity = 1;
          tip.style.left = (ev.clientX - rect.left + 10) + 'px';
          tip.style.top  = (ev.clientY - rect.top - 10) + 'px';
          tip.innerHTML = `<div style="color:${LAB_COLOR[it.lab]};font-family:JetBrains Mono,monospace;font-size:0.74rem;text-transform:uppercase;letter-spacing:0.06em">${it.lab} · ${it.cap} · ${it.d}</div>
            <div style="font-weight:600;margin-top:2px">${it.name}</div>
            <div style="color:var(--text-soft);margin-top:2px">${getLang()==='zh'?it.zh:it.en}</div>`;
        })
        .on('mouseleave', () => { tip.style.opacity = 0; });
    });

    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:12px;font-size:0.82rem;color:var(--text-muted);font-style:italic;max-width:74ch';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // Wire
    root.querySelectorAll('.tl-lab').forEach(b => b.addEventListener('click', e => { filterLab = e.currentTarget.dataset.l; render(); }));
    root.querySelectorAll('.tl-cap').forEach(b => b.addEventListener('click', e => { filterCap = e.currentTarget.dataset.c; render(); }));
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__tlT); window.__tlT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

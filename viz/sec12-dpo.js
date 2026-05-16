/* §12 — DPO derivation walk: step through the algebra collapsing RLHF into a classification loss */
(function () {
  'use strict';

  let step = 0;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        title: 'DPO 推导：从 RLHF 到一个分类损失',
        steps: [
          {
            label: '第 1 步 · KL 约束下的最优策略',
            math: '$$\\pi^*(y \\mid x) \\;=\\; \\frac{1}{Z(x)} \\, \\pi_{\\text{ref}}(y \\mid x) \\, \\exp\\!\\Big(\\tfrac{1}{\\beta} \\, r(x, y)\\Big)$$',
            side: '从 RLHF 目标 $\\mathbb{E}[r] - \\beta D_{KL}$ 出发，对 $\\pi$ 求闭式解。结果：最优策略是参考策略的指数倾斜（exponential tilting），由奖励决定。$Z(x)$ 是归一化常数。',
          },
          {
            label: '第 2 步 · 反解：把 r 写成对数比',
            math: '$$r(x, y) \\;=\\; \\beta \\, \\log \\frac{\\pi^*(y \\mid x)}{\\pi_{\\text{ref}}(y \\mid x)} \\;+\\; \\beta \\log Z(x)$$',
            side: '关键代数动作：奖励函数可以从最优策略中“读出”。这意味着 — 我们不必单独训练奖励模型 — 任何最优策略本身就是一个隐式奖励模型。',
          },
          {
            label: '第 3 步 · 代入 Bradley-Terry，Z(x) 抵消',
            math: '$$P(y_w \\succ y_l \\mid x) \\;=\\; \\sigma\\!\\Big(\\,\\beta \\log \\tfrac{\\pi^*(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} \\;-\\; \\beta \\log \\tfrac{\\pi^*(y_l|x)}{\\pi_{\\text{ref}}(y_l|x)} \\,\\Big)$$',
            side: '把第 2 步代入 Bradley-Terry $\\sigma(r_w - r_l)$。两边的 $\\beta \\log Z(x)$ 完全相同 — 因此抵消！奖励模型整个消失了。',
          },
          {
            label: '第 4 步 · DPO 损失',
            math: '$$\\mathcal{L}_{\\text{DPO}}(\\theta) \\;=\\; -\\,\\mathbb{E}_{(x, y_w, y_l)}\\!\\left[ \\log \\sigma\\!\\Big( \\beta \\log \\tfrac{\\pi_\\theta(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} - \\beta \\log \\tfrac{\\pi_\\theta(y_l|x)}{\\pi_{\\text{ref}}(y_l|x)} \\Big) \\right]$$',
            side: '把 $\\pi^*$ 换成可学习的 $\\pi_\\theta$。这就是 DPO：用偏好数据直接训练策略，不需要奖励模型、不需要 PPO、不需要采样。一个简单的二元分类损失。',
          },
        ],
        prev: '← 上一步',
        next: '下一步 →',
        reset: '↺ 重置',
      };
    }
    return {
      title: 'DPO derivation: from RLHF to a single classification loss',
      steps: [
        {
          label: 'Step 1 · Optimal policy under the KL constraint',
          math: '$$\\pi^*(y \\mid x) \\;=\\; \\frac{1}{Z(x)} \\, \\pi_{\\text{ref}}(y \\mid x) \\, \\exp\\!\\Big(\\tfrac{1}{\\beta} \\, r(x, y)\\Big)$$',
          side: 'Starting from the RLHF objective $\\mathbb{E}[r] - \\beta D_{KL}$, solve in closed form for $\\pi$. The optimal policy is an exponential tilting of the reference policy by reward. $Z(x)$ is a normalizer.',
        },
        {
          label: 'Step 2 · Invert: write r as a log-ratio',
          math: '$$r(x, y) \\;=\\; \\beta \\, \\log \\frac{\\pi^*(y \\mid x)}{\\pi_{\\text{ref}}(y \\mid x)} \\;+\\; \\beta \\log Z(x)$$',
          side: 'The key algebraic move: the reward function can be read off from the optimal policy. We never needed to train a reward model separately — any optimal policy is an implicit reward model.',
        },
        {
          label: 'Step 3 · Substitute into Bradley-Terry, watch Z(x) cancel',
          math: '$$P(y_w \\succ y_l \\mid x) \\;=\\; \\sigma\\!\\Big(\\,\\beta \\log \\tfrac{\\pi^*(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} \\;-\\; \\beta \\log \\tfrac{\\pi^*(y_l|x)}{\\pi_{\\text{ref}}(y_l|x)} \\,\\Big)$$',
          side: 'Plug Step 2 into Bradley-Terry $\\sigma(r_w - r_l)$. The $\\beta \\log Z(x)$ terms on both sides are identical — they cancel! The reward model vanishes entirely from the equation.',
        },
        {
          label: 'Step 4 · DPO loss',
          math: '$$\\mathcal{L}_{\\text{DPO}}(\\theta) \\;=\\; -\\,\\mathbb{E}_{(x, y_w, y_l)}\\!\\left[ \\log \\sigma\\!\\Big( \\beta \\log \\tfrac{\\pi_\\theta(y_w|x)}{\\pi_{\\text{ref}}(y_w|x)} - \\beta \\log \\tfrac{\\pi_\\theta(y_l|x)}{\\pi_{\\text{ref}}(y_l|x)} \\Big) \\right]$$',
          side: 'Replace $\\pi^*$ with a trainable $\\pi_\\theta$. That is DPO: directly train the policy from preference data — no reward model, no PPO, no sampling. Just a binary classification loss.',
        },
      ],
      prev: '← Prev',
      next: 'Next →',
      reset: '↺ Reset',
    };
  }

  function render() {
    const container = document.getElementById('viz3-2');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    // Stepper dots
    const dots = document.createElement('div');
    dots.style.display = 'flex';
    dots.style.gap = '6px';
    dots.style.marginBottom = '14px';
    L.steps.forEach((_, i) => {
      const d = document.createElement('div');
      d.style.flex = '1';
      d.style.height = '3px';
      d.style.borderRadius = '2px';
      d.style.background = i <= step ? 'var(--accent)' : 'var(--border-strong)';
      d.style.transition = 'background 300ms';
      dots.appendChild(d);
    });
    container.appendChild(dots);

    const label = document.createElement('div');
    label.style.fontFamily = 'JetBrains Mono, monospace';
    label.style.fontSize = '0.82rem';
    label.style.color = 'var(--accent)';
    label.style.letterSpacing = '0.04em';
    label.style.marginBottom = '10px';
    label.textContent = L.steps[step].label;
    container.appendChild(label);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'minmax(0, 1.55fr) minmax(0, 1fr)';
    grid.style.gap = '16px';
    grid.style.alignItems = 'start';
    container.appendChild(grid);

    // Math block — animated
    const mathBox = document.createElement('div');
    mathBox.style.background = 'var(--bg-frame-2)';
    mathBox.style.border = '1px solid var(--border-strong)';
    mathBox.style.borderRadius = '6px';
    mathBox.style.padding = '24px 18px';
    mathBox.style.minHeight = '160px';
    mathBox.style.overflowX = 'auto';
    mathBox.style.fontSize = '1.02rem';
    mathBox.style.color = 'var(--text)';
    mathBox.style.opacity = '0';
    mathBox.style.transform = 'translateY(8px)';
    mathBox.style.transition = 'opacity 380ms ease, transform 380ms ease';
    mathBox.innerHTML = L.steps[step].math;
    grid.appendChild(mathBox);

    const side = document.createElement('div');
    side.style.background = 'var(--bg-frame)';
    side.style.borderLeft = '3px solid var(--accent-2)';
    side.style.borderRadius = '0 4px 4px 0';
    side.style.padding = '14px 16px';
    side.style.fontFamily = 'Inter, sans-serif';
    side.style.fontSize = '0.88rem';
    side.style.lineHeight = '1.55';
    side.style.color = 'var(--text-soft)';
    side.style.opacity = '0';
    side.style.transform = 'translateY(8px)';
    side.style.transition = 'opacity 380ms ease 120ms, transform 380ms ease 120ms';
    side.innerHTML = L.steps[step].side;
    grid.appendChild(side);

    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(mathBox, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
        window.renderMathInElement(side, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
      } catch (e) {}
    }
    requestAnimationFrame(() => {
      mathBox.style.opacity = '1';
      mathBox.style.transform = 'translateY(0)';
      side.style.opacity = '1';
      side.style.transform = 'translateY(0)';
    });

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '14px';
    actions.style.justifyContent = 'space-between';
    actions.innerHTML = `
      <button class="btn btn-ghost" id="dpo-prev" ${step === 0 ? 'disabled' : ''}>${L.prev}</button>
      <div style="font-family:JetBrains Mono,monospace;font-size:0.78rem;color:var(--text-muted);align-self:center">${step + 1} / ${L.steps.length}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="dpo-reset">${L.reset}</button>
        <button class="btn" id="dpo-next" ${step === L.steps.length - 1 ? 'disabled' : ''}>${L.next}</button>
      </div>
    `;
    container.appendChild(actions);

    document.getElementById('dpo-prev')?.addEventListener('click', () => { if (step > 0) { step--; render(); } });
    document.getElementById('dpo-next')?.addEventListener('click', () => { if (step < L.steps.length - 1) { step++; render(); } });
    document.getElementById('dpo-reset')?.addEventListener('click', () => { step = 0; render(); });
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

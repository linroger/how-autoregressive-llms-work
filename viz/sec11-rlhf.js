/* §11 — RLHF: SFT → Reward Model → PPO pipeline with click-to-expand stages */
(function () {
  'use strict';

  let active = 0;

  function t() {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    if (lang === 'zh') {
      return {
        title: 'RLHF 三阶段流水线',
        stages: [
          {
            tag: '① SFT',
            short: '监督微调',
            blurb: '从人类示范数据出发',
            detail: '收集（prompt → 高质量回答）对。在预训练 LLM 上以标准交叉熵损失进行微调，得到 $\\pi_{\\text{SFT}}$。这是后续步骤的参考策略。',
            color: 'var(--accent-2)',
          },
          {
            tag: '② RM',
            short: '奖励模型',
            blurb: '从偏好对训练 Bradley-Terry 模型',
            detail: '标注者比较两条回答 $y_w \\succ y_l$。训练一个标量奖励头 $r_\\phi(x, y)$，最小化负对数似然 $-\\log \\sigma(r(y_w) - r(y_l))$（Bradley-Terry）：$P(y_w \\succ y_l \\mid x) = \\sigma\\!\\big(r_\\phi(x, y_w) - r_\\phi(x, y_l)\\big)$。',
            color: 'var(--accent-3)',
          },
          {
            tag: '③ PPO',
            short: '带 KL 惩罚的 PPO',
            blurb: '最大化奖励，同时不要走远',
            detail: '用 PPO 微调策略 $\\pi_\\theta$，目标为 $\\max_\\theta \\; \\mathbb{E}_{x \\sim \\mathcal{D},\\, y \\sim \\pi_\\theta}\\big[r_\\phi(x, y)\\big] - \\beta \\, D_{KL}\\!\\big(\\pi_\\theta(\\cdot|x) \\,\\|\\, \\pi_{\\text{ref}}(\\cdot|x)\\big)$。KL 惩罚把策略锚定在 $\\pi_{\\text{SFT}}$ 附近，防止奖励黑客与模式崩溃。',
            color: 'var(--accent)',
          },
        ],
        hint: '点击任一阶段展开数学细节',
      };
    }
    return {
      title: 'RLHF three-stage pipeline',
      stages: [
        {
          tag: '① SFT',
          short: 'Supervised finetune',
          blurb: 'Start from human demonstrations',
          detail: 'Collect (prompt → high-quality response) pairs. Finetune the pretrained LLM with standard cross-entropy to get $\\pi_{\\text{SFT}}$. This becomes the reference policy for later stages.',
          color: 'var(--accent-2)',
        },
        {
          tag: '② RM',
          short: 'Reward model',
          blurb: 'Bradley-Terry on preference pairs',
          detail: 'Annotators compare two responses, $y_w \\succ y_l$. Train a scalar reward head $r_\\phi(x, y)$ minimizing $-\\log \\sigma(r(y_w) - r(y_l))$ (Bradley-Terry): $P(y_w \\succ y_l \\mid x) = \\sigma\\!\\big(r_\\phi(x, y_w) - r_\\phi(x, y_l)\\big)$.',
          color: 'var(--accent-3)',
        },
        {
          tag: '③ PPO',
          short: 'PPO with KL penalty',
          blurb: 'Maximize reward, stay near reference',
          detail: 'Finetune $\\pi_\\theta$ with PPO to maximize $\\mathbb{E}_{x \\sim \\mathcal{D},\\, y \\sim \\pi_\\theta}\\big[r_\\phi(x, y)\\big] - \\beta \\, D_{KL}\\!\\big(\\pi_\\theta(\\cdot|x) \\,\\|\\, \\pi_{\\text{ref}}(\\cdot|x)\\big)$. The KL penalty anchors the policy near $\\pi_{\\text{SFT}}$, preventing reward hacking and mode collapse.',
          color: 'var(--accent)',
        },
      ],
      hint: 'Click any stage to expand the math',
    };
  }

  function render() {
    const container = document.getElementById('viz3-1');
    if (!container) return;
    container.innerHTML = '';
    const L = t();

    const hint = document.createElement('div');
    hint.style.fontFamily = 'Inter, sans-serif';
    hint.style.fontSize = '0.78rem';
    hint.style.color = 'var(--text-muted)';
    hint.style.marginBottom = '12px';
    hint.textContent = L.hint;
    container.appendChild(hint);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    row.style.gap = '12px';
    row.style.position = 'relative';

    L.stages.forEach((s, i) => {
      const card = document.createElement('div');
      card.style.cursor = 'pointer';
      card.style.padding = '14px';
      card.style.borderRadius = '6px';
      card.style.background = 'var(--bg-frame-2)';
      card.style.border = '1.5px solid ' + (i === active ? s.color : 'var(--border-strong)');
      card.style.transition = 'border-color 200ms, transform 200ms';
      card.style.position = 'relative';

      const tag = document.createElement('div');
      tag.style.fontFamily = 'JetBrains Mono, monospace';
      tag.style.fontSize = '0.74rem';
      tag.style.color = s.color;
      tag.style.letterSpacing = '0.08em';
      tag.style.marginBottom = '6px';
      tag.textContent = s.tag;
      card.appendChild(tag);

      const title = document.createElement('div');
      title.style.fontFamily = 'Inter, sans-serif';
      title.style.fontSize = '1rem';
      title.style.fontWeight = '600';
      title.style.color = 'var(--text)';
      title.style.marginBottom = '4px';
      title.textContent = s.short;
      card.appendChild(title);

      const blurb = document.createElement('div');
      blurb.style.fontFamily = 'Inter, sans-serif';
      blurb.style.fontSize = '0.8rem';
      blurb.style.color = 'var(--text-soft)';
      blurb.textContent = s.blurb;
      card.appendChild(blurb);

      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; });
      card.addEventListener('click', () => { active = i; render(); });

      row.appendChild(card);

      if (i < L.stages.length - 1) {
        const arrow = document.createElement('div');
        arrow.style.display = 'flex';
        arrow.style.alignItems = 'center';
        arrow.style.justifyContent = 'center';
        arrow.style.color = 'var(--text-muted)';
        arrow.style.fontSize = '1.4rem';
        arrow.style.fontFamily = 'JetBrains Mono, monospace';
        arrow.textContent = '→';
        arrow.style.position = 'absolute';
        // we'll fall back to inline arrows for narrow screens — leave it cosmetic
      }
    });

    container.appendChild(row);

    const detail = document.createElement('div');
    detail.style.marginTop = '16px';
    detail.style.padding = '16px 18px';
    detail.style.background = 'var(--bg-frame)';
    detail.style.borderLeft = '3px solid ' + L.stages[active].color;
    detail.style.borderRadius = '0 4px 4px 0';
    detail.style.fontFamily = 'Inter, sans-serif';
    detail.style.fontSize = '0.92rem';
    detail.style.lineHeight = '1.55';
    detail.style.color = 'var(--text-soft)';
    detail.innerHTML = L.stages[active].detail;
    container.appendChild(detail);

    if (window.renderMathInElement) {
      try { window.renderMathInElement(detail, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch (e) {}
    }
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

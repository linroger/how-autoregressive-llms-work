/* §25 — Autoregressive vs Diffusion LLM generation
 * Side-by-side mini comparison:
 *   Left  panel: AR — reveals one token at a time, left-to-right.
 *   Right panel: Diffusion — all masked, then resolves in 4 parallel passes.
 * Same final sentence in both panels for easy comparison.
 * Includes a small "see the companion site" link bubble.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      arTitle: 'Autoregressive',
      arSub: 'one token at a time, left → right',
      dfTitle: 'Diffusion',
      dfSub: 'all positions, resolved in parallel passes',
      step: 'step',
      play: 'Play',
      reset: 'Reset',
      bubble: 'Companion site: how diffusion LLMs work →',
      done: 'done',
    },
    zh: {
      arTitle: '自回归',
      arSub: '一次一个 token,从左到右',
      dfTitle: '扩散',
      dfSub: '所有位置并行,多步解析',
      step: '步骤',
      play: '播放',
      reset: '重置',
      bubble: '配套站点:扩散 LLM 是如何工作的 →',
      done: '完成',
    },
  };

  const COMPANION_URL = 'https://linroger.github.io/how-diffusion-llms-work/';
  const DIFFUSION_STEPS = 4; // number of parallel passes

  // Precompute a commit-step assignment for the diffusion panel.
  function diffusionSchedule(n) {
    const rng = DLM.makeRNG(91);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const r = rng();
      // Earlier tokens slightly biased to commit earlier, but not strictly L→R
      const bias = (i / Math.max(1, n - 1)) * 0.15;
      const v = r + bias;
      if (v < 0.25) out[i] = 1;
      else if (v < 0.55) out[i] = 2;
      else if (v < 0.82) out[i] = 3;
      else out[i] = 4;
    }
    return out;
  }

  let stepIdx = 0;
  let playing = false;
  let timer = null;
  let schedule = [];

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }

  function renderPanel(container, tokens, panelKind, step) {
    container.innerHTML = '';
    const totalSteps = panelKind === 'ar' ? tokens.length : DIFFUSION_STEPS;
    tokens.forEach((tok, i) => {
      const el = document.createElement('span');
      el.className = 'token';
      let cls = 'mask';
      let text = DLM.MASK;
      if (panelKind === 'ar') {
        // committed if step has passed this index; "commit" highlight on the one just revealed
        if (step > i) { cls = 'committed'; text = tok; }
        else if (step === i + 0) { cls = 'mask'; text = DLM.MASK; }
        if (step === i + 1) { /* just revealed */ }
        if (step >= i + 1) {
          cls = (step === i + 1) ? 'commit' : 'committed';
          text = tok;
        }
      } else {
        const committedAt = schedule[i];
        if (step >= committedAt) {
          cls = (step === committedAt) ? 'commit' : 'committed';
          text = tok;
        }
      }
      el.classList.add(cls);
      el.textContent = text;
      el.style.animationDelay = (i * 18) + 'ms';
      container.appendChild(el);
    });
  }

  function render() {
    const root = document.getElementById('viz6-2');
    if (!root) return;
    const lang = getLang();
    const S = STR[lang];
    const sentence = DLM.pickSentence(0);

    root.innerHTML = '';

    // Outer wrapper
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '14px';
    wrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    root.appendChild(wrap);

    // ---------- LEFT: AR ----------
    const arCard = makeCard(S.arTitle, S.arSub, 'var(--accent-4, #52c41a)');
    const arTokens = document.createElement('div');
    arTokens.className = 'token-row';
    arTokens.style.display = 'flex';
    arTokens.style.flexWrap = 'wrap';
    arTokens.style.gap = '4px';
    arTokens.style.minHeight = '92px';
    arCard.body.appendChild(arTokens);
    const arReadout = document.createElement('div');
    arReadout.style.marginTop = '8px';
    arReadout.style.fontFamily = 'JetBrains Mono, monospace';
    arReadout.style.fontSize = '11px';
    arReadout.style.color = 'var(--text-muted)';
    arCard.body.appendChild(arReadout);
    wrap.appendChild(arCard.card);

    // ---------- RIGHT: Diffusion ----------
    const dfCard = makeCard(S.dfTitle, S.dfSub, 'var(--accent, #1677ff)');
    const dfTokens = document.createElement('div');
    dfTokens.className = 'token-row';
    dfTokens.style.display = 'flex';
    dfTokens.style.flexWrap = 'wrap';
    dfTokens.style.gap = '4px';
    dfTokens.style.minHeight = '92px';
    dfCard.body.appendChild(dfTokens);
    const dfReadout = document.createElement('div');
    dfReadout.style.marginTop = '8px';
    dfReadout.style.fontFamily = 'JetBrains Mono, monospace';
    dfReadout.style.fontSize = '11px';
    dfReadout.style.color = 'var(--text-muted)';
    dfCard.body.appendChild(dfReadout);
    wrap.appendChild(dfCard.card);

    // Render token states based on current stepIdx.
    // We synchronize "logical step" 0..max; AR uses stepIdx mapped to tokens.length, diffusion uses 0..4.
    const maxStep = Math.max(sentence.length, DIFFUSION_STEPS);
    const arStep = Math.min(stepIdx, sentence.length); // 0..tokens.length
    const dfStepNorm = Math.round((stepIdx / maxStep) * DIFFUSION_STEPS);
    const dfStep = Math.min(dfStepNorm, DIFFUSION_STEPS);

    renderPanel(arTokens, sentence, 'ar', arStep);
    renderPanel(dfTokens, sentence, 'df', dfStep);

    arReadout.textContent = arStep >= sentence.length
      ? `${S.done} — ${sentence.length}/${sentence.length}`
      : `${S.step} ${arStep} / ${sentence.length}`;
    dfReadout.textContent = dfStep >= DIFFUSION_STEPS
      ? `${S.done} — ${DIFFUSION_STEPS}/${DIFFUSION_STEPS}`
      : `${S.step} ${dfStep} / ${DIFFUSION_STEPS}`;

    // Controls + companion bubble
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.flexWrap = 'wrap';
    controls.style.alignItems = 'center';
    controls.style.gap = '10px';
    controls.style.marginTop = '14px';

    const playBtn = button(S.play, () => play());
    const resetBtn = button(S.reset, () => reset());
    controls.appendChild(playBtn);
    controls.appendChild(resetBtn);

    const bubble = document.createElement('a');
    bubble.href = COMPANION_URL;
    bubble.target = '_blank';
    bubble.rel = 'noopener noreferrer';
    bubble.textContent = S.bubble;
    bubble.style.marginLeft = 'auto';
    bubble.style.fontSize = '12px';
    bubble.style.padding = '6px 12px';
    bubble.style.borderRadius = '999px';
    bubble.style.border = '1px solid var(--border)';
    bubble.style.background = 'var(--bg-frame-2, transparent)';
    bubble.style.color = 'var(--accent)';
    bubble.style.textDecoration = 'none';
    bubble.style.whiteSpace = 'nowrap';
    bubble.style.transition = 'background 160ms, transform 160ms';
    bubble.addEventListener('mouseenter', () => { bubble.style.background = 'var(--bg-frame, transparent)'; bubble.style.transform = 'translateY(-1px)'; });
    bubble.addEventListener('mouseleave', () => { bubble.style.background = 'var(--bg-frame-2, transparent)'; bubble.style.transform = 'none'; });
    controls.appendChild(bubble);

    root.appendChild(controls);
  }

  function makeCard(title, sub, accentColor) {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-frame, transparent)';
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = '10px';
    card.style.padding = '12px 14px';
    card.style.position = 'relative';

    const stripe = document.createElement('div');
    stripe.style.position = 'absolute';
    stripe.style.left = '0';
    stripe.style.top = '12px';
    stripe.style.bottom = '12px';
    stripe.style.width = '3px';
    stripe.style.borderRadius = '2px';
    stripe.style.background = accentColor;
    card.appendChild(stripe);

    const head = document.createElement('div');
    head.style.marginBottom = '8px';
    head.style.paddingLeft = '8px';

    const t = document.createElement('div');
    t.textContent = title;
    t.style.fontWeight = '600';
    t.style.fontSize = '13px';
    t.style.color = 'var(--text)';
    head.appendChild(t);

    const s = document.createElement('div');
    s.textContent = sub;
    s.style.fontSize = '11px';
    s.style.color = 'var(--text-soft)';
    head.appendChild(s);

    card.appendChild(head);

    const body = document.createElement('div');
    body.style.paddingLeft = '8px';
    card.appendChild(body);
    return { card, body };
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.padding = '6px 14px';
    b.style.fontSize = '12px';
    b.style.borderRadius = '6px';
    b.style.border = '1px solid var(--border-strong)';
    b.style.background = 'var(--bg-elevated, transparent)';
    b.style.color = 'var(--text)';
    b.style.cursor = 'pointer';
    b.style.fontFamily = 'inherit';
    b.addEventListener('click', onClick);
    return b;
  }

  function play() {
    if (playing) return;
    playing = true;
    stepIdx = 0;
    render();
    const sentence = DLM.pickSentence(0);
    const maxStep = Math.max(sentence.length, DIFFUSION_STEPS);
    const advance = () => {
      stepIdx++;
      if (stepIdx > maxStep) {
        stepIdx = maxStep;
        playing = false;
        return;
      }
      render();
      timer = setTimeout(advance, 520);
    };
    timer = setTimeout(advance, 600);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    playing = false;
    stepIdx = 0;
    render();
  }

  function init() {
    const sentence = DLM.pickSentence(0);
    schedule = diffusionSchedule(sentence.length);
    render();
    window.addEventListener('langchange', () => {
      const s = DLM.pickSentence(0);
      schedule = diffusionSchedule(s.length);
      render();
    });
    window.addEventListener('resize', () => render());
    setTimeout(play, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

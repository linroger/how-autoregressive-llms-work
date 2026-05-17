/* §17b — Speculative decoding: a tiny draft model proposes K tokens,
 * the big target model verifies all K in a single forward pass and
 * accepts the longest prefix matching its own samples.
 *
 * Three pre-baked example runs cycle on the Play button to expose variance.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      draft: 'Draft (1B params)',
      target: 'Target (70B params)',
      draftSub: '~4× cheaper per token',
      targetSub: 'verifies K tokens in one forward pass',
      propose: 'Step 1 — Draft proposes K = 4 tokens',
      verify: 'Step 2 — Target verifies in parallel',
      accept: 'Step 3 — Accept longest matching prefix',
      gauge: 'Effective speedup',
      naive: 'Naïve autoregressive',
      spec: 'Speculative',
      naiveU: 'forward passes',
      specU: 'eqv. forward passes',
      cycle: 'Try another run',
      reset: 'Reset',
      runLbl: 'Example run',
      rule: 'Rejection sampling rule',
      ruleEq: 'accept token if  u ≤ min(1, p_target(x) / p_draft(x))',
      ruleNote: 'where u ~ Uniform(0,1). This makes the marginal distribution of accepted tokens exactly p_target — free quality, no degradation.',
      accLabel: 'accepted',
      rejLabel: 'rejected',
      discLabel: 'discarded',
      caption: 'The accepted tokens are sampled from the exact target distribution, so quality is unchanged. The speedup is purely a consequence of trading sequential target calls for one parallel verification.',
      examples: [
        {
          label: '"the cat sat on …"',
          draftToks: ['the', 'cat', 'sat', 'on'],
          targetToks: ['the', 'cat', 'jumped', 'over'],
          probs: [0.92, 0.88, 0.31, 0.10], // p_target/p_draft
          accepts: [true, true, false, false],
        },
        {
          label: '"def sum(a, …"',
          draftToks: ['def', 'sum', '(', 'a'],
          targetToks: ['def', 'sum', '(', 'a'],
          probs: [0.98, 0.97, 0.99, 0.95],
          accepts: [true, true, true, true],
        },
        {
          label: '"once upon a …"',
          draftToks: ['once', 'upon', 'time', 'there'],
          targetToks: ['once', 'a', '...', '...'],
          probs: [0.95, 0.18, 0.08, 0.05],
          accepts: [true, false, false, false],
        },
      ],
      stepFmt: (cur, tot) => `run ${cur} / ${tot}`,
    },
    zh: {
      draft: '草稿模型 (1B 参数)',
      target: '目标模型 (70B 参数)',
      draftSub: '每个 token 便宜约 4×',
      targetSub: '一次前向并行验证 K 个 token',
      propose: '第 1 步 — 草稿模型提议 K = 4 个 token',
      verify: '第 2 步 — 目标模型并行验证',
      accept: '第 3 步 — 接受最长匹配前缀',
      gauge: '有效加速',
      naive: '朴素自回归',
      spec: '推测解码',
      naiveU: '次前向',
      specU: '等效前向次数',
      cycle: '换一组示例',
      reset: '重置',
      runLbl: '示例运行',
      rule: '拒绝采样规则',
      ruleEq: '若  u ≤ min(1, p_target(x) / p_draft(x))  则接受',
      ruleNote: '其中 u ~ Uniform(0,1)。这保证接受 token 的边缘分布严格等于 p_target —— 质量无损,只是把多次串行调用换成了一次并行验证。',
      accLabel: '已接受',
      rejLabel: '被拒绝',
      discLabel: '丢弃',
      caption: '接受的 token 严格采样自目标分布,因此质量与朴素解码一致。加速完全来自把多次串行 target 调用替换成一次并行验证。',
      examples: [
        {
          label: '"the cat sat on …"',
          draftToks: ['the', 'cat', 'sat', 'on'],
          targetToks: ['the', 'cat', 'jumped', 'over'],
          probs: [0.92, 0.88, 0.31, 0.10],
          accepts: [true, true, false, false],
        },
        {
          label: '"def sum(a, …"',
          draftToks: ['def', 'sum', '(', 'a'],
          targetToks: ['def', 'sum', '(', 'a'],
          probs: [0.98, 0.97, 0.99, 0.95],
          accepts: [true, true, true, true],
        },
        {
          label: '"once upon a …"',
          draftToks: ['once', 'upon', 'time', 'there'],
          targetToks: ['once', 'a', '...', '...'],
          probs: [0.95, 0.18, 0.08, 0.05],
          accepts: [true, false, false, false],
        },
      ],
      stepFmt: (cur, tot) => `第 ${cur} / ${tot} 组`,
    },
  };

  // K = 4 proposed tokens. The cost model:
  //   naive: K target forward passes
  //   spec:  1 target forward pass + K * 0.05 (draft is ~20x cheaper)
  // Effective accepted = number of consecutive trues from the start.
  const DRAFT_COST = 0.05; // per token, vs 1 target call
  const K = 4;

  let runIdx = 0;
  let phase = 0;   // 0=idle/initial, 1=propose, 2=verify, 3=accept (final)
  let timers = [];

  function clearTimer() { timers.forEach(t => clearTimeout(t)); timers = []; }

  function acceptedCount(accepts) {
    let n = 0;
    for (let i = 0; i < accepts.length; i++) { if (accepts[i]) n++; else break; }
    return n;
  }

  function render() {
    const root = document.getElementById('viz17b-speculative');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    const ex = S.examples[runIdx];
    root.innerHTML = '';

    // ─── tooltip ─────────────────────────────────────────────────────
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;'
      + 'background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);'
      + "font-family:'JetBrains Mono', monospace;font-size:11px;border-radius:4px;"
      + 'opacity:0;transition:opacity 120ms;z-index:50;white-space:nowrap;';
    document.body.appendChild(tip);
    root.addEventListener('viz-cleanup', () => tip.remove(), { once: true });

    // ─── controls ────────────────────────────────────────────────────
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap';
    const bCycle = document.createElement('button'); bCycle.className = 'btn'; bCycle.textContent = '▶ ' + S.cycle;
    const bReset = document.createElement('button'); bReset.className = 'btn btn-ghost'; bReset.textContent = S.reset;
    const runRead = document.createElement('span');
    runRead.style.cssText = "margin-left:auto;font-family:'JetBrains Mono', monospace;font-size:0.78rem;color:var(--text-soft)";
    runRead.textContent = `${S.runLbl}: ${ex.label}  ·  ${S.stepFmt(runIdx + 1, S.examples.length)}`;
    ctrls.append(bCycle, bReset, runRead);
    root.appendChild(ctrls);

    // ─── model boxes (draft top, target bottom) ──────────────────────
    function buildBox(parent, title, sub, accentVar, phaseLabel) {
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-frame-2);border:1px solid var(--border-strong);'
        + 'border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;gap:8px';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap';
      head.innerHTML = `<span style="font-family:'JetBrains Mono', monospace;font-size:0.82rem;color:${accentVar};font-weight:600">${title}</span>`
        + `<span style="font-family:Inter, sans-serif;font-size:0.72rem;color:var(--text-muted)">${sub}</span>`;
      box.appendChild(head);
      const phaseLine = document.createElement('div');
      phaseLine.style.cssText = 'font-family:Inter, sans-serif;font-size:0.74rem;color:var(--text-soft);'
        + 'text-transform:uppercase;letter-spacing:0.06em';
      phaseLine.textContent = phaseLabel;
      box.appendChild(phaseLine);
      const tokRow = document.createElement('div');
      tokRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:40px';
      box.appendChild(tokRow);
      parent.appendChild(box);
      return tokRow;
    }

    const draftRow = buildBox(root, S.draft, S.draftSub, 'var(--accent-4)', S.propose);

    function makeToken(text, kind) {
      const sp = document.createElement('span');
      sp.style.cssText = 'padding:6px 11px;border-radius:4px;'
        + "font-family:'JetBrains Mono', monospace;font-size:0.85rem;line-height:1;"
        + 'border:1px solid var(--border-strong);transition:all 220ms';
      sp.textContent = text;
      if (kind === 'draft') {
        sp.style.background = 'rgba(82,196,26,0.12)';
        sp.style.borderColor = 'var(--accent-4)';
        sp.style.color = 'var(--text)';
      } else if (kind === 'accept') {
        sp.style.background = 'rgba(82,196,26,0.28)';
        sp.style.borderColor = 'var(--accent-4)';
        sp.style.color = 'var(--accent-4)';
        sp.style.fontWeight = '600';
      } else if (kind === 'reject') {
        sp.style.background = 'rgba(255,77,79,0.18)';
        sp.style.borderColor = '#ff4d4f';
        sp.style.color = '#ff4d4f';
        sp.style.fontWeight = '600';
        sp.style.textDecoration = 'line-through';
      } else if (kind === 'discard') {
        sp.style.background = 'var(--bg-frame)';
        sp.style.color = 'var(--text-muted)';
        sp.style.opacity = 0.55;
      } else {
        sp.style.background = 'var(--bg-frame)';
        sp.style.color = 'var(--text-soft)';
      }
      return sp;
    }

    if (phase >= 1) {
      ex.draftToks.forEach((t, i) => {
        const tok = makeToken(t, 'draft');
        tok.style.opacity = 0;
        draftRow.appendChild(tok);
        setTimeout(() => { tok.style.opacity = 1; }, i * 120);
      });
    }

    // arrow
    const arrow = document.createElement('div');
    arrow.style.cssText = 'text-align:center;color:var(--text-muted);font-family:\'JetBrains Mono\', monospace;font-size:14px;line-height:1';
    arrow.textContent = '↓';
    root.appendChild(arrow);

    const targetRow = buildBox(root, S.target, S.targetSub, 'var(--accent)', phase >= 2 ? S.verify : S.accept);

    const accCount = acceptedCount(ex.accepts);
    if (phase >= 2) {
      ex.draftToks.forEach((t, i) => {
        let kind;
        if (i < accCount) kind = 'accept';
        else if (i === accCount) kind = 'reject';
        else kind = 'discard';
        const finalTok = (kind === 'reject') ? ex.targetToks[i] : t;
        const tok = makeToken(finalTok, kind);
        // add prob badge
        const badge = document.createElement('sub');
        badge.style.cssText = 'margin-left:6px;font-size:9px;color:var(--text-muted);font-weight:400;text-decoration:none';
        badge.textContent = `p=${ex.probs[i].toFixed(2)}`;
        tok.appendChild(badge);
        tok.style.opacity = 0;
        targetRow.appendChild(tok);
        setTimeout(() => { tok.style.opacity = 1; }, 250 + i * 130);

        // hover detail
        tok.addEventListener('mouseover', (e) => {
          tip.style.opacity = 1;
          const lbl = kind === 'accept' ? S.accLabel : (kind === 'reject' ? S.rejLabel : S.discLabel);
          tip.innerHTML = `<b>${t}</b> → <b>${finalTok}</b><br>`
            + `p_target/p_draft = ${ex.probs[i].toFixed(2)}<br>`
            + `<span style="opacity:0.7">${lbl}</span>`;
        });
        tok.addEventListener('mousemove', (e) => {
          tip.style.left = (e.pageX + 12) + 'px';
          tip.style.top = (e.pageY + 12) + 'px';
        });
        tok.addEventListener('mouseout', () => { tip.style.opacity = 0; });
      });
    }

    // ─── speedup gauge ───────────────────────────────────────────────
    const gaugeWrap = document.createElement('div');
    gaugeWrap.style.cssText = 'margin-top:14px;background:var(--bg-frame);border:1px solid var(--border-strong);'
      + 'border-radius:6px;padding:12px 14px';
    const gTitle = document.createElement('div');
    gTitle.style.cssText = 'font-family:Inter, sans-serif;font-size:0.74rem;color:var(--text-soft);'
      + 'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px';
    gTitle.textContent = S.gauge;
    gaugeWrap.appendChild(gTitle);

    const W = Math.min(root.clientWidth || 600, 720);
    const gH = 86;
    const gSvg = d3.select(gaugeWrap).append('svg')
      .attr('width', '100%').attr('height', gH)
      .attr('viewBox', `0 0 ${W} ${gH}`).style('display', 'block');
    const gm = { top: 8, right: 110, bottom: 4, left: 130 };
    const gInner = gSvg.append('g').attr('transform', `translate(${gm.left},${gm.top})`);
    const giw = W - gm.left - gm.right;
    const naiveCost = K;
    const specCost = phase >= 3 ? (1 + K * DRAFT_COST) : naiveCost;
    const accepted = phase >= 3 ? accCount : 0;
    const speedup = phase >= 3 && accepted > 0 ? accepted / specCost : 1;
    const xScale = d3.scaleLinear().domain([0, K]).range([0, giw]);

    // naive bar
    gInner.append('text').attr('x', -8).attr('y', 14).attr('text-anchor', 'end')
      .style('font-size', '11px').style('fill', 'var(--text-soft)').style('font-family', "'JetBrains Mono', monospace")
      .text(S.naive);
    gInner.append('rect').attr('x', 0).attr('y', 4).attr('height', 18).attr('rx', 3)
      .attr('fill', 'var(--mask)').attr('opacity', 0.7)
      .attr('width', 0).transition().duration(700).attr('width', xScale(naiveCost));
    gInner.append('text').attr('x', xScale(naiveCost) + 8).attr('y', 17)
      .style('font-size', '11px').style('fill', 'var(--text-muted)').style('font-family', "'JetBrains Mono', monospace")
      .text(`${naiveCost.toFixed(1)} ${S.naiveU}`);

    // spec bar
    gInner.append('text').attr('x', -8).attr('y', 50).attr('text-anchor', 'end')
      .style('font-size', '11px').style('fill', 'var(--text-soft)').style('font-family', "'JetBrains Mono', monospace")
      .text(S.spec);
    gInner.append('rect').attr('x', 0).attr('y', 40).attr('height', 18).attr('rx', 3)
      .attr('fill', accepted >= 3 ? 'var(--accent-4)' : (accepted >= 2 ? 'var(--accent)' : 'var(--accent-3)'))
      .attr('width', 0).transition().duration(900).attr('width', xScale(specCost));
    gInner.append('text').attr('x', xScale(specCost) + 8).attr('y', 53)
      .style('font-size', '11px').style('fill', 'var(--text-muted)').style('font-family', "'JetBrains Mono', monospace")
      .text(`${specCost.toFixed(2)} ${S.specU}`);

    // big speedup label on right
    if (phase >= 3 && accepted > 0) {
      const speedupTxt = `${speedup.toFixed(2)}×`;
      gSvg.append('text').attr('x', W - 14).attr('y', gH / 2 + 4)
        .attr('text-anchor', 'end')
        .style('font-size', '24px').style('font-weight', 700)
        .style('fill', accepted >= 3 ? 'var(--accent-4)' : 'var(--accent)')
        .style('font-family', "'JetBrains Mono', monospace")
        .attr('opacity', 0).text(speedupTxt)
        .transition().delay(900).duration(400).attr('opacity', 1);
    }

    root.appendChild(gaugeWrap);

    // ─── rejection-sampling rule box ─────────────────────────────────
    const rule = document.createElement('div');
    rule.style.cssText = 'margin-top:12px;background:var(--bg-elevated);border:1px solid var(--border-strong);'
      + 'border-radius:6px;padding:10px 14px';
    rule.innerHTML = `<div style="font-family:Inter, sans-serif;font-size:0.72rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${S.rule}</div>`
      + `<div style="font-family:'JetBrains Mono', monospace;font-size:0.86rem;color:var(--text);margin-bottom:6px">${S.ruleEq}</div>`
      + `<div style="font-family:Inter, sans-serif;font-size:0.78rem;color:var(--text-muted);line-height:1.5">${S.ruleNote}</div>`;
    root.appendChild(rule);

    // ─── caption ─────────────────────────────────────────────────────
    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:10px;font-size:12px;color:var(--text-muted);line-height:1.5;'
      + 'padding:8px 12px;background:var(--bg-frame);border-left:3px solid var(--accent-3);border-radius:0 4px 4px 0';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // ─── wire handlers ───────────────────────────────────────────────
    bCycle.addEventListener('click', () => {
      clearTimer();
      runIdx = (runIdx + 1) % S.examples.length;
      phase = 0;
      cleanupTip();
      render();
      // animate phases automatically
      timers.push(setTimeout(() => { phase = 1; render(); }, 120));
      timers.push(setTimeout(() => { phase = 2; render(); }, 900));
      timers.push(setTimeout(() => { phase = 3; render(); }, 1900));
    });
    bReset.addEventListener('click', () => {
      clearTimer(); phase = 0; cleanupTip(); render();
    });

    function cleanupTip() { root.dispatchEvent(new Event('viz-cleanup')); }
  }

  function init() {
    window.addEventListener('langchange', () => { phase = 0; clearTimer(); render(); });
    window.addEventListener('resize', () => render());
    render();
    // kick off the first run animation
    timers.push(setTimeout(() => { phase = 1; render(); }, 350));
    timers.push(setTimeout(() => { phase = 2; render(); }, 1200));
    timers.push(setTimeout(() => { phase = 3; render(); }, 2200));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

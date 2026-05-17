/* §1b — Byte-Pair Encoding step-through
 * Tiny corpus "low low low lower lower newest newest widest".
 * Step 0: every character is its own token (split by char, '·' between words).
 * Each "Next merge" finds the most frequent adjacent pair across the corpus
 * and merges it; the vocabulary grows by exactly one symbol per merge.
 * Top:    color-coded current tokenization of every word + frequency.
 * Middle: the pair currently being merged with its count.
 * Bottom: the running vocabulary list.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Byte-Pair Encoding — learn a subword vocabulary from a tiny corpus',
      next: 'Next merge',
      reset: 'Reset to characters',
      auto: 'Run all',
      pair: 'Most frequent pair',
      mergingNow: 'merging now',
      count: 'count',
      step: 'step',
      vocab: 'Vocabulary',
      vocabCount: 'size',
      noMerge: 'No more adjacent pairs occur > 1 — vocabulary is stable.',
      corpusLabel: 'Corpus',
      hint: 'BPE iteratively merges the most frequent pair until you hit a target vocab size. Real BPE tokenizers (GPT-2 used 50 257 merges) compress text into rare-but-meaningful sub-units.',
    },
    zh: {
      title: '字节对编码 (BPE) — 从小语料中学习子词词表',
      next: '下一步合并',
      reset: '重置为字符',
      auto: '一键运行',
      pair: '出现最多的相邻对',
      mergingNow: '正在合并',
      count: '出现次数',
      step: '步骤',
      vocab: '词表',
      vocabCount: '大小',
      noMerge: '已经没有出现 > 1 次的相邻对了 — 词表稳定。',
      corpusLabel: '语料',
      hint: 'BPE 反复合并最常见的相邻 token,直到达到目标词表大小。真实的 BPE 分词器 (例如 GPT-2 有 50,257 次合并) 把文本压成稀有但意义稳定的子词单元。',
    },
  };

  // Corpus as a multiset:  word → frequency
  const CORPUS = {
    'low':    3,
    'lower':  2,
    'newest': 2,
    'widest': 1,
  };

  // Each word starts as an array of single-char tokens.
  function freshState() {
    const words = {};
    for (const w of Object.keys(CORPUS)) words[w] = Array.from(w);
    return words;
  }

  // Score adjacent pairs across the whole weighted corpus.
  // Returns [{pair: [a,b], count}, ...] sorted by count desc.
  function pairStats(words) {
    const counts = new Map();
    for (const [w, toks] of Object.entries(words)) {
      const f = CORPUS[w];
      for (let i = 0; i < toks.length - 1; i++) {
        const key = toks[i] + '' + toks[i + 1];
        counts.set(key, (counts.get(key) || 0) + f);
      }
    }
    const arr = [];
    for (const [k, c] of counts) {
      const [a, b] = k.split('');
      arr.push({ pair: [a, b], count: c });
    }
    arr.sort((x, y) => y.count - x.count || (x.pair[0] + x.pair[1]).localeCompare(y.pair[0] + y.pair[1]));
    return arr;
  }

  // Apply a merge (a, b) → "ab" to every word, in-place on a copy.
  function applyMerge(words, a, b) {
    const merged = a + b;
    const out = {};
    for (const [w, toks] of Object.entries(words)) {
      const r = [];
      let i = 0;
      while (i < toks.length) {
        if (i < toks.length - 1 && toks[i] === a && toks[i + 1] === b) {
          r.push(merged); i += 2;
        } else { r.push(toks[i]); i += 1; }
      }
      out[w] = r;
    }
    return out;
  }

  // Pre-compute the merge history once so the UI can scrub forward.
  function buildHistory(maxSteps) {
    const states = [{ words: freshState(), merge: null, vocab: initialVocab() }];
    for (let k = 0; k < maxSteps; k++) {
      const last = states[states.length - 1];
      const stats = pairStats(last.words);
      if (!stats.length || stats[0].count < 2) break;
      const top = stats[0];
      const nextWords = applyMerge(last.words, top.pair[0], top.pair[1]);
      const newVocab = last.vocab.slice();
      const merged = top.pair[0] + top.pair[1];
      if (!newVocab.includes(merged)) newVocab.push(merged);
      states.push({ words: nextWords, merge: { pair: top.pair, count: top.count, merged }, vocab: newVocab });
    }
    return states;
  }

  function initialVocab() {
    const v = new Set();
    for (const w of Object.keys(CORPUS)) for (const c of w) v.add(c);
    return Array.from(v).sort();
  }

  const HISTORY = buildHistory(8);   // ~6 useful merges in this corpus
  let step = 0;

  // Stable color per token chunk (hash → hue)
  function tokenColor(tok) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue}, 55%, 38%)`;
  }

  function render() {
    const root = document.getElementById('viz1b-bpe');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    const stateNow = HISTORY[Math.min(step, HISTORY.length - 1)];
    const atEnd = step >= HISTORY.length - 1;

    // --- title strip ---
    const title = document.createElement('div');
    title.style.fontSize = '11px';
    title.style.color = 'var(--text-soft)';
    title.style.marginBottom = '10px';
    title.style.fontFamily = "'Inter', sans-serif";
    title.textContent = S.title;
    root.appendChild(title);

    // --- controls ---
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '12px';
    const bNext = document.createElement('button');
    bNext.className = 'btn';
    bNext.textContent = S.next;
    bNext.disabled = atEnd;
    if (atEnd) { bNext.style.opacity = 0.5; bNext.style.cursor = 'not-allowed'; }
    bNext.addEventListener('click', () => { if (step < HISTORY.length - 1) { step++; render(); } });
    const bAuto = document.createElement('button');
    bAuto.className = 'btn btn-ghost';
    bAuto.textContent = S.auto;
    bAuto.addEventListener('click', () => { step = HISTORY.length - 1; render(); });
    const bReset = document.createElement('button');
    bReset.className = 'btn btn-ghost';
    bReset.textContent = S.reset;
    bReset.addEventListener('click', () => { step = 0; render(); });
    const stepReadout = document.createElement('span');
    stepReadout.style.fontFamily = "'JetBrains Mono', monospace";
    stepReadout.style.fontSize = '11px';
    stepReadout.style.color = 'var(--text-muted)';
    stepReadout.style.marginLeft = '8px';
    stepReadout.textContent = `${S.step} ${step} / ${HISTORY.length - 1}`;
    ctrls.append(bNext, bAuto, bReset, stepReadout);
    root.appendChild(ctrls);

    // --- TOP: tokenized corpus ---
    const corpusBox = document.createElement('div');
    corpusBox.style.background = 'var(--bg-frame-2)';
    corpusBox.style.border = '1px solid var(--border)';
    corpusBox.style.borderRadius = '8px';
    corpusBox.style.padding = '14px 16px';
    corpusBox.style.marginBottom = '10px';

    const corpusHdr = document.createElement('div');
    corpusHdr.style.fontSize = '10px';
    corpusHdr.style.color = 'var(--text-muted)';
    corpusHdr.style.textTransform = 'uppercase';
    corpusHdr.style.letterSpacing = '0.06em';
    corpusHdr.style.marginBottom = '8px';
    corpusHdr.style.fontFamily = "'Inter', sans-serif";
    corpusHdr.textContent = S.corpusLabel;
    corpusBox.appendChild(corpusHdr);

    // Tooltip — shared
    const tip = document.createElement('div');
    tip.style.position = 'absolute'; tip.style.pointerEvents = 'none';
    tip.style.padding = '4px 8px'; tip.style.background = 'var(--bg-frame-2)';
    tip.style.border = '1px solid var(--accent)'; tip.style.color = 'var(--text)';
    tip.style.fontFamily = "'JetBrains Mono', monospace"; tip.style.fontSize = '11px';
    tip.style.borderRadius = '4px'; tip.style.opacity = 0;
    tip.style.transition = 'opacity 120ms'; tip.style.zIndex = 50;
    document.body.appendChild(tip);

    const wordsRow = document.createElement('div');
    wordsRow.style.display = 'flex';
    wordsRow.style.flexWrap = 'wrap';
    wordsRow.style.gap = '14px';
    wordsRow.style.alignItems = 'flex-end';

    // Determine pair to highlight for *next* merge (preview)
    const previewPair = stateNow.merge ? stateNow.merge.pair : null;

    for (const [w, freq] of Object.entries(CORPUS)) {
      const col = document.createElement('div');
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.alignItems = 'center';
      col.style.gap = '4px';

      const tokRow = document.createElement('div');
      tokRow.style.display = 'flex';
      tokRow.style.gap = '2px';
      const toks = stateNow.words[w];
      toks.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.textContent = t;
        chip.style.padding = '4px 7px';
        chip.style.fontFamily = "'JetBrains Mono', monospace";
        chip.style.fontSize = '13px';
        chip.style.color = '#fff';
        chip.style.background = tokenColor(t);
        chip.style.borderRadius = '4px';
        chip.style.transition = 'box-shadow 200ms, transform 200ms';
        // Highlight the just-merged token (state arrived FROM previous via this merge)
        if (stateNow.merge && t === stateNow.merge.merged) {
          chip.style.boxShadow = '0 0 0 2px var(--accent)';
          chip.style.transform = 'translateY(-2px)';
        }
        chip.addEventListener('mouseover', (e) => {
          tip.style.opacity = 1;
          tip.innerHTML = `token: <b>${t}</b><br>length: ${t.length} char`;
        });
        chip.addEventListener('mousemove', (e) => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; });
        chip.addEventListener('mouseout', () => { tip.style.opacity = 0; });
        tokRow.appendChild(chip);
      });

      const lab = document.createElement('div');
      lab.style.fontSize = '10px';
      lab.style.color = 'var(--text-muted)';
      lab.style.fontFamily = "'JetBrains Mono', monospace";
      lab.textContent = `"${w}" × ${freq}`;

      col.append(tokRow, lab);
      wordsRow.appendChild(col);
    }
    corpusBox.appendChild(wordsRow);
    root.appendChild(corpusBox);

    // --- MIDDLE: most-frequent-pair banner ---
    const banner = document.createElement('div');
    banner.style.padding = '12px 16px';
    banner.style.border = '1px solid var(--accent)';
    banner.style.borderRadius = '8px';
    banner.style.background = 'rgba(22,119,255,0.08)';
    banner.style.marginBottom = '10px';
    banner.style.fontFamily = "'JetBrains Mono', monospace";
    banner.style.fontSize = '12px';
    banner.style.color = 'var(--text)';
    banner.style.display = 'flex';
    banner.style.flexWrap = 'wrap';
    banner.style.alignItems = 'center';
    banner.style.gap = '8px';

    // Show what THIS step's merge was (if any). If at step 0, look forward to next.
    let mergeInfo;
    if (stateNow.merge) {
      mergeInfo = stateNow.merge;
    } else {
      // step 0 — preview the upcoming top pair
      const stats = pairStats(stateNow.words);
      mergeInfo = stats.length ? { pair: stats[0].pair, count: stats[0].count, merged: stats[0].pair.join('') } : null;
    }
    if (mergeInfo) {
      const lbl = document.createElement('span');
      lbl.style.color = 'var(--text-muted)';
      lbl.textContent = S.pair + ':';
      const a = document.createElement('span');
      a.textContent = mergeInfo.pair[0];
      a.style.padding = '2px 6px'; a.style.background = tokenColor(mergeInfo.pair[0]); a.style.color = '#fff'; a.style.borderRadius = '3px';
      const plus = document.createElement('span'); plus.textContent = '+'; plus.style.color = 'var(--text-muted)';
      const b = document.createElement('span');
      b.textContent = mergeInfo.pair[1];
      b.style.padding = '2px 6px'; b.style.background = tokenColor(mergeInfo.pair[1]); b.style.color = '#fff'; b.style.borderRadius = '3px';
      const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.style.color = 'var(--accent)';
      const m = document.createElement('span');
      m.textContent = mergeInfo.merged;
      m.style.padding = '2px 6px'; m.style.background = tokenColor(mergeInfo.merged); m.style.color = '#fff'; m.style.borderRadius = '3px'; m.style.fontWeight = '600';
      const cnt = document.createElement('span');
      cnt.style.marginLeft = '12px'; cnt.style.color = 'var(--text-soft)';
      cnt.textContent = `${S.count}: ${mergeInfo.count}`;
      const stat = document.createElement('span');
      stat.style.marginLeft = '8px'; stat.style.color = 'var(--accent-4)'; stat.style.fontStyle = 'italic';
      stat.textContent = stateNow.merge ? `(${S.mergingNow})` : '(preview)';
      banner.append(lbl, a, plus, b, arrow, m, cnt, stat);
    } else {
      banner.textContent = S.noMerge;
      banner.style.borderColor = 'var(--accent-4)';
      banner.style.background = 'rgba(82,196,26,0.08)';
    }
    root.appendChild(banner);

    // --- BOTTOM: vocabulary ---
    const vocabBox = document.createElement('div');
    vocabBox.style.background = 'var(--bg-frame)';
    vocabBox.style.border = '1px solid var(--border)';
    vocabBox.style.borderRadius = '8px';
    vocabBox.style.padding = '12px 16px';

    const vHdr = document.createElement('div');
    vHdr.style.display = 'flex';
    vHdr.style.justifyContent = 'space-between';
    vHdr.style.alignItems = 'center';
    vHdr.style.marginBottom = '8px';
    vHdr.style.fontFamily = "'Inter', sans-serif";
    const vTitle = document.createElement('span');
    vTitle.style.fontSize = '10px'; vTitle.style.color = 'var(--text-muted)';
    vTitle.style.textTransform = 'uppercase'; vTitle.style.letterSpacing = '0.06em';
    vTitle.textContent = S.vocab;
    const vCount = document.createElement('span');
    vCount.style.fontFamily = "'JetBrains Mono', monospace";
    vCount.style.fontSize = '11px';
    vCount.style.color = 'var(--accent-2)';
    vCount.textContent = `${S.vocabCount}: ${stateNow.vocab.length}`;
    vHdr.append(vTitle, vCount);
    vocabBox.appendChild(vHdr);

    const vocabRow = document.createElement('div');
    vocabRow.style.display = 'flex'; vocabRow.style.flexWrap = 'wrap'; vocabRow.style.gap = '5px';
    stateNow.vocab.forEach(tok => {
      const chip = document.createElement('span');
      chip.textContent = tok;
      chip.style.padding = '3px 6px';
      chip.style.fontFamily = "'JetBrains Mono', monospace";
      chip.style.fontSize = '11px';
      chip.style.color = '#fff';
      chip.style.background = tokenColor(tok);
      chip.style.borderRadius = '3px';
      chip.style.opacity = '0.92';
      if (stateNow.merge && tok === stateNow.merge.merged) {
        chip.style.boxShadow = '0 0 0 2px var(--accent)';
        chip.style.opacity = '1';
      }
      vocabRow.appendChild(chip);
    });
    vocabBox.appendChild(vocabRow);
    root.appendChild(vocabBox);

    // Hint
    const hint = document.createElement('div');
    hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)';
    hint.style.marginTop = '10px'; hint.textContent = S.hint;
    root.appendChild(hint);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => render());
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

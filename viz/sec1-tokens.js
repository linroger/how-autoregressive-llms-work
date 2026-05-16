/* §1 — Tokenization demo
 * Toggle between word / BPE / char tokenization for a sample sentence,
 * showing how the same input becomes a different number of tokens.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      input: 'Tokenization is fundamental for language models.',
      modes: { word: 'word', bpe: 'BPE', char: 'character' },
      countLabel: 'tokens',
      hint: 'BPE merges common substrings; rare words split into pieces.',
    },
    zh: {
      input: '分词是语言模型的基础。',
      modes: { word: '词', bpe: 'BPE 子词', char: '字符' },
      countLabel: '个 token',
      hint: 'BPE 把常见子串合并为一个 token,罕见词拆成多片。',
    },
  };

  // A tiny faux-BPE: pre-compiled splits for English demo words.
  const BPE_SPLITS_EN = {
    'Tokenization': ['Token', 'ization'],
    'is': ['is'],
    'fundamental': ['fund', 'amental'],
    'for': ['for'],
    'language': ['lang', 'uage'],
    'models': ['model', 's'],
    '.': ['.'],
  };
  const BPE_SPLITS_ZH = {
    '分词': ['分', '词'],
    '是': ['是'],
    '语言': ['语言'],
    '模型': ['模', '型'],
    '的': ['的'],
    '基础': ['基础'],
    '。': ['。'],
  };

  let mode = 'word';

  function tokenize(text, lang, mode) {
    if (mode === 'char') {
      return Array.from(text).filter(c => c !== ' ');
    }
    // word split: by whitespace + punctuation isolation
    let words;
    if (lang === 'zh') {
      words = ['分词', '是', '语言', '模型', '的', '基础', '。'];
    } else {
      words = text.replace(/\./g, ' .').split(/\s+/).filter(Boolean);
    }
    if (mode === 'word') return words;
    // BPE
    const splits = lang === 'zh' ? BPE_SPLITS_ZH : BPE_SPLITS_EN;
    const out = [];
    words.forEach(w => {
      const s = splits[w] || [w];
      s.forEach(p => out.push(p));
    });
    return out;
  }

  function render() {
    const root = document.getElementById('viz1-1');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // Mode toggle
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '12px';
    ['word','bpe','char'].forEach(m => {
      const b = document.createElement('button');
      b.className = 'btn' + (m === mode ? ' active' : '');
      b.textContent = S.modes[m];
      b.style.marginRight = '6px';
      b.addEventListener('click', () => { mode = m; render(); });
      ctrls.appendChild(b);
    });
    root.appendChild(ctrls);

    // Input echo
    const src = document.createElement('div');
    src.style.fontFamily = "'JetBrains Mono', monospace";
    src.style.color = 'var(--text-soft)';
    src.style.marginBottom = '10px';
    src.style.fontSize = '13px';
    src.textContent = '"' + S.input + '"';
    root.appendChild(src);

    // Tokens
    const tokens = tokenize(S.input, lang, mode);
    const strip = document.createElement('div');
    strip.style.display = 'flex';
    strip.style.flexWrap = 'wrap';
    strip.style.gap = '4px';
    strip.style.marginBottom = '10px';

    const palette = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)'];
    tokens.forEach((t, i) => {
      const sp = document.createElement('span');
      sp.className = 'token committed';
      sp.textContent = t;
      sp.style.background = palette[i % palette.length] + '22';
      sp.style.borderColor = palette[i % palette.length];
      sp.style.animationDelay = (i * 30) + 'ms';
      strip.appendChild(sp);
    });
    root.appendChild(strip);

    // Count
    const cnt = document.createElement('div');
    cnt.style.fontSize = '13px';
    cnt.style.color = 'var(--text-muted)';
    cnt.innerHTML = `<b style="color:var(--accent)">${tokens.length}</b> ${S.countLabel} · ${S.hint}`;
    root.appendChild(cnt);

    // ID mapping illustration as a tiny table
    const idsWrap = document.createElement('div');
    idsWrap.style.marginTop = '10px';
    idsWrap.style.display = 'flex';
    idsWrap.style.flexWrap = 'wrap';
    idsWrap.style.gap = '8px';
    idsWrap.style.fontFamily = "'JetBrains Mono', monospace";
    idsWrap.style.fontSize = '11px';
    idsWrap.style.color = 'var(--text-muted)';
    tokens.slice(0, 12).forEach((t, i) => {
      // deterministic faux ID
      const id = ((t.charCodeAt(0) * 131 + (t.length || 1) * 17) % 50000) + 100;
      const el = document.createElement('span');
      el.innerHTML = `${t}<span style="color:var(--text-muted);opacity:0.6"> → ${id}</span>`;
      idsWrap.appendChild(el);
    });
    root.appendChild(idsWrap);
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

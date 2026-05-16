/* Top-level orchestration:
   - Language toggle (EN / 中) with smooth re-render
   - Scroll-spy TOC
   - Smooth scroll for nav links
   - Section reveal on scroll
   - Token utilities shared by visualizations */

(function () {
  'use strict';

  // ============================================================
  // i18n
  // ============================================================

  function applyLanguage(lang) {
    const dict = (window.I18N && window.I18N[lang]) || {};
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    document.documentElement.setAttribute('data-lang', lang);
    document.body.setAttribute('data-lang', lang);

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        // Allow simple inline HTML
        el.innerHTML = dict[key];
      }
    });

    // Update title tag separately (innerHTML doesn't run for non-content elements properly)
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl && dict[titleEl.getAttribute('data-i18n')]) {
      document.title = dict[titleEl.getAttribute('data-i18n')];
    }

    // Update meta description
    const metaEl = document.querySelector('meta[data-i18n]');
    if (metaEl && dict[metaEl.getAttribute('data-i18n')]) {
      metaEl.setAttribute('content', dict[metaEl.getAttribute('data-i18n')]);
    }

    // Update toggle button styling
    document.querySelectorAll('.lang-en').forEach((el) => el.classList.toggle('active', lang === 'en'));
    document.querySelectorAll('.lang-zh').forEach((el) => el.classList.toggle('active', lang === 'zh'));

    // Re-render KaTeX math after content swap
    if (window.renderMathInElement) {
      try { window.renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch (e) {}
    }

    // Notify visualizations (some may need to re-render text)
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));

    // Persist
    try { localStorage.setItem('llm-explainer-lang', lang); } catch (e) {}
  }

  function initLanguage() {
    let initial = 'en';
    try {
      const stored = localStorage.getItem('llm-explainer-lang');
      if (stored === 'zh' || stored === 'en') initial = stored;
    } catch (e) {}
    applyLanguage(initial);

    const toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-lang') || 'en';
        applyLanguage(current === 'en' ? 'zh' : 'en');
      });
    }
  }

  // ============================================================
  // Side TOC scroll-spy
  // ============================================================

  function initTOC() {
    const toc = document.querySelector('.toc-list');
    if (!toc) return;
    const sections = document.querySelectorAll('.section, .part-divider');
    sections.forEach((sec) => {
      const li = document.createElement('li');
      const id = sec.id;
      const titleEl = sec.querySelector('.sec-title, .part-title');
      li.textContent = titleEl ? titleEl.textContent.trim() : id;
      li.dataset.target = id;
      li.addEventListener('click', () => {
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      toc.appendChild(li);
    });

    // Rebuild TOC text when language changes
    window.addEventListener('langchange', () => {
      Array.from(toc.children).forEach((li) => {
        const target = document.getElementById(li.dataset.target);
        if (!target) return;
        const titleEl = target.querySelector('.sec-title, .part-title');
        if (titleEl) li.textContent = titleEl.textContent.trim();
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            Array.from(toc.children).forEach((li) => {
              li.classList.toggle('active', li.dataset.target === id);
            });
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ============================================================
  // Smooth scroll for header nav links
  // ============================================================

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (href.length <= 1) return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ============================================================
  // Section reveal animation
  // ============================================================

  function initSectionReveal() {
    const sections = document.querySelectorAll('.section, .part-divider');
    sections.forEach((s) => {
      s.style.opacity = '0';
      s.style.transform = 'translateY(20px)';
      s.style.transition = 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '-50px 0px -50px 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ============================================================
  // Shared utilities for visualizations
  // ============================================================

  window.DLM = window.DLM || {};

  // Mulberry32 — deterministic PRNG so visualizations are reproducible
  DLM.makeRNG = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // A "sentence" is an ordered list of token strings.
  // The same sentence is used across many visualizations for cross-referencing.
  DLM.SENTENCES = {
    en: [
      ['Attention', 'is', 'all', 'you', 'need', 'to', 'build', 'a', 'language', 'model', '.'],
      ['The', 'cat', 'sat', 'on', 'the', 'mat', 'near', 'the', 'window', '.'],
      ['def', 'attention', '(', 'q', ',', 'k', ',', 'v', ')', ':', 'return', 'softmax', '(', 'q', '@', 'k', '.T', ')', '@', 'v'],
      ['Large', 'language', 'models', 'learn', 'by', 'predicting', 'the', 'next', 'token', '.'],
    ],
    zh: [
      ['注意力', '是', '你', '需要', '的', '一切', ',', '足以', '构建', '语言', '模型', '。'],
      ['猫', '坐', '在', '窗', '边', '的', '垫', '子', '上', '。'],
      ['def', 'attention', '(', 'q', ',', 'k', ',', 'v', ')', ':', 'return', 'softmax', '(', 'q', '@', 'k', '.T', ')', '@', 'v'],
      ['大', '语言', '模型', '通过', '预测', '下一个', 'token', '来', '学习', '。'],
    ],
  };

  DLM.MASK = '[MASK]';

  DLM.pickSentence = function (idx) {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const arr = DLM.SENTENCES[lang] || DLM.SENTENCES.en;
    return arr[idx % arr.length];
  };

  // Render a token strip into a container element. `state` is an array of:
  //   { token: string, state: 'mask' | 'committed' | 'commit' | 'edited' | 'predicted' }
  DLM.renderTokens = function (container, state) {
    if (!container) return;
    container.innerHTML = '';
    state.forEach((cell, i) => {
      const el = document.createElement('span');
      el.className = 'token';
      if (cell.state) el.classList.add(cell.state);
      el.textContent = cell.token;
      el.style.animationDelay = (i * 20) + 'ms';
      container.appendChild(el);
    });
  };

  // Animate a state transition. Old states fade, changes get a brief "commit" class.
  DLM.transitionTokens = function (container, oldState, newState) {
    if (!container) return;
    container.innerHTML = '';
    newState.forEach((cell, i) => {
      const old = oldState[i];
      const el = document.createElement('span');
      el.className = 'token';
      const changed = !old || old.token !== cell.token || old.state !== cell.state;
      let stateClass = cell.state || '';
      if (changed && cell.state !== 'mask') {
        stateClass = (old && old.state === 'mask') ? 'commit' : (cell.state === 'edited' ? 'edited' : 'commit');
      } else if (cell.state === 'mask') {
        stateClass = 'mask';
      } else {
        stateClass = 'committed';
      }
      el.classList.add(stateClass);
      el.textContent = cell.token;
      el.style.animationDelay = (i * 12) + 'ms';
      container.appendChild(el);
    });
  };

  // Convert a sentence + a mask probability into a token-state array
  DLM.makeMaskedState = function (sentence, maskProb, rng) {
    return sentence.map((tok) => {
      const masked = rng() < maskProb;
      return { token: masked ? DLM.MASK : tok, state: masked ? 'mask' : 'committed' };
    });
  };

  // Confidence simulator: deterministic per-position confidence score
  // higher confidence on "common" positions, lower on hard ones
  DLM.makeConfidence = function (sentence, seed) {
    const rng = DLM.makeRNG(seed);
    return sentence.map((tok, i) => {
      // longer / less common tokens get lower base confidence
      const base = 0.55 + 0.4 * Math.exp(-tok.length / 6);
      const jitter = (rng() - 0.5) * 0.3;
      return Math.max(0.4, Math.min(0.99, base + jitter));
    });
  };

  // ============================================================
  // Boot
  // ============================================================

  function boot() {
    initLanguage();
    initTOC();
    initSmoothScroll();
    initSectionReveal();
    initTweaks();

    // KaTeX renders after deferred scripts load — re-render then
    window.addEventListener('load', () => {
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(document.body, {
            delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
            throwOnError: false,
          });
        } catch (e) { console.warn('KaTeX render error', e); }
      }
    });
  }

  // ============================================================
  // Tweaks panel — theme / palette / density
  // ============================================================

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "density": "comfortable"
  }/*EDITMODE-END*/;

  function applyTweaks(state) {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.setAttribute('data-density', state.density);
    document.querySelectorAll('[data-tweak]').forEach((group) => {
      const key = group.getAttribute('data-tweak');
      group.querySelectorAll('[data-value]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === state[key]);
      });
    });
    try { localStorage.setItem('diffusion-llm-tweaks', JSON.stringify(state)); } catch (e) {}
  }

  function initTweaks() {
    // Load saved
    let state = { ...TWEAK_DEFAULTS };
    try {
      const saved = localStorage.getItem('diffusion-llm-tweaks');
      if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch (e) {}

    applyTweaks(state);

    const launcher = document.getElementById('tweaksLauncher');
    const panel = document.getElementById('tweaksPanel');
    const closeBtn = document.getElementById('tweaksClose');

    function open() {
      panel.classList.add('open');
      launcher.classList.add('hidden');
    }
    function close() {
      panel.classList.remove('open');
      launcher.classList.remove('hidden');
    }

    launcher?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);

    document.querySelectorAll('[data-tweak]').forEach((group) => {
      const key = group.getAttribute('data-tweak');
      group.querySelectorAll('[data-value]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state[key] = btn.getAttribute('data-value');
          applyTweaks(state);
          window.dispatchEvent(new CustomEvent('palettechange', { detail: state }));
        });
      });
    });

    // Editor host integration (so the toolbar Tweaks toggle works)
    window.addEventListener('message', (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === '__activate_edit_mode') open();
      if (data.type === '__deactivate_edit_mode') close();
    });
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

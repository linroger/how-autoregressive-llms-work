/* §18b — Knowledge distillation
 * Teacher (large) produces a soft probability distribution over 8 candidate
 * next tokens. Student (small) tries to match it. Toggle hard (one-hot) vs
 * soft (T=4) labels; soft labels carry "dark knowledge" and student
 * converges faster. KL(teacher || student) tracked across epochs.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      title: 'Knowledge distillation: teacher → student',
      teacher: 'Teacher (70B)',
      student: 'Student (1B)',
      tokens: ['cat', 'dog', 'puppy', 'kitten', 'lion', 'tiger', 'car', 'tree'],
      inputs: ['The fluffy ___', 'A loyal ___', 'A roaring ___', 'A growing ___'],
      hard: 'Hard labels (one-hot)',
      soft: 'Soft labels (T = 4)',
      reset: 'Reset training',
      epoch: 'epoch',
      loss: 'KL(teacher ‖ student)',
      input: 'input',
      step: 'next token',
      hint: 'Dark knowledge lives in the *relative* probabilities. The teacher saying p(dog)=0.18 even when p(cat)=0.60 tells the student that dog is *like* cat — a richer signal than a one-hot label.',
    },
    zh: {
      title: '知识蒸馏:教师 → 学生',
      teacher: '教师 (70B)',
      student: '学生 (1B)',
      tokens: ['猫', '狗', '幼犬', '幼猫', '狮子', '老虎', '汽车', '树'],
      inputs: ['毛茸茸的 ___', '忠诚的 ___', '咆哮的 ___', '成长中的 ___'],
      hard: '硬标签 (one-hot)',
      soft: '软标签 (T = 4)',
      reset: '重置训练',
      epoch: '迭代',
      loss: 'KL(教师 ‖ 学生)',
      input: '输入',
      step: '下一个 token',
      hint: '暗知识藏在*相对*概率里。即使 p(猫)=0.60,教师仍说 p(狗)=0.18,这告诉学生:狗*类似*猫——比 one-hot 标签信息量大得多。',
    },
  };

  // Four input examples with their "true" target token index and the teacher's
  // logits over 8 candidates. Logits crafted so the secondary mass on
  // semantically related tokens conveys dark knowledge.
  const TEACHER_LOGITS = [
    [4.2, 2.8, 2.2, 3.4, 1.6, 1.4, -1.0, -0.6], // fluffy → cat (kitten, puppy nearby)
    [2.4, 4.4, 3.6, 1.8, 1.0, 0.8, -0.6, -0.4], // loyal → dog (puppy nearby)
    [0.6, 0.8, 0.2, 0.4, 4.4, 3.8, -0.8, -0.4], // roaring → lion (tiger nearby)
    [2.2, 2.0, 4.2, 3.8, 0.8, 0.6, -0.6, -0.2], // growing → puppy (kitten nearby)
  ];
  const TARGETS = [0, 1, 4, 2];
  const N = 8;
  const NUM_INPUTS = 4;

  let mode = 'soft'; // 'soft' or 'hard'
  let inputIdx = 0;
  let epoch = 0;
  let timer = null;
  let tipEl = null; // single tooltip instance reused across renders
  // Student logits initialized small, separate per (mode,input) so reset works
  let studentLogits = null;
  let teacherT = 4.0;

  function softmaxT(xs, T) {
    const m = Math.max(...xs);
    const e = xs.map(v => Math.exp((v - m) / T));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(v => v / s);
  }

  function klDiv(p, q) {
    let kl = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] > 1e-9) kl += p[i] * Math.log(p[i] / Math.max(q[i], 1e-9));
    }
    return kl;
  }

  function resetStudent() {
    const rng = DLM.makeRNG(7 + inputIdx * 13);
    // Start near zero with small noise — student knows nothing.
    studentLogits = Array.from({ length: N }, () => (rng() - 0.5) * 0.4);
    epoch = 0;
  }

  function stepStudent() {
    // One gradient step toward the chosen teacher target. Soft labels move
    // the student toward the *full* teacher distribution; hard labels move
    // only the top token.
    const teacher = mode === 'soft'
      ? softmaxT(TEACHER_LOGITS[inputIdx], teacherT)
      : (() => { const z = Array(N).fill(0); z[TARGETS[inputIdx]] = 1.0; return z; })();
    const student = softmaxT(studentLogits, 1.0);
    // gradient of CE w.r.t. logits is (student - teacher)
    const lr = mode === 'soft' ? 0.65 : 0.45;
    for (let i = 0; i < N; i++) {
      studentLogits[i] += lr * (teacher[i] - student[i]) * 4;
    }
    epoch += 1;
  }

  function currentKL() {
    // Always report KL against the soft teacher — this is what dark
    // knowledge captures, even when training on hard labels.
    const teacherSoft = softmaxT(TEACHER_LOGITS[inputIdx], teacherT);
    const studentP = softmaxT(studentLogits, 1.0);
    return klDiv(teacherSoft, studentP);
  }

  function render() {
    const root = document.getElementById('viz18b-distill');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';
    if (!studentLogits) resetStudent();

    // --- Controls ---
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px';

    const bHard = document.createElement('button');
    bHard.className = 'btn' + (mode === 'hard' ? ' active' : '');
    bHard.textContent = S.hard;
    bHard.addEventListener('click', () => { mode = 'hard'; resetStudent(); render(); });

    const bSoft = document.createElement('button');
    bSoft.className = 'btn' + (mode === 'soft' ? ' active' : '');
    bSoft.textContent = S.soft;
    bSoft.addEventListener('click', () => { mode = 'soft'; resetStudent(); render(); });

    const bReset = document.createElement('button');
    bReset.className = 'btn';
    bReset.textContent = S.reset;
    bReset.addEventListener('click', () => { resetStudent(); render(); });

    // Input selector
    const inSel = document.createElement('span');
    inSel.style.cssText = 'font-size:12px;color:var(--text-soft);margin-left:10px';
    inSel.innerHTML = `<span>${S.input}:</span> `;
    S.inputs.forEach((txt, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === inputIdx ? ' active' : '');
      b.textContent = txt;
      b.style.cssText = 'margin-left:4px;font-size:10px;padding:2px 6px';
      b.addEventListener('click', () => { inputIdx = i; resetStudent(); render(); });
      inSel.appendChild(b);
    });

    ctrls.appendChild(bSoft); ctrls.appendChild(bHard); ctrls.appendChild(bReset); ctrls.appendChild(inSel);
    root.appendChild(ctrls);

    // --- Tooltip (absolute, single instance) ---
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.style.cssText = 'position:absolute;pointer-events:none;padding:4px 8px;background:var(--bg-frame-2);border:1px solid var(--accent);color:var(--text);font-family:JetBrains Mono,monospace;font-size:11px;border-radius:4px;opacity:0;transition:opacity 120ms;z-index:50';
      document.body.appendChild(tipEl);
    }
    const tip = tipEl;

    // --- Layout ---
    const W = Math.min(root.clientWidth || 640, 720);
    const H = 280;
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H);

    const colW = (W - 30) / 2;
    const teacherX = 0;
    const studentX = colW + 30;
    const margin = { top: 28, right: 12, bottom: 30, left: 50 };
    const innerW = colW - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const teacherProbs = softmaxT(TEACHER_LOGITS[inputIdx], teacherT);
    const studentProbs = softmaxT(studentLogits, 1.0);

    const yScale = d3.scaleBand().domain(d3.range(N)).range([0, innerH]).padding(0.18);
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);

    function drawPanel(xOff, title, probs, color, dataSet) {
      const g = svg.append('g').attr('transform', `translate(${xOff + margin.left},${margin.top})`);
      svg.append('text').attr('x', xOff + margin.left).attr('y', 14)
        .style('font-size', '12px').style('font-weight', '600')
        .style('fill', 'var(--text-soft)').text(title);

      g.selectAll('.lbl').data(S.tokens).enter().append('text')
        .attr('x', -6).attr('y', (_, i) => yScale(i) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end').style('font-size', '10px')
        .style('font-family', "'JetBrains Mono', monospace")
        .style('fill', (_, i) => i === TARGETS[inputIdx] ? 'var(--accent)' : 'var(--text-soft)')
        .text(d => d);

      g.selectAll('.bar').data(probs.map((p, i) => ({ p, i }))).enter().append('rect')
        .attr('class', 'bar')
        .attr('x', 0).attr('y', d => yScale(d.i)).attr('height', yScale.bandwidth())
        .attr('width', 0).attr('fill', color)
        .attr('opacity', d => d.i === TARGETS[inputIdx] ? 1.0 : 0.7)
        .on('mouseover', function (e, d) {
          tip.style.opacity = 1;
          tip.innerHTML = `${S.tokens[d.i]} → p = ${d.p.toFixed(3)}`;
        })
        .on('mousemove', e => { tip.style.left = (e.pageX + 12) + 'px'; tip.style.top = (e.pageY + 12) + 'px'; })
        .on('mouseout', () => { tip.style.opacity = 0; })
        .transition().duration(450).attr('width', d => xScale(d.p));

      g.selectAll('.pv').data(probs).enter().append('text')
        .attr('y', (_, i) => yScale(i) + yScale.bandwidth() / 2 + 4)
        .attr('x', d => xScale(d) + 4)
        .style('font-size', '9px').style('font-family', "'JetBrains Mono', monospace")
        .style('fill', 'var(--text-muted)')
        .style('opacity', 0)
        .text(d => d.toFixed(2))
        .transition().delay(350).duration(300).style('opacity', 1);
    }

    drawPanel(teacherX, S.teacher, teacherProbs, 'var(--accent-3)', 'teacher');
    drawPanel(studentX, S.student, studentProbs, 'var(--accent-2)', 'student');

    // --- Stats row below: epoch counter + loss bar ---
    const stats = document.createElement('div');
    stats.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:8px 12px;background:var(--bg-elevated);border-radius:4px;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-soft)';
    const kl = currentKL();
    stats.innerHTML = `
      <span>${S.epoch}: <strong style="color:var(--accent)">${epoch}</strong></span>
      <span>${S.loss}: <strong style="color:${kl < 0.05 ? 'var(--accent-2)' : 'var(--accent-3)'}">${kl.toFixed(4)}</strong></span>
      <span style="font-size:10px;color:var(--text-muted)">${mode === 'soft' ? 'T = 4 (soft)' : 'one-hot target'}</span>
    `;
    root.appendChild(stats);

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5';
    hint.textContent = S.hint;
    root.appendChild(hint);

    // Auto-advance training every 400ms while loss > threshold
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (epoch >= 30) return; // cap so it stops
      stepStudent();
      // Lightweight re-render: just the bars + stats. Full re-render keeps code simple.
      render();
    }, 380);
  }

  function init() {
    resetStudent();
    window.addEventListener('langchange', () => { resetStudent(); render(); });
    window.addEventListener('resize', () => render());
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

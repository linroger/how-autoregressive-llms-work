/* §4 — Positional encoding
 * (a) Heatmap of sinusoidal PE values: positions × dimensions.
 * (b) Slider to scrub a position, highlighting that row + showing its PE vector.
 * (c) Toggle to RoPE preview — pairs of dimensions rotate as position increases.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      sinu: 'sinusoidal',
      rope: 'RoPE (rotary)',
      pos: 'position',
      hint: 'Each row is the PE vector for one position. Low dims rotate fast, high dims slowly.',
      ropeHint: 'RoPE rotates pairs of dimensions by an angle θ proportional to position. The relative angle between two positions encodes their distance.',
    },
    zh: {
      sinu: '正弦位置编码',
      rope: 'RoPE 旋转位置',
      pos: '位置',
      hint: '每行是一个位置的 PE 向量。低维快速旋转,高维缓慢旋转。',
      ropeHint: 'RoPE 把成对维度旋转一个与位置成正比的角度。两个位置间的相对角编码了它们的距离。',
    },
  };

  let mode = 'sinu';
  let curPos = 8;
  const POS = 32;
  const DIM = 32;

  function sinuPE(pos, d, D) {
    const i = Math.floor(d / 2);
    const denom = Math.pow(10000, (2 * i) / D);
    return (d % 2 === 0) ? Math.sin(pos / denom) : Math.cos(pos / denom);
  }

  function render() {
    const root = document.getElementById('viz1-4');
    if (!root) return;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    const S = STR[lang];
    root.innerHTML = '';

    // controls
    const ctrls = document.createElement('div');
    ctrls.className = 'viz-controls';
    ctrls.style.marginBottom = '10px';
    ctrls.style.display = 'flex';
    ctrls.style.flexWrap = 'wrap';
    ctrls.style.gap = '10px';
    ctrls.style.alignItems = 'center';

    const bSin = document.createElement('button'); bSin.className = 'btn' + (mode === 'sinu' ? ' active' : ''); bSin.textContent = S.sinu;
    const bRope = document.createElement('button'); bRope.className = 'btn' + (mode === 'rope' ? ' active' : ''); bRope.textContent = S.rope;
    bSin.addEventListener('click', () => { mode = 'sinu'; render(); });
    bRope.addEventListener('click', () => { mode = 'rope'; render(); });
    ctrls.appendChild(bSin); ctrls.appendChild(bRope);

    const lbl = document.createElement('label');
    lbl.style.color = 'var(--text-soft)'; lbl.style.fontSize = '12px';
    lbl.textContent = S.pos + ': ';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 0; slider.max = POS - 1; slider.value = curPos;
    slider.style.verticalAlign = 'middle';
    const v = document.createElement('span'); v.style.fontFamily = "'JetBrains Mono', monospace"; v.style.color = 'var(--accent)'; v.style.marginLeft = '6px'; v.textContent = curPos;
    slider.addEventListener('input', () => { curPos = +slider.value; v.textContent = curPos; updateHighlight(); });
    lbl.appendChild(slider); lbl.appendChild(v);
    ctrls.appendChild(lbl);
    root.appendChild(ctrls);

    if (mode === 'sinu') {
      drawHeatmap(root, S);
    } else {
      drawRoPE(root, S);
    }

    function updateHighlight() {
      if (mode === 'sinu') {
        d3.select(root).select('.pos-row')
          .attr('y', curPos * (cellH));
      } else {
        drawRoPE.update && drawRoPE.update();
      }
    }

    let cellH = 0;
    function drawHeatmap(parent, S) {
      const W = Math.min(parent.clientWidth || 540, 540);
      const margin = { top: 10, right: 14, bottom: 30, left: 50 };
      const innerW = W - margin.left - margin.right;
      const innerH = 280;
      const cellW = innerW / DIM;
      cellH = innerH / POS;

      const svg = d3.select(parent).append('svg').attr('width', W).attr('height', innerH + margin.top + margin.bottom);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const color = d3.scaleSequential().domain([-1, 1]).interpolator(d3.interpolateRdBu);
      for (let p = 0; p < POS; p++) {
        for (let d = 0; d < DIM; d++) {
          g.append('rect')
            .attr('x', d * cellW).attr('y', p * cellH)
            .attr('width', cellW - 0.2).attr('height', cellH - 0.2)
            .attr('fill', color(sinuPE(p, d, DIM)));
        }
      }
      // highlight row
      g.append('rect').attr('class', 'pos-row')
        .attr('x', -2).attr('y', curPos * cellH)
        .attr('width', innerW + 4).attr('height', cellH)
        .attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 2);

      svg.append('text').attr('x', margin.left + innerW/2).attr('y', innerH + margin.top + 20)
        .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)')
        .text('dimension d →');
      svg.append('text').attr('x', 14).attr('y', margin.top + innerH/2)
        .attr('transform', `rotate(-90, 14, ${margin.top + innerH/2})`)
        .attr('text-anchor','middle').style('font-size','11px').style('fill','var(--text-muted)')
        .text('position p ↓');

      const hint = document.createElement('div');
      hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '6px';
      hint.textContent = S.hint;
      parent.appendChild(hint);
    }

    function drawRoPE(parent, S) {
      // visualize 4 dimension-pairs as 2D rotating vectors
      const pairs = 4;
      const W = Math.min(parent.clientWidth || 540, 540);
      const cellSize = Math.min(120, (W - 40) / pairs);
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '10px';
      wrap.style.flexWrap = 'wrap';
      parent.appendChild(wrap);

      const svgs = [];
      for (let k = 0; k < pairs; k++) {
        const c = document.createElement('div');
        c.style.textAlign = 'center';
        const lab = document.createElement('div');
        lab.style.fontSize = '10px'; lab.style.color = 'var(--text-muted)';
        lab.textContent = `dim ${2*k}/${2*k+1}`;
        c.appendChild(lab);
        const svg = d3.select(c).append('svg').attr('width', cellSize).attr('height', cellSize);
        // axes
        const cx = cellSize/2, cy = cellSize/2, R = cellSize/2 - 8;
        svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', R)
          .attr('fill','none').attr('stroke','var(--bg-frame-2)').attr('stroke-width',1);
        svg.append('line').attr('x1', cx - R).attr('x2', cx + R).attr('y1', cy).attr('y2', cy)
          .attr('stroke','var(--text-muted)').attr('stroke-width',0.5).attr('opacity',0.3);
        svg.append('line').attr('y1', cy - R).attr('y2', cy + R).attr('x1', cx).attr('x2', cx)
          .attr('stroke','var(--text-muted)').attr('stroke-width',0.5).attr('opacity',0.3);
        const arrow = svg.append('line').attr('class','arrow').attr('x1', cx).attr('y1', cy)
          .attr('stroke','var(--accent)').attr('stroke-width',2);
        const head = svg.append('circle').attr('class','head').attr('r', 3).attr('fill','var(--accent)');
        svgs.push({ svg, arrow, head, cx, cy, R, k });
        wrap.appendChild(c);
      }
      function update() {
        svgs.forEach(o => {
          const freq = 1 / Math.pow(10000, (2*o.k) / DIM);
          const theta = curPos * freq;
          const x = o.cx + o.R * Math.cos(theta);
          const y = o.cy - o.R * Math.sin(theta);
          o.arrow.transition().duration(200).attr('x2', x).attr('y2', y);
          o.head.transition().duration(200).attr('cx', x).attr('cy', y);
        });
      }
      drawRoPE.update = update;
      update();

      const hint = document.createElement('div');
      hint.style.fontSize = '12px'; hint.style.color = 'var(--text-muted)'; hint.style.marginTop = '10px';
      hint.textContent = S.ropeHint;
      parent.appendChild(hint);
    }
  }

  function init() {
    window.addEventListener('langchange', render);
    window.addEventListener('resize', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

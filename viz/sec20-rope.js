/* §20 — RoPE: rotary position embeddings
 * Show 2D vectors q,k. Rotate q by mθ and k by nθ.
 * The inner product f(q,m)·f(k,n) = q^T R_{n-m} k depends only on (n-m).
 * Sliders for m (query pos) and n (key pos). Also a "shift both" demo.
 */
(function () {
  'use strict';

  const STR = {
    en: {
      m: 'query position m', n: 'key position n', shift: 'shift both by',
      title: 'Rotary position embeddings: dot-product depends only on (n − m)',
      qLabel: 'q (rotated by mθ)', kLabel: 'k (rotated by nθ)',
      dot: 'rotated dot product', original: 'original q · k', relative: 'relative offset n − m',
      caption: 'Try sliding the shift: rotating both vectors by the same extra angle leaves the dot product unchanged. RoPE encodes only relative positions.',
    },
    zh: {
      m: '查询位置 m', n: '键位置 n', shift: '同时平移',
      title: '旋转位置编码: 点积只取决于 (n − m)',
      qLabel: 'q (按 mθ 旋转)', kLabel: 'k (按 nθ 旋转)',
      dot: '旋转后点积', original: '原始 q · k', relative: '相对偏移 n − m',
      caption: '拖动 shift: 把两个向量同时再转同一角度, 点积不变. RoPE 只编码相对位置.',
    },
  };

  let m = 0, n = 4, shift = 0;
  const THETA = Math.PI / 8;   // base angular step
  const q0 = [1.0, 0.3];        // original q
  const k0 = [0.7, 0.7];        // original k

  function getLang() { return document.documentElement.getAttribute('data-lang') || 'en'; }
  function rot(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c - v[1]*s, v[0]*s + v[1]*c]; }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1]; }

  function render() {
    const root = document.getElementById('viz5-1');
    if (!root) return;
    const S = STR[getLang()];
    root.innerHTML = '';

    // Header / controls
    const ctrl = document.createElement('div');
    ctrl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:16px';
    ctrl.innerHTML = `
      <div>
        <div style="font-family:Inter;font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${S.m}: <b style="color:var(--accent)">${m}</b></div>
        <input type="range" id="rope-m" min="0" max="16" value="${m}" style="width:100%">
      </div>
      <div>
        <div style="font-family:Inter;font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${S.n}: <b style="color:var(--accent-2)">${n}</b></div>
        <input type="range" id="rope-n" min="0" max="16" value="${n}" style="width:100%">
      </div>
      <div>
        <div style="font-family:Inter;font-size:0.74rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${S.shift}: <b style="color:var(--accent-3)">+${shift}</b></div>
        <input type="range" id="rope-shift" min="0" max="12" value="${shift}" style="width:100%">
      </div>
    `;
    root.appendChild(ctrl);

    // SVG
    const W = root.clientWidth || 720;
    const H = 360;
    const cx = W / 2 - 60, cy = H / 2;
    const R = Math.min(140, H/2 - 30);
    const svg = d3.select(root).append('svg').attr('width', W).attr('height', H).style('overflow','visible');

    // Title text
    svg.append('text').attr('x', W/2).attr('y', 16).attr('text-anchor','middle')
      .style('font-family','Inter,sans-serif').style('font-size','12px').style('fill','var(--text-soft)')
      .text(S.title);

    // Grid circle
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', R)
      .attr('fill','none').attr('stroke','var(--border)').attr('stroke-dasharray','3 4');
    svg.append('line').attr('x1', cx - R).attr('y1', cy).attr('x2', cx + R).attr('y2', cy)
      .attr('stroke','var(--border)').attr('stroke-width', 0.5);
    svg.append('line').attr('x1', cx).attr('y1', cy - R).attr('x2', cx).attr('y2', cy + R)
      .attr('stroke','var(--border)').attr('stroke-width', 0.5);

    // Original vectors (faint)
    drawVec(svg, cx, cy, q0, R, 'var(--text-muted)', 0.4, 'q₀');
    drawVec(svg, cx, cy, k0, R, 'var(--text-muted)', 0.4, 'k₀');

    // Rotated vectors
    const aQ = (m + shift) * THETA;
    const aK = (n + shift) * THETA;
    const qR = rot(q0, aQ);
    const kR = rot(k0, aK);
    drawVec(svg, cx, cy, qR, R, 'var(--accent)', 1.0, 'q');
    drawVec(svg, cx, cy, kR, R, 'var(--accent-2)', 1.0, 'k');

    // Arc showing angle (n-m)*θ between them
    const a1 = Math.atan2(qR[1], qR[0]);
    const a2 = Math.atan2(kR[1], kR[0]);
    const arc = d3.arc().innerRadius(R*0.25).outerRadius(R*0.3)
      .startAngle(a1 + Math.PI/2).endAngle(a2 + Math.PI/2);
    svg.append('path').attr('d', arc()).attr('transform', `translate(${cx},${cy})`)
      .attr('fill','var(--accent-3)').attr('opacity', 0.7);

    // Readout panel on right
    const dotRotated = dot(qR, kR);
    const dotOriginal = dot(q0, k0);
    const dotRelative = dot(q0, rot(k0, (n - m) * THETA));   // = f(q,m)·f(k,n) by closed form

    const panelX = cx + R + 50;
    const stat = (y, label, value, color) => {
      svg.append('text').attr('x', panelX).attr('y', y)
        .style('font-family','Inter,sans-serif').style('font-size','11px')
        .style('fill','var(--text-soft)').style('text-transform','uppercase').style('letter-spacing','0.06em').text(label);
      svg.append('text').attr('x', panelX).attr('y', y + 22)
        .style('font-family','JetBrains Mono,monospace').style('font-size','18px')
        .style('fill', color).text(value);
    };
    stat(cy - 80, S.dot,       dotRotated.toFixed(4),  'var(--accent)');
    stat(cy - 20, 'q · R_{n-m} k', dotRelative.toFixed(4), 'var(--accent-3)');
    stat(cy + 40, S.original,  dotOriginal.toFixed(4), 'var(--text-muted)');
    stat(cy + 100, S.relative, String(n - m),          'var(--accent-2)');

    // Caption
    const cap = document.createElement('div');
    cap.style.cssText = 'margin-top:10px;font-size:0.84rem;color:var(--text-muted);font-style:italic;max-width:60ch';
    cap.textContent = S.caption;
    root.appendChild(cap);

    // Wire
    document.getElementById('rope-m').addEventListener('input', e => { m = +e.target.value; render(); });
    document.getElementById('rope-n').addEventListener('input', e => { n = +e.target.value; render(); });
    document.getElementById('rope-shift').addEventListener('input', e => { shift = +e.target.value; render(); });
  }

  function drawVec(svg, cx, cy, v, R, color, op, label) {
    const x2 = cx + v[0] * R / 1.4;
    const y2 = cy - v[1] * R / 1.4;
    svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2)
      .attr('stroke', color).attr('stroke-width', 2).attr('opacity', op)
      .attr('marker-end','url(#arrow-' + color.replace(/[^a-z]/g,'') + ')');
    // arrowhead approximation: small triangle
    const ang = Math.atan2(y2 - cy, x2 - cx);
    const ah = 7;
    svg.append('polygon')
      .attr('points', `${x2},${y2} ${x2 - ah*Math.cos(ang - 0.4)},${y2 - ah*Math.sin(ang - 0.4)} ${x2 - ah*Math.cos(ang + 0.4)},${y2 - ah*Math.sin(ang + 0.4)}`)
      .attr('fill', color).attr('opacity', op);
    svg.append('text').attr('x', x2 + 8*Math.cos(ang)).attr('y', y2 + 8*Math.sin(ang) + 4)
      .style('font-family','JetBrains Mono,monospace').style('font-size','12px')
      .style('fill', color).attr('opacity', op).text(label);
  }

  function init() {
    render();
    window.addEventListener('langchange', render);
    window.addEventListener('resize', () => { clearTimeout(window.__ropeT); window.__ropeT = setTimeout(render, 120); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

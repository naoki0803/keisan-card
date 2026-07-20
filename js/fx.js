// 紙吹雪エフェクト。固定canvasに描画し、ゲーム進行を一切ブロックしない。
// パーティクルが無いときは rAF ループも回さない。

const COLORS = ['#FF8A5C', '#62B6E8', '#FFD34E', '#FF5252', '#7ED957'];

let canvas = null;
let ctx = null;
let particles = [];
let running = false;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.getElementById('confetti');
  ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

function loop() {
  if (particles.length === 0) {
    running = false;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    return;
  }
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const now = performance.now();
  particles = particles.filter((p) => now - p.born < p.life);
  for (const p of particles) {
    const t = (now - p.born) / 1000;
    const x = p.x + p.vx * t;
    const y = p.y + p.vy * t + 500 * t * t; // 重力
    const fade = 1 - (now - p.born) / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.spin * t);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  requestAnimationFrame(loop);
}

function spawn(x, y, count, spread, life) {
  ensureCanvas();
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = 250 + Math.random() * 250;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      size: 7 + Math.random() * 5,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      born: now,
      life,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

// 正解時: 控えめに一瞬だけ舞う
export function burst(x, y) {
  spawn(x, y, 18, Math.PI * 0.9, 700);
}

// ベスト更新時: すこし盛大に
export function celebrate() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  spawn(w * 0.25, h * 0.75, 30, Math.PI * 0.7, 1200);
  spawn(w * 0.75, h * 0.75, 30, Math.PI * 0.7, 1200);
}

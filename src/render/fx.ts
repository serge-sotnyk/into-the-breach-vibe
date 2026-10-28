// Particles and floating text in board space. Purely cosmetic and non-blocking.

interface Part {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  kind: 'dot' | 'smoke' | 'chunk' | 'ring' | 'spark';
  rot: number;
}

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

const rr = (a: number, b: number): number => a + Math.random() * (b - a);

export class FX {
  parts: Part[] = [];
  floats: Float[] = [];
  shake = 0;

  clear(): void {
    this.parts = [];
    this.floats = [];
    this.shake = 0;
  }

  private add(p: Partial<Part> & { x: number; y: number }): void {
    const life = p.life ?? 0.6;
    this.parts.push({ z: 0, vx: 0, vy: 0, vz: 0, g: 0, size: 3, grow: 0, color: '#fff', kind: 'dot', rot: 0, ...p, life, max: life });
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.g * dt;
      p.z += p.vz * dt;
      if (p.z < 0 && p.g > 0) {
        p.z = 0;
        p.vz *= -0.35;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
      p.size += p.grow * dt;
      p.rot += dt * 6;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) f.life -= dt;
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      const y = p.y - p.z;
      ctx.globalAlpha = p.kind === 'smoke' ? a * 0.55 : a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath();
        ctx.ellipse(p.x, y, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'chunk') {
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x - p.vx * 0.04, y - p.vy * 0.04 + p.vz * 0.04);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, y, Math.max(0.2, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of this.floats) {
      const k = 1 - f.life / f.max;
      const a = Math.min(1, f.life / (f.max * 0.4));
      const y = f.y - 26 - k * 26;
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size}px "Chakra Petch", Tektur, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5,8,12,0.9)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  text(x: number, y: number, text: string, color = '#fff', size = 18, life = 1.1): void {
    // nudge stacked texts apart
    const near = this.floats.filter((f) => Math.abs(f.x - x) < 30 && Math.abs(f.y - y) < 20 && f.life > f.max * 0.6).length;
    this.floats.push({ x, y: y - near * 18, text, color, life, max: life, size });
  }

  sparks(x: number, y: number, color = '#ffd36b', n = 10): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(60, 180);
      this.add({ x, y, z: rr(8, 24), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rr(40, 140), g: 380, life: rr(0.25, 0.5), color, kind: 'spark' });
    }
  }

  explosion(x: number, y: number, scale = 1): void {
    this.shake = Math.max(this.shake, 6 * scale);
    for (let i = 0; i < 14 * scale; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(20, 90) * scale;
      this.add({ x, y, z: rr(4, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rr(10, 50), life: rr(0.3, 0.6), size: rr(4, 9) * scale, grow: -8, color: i % 3 ? '#ffb347' : '#fff1a8' });
    }
    for (let i = 0; i < 8 * scale; i++) this.smoke(x + rr(-14, 14) * scale, y + rr(-6, 6), rr(6, 11) * scale);
    this.ring(x, y, '#ffd36b', 34 * scale);
    this.sparks(x, y, '#ffe08a', Math.round(8 * scale));
  }

  smoke(x: number, y: number, size = 8, color = '#5c5f66'): void {
    this.add({ x, y, z: rr(6, 20), vx: rr(-10, 10), vy: rr(-6, 6), vz: rr(18, 40), life: rr(0.7, 1.3), size, grow: 10, color, kind: 'smoke' });
  }

  debris(x: number, y: number, color: string, n = 10): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(30, 110);
      this.add({ x, y, z: rr(10, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rr(80, 200), g: 520, life: rr(0.6, 1.1), size: rr(3, 6), color, kind: 'chunk' });
    }
  }

  splash(x: number, y: number): void {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(20, 80);
      this.add({ x, y, z: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rr(90, 220), g: 520, life: rr(0.5, 0.9), size: rr(2, 4), color: i % 2 ? '#bfeaff' : '#5fb8e6' });
    }
    this.ring(x, y, '#bfeaff', 30);
  }

  ring(x: number, y: number, color: string, size: number): void {
    this.add({ x, y, life: 0.45, size: size * 0.3, grow: size * 2.2, color, kind: 'ring' });
  }

  dust(x: number, y: number, color = '#b9a27a', n = 8): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 5, z: 2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 20, vz: rr(10, 30), life: rr(0.4, 0.8), size: rr(4, 7), grow: 8, color, kind: 'smoke' });
    }
  }

  embers(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + rr(-12, 12), y: y + rr(-5, 5), z: rr(4, 16), vx: rr(-15, 15), vy: rr(-8, 8), vz: rr(40, 90), life: rr(0.5, 1), size: rr(1.5, 3), color: i % 2 ? '#ff9a3a' : '#ffd24a' });
    }
  }

  heal(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      this.add({ x: x + rr(-14, 14), y: y + rr(-6, 6), z: rr(4, 30), vz: rr(30, 60), life: rr(0.5, 0.9), size: rr(2, 3.5), color: '#7dffa8' });
    }
  }

  frost(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(20, 70);
      this.add({ x, y, z: rr(6, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rr(-10, 30), life: rr(0.4, 0.8), size: rr(2, 4), color: i % 2 ? '#e8fbff' : '#8fdcff' });
    }
  }
}

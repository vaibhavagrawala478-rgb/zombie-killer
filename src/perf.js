// F3 performance overlay: fps, frame time, draw calls, triangles, GPU memory counts, entity counts.
import { G } from './state.js';

export class Perf {
  constructor(renderer) {
    this.r = renderer; this.visible = false;
    this.el = document.createElement('pre');
    this.el.id = 'perf';
    this.el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#9dffb0;font:12px/1.35 Consolas,monospace;pointer-events:none;display:none;white-space:pre;border:1px solid rgba(157,255,176,.3)';
    document.body.appendChild(this.el);
    this.acc = 0; this.frames = 0; this.worst = 0; this.msSum = 0; this.t0 = 0;
    addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); this.toggle(); } });
  }
  toggle() { this.visible = !this.visible; this.el.style.display = this.visible ? 'block' : 'none'; this.r.info.autoReset = !this.visible; }
  begin() { if (!this.visible) return; this.r.info.reset(); this.t0 = performance.now(); }
  end(dt) {
    if (!this.visible) return;
    const cpu = performance.now() - this.t0; // render-submit CPU time (GPU time needs timer queries; use fps as the truth)
    this.acc += dt; this.frames++; this.worst = Math.max(this.worst, dt * 1000); this.msSum += cpu;
    if (this.acc < 0.5) return;
    const i = this.r.info, fps = this.frames / this.acc;
    this.el.textContent =
      `FPS ${fps.toFixed(0).padStart(3)}   frame ${(1000 / fps).toFixed(1)} ms (worst ${this.worst.toFixed(0)})\n` +
      `render submit ${(this.msSum / this.frames).toFixed(1)} ms   res x${this.r.getPixelRatio().toFixed(2)}  quality ${G.qualityName || '?'}\n` +
      `draw calls ${i.render.calls}   tris ${(i.render.triangles / 1000).toFixed(0)}k\n` +
      `geometries ${i.memory.geometries}   textures ${i.memory.textures}\n` +
      `zombies ${G.zombies.aliveCount} (+${G.zombies.list.length - G.zombies.aliveCount} corpses)   gems ${G.gems.list.length}`;
    this.acc = 0; this.frames = 0; this.worst = 0; this.msSum = 0;
  }
}

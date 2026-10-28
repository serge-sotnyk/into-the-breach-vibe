// Board camera for touch screens: pinch to zoom around the fingers, drag to pan.
// `base` is the fitted view at zoom 1 (scale and origin in CSS pixels); the camera adds
// a zoom factor and an offset on top of it.

export const MAX_ZOOM = 2.2;

export interface Camera {
  zoom: number;
  x: number;
  y: number;
}

export interface View0 {
  scale: number;
  ox: number;
  oy: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Zooms by `factor` around the screen point (px, py), keeping the board point under it in place. */
export function zoomAround(cam: Camera, base: View0, px: number, py: number, factor: number): Camera {
  const zoom = clamp(cam.zoom * factor, 1, MAX_ZOOM);
  const s0 = base.scale * cam.zoom;
  const s1 = base.scale * zoom;
  const bx = (px - base.ox - cam.x) / s0;
  const by = (py - base.oy - cam.y) / s0;
  return { zoom, x: px - bx * s1 - base.ox, y: py - by * s1 - base.oy };
}

/** At zoom 1 the board sits where it was fitted; zoomed in, its centre (`centre`, board
 *  units) may move anywhere inside `area` but no further, so it can't be lost off-screen. */
export function clampCamera(cam: Camera, base: View0, area: { x0: number; y0: number; x1: number; y1: number }, centre: [number, number]): Camera {
  if (cam.zoom <= 1.001) return { zoom: 1, x: 0, y: 0 };
  const s = base.scale * cam.zoom;
  const sx = base.ox + cam.x + centre[0] * s;
  const sy = base.oy + cam.y + centre[1] * s;
  return { zoom: cam.zoom, x: cam.x + clamp(sx, area.x0, area.x1) - sx, y: cam.y + clamp(sy, area.y0, area.y1) - sy };
}

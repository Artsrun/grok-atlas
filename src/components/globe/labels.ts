import * as THREE from "three";
import { ll2xyz } from "@/lib/atlas/geo";
import type { Spot } from "@/lib/atlas/graticule";

/** One cell per reading. 8 across keeps the sheet square-ish at any count. */
const COLS = 8;
const CELL_W = 256;
const CELL_H = 128;
export const LABEL_ASPECT = CELL_W / CELL_H;

/** Every degree reading baked into one sheet — one texture, one draw call. */
export const labelAtlas = (texts: string[]): THREE.CanvasTexture => {
  const rows = Math.max(1, Math.ceil(texts.length / COLS));
  const cv = document.createElement("canvas");
  cv.width = COLS * CELL_W;
  cv.height = rows * CELL_H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = `600 62px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    texts.forEach((t, i) => {
      const x = (i % COLS) * CELL_W + CELL_W / 2;
      const y = Math.floor(i / COLS) * CELL_H + CELL_H / 2;
      ctx.fillText(t, x, y);
    });
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
};

/**
 * Four vertices per reading, all sharing the reading's anchor: the corner
 * attribute spreads them in view space, so the buffer never needs rebuilding
 * when the camera moves.
 */
export const coordGeometry = (spots: Spot[], radius: number): THREE.BufferGeometry => {
  const rows = Math.max(1, Math.ceil(spots.length / COLS));
  const pos = new Float32Array(spots.length * 4 * 3);
  const corner = new Float32Array(spots.length * 4 * 2);
  const uv = new Float32Array(spots.length * 4 * 2);
  const index = new Uint16Array(spots.length * 6);
  const half = LABEL_ASPECT / 2;
  const corners: [number, number][] = [
    [-half, -0.5],
    [half, -0.5],
    [half, 0.5],
    [-half, 0.5],
  ];

  spots.forEach((s, i) => {
    const p = ll2xyz(s.lat, s.lon, radius);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    // Canvas rows run down, UV rows run up.
    const u0 = col / COLS;
    const v0 = 1 - (row + 1) / rows;
    corners.forEach(([cx, cy], k) => {
      const v = i * 4 + k;
      pos[v * 3] = p[0];
      pos[v * 3 + 1] = p[1];
      pos[v * 3 + 2] = p[2];
      corner[v * 2] = cx;
      corner[v * 2 + 1] = cy;
      uv[v * 2] = u0 + ((cx / LABEL_ASPECT + 0.5) * 1) / COLS;
      uv[v * 2 + 1] = v0 + ((cy + 0.5) * 1) / rows;
    });
    const b = i * 4;
    index.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  // Anchors are all over the sphere; a per-quad sphere would cull half of them.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.2);
  return g;
};

// The shell of the core: a sphere tiled in hexagons (a Goldberg polyhedron), every
// tile a bevelled plate that flies in and locks to its neighbours. No rendering here.
const FLOATS = 12; // position 3, normal 3, centre 3, order, seed, glow

export const SHELL_AXIS = (() => {
  const [x, y, z] = [0.36, 0.88, 0.3], length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
})();

const normalize = ([x, y, z]) => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// A geodesic sphere: each icosahedron face split into `split * split` triangles.
function geodesic(split) {
  const t = (1 + Math.sqrt(5)) / 2;
  const base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(normalize);
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const vertices = [], index = new Map(), triangles = [];
  const at = (a, b, c, i, j) => {
    const k = split - i - j;
    const p = normalize([0, 1, 2].map((n) => (a[n] * k + b[n] * i + c[n] * j) / split));
    const key = p.map((v) => Math.round(v * 1e4)).join();
    if (!index.has(key)) { index.set(key, vertices.length); vertices.push(p); }
    return index.get(key);
  };
  for (const [ia, ib, ic] of faces) {
    const [a, b, c] = [base[ia], base[ib], base[ic]];
    for (let i = 0; i < split; i += 1) {
      for (let j = 0; j < split - i; j += 1) {
        triangles.push([at(a, b, c, i, j), at(a, b, c, i + 1, j), at(a, b, c, i, j + 1)]);
        if (i + j < split - 1) triangles.push([at(a, b, c, i + 1, j), at(a, b, c, i + 1, j + 1), at(a, b, c, i, j + 1)]);
      }
    }
  }
  return { vertices, triangles };
}

export function buildShell(split = 8) {
  let state = 0x464c4944;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const { vertices, triangles } = geodesic(split);
  const around = vertices.map(() => []);
  for (const tri of triangles) {
    const mid = normalize([0, 1, 2].map((n) => vertices[tri[0]][n] + vertices[tri[1]][n] + vertices[tri[2]][n]));
    for (const v of tri) around[v].push(mid);
  }
  const data = [];
  let plates = 0;
  vertices.forEach((center, v) => {
    const side = dot(center, SHELL_AXIS);
    // An open band around the middle lets the core show through, whatever the angle.
    if (Math.abs(side) < 0.1) return;
    const seed = random(), raised = seed > 0.8 ? 0.05 : seed > 0.5 ? 0.022 : 0;
    const height = 1 + raised, order = (side + 1) / 2 * 0.72 + random() * 0.06 + 0.04;
    const u = normalize(cross(center, Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = cross(center, u);
    const ring = around[v].slice().sort((a, b) => Math.atan2(dot(a, w), dot(a, u)) - Math.atan2(dot(b, w), dot(b, u)));
    const level = (scale, radius) => ring.map((corner) => [0, 1, 2].map((n) => (center[n] + (corner[n] - center[n]) * scale) * radius - center[n] * height));
    const add = (a, b, c, glow) => {
      let n = normalize(cross(sub(b, a), sub(c, a)));
      if (dot(n, [a[0] + center[0], a[1] + center[1], a[2] + center[2]]) < 0) { n = n.map((x) => -x); [b, c] = [c, b]; }
      for (const p of [a, b, c]) data.push(p[0], p[1], p[2], n[0], n[1], n[2], center[0] * height, center[1] * height, center[2] * height, order, seed, glow);
    };
    const quad = (a, b, c, d, glow) => { add(a, b, c, glow); add(a, c, d, glow); };
    const top = level(0.8, height), lip = level(0.9, height - 0.02), foot = level(0.9, 0.9), lamp = level(0.42, height + 0.001);
    const hasLamp = random() < 0.24;
    const middle = [0, 0, 0];
    ring.forEach((_, i) => {
      const next = (i + 1) % ring.length;
      if (hasLamp) {
        add(lamp[i], lamp[next], middle.map((_, n) => center[n] * 0.001), 1.5);
        quad(lamp[i], lamp[next], top[next], top[i], 0);
      } else {
        add(top[i], top[next], middle.map((_, n) => center[n] * 0.001), 0);
      }
      quad(top[i], top[next], lip[next], lip[i], 0.75);
      quad(lip[i], lip[next], foot[next], foot[i], 0);
    });
    plates += 1;
  });
  return { data: new Float32Array(data), plates, stride: FLOATS };
}

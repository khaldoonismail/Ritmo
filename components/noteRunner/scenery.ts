import * as THREE from "three";
import { Materials, PALETTE } from "./look";
import type { RunnerQuality } from "./quality";

// Scenery shared by Note Runner and Up or Down: hills and clouds far
// behind, cartoon trees behind the play area (peeking over it) and bushes
// in front. "low" keeps a few trees and clouds.
//
// `add` places each object: `parallax` is how fast it scrolls relative to
// the runner (1 = with the ground), `decor` marks extras hidden when frames
// get slow, `span`/`margin` set how it wraps around when it leaves the
// screen. `top` is the height trees must reach; `bottom` sizes the bushes
// (`bushes: false` leaves them out).

export type SceneryAdd = (o: THREE.Object3D, parallax: number, decor: boolean, span?: number, margin?: number) => void;

export function buildScenery(
  mat: Materials,
  quality: RunnerQuality,
  pageTop: number,
  pageBottom: number,
  add: SceneryAdd,
  bushes = true
) {
  const high = quality === "high";
  if (high) {
    const hillGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const far = i % 2 === 0;
      const hill = new THREE.Mesh(hillGeo, mat.get(far ? PALETTE.hillFar : PALETTE.hillNear));
      const r = far ? 16 + (i % 3) * 4 : 11 + (i % 3) * 3;
      hill.scale.set(r, (pageTop + 3) * (far ? 0.55 : 0.4) + (i % 3), r * 0.5);
      hill.position.set(-30 + i * 14, 0, far ? -38 : -26);
      add(hill, far ? 0.15 : 0.25, true, 112, 22);
    }
  }

  const puff = new THREE.SphereGeometry(1, high ? 12 : 8, high ? 8 : 6);
  const cloudCount = high ? 6 : 3;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j++) {
      const p = new THREE.Mesh(puff, mat.get(PALETTE.cloud));
      const s = 1.1 + ((i + j) % 3) * 0.4;
      p.scale.set(s * 1.2, s * 0.8, s * 0.7);
      p.position.set(j * 1.4 - n * 0.7, ((j * 7) % 3) * 0.3, 0);
      cloud.add(p);
    }
    cloud.position.set(-20 + i * (90 / cloudCount), pageTop + 4.5 + (i % 3) * 1.6, -30);
    add(cloud, 0.1, i >= 3, 96, 14);
  }

  const blob = new THREE.IcosahedronGeometry(1, high ? 1 : 0);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 7);
  const cone = new THREE.ConeGeometry(1, 1.6, high ? 8 : 6);
  let k = 0;
  const step = high ? 3.2 : 5;
  for (let x = -10; x < 60; x += step) {
    const tree = new THREE.Group();
    const height = pageTop + 0.3 + ((k * 7) % 5) * 0.4;
    const trunk = new THREE.Mesh(trunkGeo, mat.get(PALETTE.wood));
    trunk.scale.y = height;
    trunk.position.y = height / 2;
    tree.add(trunk);
    if (k % 3 === 2) {
      for (let t = 0; t < 3; t++) {
        const c = new THREE.Mesh(cone, mat.get(PALETTE.pine));
        const s = 1.5 - t * 0.35;
        c.scale.set(s, s, s);
        c.position.y = height + 0.4 + t * 0.85;
        tree.add(c);
      }
    } else {
      const crowns: [number, number, number, number][] = [
        [0, 1.0, 0, 1.35],
        [-0.75, 0.55, 0.2, 0.95],
        [0.8, 0.6, -0.1, 1.0],
      ];
      crowns.forEach(([cx, cy, cz, s], j) => {
        const c = new THREE.Mesh(blob, mat.get(j === 0 ? PALETTE.leaf : PALETTE.leafLight));
        c.scale.setScalar(s);
        c.position.set(cx, height + cy, cz);
        tree.add(c);
      });
    }
    tree.position.set(x + ((k * 13) % 3) * 0.6, 0, -2.6 - ((k * 5) % 4));
    add(tree, 0.8, false);

    if (high && bushes && k % 2 === 0) {
      const bush = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const p = new THREE.Mesh(blob, mat.get(b === 1 ? PALETTE.leafLight : PALETTE.leaf));
        const s = 0.35 + (b === 1 ? 0.12 : 0);
        p.scale.setScalar(s);
        p.position.set((b - 1) * 0.42, s * 0.6, 0);
        bush.add(p);
      }
      bush.scale.y = Math.min(1, (pageBottom * 0.9) / 0.6);
      bush.position.set(x + 1.6, 0, 1.4);
      add(bush, 1.15, true);
    }
    k++;
  }
}

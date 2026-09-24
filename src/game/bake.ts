import * as THREE from "three";

/**
 * GLBs are meshopt-compressed, which quantizes vertex data and folds a dequantization transform into
 * each node. Anything we re-parent (props into rigid bodies, car parts) must not depend on node
 * transforms, so we bake the transform into float geometry instead.
 */
export function toFloat(geo: THREE.BufferGeometry) {
  for (const name of ["position", "normal"]) {
    const a = geo.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) continue;
    const out = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) {
      out[i * 3] = a.getX(i);
      out[i * 3 + 1] = a.getY(i);
      out[i * 3 + 2] = a.getZ(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  return geo;
}

/**
 * Returns a new group whose meshes carry `root`'s geometry expressed relative to `frame`
 * (a world matrix), with identity transforms — ready to drop under a rigid body placed at `frame`.
 */
export function bakeRelativeTo(root: THREE.Object3D, frame: THREE.Matrix4) {
  root.updateWorldMatrix(true, true);
  const inv = frame.clone().invert();
  const group = new THREE.Group();
  group.name = root.name;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = toFloat(mesh.geometry.clone());
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    geo.computeBoundingSphere();
    const baked = new THREE.Mesh(geo, mesh.material);
    baked.castShadow = mesh.castShadow;
    baked.receiveShadow = mesh.receiveShadow;
    baked.name = mesh.name;
    group.add(baked);
  });
  return group;
}

export function frameFrom(pos: THREE.Vector3Like, quat: THREE.QuaternionLike) {
  return new THREE.Matrix4().compose(new THREE.Vector3().copy(pos), new THREE.Quaternion().copy(quat), new THREE.Vector3(1, 1, 1));
}

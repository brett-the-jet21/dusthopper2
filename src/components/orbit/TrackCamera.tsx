"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";

export function TrackCamera({
  target,
  enabled,
}: {
  target: THREE.Vector3;
  enabled: boolean;
}) {
  const { camera } = useThree();
  const prev = useRef<THREE.Vector3>(target.clone());
  const vel = useRef<THREE.Vector3>(new THREE.Vector3());

  useFrame(() => {
    if (!enabled) {
      // keep prev updated even when disabled
      prev.current.copy(target);
      return;
    }

    // estimate velocity
    vel.current.copy(target).sub(prev.current);
    prev.current.copy(target);

    // if nearly stationary, pick a stable direction
    const dir = vel.current.lengthSq() > 1e-6 ? vel.current.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // camera wants to sit behind the motion, slightly above
    const desired = target
      .clone()
      .add(dir.clone().multiplyScalar(-7.5))
      .add(new THREE.Vector3(2.5, 1.8, 2.5));

    // smooth damping
    camera.position.lerp(desired, 0.06);
    camera.lookAt(target);
  });

  return null;
}

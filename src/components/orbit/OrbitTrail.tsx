'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function OrbitTrail({
  position,
  maxPoints = 220,
}: {
  position: [number, number, number];
  maxPoints?: number;
}) {
  // Geometry + material stay stable
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.55,
      }),
    []
  );

  // A reusable buffer for positions
  const positions = useMemo(() => new Float32Array(maxPoints * 3), [maxPoints]);

  // Create the THREE.Line once
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  useEffect(() => {
    // init buffer
    for (let i = 0; i < maxPoints; i++) {
      positions[i * 3 + 0] = position[0];
      positions[i * 3 + 1] = position[1];
      positions[i * 3 + 2] = position[2];
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
  }, [geometry, maxPoints, position, positions]);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      // shift older points forward
      for (let i = 0; i < maxPoints - 1; i++) {
        positions[i * 3 + 0] = positions[(i + 1) * 3 + 0];
        positions[i * 3 + 1] = positions[(i + 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i + 1) * 3 + 2];
      }
      // append newest
      positions[(maxPoints - 1) * 3 + 0] = position[0];
      positions[(maxPoints - 1) * 3 + 1] = position[1];
      positions[(maxPoints - 1) * 3 + 2] = position[2];

      const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [geometry, maxPoints, position, positions]);

  return <primitive object={line} />;
}

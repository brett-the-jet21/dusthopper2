'use client';

import { Stars } from '@react-three/drei';

export function StarsField() {
  return <Stars radius={260} depth={90} count={11000} factor={4} saturation={0} fade speed={0.6} />;
}

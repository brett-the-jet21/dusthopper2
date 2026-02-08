import { useRef, useEffect } from 'react';

export function useSimTime(baseTime: number, playing: boolean, speed: number) {
  const rafRef = useRef<number>();
  const lastTimeRef = useRef(Date.now());
  const accumulatedRef = useRef(0);
  
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      return;
    }
    
    const animate = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      
      accumulatedRef.current += delta * speed;
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [playing, speed]);
  
  return { t: baseTime + accumulatedRef.current };
}

"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  targetDate: string;
  onLaunch?: () => void;
};

// Only trigger the launch animation if the countdown reaches zero while
// the user is watching. If the NET was already more than 2 minutes in the
// past when the component mounts, it's a stale launch — don't animate.
const LAUNCH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export default function Countdown({ targetDate, onLaunch }: Props) {
  const [remaining, setRemaining] = useState(calcRemaining(targetDate));
  const [fired, setFired] = useState(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = calcRemaining(targetDate);
      setRemaining(r);
      if (r.total <= 0 && !fired) {
        setFired(true);
        // Only trigger the animation if the NET just passed (within the
        // launch window from when we mounted). This prevents a stale past
        // launch from immediately firing the rocket on page load.
        const timeSinceNet = Date.now() - Date.parse(targetDate);
        const timeSinceMount = Date.now() - mountTimeRef.current;
        if (timeSinceNet < LAUNCH_WINDOW_MS || timeSinceMount > 3000) {
          // Either the NET is very recent, or we actually counted down
          // for at least 3 seconds before it hit zero — real countdown.
          onLaunch?.();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate, onLaunch, fired]);

  if (remaining.total <= 0) {
    const elapsed = Date.now() - Date.parse(targetDate);
    if (elapsed < LAUNCH_WINDOW_MS) {
      return (
        <span className="text-red-400 font-bold animate-pulse">LIFTOFF</span>
      );
    }
    return (
      <span className="text-emerald-400 font-semibold">LAUNCHED</span>
    );
  }

  return (
    <div className="flex gap-1 font-mono text-sm tabular-nums">
      <span className="text-white/60">T&#8722;</span>
      {remaining.days > 0 && <Unit value={remaining.days} label="d" />}
      <Unit value={remaining.hours} label="h" />
      <Unit value={remaining.minutes} label="m" />
      <Unit value={remaining.seconds} label="s" />
    </div>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="text-white font-semibold">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-white/40">{label} </span>
    </span>
  );
}

function calcRemaining(target: string) {
  const diff = Math.max(0, Date.parse(target) - Date.now());
  return {
    total: diff,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

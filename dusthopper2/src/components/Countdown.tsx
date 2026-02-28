"use client";

import { useEffect, useState } from "react";

type Props = {
  targetDate: string; // ISO string
  onLaunch?: () => void;
};

export default function Countdown({ targetDate, onLaunch }: Props) {
  const [remaining, setRemaining] = useState(calcRemaining(targetDate));
  const [fired, setFired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const r = calcRemaining(targetDate);
      setRemaining(r);
      if (r.total <= 0 && !fired) {
        setFired(true);
        onLaunch?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate, onLaunch, fired]);

  if (remaining.total <= 0) {
    return (
      <span className="text-red-400 font-bold animate-pulse">LIFTOFF</span>
    );
  }

  return (
    <div className="flex gap-1 font-mono text-sm tabular-nums">
      <span className="text-white/60">T-</span>
      {remaining.days > 0 && (
        <Unit value={remaining.days} label="d" />
      )}
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

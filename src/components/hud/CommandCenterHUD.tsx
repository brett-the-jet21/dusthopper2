"use client";

import { useMissionStore } from '@/lib/store/missionStore';

export function CommandCenterHUD() {
  const { playing, togglePlaying, simSpeed, setSimSpeed, freeCam, toggleFreeCam } = useMissionStore();

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex',
      gap: 12,
      background: 'rgba(0, 10, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 255, 200, 0.3)',
      borderRadius: 12,
      padding: '14px 28px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 255, 200, 0.1)',
    }}>
      <button 
        onClick={toggleFreeCam} 
        style={{
          background: freeCam ? 'linear-gradient(135deg, #00ffcc, #00ccff)' : 'rgba(255, 255, 255, 0.08)',
          color: freeCam ? '#000' : 'rgba(0, 255, 200, 0.9)',
          border: freeCam ? 'none' : '1px solid rgba(0, 255, 200, 0.3)',
          padding: '10px 22px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.5,
          transition: 'all 0.2s',
        }}
      >
        {freeCam ? '🎥 FREE CAM' : '🎯 TRACK'}
      </button>
      
      <button 
        onClick={togglePlaying} 
        style={{
          background: playing ? 'linear-gradient(135deg, #00ff88, #00cc66)' : 'linear-gradient(135deg, #ff6666, #ff3333)',
          color: '#000',
          border: 'none',
          padding: '10px 22px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.5,
          transition: 'all 0.2s',
        }}
      >
        {playing ? '⏸ PAUSE' : '▶ PLAY'}
      </button>
      
      <div style={{ width: 1, height: 36, background: 'rgba(0, 255, 200, 0.2)', margin: '0 4px' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'rgba(0, 255, 200, 0.7)', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
          SPEED
        </span>
        <select
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          style={{
            background: 'rgba(0, 255, 200, 0.1)',
            border: '1px solid rgba(0, 255, 200, 0.3)',
            color: '#00ffcc',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        >
          {[0.25, 0.5, 1, 2, 5, 10, 25, 50].map(s => (
            <option key={s} value={s} style={{ background: '#001a1a', color: '#00ffcc' }}>
              {s}×
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

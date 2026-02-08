"use client";

import { useMissionStore } from '@/lib/store/missionStore';

export function MissionSelector() {
  const { missions, trackedMissionId, setTrackedMission } = useMissionStore();
  const missionArray = Array.from(missions.values());
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 16,
      zIndex: 100,
    }}>
      {missionArray.map(m => (
        <button
          key={m.id}
          onClick={() => setTrackedMission(m.id)}
          style={{
            background: m.id === trackedMissionId 
              ? `linear-gradient(135deg, ${m.colorScheme.primary}, ${m.colorScheme.secondary})`
              : 'rgba(0, 10, 20, 0.85)',
            color: m.id === trackedMissionId ? '#000' : '#fff',
            border: `2px solid ${m.colorScheme.primary}`,
            padding: '12px 28px',
            borderRadius: 10,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.8,
            backdropFilter: 'blur(12px)',
            boxShadow: m.id === trackedMissionId 
              ? `0 8px 24px ${m.colorScheme.primary}60, 0 0 30px ${m.colorScheme.primary}40`
              : '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.3s',
            textTransform: 'uppercase',
          }}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}

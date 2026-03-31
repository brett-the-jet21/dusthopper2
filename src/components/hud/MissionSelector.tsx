"use client";

import { useMissionStore } from '@/lib/store/missionStore';

/* Mission display order */
const MISSION_ORDER = ['artemis', 'iss', 'starship-hls1', 'starlink-6548'];

const MISSION_LABELS: Record<string, string> = {
  artemis: 'Artemis I',
  iss: 'ISS',
  'starship-hls1': 'Starship HLS',
  'starlink-6548': 'Starlink-6548',
};

export function MissionSelector() {
  const { missions, trackedMissionId, setTrackedMission } = useMissionStore();

  const orderedMissions = MISSION_ORDER
    .map((id) => missions.get(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof missions.get>>[];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 14,
        zIndex: 100,
        alignItems: 'flex-end',
      }}
    >
      {orderedMissions.map((m) => {
        const isArtemis = m.id === 'artemis';
        const isSelected = m.id === trackedMissionId;
        const label = MISSION_LABELS[m.id] ?? m.name;

        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* PRIMARY MISSION badge above Artemis */}
            {isArtemis && (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  color: '#FF6B00',
                  textTransform: 'uppercase',
                  background: 'rgba(255, 107, 0, 0.12)',
                  border: '1px solid rgba(255, 107, 0, 0.3)',
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                🌙 PRIMARY MISSION
              </div>
            )}

            <button
              onClick={() => setTrackedMission(m.id)}
              className={isArtemis && isSelected ? 'artemis-pulse-glow' : ''}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${m.colorScheme.primary}, ${m.colorScheme.secondary})`
                  : isArtemis
                  ? 'rgba(255, 107, 0, 0.08)'
                  : 'rgba(0, 10, 20, 0.85)',
                color: isSelected ? '#000' : isArtemis ? '#FF6B00' : '#fff',
                border: `2px solid ${isSelected ? 'transparent' : m.colorScheme.primary}`,
                padding: isArtemis ? '14px 32px' : '11px 24px',
                borderRadius: isArtemis ? 12 : 10,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: isArtemis ? 14 : 12,
                letterSpacing: 0.8,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isSelected
                  ? `0 8px 28px ${m.colorScheme.primary}70, 0 0 40px ${m.colorScheme.primary}40`
                  : isArtemis
                  ? `0 0 20px rgba(255, 107, 0, 0.2), 0 4px 12px rgba(0,0,0,0.5)`
                  : '0 4px 12px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                minWidth: isArtemis ? 160 : 110,
                position: 'relative',
              }}
            >
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { create } from 'zustand';

export type MissionData = {
  id: string;
  name: string;
  agency: string;
  status: 'active' | 'completed' | 'planned';
  launchDate: number;
  telemetry: {
    position: [number, number, number];
    velocity: [number, number, number];
    altitude: number;
    speed: number;
  };
  events: MissionEvent[];
  colorScheme: {
    primary: string;
    secondary: string;
    trail: string;
  };
  // Artemis-specific extra fields
  extra?: Record<string, string | number>;
};

export type MissionEvent = {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  type: 'launch' | 'maneuver' | 'milestone' | 'communication' | 'anomaly';
  critical: boolean;
};

type MissionStore = {
  missions: Map<string, MissionData>;
  activeMissionId: string | null;
  trackedMissionId: string | null;
  simTime: number;
  simSpeed: number;
  playing: boolean;
  freeCam: boolean;
  showTelemetry: boolean;
  showEvents: boolean;
  showOrbits: boolean;
  hudOpacity: number;
  addMission: (mission: MissionData) => void;
  removeMission: (id: string) => void;
  setActiveMission: (id: string) => void;
  setTrackedMission: (id: string) => void;
  updateMissionTelemetry: (id: string, telemetry: MissionData['telemetry']) => void;
  addMissionEvent: (missionId: string, event: MissionEvent) => void;
  setSimTime: (time: number) => void;
  setSimSpeed: (speed: number) => void;
  togglePlaying: () => void;
  toggleFreeCam: () => void;
  toggleTelemetry: () => void;
  toggleEvents: () => void;
  toggleOrbits: () => void;
  setHudOpacity: (opacity: number) => void;
};

/* ===================================================================
   Pre-initialized mission roster
   =================================================================== */
const MISSIONS_LIST: MissionData[] = [
  {
    id: 'artemis',
    name: 'Artemis I — SLS/Orion',
    agency: 'NASA',
    status: 'active',
    launchDate: new Date('2022-11-16').getTime(),
    telemetry: {
      position: [6.35, 0, 0],
      velocity: [0, 10.4, 0],
      altitude: 370,
      speed: 10.4,
    },
    events: [],
    colorScheme: {
      primary: '#FF6B00',
      secondary: '#FFB347',
      trail: '#FF6B0060',
    },
    extra: {
      phase: 'Trans-Lunar Injection',
      apogee: 384400,
      perigee: 370,
      inclination: 28.5,
      period: 91.5,
      missionPhase: 'TLI → Lunar Flyby → DRO → Return',
    },
  },
  {
    id: 'iss',
    name: 'ISS',
    agency: 'ISS Program',
    status: 'active',
    launchDate: new Date('1998-11-20').getTime(),
    telemetry: {
      position: [0, 6.4, 0],
      velocity: [7.66, 0, 0],
      altitude: 408,
      speed: 7.66,
    },
    events: [],
    colorScheme: {
      primary: '#66ffaa',
      secondary: '#00ccff',
      trail: '#66ffaa60',
    },
  },
  {
    id: 'starship-hls1',
    name: 'Starship HLS-1',
    agency: 'SpaceX / NASA',
    status: 'planned',
    launchDate: new Date('2026-06-01').getTime(),
    telemetry: {
      position: [0, 6.3, 0],
      velocity: [0, 0, 7.8],
      altitude: 250,
      speed: 7.8,
    },
    events: [],
    colorScheme: {
      primary: '#88bbff',
      secondary: '#4499ff',
      trail: '#88bbff60',
    },
  },
  {
    id: 'starlink-6548',
    name: 'Starlink-6548',
    agency: 'SpaceX',
    status: 'active',
    launchDate: new Date('2024-06-01').getTime(),
    telemetry: {
      position: [0, -6.3, 0],
      velocity: [7.6, 0, 0],
      altitude: 550,
      speed: 7.6,
    },
    events: [],
    colorScheme: {
      primary: '#cc88ff',
      secondary: '#9944ff',
      trail: '#cc88ff60',
    },
  },
];

const initialMissions = new Map(MISSIONS_LIST.map((m) => [m.id, m]));

export const useMissionStore = create<MissionStore>((set) => ({
  missions: initialMissions,
  activeMissionId: 'artemis',
  trackedMissionId: 'artemis',
  simTime: Date.now(),
  simSpeed: 1,
  playing: true,
  freeCam: false,
  showTelemetry: true,
  showEvents: true,
  showOrbits: true,
  hudOpacity: 0.85,
  addMission: (mission) =>
    set((state) => {
      const newMissions = new Map(state.missions);
      newMissions.set(mission.id, mission);
      return { missions: newMissions };
    }),
  removeMission: (id) =>
    set((state) => {
      const newMissions = new Map(state.missions);
      newMissions.delete(id);
      return { missions: newMissions };
    }),
  setActiveMission: (id) => set({ activeMissionId: id }),
  setTrackedMission: (id) => set({ trackedMissionId: id, activeMissionId: id }),
  updateMissionTelemetry: (id, telemetry) =>
    set((state) => {
      const newMissions = new Map(state.missions);
      const mission = newMissions.get(id);
      if (mission) {
        newMissions.set(id, { ...mission, telemetry });
      }
      return { missions: newMissions };
    }),
  addMissionEvent: (missionId, event) =>
    set((state) => {
      const newMissions = new Map(state.missions);
      const mission = newMissions.get(missionId);
      if (mission) {
        newMissions.set(missionId, {
          ...mission,
          events: [...mission.events, event],
        });
      }
      return { missions: newMissions };
    }),
  setSimTime: (time) => set({ simTime: time }),
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  toggleFreeCam: () => set((state) => ({ freeCam: !state.freeCam })),
  toggleTelemetry: () => set((state) => ({ showTelemetry: !state.showTelemetry })),
  toggleEvents: () => set((state) => ({ showEvents: !state.showEvents })),
  toggleOrbits: () => set((state) => ({ showOrbits: !state.showOrbits })),
  setHudOpacity: (opacity) => set({ hudOpacity: opacity }),
}));

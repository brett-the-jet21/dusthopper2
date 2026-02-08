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

export const useMissionStore = create<MissionStore>((set) => ({
  missions: new Map(),
  activeMissionId: null,
  trackedMissionId: null,
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
      return { 
        missions: newMissions,
        activeMissionId: state.activeMissionId || mission.id,
        trackedMissionId: state.trackedMissionId || mission.id,
      };
    }),
  removeMission: (id) =>
    set((state) => {
      const newMissions = new Map(state.missions);
      newMissions.delete(id);
      return { missions: newMissions };
    }),
  setActiveMission: (id) => set({ activeMissionId: id }),
  setTrackedMission: (id) => set({ trackedMissionId: id }),
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

"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  Falcon9FirstStage,
  Falcon9SecondStage,
  PayloadFairing,
  EnginePlume,
} from "./Falcon9Model";

import {
  type LaunchProfile,
  interpolateTrajectory,
  launchSiteFrame,
  trajectoryToWorld,
  rocketOrientation,
} from "./launchProfiles";

const STAGE_SEP_TIME = 158; // seconds — stage separation
const FAIRING_SEP_TIME = 210;
const ROCKET_SCENE_SCALE = 0.04; // model-units → scene-units

/* ====================================================================
   Tracking beacon  (visible from far away)
   ==================================================================== */

function TrackingBeacon({ color }: { color: string }) {
  return (
    <group>
      <pointLight color={color} intensity={4} distance={5} />
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ====================================================================
   Falcon 9 Launch Scene

   Renders the full animated launch sequence inside the existing
   Canvas.  The parent provides `launchT` (seconds from T-0).
   ==================================================================== */

export function Falcon9LaunchScene({
  launchT,
  profile,
  trackBooster,
  onRocketPosition,
  onBoosterPosition,
}: {
  launchT: number;
  profile: LaunchProfile;
  trackBooster: boolean;
  onRocketPosition: (pos: number[]) => void;
  onBoosterPosition: (pos: number[]) => void;
}) {
  const rocketRef = useRef<THREE.Group>(null);
  const boosterRef = useRef<THREE.Group>(null);

  const frame = useMemo(
    () => launchSiteFrame(profile.launchSiteLat, profile.launchSiteLon, profile.launchAzimuth),
    [profile],
  );

  const separated = launchT >= STAGE_SEP_TIME;
  const fairingSep = launchT >= FAIRING_SEP_TIME;

  /* -- Rocket (upper stage after separation, full stack before) -- */
  const rocketTraj = interpolateTrajectory(profile.trajectory, launchT);
  const boosterTraj = separated
    ? interpolateTrajectory(profile.boosterReturn, launchT)
    : null;

  /* -- Compute world positions -- */
  const rocketPos = rocketTraj
    ? trajectoryToWorld(frame, rocketTraj.alt, rocketTraj.downrange)
    : frame.pos.clone();

  const rocketQuat = rocketTraj
    ? rocketOrientation(frame, rocketTraj.pitch, rocketTraj.downrange)
    : rocketOrientation(frame, 0, 0);

  const boosterPos = boosterTraj
    ? trajectoryToWorld(frame, boosterTraj.alt, boosterTraj.downrange)
    : null;

  const boosterQuat = boosterTraj
    ? rocketOrientation(frame, boosterTraj.pitch, boosterTraj.downrange)
    : null;

  /* -- Report positions for camera tracking -- */
  useFrame(() => {
    if (rocketRef.current) {
      rocketRef.current.position.copy(rocketPos);
      rocketRef.current.quaternion.copy(rocketQuat);
      onRocketPosition([rocketPos.x, rocketPos.y, rocketPos.z]);
    }
    if (boosterRef.current && boosterPos && boosterQuat) {
      boosterRef.current.position.copy(boosterPos);
      boosterRef.current.quaternion.copy(boosterQuat);
      onBoosterPosition([boosterPos.x, boosterPos.y, boosterPos.z]);
    }
  });

  const s1Throttle = separated
    ? 0
    : rocketTraj?.throttle ?? 0;

  const s2Throttle = separated
    ? rocketTraj?.throttle ?? 0
    : 0;

  const boosterThrottle = boosterTraj?.throttle ?? 0;
  const boosterLanded = boosterTraj && boosterTraj.vel === 0 && boosterTraj.alt === 0;

  return (
    <>
      {/* ---- Upper stage / full stack ---- */}
      <group ref={rocketRef}>
        <group scale={ROCKET_SCENE_SCALE}>
          {!separated ? (
            /* Full stack before separation */
            <group>
              <group position={[0, 3.5, 0]}>
                <PayloadFairing separated={fairingSep} />
              </group>
              <group position={[0, 2.5, 0]}>
                <Falcon9SecondStage throttle={0} />
              </group>
              <group position={[0, 0, 0]}>
                <Falcon9FirstStage throttle={s1Throttle} />
              </group>
            </group>
          ) : (
            /* Upper stage only after separation */
            <group>
              <group position={[0, 1.0, 0]}>
                <PayloadFairing separated={fairingSep} />
              </group>
              <Falcon9SecondStage throttle={s2Throttle} vacuum />
            </group>
          )}
        </group>
        <TrackingBeacon color="#ff4444" />
      </group>

      {/* ---- Booster (after separation) ---- */}
      {separated && (
        <group ref={boosterRef}>
          <group scale={ROCKET_SCENE_SCALE}>
            <Falcon9FirstStage
              throttle={boosterThrottle}
              gridFins={true}
              legs={!!(boosterLanded || (boosterTraj && boosterTraj.alt < 5))}
              engineCount={boosterThrottle > 0 ? (boosterTraj && boosterTraj.alt < 5 ? 1 : 3) : 0}
            />
          </group>
          <TrackingBeacon color="#00ccff" />
        </group>
      )}

      {/* ---- Launch pad marker on surface ---- */}
      <group position={frame.pos.toArray()}>
        <mesh>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color="#ffaa00" />
        </mesh>
        <pointLight color="#ffaa00" intensity={2} distance={2} />
      </group>
    </>
  );
}

/* ====================================================================
   Launch camera  –  follows either the upper stage or the booster
   ==================================================================== */

export function LaunchCamera({
  target,
  enabled,
}: {
  target: number[] | null;
  enabled: boolean;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!enabled || !target || target.length !== 3) return;
    const t = new THREE.Vector3(target[0], target[1], target[2]);
    const up = t.clone().normalize();
    const dist = 0.8;
    const offset = up.clone().multiplyScalar(dist).add(
      new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(dist * 0.5),
    );
    const desired = t.clone().add(offset);
    camera.position.lerp(desired, 0.04);
    camera.lookAt(t);
    camera.up.copy(up);
  });

  return null;
}

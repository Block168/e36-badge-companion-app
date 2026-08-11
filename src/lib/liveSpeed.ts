import { useEffect, useState } from "react";

export interface LiveSpeedState {
  kmh: number;
  active: boolean;
  simulated: boolean;
  supported: boolean;
  error: string | null;
}

const SIM_BASE = 55;
const SIM_AMP = 115;

function simulateKmh(): number {
  const t = Date.now() / 1000;
  return Math.round(SIM_BASE + SIM_AMP * (0.5 + 0.5 * Math.sin(t / 1.7)));
}

/**
 * Live speed feed. Uses the Geolocation API (high accuracy) to read the
 * device's ground speed, with a simulated oscillation fallback so the
 * feature always works — even on a desk. Pass `enabled: false` to defer
 * the permission prompt until the feature is actually needed.
 */
export function useGeoSpeed(pollMs = 600, enabled = true): LiveSpeedState {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const [kmh, setKmh] = useState(0);
  const [active, setActive] = useState(false);
  const [simulated, setSimulated] = useState(!supported);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSimulated(true);
      return;
    }
    if (!supported) {
      setKmh(simulateKmh());
      return;
    }

    let cancelled = false;
    let watchId: number | null = null;
    let simId: number | null = null;

    const startSim = (err: string | null) => {
      setActive(false);
      setSimulated(true);
      setError(err);
      setKmh(simulateKmh());
      simId = window.setInterval(() => setKmh(simulateKmh()), pollMs);
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        if (simId !== null) {
          window.clearInterval(simId);
          simId = null;
        }
        setSimulated(false);
        setError(null);
        setActive(true);
        const speed = pos.coords.speed;
        if (speed != null && Number.isFinite(speed)) {
          setKmh(Math.max(0, Math.round(speed * 3.6)));
        }
      },
      (err) => startSim(err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (simId !== null) window.clearInterval(simId);
    };
  }, [pollMs, supported, enabled]);

  return { kmh, active, simulated, supported, error };
}

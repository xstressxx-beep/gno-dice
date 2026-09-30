"use client";

import { useEffect, useState } from "react";

/** Heure actuelle en secondes Unix, mise à jour toutes les `intervalMs`. 0 avant le premier rendu côté navigateur. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

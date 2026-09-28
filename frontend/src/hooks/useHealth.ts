import { useEffect, useState } from "react";
import { getHealth } from "../services/healthApi";
import { HealthResponse } from "../types/api";

export function useHealth(pollInterval = 10000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  async function refresh(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await getHealth(force);
      setHealth(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return { health, loading, error, refresh: () => refresh(true) };
}

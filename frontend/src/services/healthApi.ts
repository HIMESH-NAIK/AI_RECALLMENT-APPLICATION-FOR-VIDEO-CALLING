import api from "./api";
import { HealthResponse } from "../types/api";

const HEALTH_CACHE_MS = 15_000;
let cachedHealth: HealthResponse | null = null;
let cachedAt = 0;
let inFlight: Promise<HealthResponse> | null = null;

export async function getHealth(force = false): Promise<HealthResponse> {
  if (!force && cachedHealth && Date.now() - cachedAt < HEALTH_CACHE_MS) {
    return cachedHealth;
  }
  if (inFlight) return inFlight;

  inFlight = api.get<HealthResponse>("/api/health")
    .then(({ data }) => {
      cachedHealth = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

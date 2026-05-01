import { availableParallelism, cpus } from "node:os";
import { performance } from "node:perf_hooks";

const RESPONSE_WINDOW_MS = 5 * 60 * 1000;
const CPU_SAMPLE_INTERVAL_MS = 5_000;

type ResponseSample = {
  durationMs: number;
  timestampMs: number;
};

type TelemetryState = {
  cpuCoreCount: number;
  lastCpuTimestampMs: number;
  lastCpuUsage: NodeJS.CpuUsage;
  lastCpuUtilizationPercent: number;
  responseSamples: ResponseSample[];
  samplerStarted: boolean;
};

const globalTelemetry = globalThis as typeof globalThis & {
  __diplomaTelemetryState?: TelemetryState;
};

function getCpuCoreCount() {
  try {
    return Math.max(1, availableParallelism());
  } catch {
    return Math.max(1, cpus().length);
  }
}

const state =
  globalTelemetry.__diplomaTelemetryState ??
  (globalTelemetry.__diplomaTelemetryState = {
    cpuCoreCount: getCpuCoreCount(),
    lastCpuTimestampMs: performance.now(),
    lastCpuUsage: process.cpuUsage(),
    lastCpuUtilizationPercent: 0,
    responseSamples: [],
    samplerStarted: false,
  });

function pruneResponseSamples(nowMs: number) {
  const cutoffMs = nowMs - RESPONSE_WINDOW_MS;

  while (state.responseSamples.length > 0 && state.responseSamples[0].timestampMs < cutoffMs) {
    state.responseSamples.shift();
  }
}

function sampleCpuUtilization() {
  const nowMs = performance.now();
  const elapsedMs = nowMs - state.lastCpuTimestampMs;

  if (elapsedMs <= 0) {
    return;
  }

  const currentCpuUsage = process.cpuUsage();
  const usedMicros =
    currentCpuUsage.user -
    state.lastCpuUsage.user +
    currentCpuUsage.system -
    state.lastCpuUsage.system;
  const capacityMicros = elapsedMs * 1000 * state.cpuCoreCount;

  state.lastCpuUtilizationPercent =
    capacityMicros <= 0
      ? 0
      : Number(Math.min(100, (usedMicros / capacityMicros) * 100).toFixed(2));
  state.lastCpuUsage = currentCpuUsage;
  state.lastCpuTimestampMs = nowMs;
}

if (!state.samplerStarted) {
  const sampler = setInterval(sampleCpuUtilization, CPU_SAMPLE_INTERVAL_MS);
  sampler.unref?.();
  state.samplerStarted = true;
}

export function shouldTrackRequest(pathname: string) {
  return pathname !== "/healthz" && pathname !== "/api/monitoring/telemetry";
}

export function recordRequestDuration(durationMs: number, timestampMs = Date.now()) {
  state.responseSamples.push({
    durationMs: Number(durationMs.toFixed(2)),
    timestampMs,
  });
  pruneResponseSamples(timestampMs);
}

export function getTelemetrySnapshot(nowMs = Date.now()) {
  pruneResponseSamples(nowMs);

  const totalDurationMs = state.responseSamples.reduce(
    (sum, sample) => sum + sample.durationMs,
    0,
  );
  const averageDurationMs =
    state.responseSamples.length === 0
      ? 0
      : Number((totalDurationMs / state.responseSamples.length).toFixed(2));
  const memoryUsage = process.memoryUsage();

  return {
    process: {
      cpu: {
        cores: state.cpuCoreCount,
        utilizationPercent: state.lastCpuUtilizationPercent,
      },
      memory: {
        externalBytes: memoryUsage.external,
        heapTotalBytes: memoryUsage.heapTotal,
        heapUsedBytes: memoryUsage.heapUsed,
        rssBytes: memoryUsage.rss,
      },
    },
    requestLatency: {
      avgMs: averageDurationMs,
      sampleCount: state.responseSamples.length,
      windowSeconds: RESPONSE_WINDOW_MS / 1000,
    },
    status: "ok",
    timestamp: new Date(nowMs).toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(1)),
  };
}

export function resetTelemetryStateForTests() {
  state.lastCpuTimestampMs = performance.now();
  state.lastCpuUsage = process.cpuUsage();
  state.lastCpuUtilizationPercent = 0;
  state.responseSamples = [];
}

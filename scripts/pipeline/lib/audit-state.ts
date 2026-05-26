import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { UnregisteredTopLevelFrame } from './audit-aggregator.ts';

export interface FrameSighting {
  nodeId: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sightingCount: number;
}

// Counts recorded at the end of an audit run, persisted across runs so the
// next run can render a trend line ("어제 대비 ▲14 detached") in Slack.
export interface PreviousAuditCounts {
  detached: number;
  unreg: number;
  recordedAt: string;
}

export interface AuditState {
  // Keyed by Figma node id (e.g. "35:244").
  unregisteredFrames: Record<string, FrameSighting>;
  // Counts from the previous audit run (if any). Written at the end of
  // every audit and read at the start of the next one to compute the
  // trend line shown in the daily Slack notification.
  lastRunCounts?: PreviousAuditCounts;
}

export interface AutoRegisterOptions {
  thresholdSightings: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O
// ─────────────────────────────────────────────────────────────────────────────

export function loadAuditState(path: string): AuditState {
  if (!existsSync(path)) {
    return { unregisteredFrames: {} };
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AuditState>;
    return {
      unregisteredFrames: parsed.unregisteredFrames ?? {},
      lastRunCounts: parsed.lastRunCounts,
    };
  } catch {
    // Corrupted state file — start over rather than fail the audit.
    return { unregisteredFrames: {} };
  }
}

export function saveAuditState(path: string, state: AuditState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure update logic (tested)
// ─────────────────────────────────────────────────────────────────────────────

export function updateAuditState(
  prev: AuditState,
  current: UnregisteredTopLevelFrame[],
  now: string
): AuditState {
  const currentById = new Map(current.map(f => [f.nodeId, f]));
  const nextFrames: Record<string, FrameSighting> = {};

  for (const frame of current) {
    const existing = prev.unregisteredFrames[frame.nodeId];
    if (existing) {
      nextFrames[frame.nodeId] = {
        nodeId: frame.nodeId,
        name: frame.name,
        firstSeenAt: existing.firstSeenAt,
        lastSeenAt: now,
        sightingCount: existing.sightingCount + 1,
      };
    } else {
      nextFrames[frame.nodeId] = {
        nodeId: frame.nodeId,
        name: frame.name,
        firstSeenAt: now,
        lastSeenAt: now,
        sightingCount: 1,
      };
    }
  }

  // Frames in prev but no longer in current are dropped (deleted or registered).
  // Intentional: a frame that disappears resets the sighting clock if it ever
  // reappears — designers shouldn't be punished for transient experiments.
  for (const nodeId of Object.keys(prev.unregisteredFrames)) {
    if (!currentById.has(nodeId)) continue; // drop
  }

  // Preserve trend tracking across the update so the caller doesn't need
  // to re-attach it manually after updateAuditState().
  return { unregisteredFrames: nextFrames, lastRunCounts: prev.lastRunCounts };
}

export function pickAutoRegisterCandidates(
  state: AuditState,
  options: AutoRegisterOptions
): FrameSighting[] {
  return Object.values(state.unregisteredFrames).filter(
    f => f.sightingCount >= options.thresholdSightings
  );
}

// Record the current run's scalar counts on the state so the NEXT run can
// surface a trend line. The previously-recorded counts (read by the
// current run before this call) are overwritten — the trend window is
// always "the immediately preceding run".
export function recordRunCounts(
  state: AuditState,
  counts: { detached: number; unreg: number; now: string }
): AuditState {
  return {
    ...state,
    lastRunCounts: {
      detached: counts.detached,
      unreg: counts.unreg,
      recordedAt: counts.now,
    },
  };
}

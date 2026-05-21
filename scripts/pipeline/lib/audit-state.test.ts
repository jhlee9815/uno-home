import assert from 'node:assert/strict';
import {
  updateAuditState,
  pickAutoRegisterCandidates,
  type AuditState,
  type FrameSighting,
} from './audit-state.ts';
import type { UnregisteredTopLevelFrame } from './audit-aggregator.ts';

// ─────────────────────────────────────────────────────────────────────────────
// updateAuditState
// ─────────────────────────────────────────────────────────────────────────────

{
  // First sighting → new entries with count 1
  const prev: AuditState = { unregisteredFrames: {} };
  const current: UnregisteredTopLevelFrame[] = [
    { nodeId: '35:244', name: 'test1' },
    { nodeId: '35:382', name: 'test2' },
  ];
  const next = updateAuditState(prev, current, '2026-05-21T13:00:00Z');
  assert.equal(Object.keys(next.unregisteredFrames).length, 2);
  assert.equal(next.unregisteredFrames['35:244'].sightingCount, 1);
  assert.equal(next.unregisteredFrames['35:244'].firstSeenAt, '2026-05-21T13:00:00Z');
  assert.equal(next.unregisteredFrames['35:244'].lastSeenAt, '2026-05-21T13:00:00Z');
}

{
  // Second sighting → increment count, lastSeenAt updates, firstSeenAt preserved
  const prev: AuditState = {
    unregisteredFrames: {
      '35:244': {
        nodeId: '35:244',
        name: 'test1',
        firstSeenAt: '2026-05-21T13:00:00Z',
        lastSeenAt: '2026-05-21T13:00:00Z',
        sightingCount: 1,
      },
    },
  };
  const current: UnregisteredTopLevelFrame[] = [{ nodeId: '35:244', name: 'test1' }];
  const next = updateAuditState(prev, current, '2026-05-22T13:00:00Z');
  assert.equal(next.unregisteredFrames['35:244'].sightingCount, 2);
  assert.equal(next.unregisteredFrames['35:244'].firstSeenAt, '2026-05-21T13:00:00Z');
  assert.equal(next.unregisteredFrames['35:244'].lastSeenAt, '2026-05-22T13:00:00Z');
}

{
  // Frame disappears → removed from state
  const prev: AuditState = {
    unregisteredFrames: {
      '35:244': {
        nodeId: '35:244', name: 'test1',
        firstSeenAt: '2026-05-21T13:00:00Z', lastSeenAt: '2026-05-21T13:00:00Z',
        sightingCount: 2,
      },
    },
  };
  const next = updateAuditState(prev, [], '2026-05-22T13:00:00Z');
  assert.equal(Object.keys(next.unregisteredFrames).length, 0);
}

{
  // Rename of frame at same nodeId → name updated, count preserved
  const prev: AuditState = {
    unregisteredFrames: {
      '35:244': {
        nodeId: '35:244', name: 'old-name',
        firstSeenAt: '2026-05-21T13:00:00Z', lastSeenAt: '2026-05-21T13:00:00Z',
        sightingCount: 1,
      },
    },
  };
  const next = updateAuditState(
    prev,
    [{ nodeId: '35:244', name: 'new-name' }],
    '2026-05-22T13:00:00Z'
  );
  assert.equal(next.unregisteredFrames['35:244'].name, 'new-name');
  assert.equal(next.unregisteredFrames['35:244'].sightingCount, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// pickAutoRegisterCandidates
// ─────────────────────────────────────────────────────────────────────────────

{
  // count < threshold → no candidates
  const state: AuditState = {
    unregisteredFrames: {
      '35:244': fakeSighting('35:244', 'test1', 1),
      '35:382': fakeSighting('35:382', 'test2', 1),
    },
  };
  const candidates = pickAutoRegisterCandidates(state, { thresholdSightings: 2 });
  assert.equal(candidates.length, 0);
}

{
  // count >= threshold → candidates
  const state: AuditState = {
    unregisteredFrames: {
      '35:244': fakeSighting('35:244', 'test1', 2),
      '35:382': fakeSighting('35:382', 'test2', 3),
      '99:99': fakeSighting('99:99', 'one-shot', 1),
    },
  };
  const candidates = pickAutoRegisterCandidates(state, { thresholdSightings: 2 });
  const ids = candidates.map(c => c.nodeId).sort();
  assert.deepEqual(ids, ['35:244', '35:382']);
}

console.log('audit-state tests passed');

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function fakeSighting(nodeId: string, name: string, count: number): FrameSighting {
  return {
    nodeId,
    name,
    firstSeenAt: '2026-05-21T13:00:00Z',
    lastSeenAt: '2026-05-21T13:00:00Z',
    sightingCount: count,
  };
}

import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { generateMappingKey, buildYamlEntry } from '../auto-register.ts';

// ─────────────────────────────────────────────────────────────────────────────
// generateMappingKey
// ─────────────────────────────────────────────────────────────────────────────

{
  // Plain ASCII name
  const key = generateMappingKey({
    nodeId: '35:244', name: 'test1',
    firstSeenAt: '', lastSeenAt: '', sightingCount: 2,
  });
  assert.equal(key, 'auto_test1_35_244');
}

{
  // Name with spaces, hyphens, periods (e.g. "Phone · My Account")
  const key = generateMappingKey({
    nodeId: '35:45', name: 'Phone · My Account',
    firstSeenAt: '', lastSeenAt: '', sightingCount: 2,
  });
  assert.equal(key, 'auto_phone_my_account_35_45');
}

{
  // Empty-ish name → fallback slug
  const key = generateMappingKey({
    nodeId: '1:1', name: '———',
    firstSeenAt: '', lastSeenAt: '', sightingCount: 2,
  });
  assert.equal(key, 'auto_frame_1_1');
}

// ─────────────────────────────────────────────────────────────────────────────
// buildYamlEntry: round-trip via js-yaml parser
// ─────────────────────────────────────────────────────────────────────────────

{
  const entry = buildYamlEntry({
    nodeId: '35:244', name: 'test1',
    firstSeenAt: '2026-05-21T13:00:00Z', lastSeenAt: '2026-05-22T13:00:00Z',
    sightingCount: 2,
  }, '2026-05-22');

  // Wrap in screens: to parse as full mapping
  const synthetic = `screens:\n${entry}`;
  const parsed = yaml.load(synthetic) as { screens: Record<string, unknown> };
  const screens = parsed.screens;

  const key = 'auto_test1_35_244';
  assert.ok(screens[key], `expected key ${key} to exist`);
  const entryParsed = screens[key] as Record<string, unknown>;
  assert.equal(entryParsed.figmaNodeId, '35:244');
  assert.equal(entryParsed.figmaNodeName, 'test1');
  assert.deepEqual(entryParsed.figmaNodePath, []);
  assert.equal(entryParsed.code, '../src/screens/FigmaFrameTracking.ts');
  assert.equal(entryParsed.targetType, 'screen');
  const automation = entryParsed.automation as Record<string, unknown>;
  assert.equal(automation.apply, 'report-only');
  assert.equal(automation.audit, 'include');
  assert.deepEqual(automation.allowedClasses, ['token', 'text', 'layout', 'structure']);
}

{
  // Name with YAML-special chars should still round-trip safely
  const entry = buildYamlEntry({
    nodeId: '99:1', name: 'Phone · My Account',
    firstSeenAt: '2026-05-21T13:00:00Z', lastSeenAt: '2026-05-22T13:00:00Z',
    sightingCount: 2,
  }, '2026-05-22');
  const synthetic = `screens:\n${entry}`;
  const parsed = yaml.load(synthetic) as { screens: Record<string, unknown> };
  const e = parsed.screens['auto_phone_my_account_99_1'] as Record<string, unknown>;
  assert.equal(e.figmaNodeName, 'Phone · My Account');
}

// YAML poison names — frame names users could plausibly type that would
// be re-typed by an unquoted YAML serializer.
{
  const cases: Array<[string, string]> = [
    ['true', 'true'],
    ['123', '123'],
    ['null', 'null'],
    ['yes', 'yes'],
    ['', ''],
    ['1.5', '1.5'],
  ];
  for (const [input, expected] of cases) {
    const entry = buildYamlEntry({
      nodeId: '88:88', name: input,
      firstSeenAt: '', lastSeenAt: '', sightingCount: 2,
    }, '2026-05-22');
    const parsed = yaml.load(`screens:\n${entry}`) as { screens: Record<string, unknown> };
    const key = Object.keys(parsed.screens)[0];
    const e = parsed.screens[key] as Record<string, unknown>;
    assert.equal(typeof e.figmaNodeName, 'string', `name "${input}" should stay a string`);
    assert.equal(e.figmaNodeName, expected, `name "${input}" should round-trip exactly`);
  }
}

console.log('auto-register-format tests passed');

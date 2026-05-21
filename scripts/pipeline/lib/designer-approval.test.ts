import assert from 'node:assert/strict';
import { buildDesignerDecisionComment, extractCsIdFromIssue, stateForDesignerLabel } from './designer-approval.ts';

assert.equal(
  extractCsIdFromIssue({ title: '[designer-review] cs-2026-05-21T02-00-00', body: '' }),
  'cs-2026-05-21T02-00-00'
);
assert.equal(
  extractCsIdFromIssue({ title: 'Review', body: 'Please approve cs-2026-05-21T02-00-00 in this issue.' }),
  'cs-2026-05-21T02-00-00'
);
assert.equal(stateForDesignerLabel('designer-approved'), 'designer-approved');
assert.equal(stateForDesignerLabel('designer-rejected'), 'designer-rejected');
assert.equal(stateForDesignerLabel('bug'), null);
assert.match(buildDesignerDecisionComment('designer-approved', 'cs-x'), /Designer approval recorded/);
assert.match(buildDesignerDecisionComment('designer-rejected', 'cs-x'), /Designer rejection recorded/);
console.log('designer-approval PASS');

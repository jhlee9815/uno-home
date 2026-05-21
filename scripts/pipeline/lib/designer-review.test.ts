import assert from 'node:assert/strict';
import {
  approveReport,
  buildDesignerReport,
  parseReviewReport,
  rejectReport,
  shouldCreateDesignerReport,
} from './designer-review.ts';

const report = buildDesignerReport({
  changeSetId: 'cs-test',
  classifiedPath: '/tmp/classified.json',
  applyReportPath: '/tmp/apply.md',
  verifyReportPath: '/tmp/verify.md',
  reportOnlyReportPath: '/tmp/diff-report-only.md',
  classifiedSummary: {
    total: 1,
    autoApply: 1,
    reportOnly: 0,
    unknown: 0,
  },
  applyStatus: 'applied',
  verifyStatus: 'passed',
  changedFiles: ['src/index.css'],
  visualReportPath: '/tmp/reports/cs-test/visual-diff.md',
  verificationRows: [
    { check: 'build', status: 'passed', message: '' },
    { check: 'visual', status: 'passed', message: '0.25%' },
  ],
  generatedAt: '2026-05-04T00:00:00.000Z',
  artifactsSha256: 'sha256:artifacts',
});

const parsed = parseReviewReport(report, '/tmp/cs-test.md');
assert.equal(parsed.frontmatter.changeSetId, 'cs-test');
assert.equal(parsed.frontmatter.status, 'pending');
assert.equal(parsed.frontmatter.reportSha256, parsed.bodySha256);
assert.equal(parsed.frontmatter.artifactsSha256, 'sha256:artifacts');
assert.match(parsed.body, /# Change Set cs-test/);
assert.match(parsed.body, /Report-only detail: `\/tmp\/diff-report-only.md`/);
assert.match(parsed.body, /Visual diff: `\/tmp\/reports\/cs-test\/visual-diff.md`/);
assert.match(parsed.body, /승인: `npm run figma:approve cs-test`/);

const approved = approveReport(report, {
  approvedBy: 'designer',
  approvedAt: '2026-05-04T01:00:00.000Z',
});
const approvedParsed = parseReviewReport(approved, '/tmp/cs-test.md');
assert.equal(approvedParsed.frontmatter.status, 'approved');
assert.equal(approvedParsed.frontmatter.approvedBy, 'designer');
assert.equal(approvedParsed.frontmatter.approvedAt, '2026-05-04T01:00:00.000Z');
assert.equal(approvedParsed.frontmatter.rejectReason, 'null');
assert.equal(approvedParsed.frontmatter.reportSha256, approvedParsed.bodySha256);

const rejected = rejectReport(report, {
  reason: 'copy needs another pass',
});
const rejectedParsed = parseReviewReport(rejected, '/tmp/cs-test.md');
assert.equal(rejectedParsed.frontmatter.status, 'rejected');
assert.equal(rejectedParsed.frontmatter.rejectReason, 'copy needs another pass');
assert.equal(rejectedParsed.frontmatter.approvedBy, 'null');
assert.equal(rejectedParsed.frontmatter.reportSha256, rejectedParsed.bodySha256);

assert.equal(
  shouldCreateDesignerReport({ total: 0, autoApply: 0, reportOnly: 0, unknown: 0 }),
  false
);
assert.equal(
  shouldCreateDesignerReport({ total: 1, autoApply: 0, reportOnly: 1, unknown: 0 }),
  true
);

// ============================================================================
// Stage 4 — compliance sections in cs report
// ============================================================================

const complianceSummary: ComplianceDiffSummary = {
  newDetachedStyles: [
    {
      nodeId: '7:3:9',
      nodeName: 'Pill',
      nodePath: ['Phone · Home', 'Pill'],
      kind: 'color',
      property: 'fill',
      rawValue: { r: 1, g: 0, b: 0, a: 1 },
      suggestedToken: null,
      evidence: { hasNodeBoundVariables: false, styleId: null },
    },
  ],
  newFrames: [
    {
      nodeId: '99:1',
      nodeName: 'Promo Banner',
      nodePath: ['Phone · Home', 'Promo Banner'],
      name: 'Promo Banner',
      parentRegisteredKey: 'pesse_home',
    },
  ],
  changedImageRefs: [
    {
      before: {
        nodeId: '7:4:7',
        nodeName: 'Card art',
        nodePath: ['Phone · Cards', 'Card art'],
        kind: 'image',
        paintIndex: 0,
        ref: 'img-old',
      },
      after: {
        nodeId: '7:4:7',
        nodeName: 'Card art',
        nodePath: ['Phone · Cards', 'Card art'],
        kind: 'image',
        paintIndex: 0,
        ref: 'img-new',
      },
    },
  ],
};

const reportWithCompliance = buildDesignerReport({
  changeSetId: 'cs-compliance',
  classifiedPath: '/tmp/c.json',
  applyReportPath: '/tmp/a.md',
  verifyReportPath: '/tmp/v.md',
  classifiedSummary: { total: 3, autoApply: 0, reportOnly: 3, unknown: 0 },
  applyStatus: 'noop',
  verifyStatus: 'passed',
  changedFiles: [],
  verificationRows: [],
  generatedAt: '2026-05-21T00:00:00.000Z',
  artifactsSha256: 'sha256:x',
  complianceSummary,
});

assert.match(reportWithCompliance, /## Detached Styles/);
assert.match(reportWithCompliance, /Pill/);
assert.match(reportWithCompliance, /fill/);
assert.match(reportWithCompliance, /## New Frames in Tracked Screens/);
assert.match(reportWithCompliance, /Promo Banner/);
assert.match(reportWithCompliance, /pesse_home/);
assert.match(reportWithCompliance, /## Image Changes/);
assert.match(reportWithCompliance, /img-old/);
assert.match(reportWithCompliance, /img-new/);

// Empty compliance summary → sections NOT present
const reportNoCompliance = buildDesignerReport({
  changeSetId: 'cs-no-compliance',
  classifiedPath: '/tmp/c.json',
  applyReportPath: '/tmp/a.md',
  verifyReportPath: '/tmp/v.md',
  classifiedSummary: { total: 1, autoApply: 1, reportOnly: 0, unknown: 0 },
  applyStatus: 'applied',
  verifyStatus: 'passed',
  changedFiles: ['src/foo.tsx'],
  verificationRows: [],
  generatedAt: '2026-05-21T00:00:00.000Z',
  artifactsSha256: 'sha256:x',
});
assert.doesNotMatch(reportNoCompliance, /## Detached Styles/);
assert.doesNotMatch(reportNoCompliance, /## New Frames/);
assert.doesNotMatch(reportNoCompliance, /## Image Changes/);

console.log('Stage 4 compliance report sections PASS');

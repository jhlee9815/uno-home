import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import yaml from 'js-yaml';

const designerApproval = readFileSync('.github/workflows/designer-approval.yml', 'utf-8');
const figmaPipeline = readFileSync('.github/workflows/figma-pipeline.yml', 'utf-8');

yaml.load(designerApproval);
yaml.load(figmaPipeline);

assert.match(
  figmaPipeline,
  /name:\s*figma-pipeline-\$\{\{ github\.run_id \}\}/,
  'figma-pipeline must upload a run-id-addressable artifact for later approval workflows'
);
assert.match(figmaPipeline, /\.automation\/diffs\//, 'pipeline artifact must include classified diffs');
assert.match(figmaPipeline, /\.automation\/snapshots\//, 'pipeline artifact must include snapshots');

assert.match(
  designerApproval,
  /actions:\s*read/,
  'designer-approval workflow needs actions: read permission to download artifacts from the originating workflow run'
);
assert.match(
  designerApproval,
  /name:\s*Prepare designer decision context/,
  'designer-approval workflow must derive the originating run id before recording the decision'
);
assert.match(
  designerApproval,
  /uses:\s*actions\/download-artifact@v4[\s\S]*name:\s*figma-pipeline-\$\{\{ env\.CS_RUN_ID \}\}[\s\S]*run-id:\s*\$\{\{ env\.CS_RUN_ID \}\}/,
  'designer-approval workflow must download the original figma-pipeline artifact by manifest runId'
);
assert.ok(
  designerApproval.indexOf('Prepare designer decision context') < designerApproval.indexOf('Record designer decision'),
  'artifact download preparation must happen before figma:designer-approval runs'
);
assert.match(
  figmaPipeline,
  /name:\s*Persist CS manifest PR[\s\S]*run:\s*npx tsx scripts\/pipeline\/manifest-pr\.ts/,
  'figma-pipeline must persist CS manifests through a PR so protected main validate can run'
);
assert.match(
  designerApproval,
  /name:\s*Persist manifest transition PR[\s\S]*run:\s*npm run figma:manifest-pr/,
  'designer-approval must persist decision transitions through a PR so protected main validate can run'
);

console.log('workflow artifact handoff contract ok');

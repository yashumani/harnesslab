import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/styles.css',
  'apps/web/workspace.css',
  'apps/web/runtime.css',
  'apps/web/app.js',
  'apps/web/engine.js',
  'apps/web/workspace-store.js',
  'apps/web/analysis-client.js',
  'apps/web/result-contract.js',
  'apps/web/manifest.webmanifest',
  'apps/web/favicon.svg',
  'apps/web/.nojekyll',
  'services/gateway/app.mjs',
  'services/gateway/config.mjs',
  'services/gateway/provider-registry.mjs',
  'services/gateway/providers/deterministic.mjs',
  'services/gateway/providers/ollama.mjs',
  'services/gateway/server.mjs',
  'services/gateway/Dockerfile',
  'docs/architecture/ANALYSIS_GATEWAY.md',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml'
];

for (const path of requiredFiles) {
  await access(path, constants.R_OK);
}

const html = await readFile('apps/web/index.html', 'utf8');
const app = await readFile('apps/web/app.js', 'utf8');
const engine = await readFile('apps/web/engine.js', 'utf8');
const workspace = await readFile('apps/web/workspace-store.js', 'utf8');
const analysisClient = await readFile('apps/web/analysis-client.js', 'utf8');
const resultContract = await readFile('apps/web/result-contract.js', 'utf8');
const workspaceCss = await readFile('apps/web/workspace.css', 'utf8');
const runtimeCss = await readFile('apps/web/runtime.css', 'utf8');
const gateway = await readFile('services/gateway/app.mjs', 'utf8');
const gatewayConfig = await readFile('services/gateway/config.mjs', 'utf8');
const ollama = await readFile('services/gateway/providers/ollama.mjs', 'utf8');
const dockerfile = await readFile('services/gateway/Dockerfile', 'utf8');
const deploy = await readFile('.github/workflows/deploy-pages.yml', 'utf8');

const requiredElementIds = [
  'project-select',
  'new-project-form',
  'save-version-button',
  'run-history',
  'analysis-mode-select',
  'gateway-url-input',
  'test-gateway-button',
  'gateway-health-badge',
  'result-runtime-badge',
  'runtime-source-value',
  'runtime-provider-value',
  'requirement-form',
  'results'
];

const checks = [
  [html.includes('src="./app.js"'), 'index must use a repository-relative app script path'],
  [html.includes('href="./styles.css"'), 'index must use the base repository-relative stylesheet path'],
  [html.includes('href="./workspace.css"'), 'index must use the workspace stylesheet path'],
  [html.includes('href="./runtime.css"'), 'index must use the runtime stylesheet path'],
  [html.includes('Browser deterministic'), 'index must retain the no-gateway analysis path'],
  [html.includes('browser-local'), 'index must disclose the browser-local persistence boundary'],
  [html.includes('No provider credentials in the browser'), 'index must disclose the provider credential boundary'],
  [!html.includes('type="password"'), 'static UI must not accept provider credentials'],
  [app.includes("from './engine.js'"), 'app must import the deterministic engine'],
  [app.includes("from './analysis-client.js'"), 'app must use the provider-neutral analysis client'],
  [app.includes("from './workspace-store.js'"), 'app must import the replaceable workspace store'],
  [analysisClient.includes('GATEWAY_INVALID_RESULT'), 'analysis client must reject invalid gateway results'],
  [analysisClient.includes('gateway.fallback'), 'analysis client must record automatic fallback'],
  [!analysisClient.toLowerCase().includes('authorization:'), 'browser analysis client must not add provider authorization'],
  [resultContract.includes('validateHarnessResult'), 'shared result contract validator is required'],
  [workspace.includes('WORKSPACE_SCHEMA_VERSION'), 'workspace store must version its persisted schema'],
  [workspace.includes('MAX_RUNS_PER_PROJECT'), 'workspace store must bound local run retention'],
  [workspaceCss.includes('.workspace-grid'), 'workspace stylesheet must define the deployed workspace layout'],
  [runtimeCss.includes('.runtime-config-grid'), 'runtime stylesheet must define the provider controls'],
  [engine.includes('no live model or external tool execution'), 'engine must disclose that live execution is absent'],
  [gateway.includes("'/health'"), 'gateway must expose its health contract'],
  [gateway.includes("'/v1/analyze'"), 'gateway must expose its analysis contract'],
  [gateway.includes('ORIGIN_NOT_ALLOWED'), 'gateway must enforce an origin allowlist'],
  [gatewayConfig.includes("'deterministic'"), 'gateway must default to deterministic analysis'],
  [ollama.includes('deterministic HarnessLab controls'), 'Ollama adapter must preserve deterministic controls'],
  [dockerfile.includes('USER node'), 'gateway container must run as a non-root user'],
  [deploy.includes('actions/deploy-pages@'), 'deployment workflow must use the official Pages deployment action'],
  [deploy.includes('path: apps/web'), 'deployment workflow must publish only the web artifact directory']
];

for (const id of requiredElementIds) {
  checks.push([html.includes(`id="${id}"`), `index is missing required element #${id}`]);
}

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i
];

for (const [name, content] of [
  ['index', html],
  ['app', app],
  ['engine', engine],
  ['workspace', workspace],
  ['analysis-client', analysisClient],
  ['result-contract', resultContract],
  ['workspace-css', workspaceCss],
  ['runtime-css', runtimeCss],
  ['gateway', gateway],
  ['gateway-config', gatewayConfig],
  ['ollama', ollama],
  ['dockerfile', dockerfile],
  ['deploy', deploy]
]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} deploy-first application and gateway files.`);

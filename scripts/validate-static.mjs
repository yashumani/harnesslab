import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/react-app.css',
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
  'services/gateway/providers/architecture-guidance.mjs',
  'services/gateway/providers/deterministic.mjs',
  'services/gateway/providers/ollama.mjs',
  'services/gateway/providers/openrouter.mjs',
  'services/gateway/providers/provider-http.mjs',
  'services/gateway/server.mjs',
  'services/gateway/Dockerfile',
  'docs/architecture/ANALYSIS_GATEWAY.md',
  'docs/architecture/NO_BUILD_REACT.md',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml'
];

for (const path of requiredFiles) {
  await access(path, constants.R_OK);
}

const html = await readFile('apps/web/index.html', 'utf8');
const app = await readFile('apps/web/app.js', 'utf8');
const visualCss = await readFile('apps/web/react-app.css', 'utf8');
const engine = await readFile('apps/web/engine.js', 'utf8');
const workspace = await readFile('apps/web/workspace-store.js', 'utf8');
const analysisClient = await readFile('apps/web/analysis-client.js', 'utf8');
const resultContract = await readFile('apps/web/result-contract.js', 'utf8');
const gateway = await readFile('services/gateway/app.mjs', 'utf8');
const gatewayConfig = await readFile('services/gateway/config.mjs', 'utf8');
const registry = await readFile('services/gateway/provider-registry.mjs', 'utf8');
const guidance = await readFile('services/gateway/providers/architecture-guidance.mjs', 'utf8');
const providerHttp = await readFile('services/gateway/providers/provider-http.mjs', 'utf8');
const ollama = await readFile('services/gateway/providers/ollama.mjs', 'utf8');
const openrouter = await readFile('services/gateway/providers/openrouter.mjs', 'utf8');
const dockerfile = await readFile('services/gateway/Dockerfile', 'utf8');
const deploy = await readFile('.github/workflows/deploy-pages.yml', 'utf8');

const browserBundle = [html, app, engine, workspace, analysisClient, resultContract].join('\n');
const checks = [
  [html.includes('id="root"'), 'index must provide the React mount root'],
  [html.includes('href="./react-app.css"'), 'index must load the repository-relative React visual stylesheet'],
  [html.includes('type="module" src="./app.js"'), 'index must use a repository-relative application module'],
  [html.includes('react@18.3.1/umd/react.production.min.js'), 'index must pin the React no-build runtime'],
  [html.includes('react-dom@18.3.1/umd/react-dom.production.min.js'), 'index must pin the ReactDOM no-build runtime'],
  [html.includes('htm@3.1.1/dist/htm.umd.js'), 'index must pin the HTM no-build template runtime'],
  [!html.includes('text/babel'), 'the deployed application must not use an in-browser JSX compiler'],
  [!html.includes('type="password"'), 'the static UI must not accept provider credentials'],
  [app.includes('HtmRuntime.bind(ReactRuntime.createElement)'), 'app must render React without JSX compilation'],
  [app.includes('ReactDomRuntime.createRoot(rootElement)'), 'app must mount through ReactDOM'],
  [app.includes("from './engine.js'"), 'React app must preserve the deterministic engine seam'],
  [app.includes("from './analysis-client.js'"), 'React app must preserve the provider-neutral analysis seam'],
  [app.includes("from './workspace-store.js'"), 'React app must preserve the replaceable workspace store'],
  [app.includes('planned, not executed'), 'React app must disclose the temporary-worker execution boundary'],
  [app.includes('No provider keys in browser'), 'React app must disclose the provider credential boundary'],
  [visualCss.includes('.architecture-map'), 'visual stylesheet must define the architecture map'],
  [visualCss.includes('.agent-card-grid'), 'visual stylesheet must define temporary-agent cards'],
  [visualCss.includes('.permission-table'), 'visual stylesheet must define the permission matrix'],
  [visualCss.includes('.trace-timeline'), 'visual stylesheet must define the trace timeline'],
  [visualCss.includes('.evaluation-ring'), 'visual stylesheet must define the evaluation visual'],
  [!browserBundle.includes('OPENROUTER_API_KEY'), 'browser assets must not reference the OpenRouter credential variable'],
  [!browserBundle.toLowerCase().includes('authorization: bearer'), 'browser assets must not construct provider authorization'],
  [analysisClient.includes('GATEWAY_INVALID_RESULT'), 'analysis client must reject invalid gateway results'],
  [analysisClient.includes('gateway.fallback'), 'analysis client must record automatic fallback'],
  [!analysisClient.toLowerCase().includes('authorization:'), 'browser analysis client must not add provider authorization'],
  [resultContract.includes('validateHarnessResult'), 'shared result contract validator is required'],
  [workspace.includes('WORKSPACE_SCHEMA_VERSION'), 'workspace store must version its persisted schema'],
  [workspace.includes('MAX_RUNS_PER_PROJECT'), 'workspace store must bound local run retention'],
  [engine.includes('no live model or external tool execution'), 'engine must disclose that live execution is absent'],
  [gateway.includes("'/health'"), 'gateway must expose its health contract'],
  [gateway.includes("'/v1/analyze'"), 'gateway must expose its analysis contract'],
  [gateway.includes('ORIGIN_NOT_ALLOWED'), 'gateway must enforce an origin allowlist'],
  [gateway.includes('providerResponse.model'), 'gateway must surface the actual routed model when available'],
  [gateway.includes('freeOnly'), 'gateway must expose provider free-only policy'],
  [gatewayConfig.includes("'deterministic'"), 'gateway must default to deterministic analysis'],
  [gatewayConfig.includes("'openrouter'"), 'gateway config must support the OpenRouter provider'],
  [gatewayConfig.includes('normalizeFreeOpenRouterModel'), 'gateway config must enforce free-only OpenRouter models'],
  [registry.includes('createOpenRouterProvider'), 'provider registry must construct the OpenRouter adapter'],
  [guidance.includes('deterministic HarnessLab controls remain authoritative'), 'shared guidance contract must preserve deterministic controls'],
  [providerHttp.includes('await response.text()'), 'provider timeout boundary must include complete response bodies'],
  [ollama.includes('applyArchitectureSupplement'), 'Ollama adapter must use the shared bounded guidance contract'],
  [openrouter.includes('https://openrouter.ai/api/v1'), 'OpenRouter adapter must use the fixed official HTTPS API origin'],
  [openrouter.includes('openrouter/free'), 'OpenRouter adapter must support the free router'],
  [openrouter.includes("endsWith(':free')"), 'OpenRouter adapter must enforce explicit free variants'],
  [openrouter.includes('/chat/completions'), 'OpenRouter adapter must use the chat-completions endpoint'],
  [openrouter.includes('/key'), 'OpenRouter adapter must validate the configured key'],
  [dockerfile.includes('USER node'), 'gateway container must run as a non-root user'],
  [deploy.includes('actions/deploy-pages@'), 'deployment workflow must use the official Pages deployment action'],
  [deploy.includes('path: apps/web'), 'deployment workflow must publish only the web artifact directory']
];

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
  ['react-css', visualCss],
  ['engine', engine],
  ['workspace', workspace],
  ['analysis-client', analysisClient],
  ['result-contract', resultContract],
  ['gateway', gateway],
  ['gateway-config', gatewayConfig],
  ['registry', registry],
  ['guidance', guidance],
  ['provider-http', providerHttp],
  ['ollama', ollama],
  ['openrouter', openrouter],
  ['dockerfile', dockerfile],
  ['deploy', deploy]
]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} no-build React, application, and gateway files.`);

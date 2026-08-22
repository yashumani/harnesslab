import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/react-app.css',
  'apps/web/app.js',
  'apps/web/engine.js',
  'apps/web/workspace-store.js',
  'apps/web/analysis-client.js',
  'apps/web/critic-client.js',
  'apps/web/critic-console.js',
  'apps/web/critic-console.css',
  'apps/web/result-contract.js',
  'apps/web/temporary-worker-contract.js',
  'apps/web/manifest.webmanifest',
  'apps/web/favicon.svg',
  'apps/web/.nojekyll',
  'services/gateway/app.mjs',
  'services/gateway/config.mjs',
  'services/gateway/provider-registry.mjs',
  'services/gateway/temporary-critic.mjs',
  'services/gateway/providers/architecture-guidance.mjs',
  'services/gateway/providers/deterministic.mjs',
  'services/gateway/providers/ollama.mjs',
  'services/gateway/providers/openrouter.mjs',
  'services/gateway/providers/provider-http.mjs',
  'services/gateway/server.mjs',
  'services/gateway/Dockerfile',
  'docs/architecture/ANALYSIS_GATEWAY.md',
  'docs/architecture/NO_BUILD_REACT.md',
  'docs/architecture/TEMPORARY_CRITIC.md',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/verify-pages.yml'
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
const criticClient = await readFile('apps/web/critic-client.js', 'utf8');
const criticConsole = await readFile('apps/web/critic-console.js', 'utf8');
const criticCss = await readFile('apps/web/critic-console.css', 'utf8');
const resultContract = await readFile('apps/web/result-contract.js', 'utf8');
const workerContract = await readFile('apps/web/temporary-worker-contract.js', 'utf8');
const gateway = await readFile('services/gateway/app.mjs', 'utf8');
const gatewayConfig = await readFile('services/gateway/config.mjs', 'utf8');
const registry = await readFile('services/gateway/provider-registry.mjs', 'utf8');
const temporaryCritic = await readFile('services/gateway/temporary-critic.mjs', 'utf8');
const guidance = await readFile('services/gateway/providers/architecture-guidance.mjs', 'utf8');
const deterministic = await readFile('services/gateway/providers/deterministic.mjs', 'utf8');
const providerHttp = await readFile('services/gateway/providers/provider-http.mjs', 'utf8');
const ollama = await readFile('services/gateway/providers/ollama.mjs', 'utf8');
const openrouter = await readFile('services/gateway/providers/openrouter.mjs', 'utf8');
const dockerfile = await readFile('services/gateway/Dockerfile', 'utf8');
const deploy = await readFile('.github/workflows/deploy-pages.yml', 'utf8');
const verifyPages = await readFile('.github/workflows/verify-pages.yml', 'utf8');

const browserBundle = [
  html,
  app,
  engine,
  workspace,
  analysisClient,
  criticClient,
  criticConsole,
  resultContract,
  workerContract
].join('\n');
const checks = [
  [html.includes('id="root"'), 'index must provide the React mount root'],
  [html.includes('href="./react-app.css"'), 'index must load the repository-relative React visual stylesheet'],
  [html.includes('type="module" src="./app.js"'), 'index must use a repository-relative application module'],
  [html.includes('type="module" src="./critic-console.js"'), 'index must load the executable critic console module'],
  [html.indexOf('src="./critic-console.js"') < html.indexOf('src="./app.js"'), 'critic console must subscribe before the main application publishes its initial result'],
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
  [app.includes('planned, not executed'), 'React app must disclose that general planned subagents are not executed'],
  [app.includes('No provider keys in browser'), 'React app must disclose the provider credential boundary'],
  [visualCss.includes('.architecture-map'), 'visual stylesheet must define the architecture map'],
  [visualCss.includes('.agent-card-grid'), 'visual stylesheet must define temporary-agent cards'],
  [visualCss.includes('.permission-table'), 'visual stylesheet must define the permission matrix'],
  [visualCss.includes('.trace-timeline'), 'visual stylesheet must define the trace timeline'],
  [visualCss.includes('.evaluation-ring'), 'visual stylesheet must define the evaluation visual'],
  [analysisClient.includes('harnesslab:analysis-result'), 'analysis client must publish results for the bounded critic console'],
  [criticClient.includes('/v1/critique'), 'critic client must call only the bounded worker endpoint'],
  [criticClient.includes('WORKER_REQUIRES_GATEWAY'), 'critic client must keep browser mode analysis-only'],
  [criticConsole.includes('One worker'), 'critic console must disclose the one-worker limit'],
  [criticConsole.includes('One provider call'), 'critic console must disclose the one-call limit'],
  [criticConsole.includes('No tools'), 'critic console must disclose that tools are unavailable'],
  [criticConsole.includes('No child agents'), 'critic console must disclose that child agents are unavailable'],
  [criticConsole.includes('No external actions'), 'critic console must disclose that external actions are unavailable'],
  [criticConsole.includes('harnesslab:critic-result'), 'critic console must consume validated worker results'],
  [criticCss.includes('.critic-drawer'), 'critic visual must define the execution drawer'],
  [criticCss.includes('.finding-card'), 'critic visual must define retained finding cards'],
  [criticCss.includes('@media (max-width: 760px)'), 'critic visual must be mobile responsive'],
  [criticCss.includes('prefers-reduced-motion'), 'critic visual must respect reduced-motion settings'],
  [!browserBundle.includes('OPENROUTER_API_KEY'), 'browser assets must not reference the OpenRouter credential variable'],
  [!browserBundle.toLowerCase().includes('authorization: bearer'), 'browser assets must not construct provider authorization'],
  [analysisClient.includes('GATEWAY_INVALID_RESULT'), 'analysis client must reject invalid gateway results'],
  [analysisClient.includes('gateway.fallback'), 'analysis client must record automatic fallback'],
  [!analysisClient.toLowerCase().includes('authorization:'), 'browser analysis client must not add provider authorization'],
  [!criticClient.toLowerCase().includes('authorization:'), 'browser critic client must not add provider authorization'],
  [resultContract.includes('validateHarnessResult'), 'shared result contract validator is required'],
  [workerContract.includes('validateTemporaryWorker'), 'shared temporary-worker contract validator is required'],
  [workerContract.includes('callBudget must equal 1'), 'worker contract must enforce one call'],
  [workerContract.includes('tools must be an empty array'), 'worker contract must enforce no tools'],
  [workerContract.includes('childSpawning must be false'), 'worker contract must prohibit child agents'],
  [workerContract.includes('externalActions must be false'), 'worker contract must prohibit external actions'],
  [workspace.includes('WORKSPACE_SCHEMA_VERSION'), 'workspace store must version its persisted schema'],
  [workspace.includes('MAX_RUNS_PER_PROJECT'), 'workspace store must bound local run retention'],
  [engine.includes('no live model or external tool execution'), 'engine must disclose that live execution is absent'],
  [gateway.includes("'/health'"), 'gateway must expose its health contract'],
  [gateway.includes("'/v1/analyze'"), 'gateway must expose its analysis contract'],
  [gateway.includes("'/v1/critique'"), 'gateway must expose the bounded critic contract'],
  [gateway.includes('maxTemporaryWorkersPerRequest: 1'), 'gateway must expose the one-worker limit'],
  [gateway.includes('executeTools: false'), 'gateway must deny tools'],
  [gateway.includes('externalActions: false'), 'gateway must deny external actions'],
  [gateway.includes('ORIGIN_NOT_ALLOWED'), 'gateway must enforce an origin allowlist'],
  [gateway.includes('providerResponse.model'), 'gateway must surface the actual routed model when available'],
  [gateway.includes('freeOnly'), 'gateway must expose provider free-only policy'],
  [gatewayConfig.includes("'deterministic'"), 'gateway must default to deterministic analysis'],
  [gatewayConfig.includes("'openrouter'"), 'gateway config must support the OpenRouter provider'],
  [gatewayConfig.includes('HARNESSLAB_CRITIC_TIMEOUT_MS'), 'gateway config must bound the temporary critic deadline'],
  [gatewayConfig.includes('HARNESSLAB_CRITIC_MAX_BODY_BYTES'), 'gateway config must bound the critic request body'],
  [gatewayConfig.includes('normalizeFreeOpenRouterModel'), 'gateway config must enforce free-only OpenRouter models'],
  [registry.includes('createOpenRouterProvider'), 'provider registry must construct the OpenRouter adapter'],
  [temporaryCritic.includes('modelCallBudget: 1'), 'temporary critic context must enforce a one-call budget'],
  [temporaryCritic.includes('tools: []'), 'temporary critic context must expose no tools'],
  [temporaryCritic.includes('childSpawning: false'), 'temporary critic context must prohibit child agents'],
  [temporaryCritic.includes('Temporary critic findings cannot weaken permissions'), 'deterministic merge must preserve controls'],
  [guidance.includes('deterministic HarnessLab controls remain authoritative'), 'shared guidance contract must preserve deterministic controls'],
  [providerHttp.includes('await response.text()'), 'provider timeout boundary must include complete response bodies'],
  [deterministic.includes('async critique'), 'deterministic provider must implement the temporary critic'],
  [ollama.includes('async function critique'), 'Ollama adapter must implement the temporary critic'],
  [ollama.includes('createCriticPrompt'), 'Ollama critic must use the bounded worker prompt'],
  [openrouter.includes('https://openrouter.ai/api/v1'), 'OpenRouter adapter must use the fixed official HTTPS API origin'],
  [openrouter.includes('openrouter/free'), 'OpenRouter adapter must support the free router'],
  [openrouter.includes("endsWith(':free')"), 'OpenRouter adapter must enforce explicit free variants'],
  [openrouter.includes('async function critique'), 'OpenRouter adapter must implement the temporary critic'],
  [openrouter.includes('createCriticPrompt'), 'OpenRouter critic must use the bounded worker prompt'],
  [openrouter.includes('/chat/completions'), 'OpenRouter adapter must use the chat-completions endpoint'],
  [openrouter.includes('/key'), 'OpenRouter adapter must validate the configured key'],
  [dockerfile.includes('USER node'), 'gateway container must run as a non-root user'],
  [deploy.includes('actions/deploy-pages@'), 'deployment workflow must use the official Pages deployment action'],
  [deploy.includes('path: apps/web'), 'deployment workflow must publish only the web artifact directory'],
  [verifyPages.includes('/critic-console.js'), 'live verification must validate the deployed critic console'],
  [verifyPages.includes('/critic-console.css'), 'live verification must validate the deployed critic visual']
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
  ['critic-client', criticClient],
  ['critic-console', criticConsole],
  ['critic-css', criticCss],
  ['result-contract', resultContract],
  ['worker-contract', workerContract],
  ['gateway', gateway],
  ['gateway-config', gatewayConfig],
  ['registry', registry],
  ['temporary-critic', temporaryCritic],
  ['guidance', guidance],
  ['provider-http', providerHttp],
  ['deterministic', deterministic],
  ['ollama', ollama],
  ['openrouter', openrouter],
  ['dockerfile', dockerfile],
  ['deploy', deploy],
  ['verify-pages', verifyPages]
]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} no-build React, temporary-worker, application, and gateway files.`);

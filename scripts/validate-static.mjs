import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/react-app.css',
  'apps/web/taskzen-theme.css',
  'apps/web/taskzen-shell.js',
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
  'scripts/capture-ui-viewport.mjs',
  'docs/architecture/ANALYSIS_GATEWAY.md',
  'docs/architecture/NO_BUILD_REACT.md',
  'docs/architecture/TEMPORARY_CRITIC.md',
  'docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/verify-pages.yml',
  '.github/workflows/ui-viewport-audit.yml'
];

for (const path of requiredFiles) {
  await access(path, constants.R_OK);
}

const html = await readFile('apps/web/index.html', 'utf8');
const app = await readFile('apps/web/app.js', 'utf8');
const visualCss = await readFile('apps/web/react-app.css', 'utf8');
const taskzenTheme = await readFile('apps/web/taskzen-theme.css', 'utf8');
const taskzenShell = await readFile('apps/web/taskzen-shell.js', 'utf8');
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
const captureViewport = await readFile('scripts/capture-ui-viewport.mjs', 'utf8');
const deploy = await readFile('.github/workflows/deploy-pages.yml', 'utf8');
const verifyPages = await readFile('.github/workflows/verify-pages.yml', 'utf8');
const viewportAudit = await readFile('.github/workflows/ui-viewport-audit.yml', 'utf8');

const browserBundle = [
  html,
  app,
  taskzenShell,
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
  [html.includes('href="./taskzen-theme.css"'), 'index must load the Taskzen-inspired visual system'],
  [!html.includes('neuronest-theme.css'), 'index must not load the superseded NeuroNest theme'],
  [html.includes('type="module" src="./taskzen-shell.js"'), 'index must load the responsive Taskzen browser shell'],
  [html.includes('type="module" src="./app.js"'), 'index must use a repository-relative application module'],
  [html.includes('type="module" src="./critic-console.js"'), 'index must load the executable critic console module'],
  [html.indexOf('src="./taskzen-shell.js"') < html.indexOf('src="./critic-console.js"'), 'the visual shell must initialize before the critic console'],
  [html.indexOf('src="./critic-console.js"') < html.indexOf('src="./app.js"'), 'critic console must subscribe before the main application publishes its initial result'],
  [html.includes('data-design="taskzen"'), 'index must disclose the active design identity'],
  [html.includes('HarnessLab — AI Agent Harness Builder'), 'index must expose the product title'],
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
  [visualCss.includes('.architecture-map'), 'functional stylesheet must define the architecture map'],
  [visualCss.includes('.agent-card-grid'), 'functional stylesheet must define temporary-agent cards'],
  [visualCss.includes('.permission-table'), 'functional stylesheet must define the permission matrix'],
  [visualCss.includes('.trace-timeline'), 'functional stylesheet must define the trace timeline'],
  [visualCss.includes('.evaluation-ring'), 'functional stylesheet must define the evaluation visual'],
  [taskzenTheme.includes('--cyan: #635bff'), 'Taskzen theme must define the primary indigo accent'],
  [taskzenTheme.includes('--teal: #0e9384'), 'Taskzen theme must define the secondary teal accent'],
  [taskzenTheme.includes('--bg-0: #f7f8fc'), 'Taskzen theme must define the light canvas'],
  [taskzenTheme.includes('.sidebar'), 'Taskzen theme must redesign navigation'],
  [taskzenTheme.includes('.mission-hero'), 'Taskzen theme must redesign the product hero'],
  [taskzenTheme.includes('.workspace-layout'), 'Taskzen theme must redesign the project workspace'],
  [taskzenTheme.includes('.runtime-panel'), 'Taskzen theme must redesign runtime configuration'],
  [taskzenTheme.includes('.composer-panel'), 'Taskzen theme must redesign requirement entry'],
  [taskzenTheme.includes('.architecture-map'), 'Taskzen theme must redesign architecture evidence'],
  [taskzenTheme.includes('.permission-table'), 'Taskzen theme must redesign governance evidence'],
  [taskzenTheme.includes('@media (max-width: 1120px)'), 'Taskzen theme must include tablet navigation behavior'],
  [taskzenTheme.includes('@media (max-width: 760px)'), 'Taskzen theme must include phone composition'],
  [taskzenTheme.includes('prefers-reduced-motion'), 'Taskzen theme must respect reduced-motion preferences'],
  [!taskzenTheme.includes('neuronest'), 'Taskzen theme must not depend on the superseded design layer'],
  [!(/url\s*\(\s*["']?https?:|data:image\//i.test(taskzenTheme)), 'Taskzen theme must not embed remote or data-image artwork'],
  [taskzenShell.includes("const DESIGN_ID = 'taskzen'"), 'Taskzen shell must expose a stable design identity'],
  [taskzenShell.includes("return 'phone'"), 'Taskzen shell must classify phone layout'],
  [taskzenShell.includes("return 'tablet'"), 'Taskzen shell must classify tablet layout'],
  [taskzenShell.includes("return 'desktop'"), 'Taskzen shell must classify desktop layout'],
  [taskzenShell.includes('dataset.uiOverflow'), 'Taskzen shell must report horizontal overflow'],
  [taskzenShell.includes('dataset.uiUndersized'), 'Taskzen shell must report touch-target failures'],
  [taskzenShell.includes('dataset.uiClipped'), 'Taskzen shell must report clipped controls'],
  [taskzenShell.includes('ui-audit-output'), 'Taskzen shell must retain browser audit evidence'],
  [captureViewport.includes('Emulation.setDeviceMetricsOverride'), 'viewport capture must use exact CDP viewport emulation'],
  [captureViewport.includes('Page.captureScreenshot'), 'viewport capture must retain image evidence'],
  [captureViewport.includes('uiDesign === \'taskzen\''), 'viewport capture must validate design identity'],
  [viewportAudit.includes('audit_viewport desktop 1440 1100'), 'viewport workflow must audit desktop'],
  [viewportAudit.includes('audit_viewport tablet 1024 900'), 'viewport workflow must audit tablet'],
  [viewportAudit.includes('audit_viewport phone 390 844'), 'viewport workflow must audit phone'],
  [viewportAudit.includes('harnesslab-taskzen-ui-audit'), 'viewport workflow must retain responsive evidence'],
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
  [criticCss.includes('--critic-cyan: #635bff'), 'critic visual must use the shared indigo product accent'],
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
  ['taskzen-theme', taskzenTheme],
  ['taskzen-shell', taskzenShell],
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
  ['capture-viewport', captureViewport],
  ['deploy', deploy],
  ['verify-pages', verifyPages],
  ['viewport-audit', viewportAudit]
]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} no-build React, Taskzen UI, temporary-worker, application, and gateway files.`);

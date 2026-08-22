import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/react-app.css',
  'apps/web/anomaly-ui.css',
  'apps/web/anomaly-mobile.css',
  'apps/web/anomaly-shell.js',
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
  'docs/architecture/ANOMALY_UI_SYSTEM.md',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/verify-pages.yml',
  '.github/workflows/ui-viewport-audit.yml'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const html = await readFile('apps/web/index.html', 'utf8');
const app = await readFile('apps/web/app.js', 'utf8');
const visualCss = await readFile('apps/web/react-app.css', 'utf8');
const anomalyCss = await readFile('apps/web/anomaly-ui.css', 'utf8');
const anomalyMobile = await readFile('apps/web/anomaly-mobile.css', 'utf8');
const anomalyShell = await readFile('apps/web/anomaly-shell.js', 'utf8');
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
const viewportAudit = await readFile('.github/workflows/ui-viewport-audit.yml', 'utf8');

const browserBundle = [
  html, app, visualCss, anomalyCss, anomalyMobile, anomalyShell, engine, workspace,
  analysisClient, criticClient, criticConsole, criticCss, resultContract, workerContract
].join('\n');

const paletteIds = [
  'midnight', 'slate', 'warm', 'light', 'verizon', 'att', 'tmobile', 'nvidia', 'meta', 'google',
  'cfo-navy', 'emerald', 'copper', 'royal', 'solar', 'arctic', 'plum', 'monochrome'
];

const checks = [
  [html.includes('id="root"'), 'index must provide the React mount root'],
  [html.includes('href="./react-app.css"'), 'index must load the functional React stylesheet'],
  [html.includes('href="./anomaly-ui.css"'), 'index must load the anomaly product desktop visual layer'],
  [html.includes('href="./anomaly-mobile.css"'), 'index must load the anomaly product phone layer'],
  [html.indexOf('href="./anomaly-mobile.css"') > html.indexOf('href="./anomaly-ui.css"'), 'phone overrides must load after the desktop visual layer'],
  [!html.includes('neuronest-theme.css'), 'the superseded NeuroNest theme must not remain active'],
  [html.includes('type="module" src="./anomaly-shell.js"'), 'index must load the palette and shell controller'],
  [html.includes('type="module" src="./app.js"'), 'index must use the repository-relative application module'],
  [html.includes('type="module" src="./critic-console.js"'), 'index must load the executable critic console module'],
  [html.indexOf('src="./anomaly-shell.js"') < html.indexOf('src="./app.js"'), 'the shell controller must establish palette/layout metadata before React mounts'],
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
  [visualCss.includes('.architecture-map'), 'functional stylesheet must define the architecture map'],
  [visualCss.includes('.agent-card-grid'), 'functional stylesheet must define temporary-agent cards'],
  [visualCss.includes('.permission-table'), 'functional stylesheet must define the permission matrix'],
  [visualCss.includes('.trace-timeline'), 'functional stylesheet must define the trace timeline'],
  [visualCss.includes('.evaluation-ring'), 'functional stylesheet must define the evaluation visual'],
  [anomalyCss.includes('yashumani/drill-down-anamoly'), 'visual layer must identify the product-owned reference repository'],
  [anomalyCss.includes('AGENT HARNESS CONTROL ROOM'), 'visual layer must implement the answer-first control-room hero'],
  [anomalyCss.includes('.theme-picker-menu'), 'visual layer must style the theme picker'],
  [anomalyCss.includes('.development-cycle'), 'visual layer must style the deploy-first cycle'],
  [anomalyCss.includes('.architecture-map'), 'visual layer must redesign the architecture map'],
  [anomalyCss.includes('harnesslab-critic-console'), 'visual layer must integrate the critic console palette'],
  [anomalyCss.includes(':focus-visible'), 'visual layer must retain keyboard focus visibility'],
  [anomalyCss.includes('prefers-reduced-motion'), 'visual layer must respect reduced motion'],
  [anomalyMobile.includes('@media (max-width: 640px)'), 'phone layer must define the phone breakpoint'],
  [anomalyMobile.includes('@media (max-width: 390px)'), 'phone layer must validate narrow phones'],
  [anomalyMobile.includes('grid-template-areas:'), 'phone app bar must use an explicit layout'],
  [anomalyMobile.includes('min-height: 44px'), 'phone primary controls must retain touch-friendly height'],
  [anomalyMobile.includes('overflow-x: clip'), 'phone layout must prevent horizontal page overflow'],
  [anomalyShell.includes('HARNESSLAB_PALETTES'), 'shell must provide the shared palette catalog'],
  [paletteIds.every((id) => anomalyShell.includes(`id: '${id}'`)), 'shell must include all 18 anomaly product palettes'],
  [paletteIds.every((id) => anomalyCss.includes(`html[data-theme="${id}"]`)), 'CSS must map all 18 anomaly product palettes'],
  [anomalyShell.includes('harnesslab.anomaly-palette.v1'), 'shell must persist only a palette identifier'],
  [anomalyShell.includes('Design → Validate → Deploy → Observe → Improve'), 'shell must expose the development cycle'],
  [anomalyShell.includes('data.uiOverflow'), 'shell must expose viewport overflow evidence'],
  [anomalyShell.includes('data.uiUndersized'), 'shell must expose interaction-size evidence'],
  [anomalyShell.includes('data.uiClipped'), 'shell must expose clipping evidence'],
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
  [criticCss.includes('prefers-reduced-motion'), 'critic visual must respect reduced motion'],
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
  [verifyPages.includes('/critic-console.css'), 'live verification must validate the deployed critic visual'],
  [viewportAudit.includes('1440,1100'), 'viewport audit must render desktop'],
  [viewportAudit.includes('1024,900'), 'viewport audit must render tablet'],
  [viewportAudit.includes('390,844'), 'viewport audit must render phone'],
  [viewportAudit.includes('actions/upload-artifact@v4'), 'viewport audit must retain screenshots']
];

for (const [condition, message] of checks) if (!condition) throw new Error(message);

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i
];

for (const [name, content] of [
  ['index', html], ['app', app], ['react-css', visualCss], ['anomaly-css', anomalyCss],
  ['anomaly-mobile', anomalyMobile], ['anomaly-shell', anomalyShell], ['engine', engine],
  ['workspace', workspace], ['analysis-client', analysisClient], ['critic-client', criticClient],
  ['critic-console', criticConsole], ['critic-css', criticCss], ['result-contract', resultContract],
  ['worker-contract', workerContract], ['gateway', gateway], ['gateway-config', gatewayConfig],
  ['registry', registry], ['temporary-critic', temporaryCritic], ['guidance', guidance],
  ['provider-http', providerHttp], ['deterministic', deterministic], ['ollama', ollama],
  ['openrouter', openrouter], ['dockerfile', dockerfile], ['deploy', deploy],
  ['verify-pages', verifyPages], ['viewport-audit', viewportAudit]
]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} no-build React, anomaly UI, temporary-worker, application, and gateway files.`);

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/learn-hub.js',
  'apps/web/learn-hub.css',
  'apps/web/guide/index.html',
  'apps/web/guide/guide.css',
  'apps/web/guide/guide.js',
  'scripts/capture-learning-guide-viewport.mjs',
  '.github/workflows/learning-guide-integration.yml',
  '.github/workflows/verify-learning-guide-pages.yml'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [
  mainHtml,
  hubJs,
  hubCss,
  guideHtml,
  guideCss,
  guideJs,
  captureViewport,
  integrationWorkflow,
  liveWorkflow
] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/learn-hub.js', 'utf8'),
  readFile('apps/web/learn-hub.css', 'utf8'),
  readFile('apps/web/guide/index.html', 'utf8'),
  readFile('apps/web/guide/guide.css', 'utf8'),
  readFile('apps/web/guide/guide.js', 'utf8'),
  readFile('scripts/capture-learning-guide-viewport.mjs', 'utf8'),
  readFile('.github/workflows/learning-guide-integration.yml', 'utf8'),
  readFile('.github/workflows/verify-learning-guide-pages.yml', 'utf8')
]);

const slideMatches = [...guideHtml.matchAll(/<section class="slide(?: [^"]*)?" id="slide-(\d+)" data-slide="(\d+)" data-title="([^"]+)"/g)];
const slideNumbers = slideMatches.map((match) => Number(match[1]));
const expectedNumbers = Array.from({ length: 18 }, (_, index) => index + 1);

const checks = [
  [mainHtml.includes('<harnesslab-learn-hub>'), 'main application must mount the learning hub'],
  [mainHtml.includes('src="./learn-hub.js"'), 'main application must load the learning hub module'],
  [mainHtml.indexOf('src="./app.js"') < mainHtml.indexOf('src="./learn-hub.js"'), 'learning hub must initialize after the builder application'],
  [hubJs.includes("customElements.define('harnesslab-learn-hub'"), 'learning hub custom element is required'],
  [hubJs.includes("new URL('./guide/'"), 'learning hub must use a deployment-safe guide URL'],
  [hubJs.includes('setBackgroundInert(true)') && hubJs.includes('setBackgroundInert(false)'), 'learning hub must manage inert background state'],
  [hubJs.includes("event.key === 'Escape'") && hubJs.includes("event.key !== 'Tab'"), 'learning hub must support Escape and focus trapping'],
  [hubJs.includes('aria-modal="true"'), 'learning hub must use modal semantics'],
  [hubJs.includes('Interactive architecture guide'), 'learning hub must clearly identify the guide'],
  [!hubJs.includes('fetch(') && !hubJs.includes('XMLHttpRequest') && !hubJs.includes('WebSocket'), 'learning hub must not perform network calls'],
  [hubCss.includes('.learn-launcher') && hubCss.includes('.learn-panel'), 'learning hub visual entry and panel are required'],
  [hubCss.includes('@media (max-width: 620px)') && hubCss.includes('@media (max-width: 390px)'), 'learning hub must provide phone layouts'],
  [hubCss.includes('prefers-reduced-motion'), 'learning hub must respect reduced motion'],

  [guideHtml.includes('data-guide-theme="midnight"'), 'guide must use the approved midnight theme'],
  [guideHtml.includes('content="dark"'), 'guide must advertise dark color scheme'],
  [guideHtml.includes("connect-src 'none'"), 'guide must not allow runtime network connections'],
  [slideMatches.length === 18, `guide must contain exactly 18 slides; found ${slideMatches.length}`],
  [JSON.stringify(slideNumbers) === JSON.stringify(expectedNumbers), 'guide slide numbering must be contiguous from 1 to 18'],
  [guideHtml.includes('What exactly is HarnessLab?'), 'guide must explain the product in plain English'],
  [guideHtml.includes('A harness is the control system around AI'), 'guide must explain the harness concept'],
  [guideHtml.includes('Requirement intelligence'), 'guide must explain requirement readiness'],
  [guideHtml.includes('Architecture decision ladder'), 'guide must explain topology escalation'],
  [guideHtml.includes('Temporary subagents'), 'guide must explain temporary workers'],
  [guideHtml.includes('Tools, MCP, retrieval, and A2A'), 'guide must distinguish protocols and capabilities'],
  [guideHtml.includes('Browser-first, provider-neutral, integration-optional'), 'guide must explain system architecture'],
  [guideHtml.includes('End-user workflow') && guideHtml.includes('Developer workflow'), 'guide must include end-user and developer paths'],
  [guideHtml.includes('Telecom KPI anomaly investigation'), 'guide must include a worked example'],
  [guideHtml.includes('Current live scope'), 'guide must disclose current implementation boundaries'],

  [guideJs.includes("event.key === 'ArrowRight'") && guideJs.includes("event.key === 'ArrowLeft'"), 'guide must support arrow-key navigation'],
  [guideJs.includes("event.key === 'Home'") && guideJs.includes("event.key === 'End'"), 'guide must support Home and End navigation'],
  [guideJs.includes("location.hash.match(/^#slide-"), 'guide must support deep-link hashes'],
  [guideJs.includes("addEventListener('touchstart'") && guideJs.includes("addEventListener('touchend'"), 'guide must support touch swipes'],
  [guideJs.includes('requestFullscreen') && guideJs.includes('window.print()'), 'guide must support fullscreen and print'],
  [guideJs.includes("globalThis.scrollTo(0, 0)"), 'guide must reset document position when a slide or deep link is selected'],
  [guideJs.includes("shell.setAttribute('inert'") && guideJs.includes("shell.removeAttribute('inert'"), 'overview must isolate background content'],
  [guideJs.includes("event.key === 'Escape'") && guideJs.includes("event.key === 'Tab'"), 'overview must support Escape and focus trapping'],
  [!guideJs.includes('fetch(') && !guideJs.includes('XMLHttpRequest') && !guideJs.includes('WebSocket'), 'guide runtime must remain network-free'],

  [guideCss.includes('--bg: #030712'), 'guide must use the midnight background token'],
  [guideCss.includes('--blue: #2b7fff') && guideCss.includes('--cyan: #12d9e8') && guideCss.includes('--violet: #8a5cff'), 'guide must use the blue, cyan, and violet accent system'],
  [guideCss.includes('@media (max-width: 1024px)') && guideCss.includes('@media (max-width: 760px)') && guideCss.includes('@media (max-width: 430px)'), 'guide must include desktop, tablet, and phone compositions'],
  [guideCss.includes('@media print') && guideCss.includes('@page { size: landscape'), 'guide must support printable presentation pages'],
  [guideCss.includes('prefers-reduced-motion'), 'guide must respect reduced motion'],
  [!guideCss.match(/url\s*\(\s*["']?https?:/i), 'guide CSS must not load remote artwork'],

  [captureViewport.includes('Emulation.setDeviceMetricsOverride'), 'guide viewport QA must emulate exact CSS dimensions through Chrome DevTools'],
  [captureViewport.includes('Page.captureScreenshot'), 'guide viewport QA must retain browser screenshots'],
  [captureViewport.includes('pageOverflowX') && captureViewport.includes('clippedInteractive'), 'guide viewport QA must reject horizontal overflow and clipped controls'],
  [captureViewport.includes('bodyScroll.x') && captureViewport.includes('topbarRect'), 'guide viewport QA must validate document position and top-bar alignment'],
  [captureViewport.includes('consoleMessages') && captureViewport.includes("type === 'error'"), 'guide viewport QA must reject browser console failures'],
  [integrationWorkflow.includes('capture-learning-guide-viewport.mjs') && integrationWorkflow.includes('desktop 1440 900') && integrationWorkflow.includes('phone 390 844'), 'pull-request CI must run exact desktop and phone guide audits'],
  [liveWorkflow.includes('capture-learning-guide-viewport.mjs') && liveWorkflow.includes('desktop 1440 900') && liveWorkflow.includes('phone 390 844'), 'post-deployment CI must run exact public desktop and phone guide audits'],
  [!integrationWorkflow.includes('--window-size=') && !liveWorkflow.includes('--window-size='), 'guide workflows must not substitute browser window size for exact CSS viewport emulation']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

for (const [name, content] of [
  ['learning hub JavaScript', hubJs],
  ['learning hub CSS', hubCss],
  ['guide HTML', guideHtml],
  ['guide JavaScript', guideJs],
  ['guide CSS', guideCss],
  ['guide viewport audit', captureViewport]
]) {
  if (/OPENROUTER_API_KEY|OLLAMA_DEFAULT_MODEL|authorization\s*:/i.test(content)) {
    throw new Error(`${name} must not contain provider credentials or authorization handling`);
  }
  if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(content)) {
    throw new Error(`Potential secret found in ${name}`);
  }
}

console.log('Validated the 18-slide dark learning guide, in-product learning hub, exact responsive browser audits, accessibility, and credential-free deployment contract.');

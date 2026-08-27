import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [
  packageJson,
  viteConfig,
  rootHtml,
  launcher,
  copilotHtml,
  app,
  agent,
  styles,
  runtime,
  smoke,
  browserVerifier,
  validator,
  deployWorkflow,
  copilotWorkflow,
  liveWorkflow,
  architectureDoc
] = await Promise.all([
  read('package.json'),
  read('vite.copilotkit.config.mjs'),
  read('apps/web/index.html'),
  read('apps/web/copilotkit-launcher.js'),
  read('apps/copilotkit-web/index.html'),
  read('apps/copilotkit-web/src/App.jsx'),
  read('apps/copilotkit-web/src/harnesslab-agent.js'),
  read('apps/copilotkit-web/src/styles.css'),
  read('services/copilotkit-runtime/server.mjs'),
  read('scripts/smoke-copilotkit-agent.mjs'),
  read('scripts/verify-copilotkit-browser.mjs'),
  read('scripts/validate-copilotkit.mjs'),
  read('.github/workflows/deploy-pages.yml'),
  read('.github/workflows/copilotkit-foundation.yml'),
  read('.github/workflows/verify-copilotkit-pages.yml'),
  read('docs/architecture/COPILOTKIT_INTEGRATION.md')
]);

const pkg = JSON.parse(packageJson);

test('pins the CopilotKit v2 foundation and a reproducible Vite build', () => {
  assert.equal(pkg.dependencies['@copilotkit/react-core'], '1.69.2');
  assert.equal(pkg.dependencies['@copilotkit/runtime'], '1.69.2');
  assert.equal(pkg.dependencies['@ag-ui/client'], '0.0.57');
  assert.equal(pkg.dependencies.react, '18.3.1');
  assert.equal(pkg.dependencies['react-dom'], '18.3.1');
  assert.equal(pkg.devDependencies.vite, '8.2.2');
  assert.equal(pkg.devDependencies['@vitejs/plugin-react'], '6.1.0');
  assert.match(pkg.scripts['build:copilot'], /vite build/);
  assert.match(viteConfig, /apps\/web\/copilot/);
  assert.match(viteConfig, /base:\s*['"]\.\//);
});

test('uses the supported runtime path instead of browser-managed production agents', () => {
  assert.match(app, /runtimeUrl=/);
  assert.match(app, /CopilotProvider/);
  assert.match(app, /CopilotChat/);
  assert.match(app, /useAgentContext/);
  assert.match(app, /useFrontendTool/);
  assert.doesNotMatch(app, /agents__unsafe_dev_only|selfManagedAgents/);
  assert.doesNotMatch(`${copilotHtml}\n${app}`, /OPENAI_API_KEY|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY/);
});

test('adapts the deterministic engine into a streaming AG-UI agent', () => {
  assert.match(agent, /extends AbstractAgent/);
  assert.match(agent, /analyzeRequirement/);
  assert.match(agent, /assertHarnessResult/);
  assert.match(agent, /EventType\.RUN_STARTED/);
  assert.match(agent, /EventType\.STATE_SNAPSHOT/);
  assert.match(agent, /EventType\.TEXT_MESSAGE_START/);
  assert.match(agent, /EventType\.RUN_FINISHED/);
  assert.match(agent, /clone\(\)/);
  assert.match(agent, /networkRequestsToModels:\s*0/);
  assert.match(agent, /toolsExecuted:\s*0/);
  assert.match(agent, /externalActions:\s*0/);
  assert.doesNotMatch(agent, /fetch\(|authorization\s*:|Bearer\s+/i);
});

test('ships a self-hosted CopilotKit runtime with least-authority defaults', () => {
  assert.match(runtime, /CopilotRuntime/);
  assert.match(runtime, /InMemoryAgentRunner/);
  assert.match(runtime, /createCopilotExpressHandler/);
  assert.match(runtime, /harnessArchitect/);
  assert.match(runtime, /ORIGIN_NOT_ALLOWED/);
  assert.match(runtime, /host = process\.env\.COPILOTKIT_HOST \|\| '127\.0\.0\.1'/);
  assert.match(runtime, /tools:\s*false/);
  assert.match(runtime, /externalActions:\s*false/);
  assert.match(runtime, /productionMutation:\s*false/);
});

test('integrates a discoverable CopilotKit entry without replacing the established builder', () => {
  assert.match(rootHtml, /src="\.\/app\.js"/);
  assert.match(rootHtml, /src="\.\/copilotkit-launcher\.js"/);
  assert.ok(rootHtml.indexOf('src="./app.js"') < rootHtml.indexOf('src="./copilotkit-launcher.js"'));
  assert.match(launcher, /new URL\('\.\/copilot\/'/);
  assert.match(launcher, /HarnessLab Copilot/);
  assert.match(copilotHtml, /id="root"/);
});

test('keeps the CopilotKit artifact UI responsive and explicitly bounded', () => {
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(app, /0 model calls/);
  assert.match(app, /0 tools/);
  assert.match(app, /0 external actions/);
  assert.match(app, /selectHarnessView/);
});

test('validates the agent, browser, deployment, and live Pages contracts', () => {
  assert.match(smoke, /runAgent/);
  assert.match(smoke, /validateHarnessResult/);
  assert.match(browserVerifier, /Emulation\.setDeviceMetricsOverride/);
  assert.match(browserVerifier, /Page\.captureScreenshot/);
  assert.match(browserVerifier, /pageOverflowX/);
  assert.match(validator, /Validated the CopilotKit v2 foundation/);
  assert.match(copilotWorkflow, /npm run build:copilot/);
  assert.match(copilotWorkflow, /npm run smoke:copilotkit/);
  assert.match(copilotWorkflow, /verify-copilotkit-browser\.mjs/);
  assert.match(deployWorkflow, /npm run build:copilot/);
  assert.match(liveWorkflow, /\/copilot\//);
});

test('documents CopilotKit as the experience layer rather than the policy authority', () => {
  assert.match(architectureDoc, /interactive copilot layer/);
  assert.match(architectureDoc, /HarnessLab remains authoritative/);
  assert.match(architectureDoc, /agents__unsafe_dev_only/);
  assert.match(architectureDoc, /rate-limit and authenticate/i);
});

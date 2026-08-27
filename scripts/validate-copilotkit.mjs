import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'vite.copilotkit.config.mjs',
  'apps/web/copilotkit-launcher.js',
  'apps/copilotkit-web/index.html',
  'apps/copilotkit-web/src/main.jsx',
  'apps/copilotkit-web/src/App.jsx',
  'apps/copilotkit-web/src/harnesslab-agent.js',
  'apps/copilotkit-web/src/styles.css',
  'services/copilotkit-runtime/server.mjs',
  'services/copilotkit-runtime/.env.example',
  'scripts/smoke-copilotkit-agent.mjs',
  'scripts/verify-copilotkit-browser.mjs',
  'tests/copilotkit-foundation.test.mjs',
  'docs/architecture/COPILOTKIT_INTEGRATION.md',
  '.github/workflows/copilotkit-foundation.yml',
  '.github/workflows/verify-copilotkit-pages.yml'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [pkgText, rootHtml, app, agent, runtime, styles, deploy, workflow, live, doc] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/copilotkit-web/src/App.jsx', 'utf8'),
  readFile('apps/copilotkit-web/src/harnesslab-agent.js', 'utf8'),
  readFile('services/copilotkit-runtime/server.mjs', 'utf8'),
  readFile('apps/copilotkit-web/src/styles.css', 'utf8'),
  readFile('.github/workflows/deploy-pages.yml', 'utf8'),
  readFile('.github/workflows/copilotkit-foundation.yml', 'utf8'),
  readFile('.github/workflows/verify-copilotkit-pages.yml', 'utf8'),
  readFile('docs/architecture/COPILOTKIT_INTEGRATION.md', 'utf8')
]);
const pkg = JSON.parse(pkgText);

const checks = [
  [pkg.dependencies['@copilotkit/react-core'] === '1.69.2', 'CopilotKit React must be pinned to 1.69.2'],
  [pkg.dependencies['@copilotkit/runtime'] === '1.69.2', 'CopilotKit runtime must be pinned to 1.69.2'],
  [pkg.dependencies['@ag-ui/client'] === '0.0.57', 'AG-UI client must be pinned to the CopilotKit release line'],
  [pkg.scripts['build:copilot']?.includes('vite build'), 'CopilotKit build script is required'],
  [rootHtml.includes('src="./copilotkit-launcher.js"'), 'root application must expose the CopilotKit workspace'],
  [app.includes("from '@copilotkit/react-core/v2'"), 'frontend must use CopilotKit v2 exports'],
  [app.includes('runtimeUrl='), 'frontend must use the server runtime path'],
  [!app.includes('agents__unsafe_dev_only') && !app.includes('selfManagedAgents'), 'deployed client must not use dev-only direct agents'],
  [agent.includes('extends AbstractAgent'), 'custom AG-UI agent is required'],
  [agent.includes('assertHarnessResult'), 'HarnessLab validation must remain authoritative'],
  [agent.includes('STATE_SNAPSHOT') && agent.includes('RUN_FINISHED'), 'agent must stream state and lifecycle events'],
  [runtime.includes('createCopilotExpressHandler'), 'self-hosted runtime handler is required'],
  [runtime.includes("'127.0.0.1'"), 'runtime must bind to loopback by default'],
  [runtime.includes('ORIGIN_NOT_ALLOWED'), 'runtime must enforce an origin boundary'],
  [styles.includes('@media (max-width: 680px)'), 'phone layout is required'],
  [styles.includes('prefers-reduced-motion'), 'reduced-motion behavior is required'],
  [deploy.includes('npm run build:copilot'), 'Pages deployment must build the CopilotKit route'],
  [workflow.includes('verify-copilotkit-browser.mjs'), 'pull-request browser validation is required'],
  [live.includes('/copilot/'), 'post-deployment CopilotKit route verification is required'],
  [doc.includes('HarnessLab remains authoritative'), 'architecture boundary must be documented']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const browserBundle = `${rootHtml}\n${app}\n${agent}`;
for (const pattern of [
  /OPENAI_API_KEY|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/,
  /authorization\s*:\s*["']?Bearer/i
]) {
  if (pattern.test(browserBundle)) throw new Error('CopilotKit browser bundle contains a provider credential or authorization pattern.');
}

for (const [name, content] of [['styles', styles], ['app', app]]) {
  const openings = [...content.matchAll(/\{/g)].length;
  const closings = [...content.matchAll(/\}/g)].length;
  if (openings !== closings) throw new Error(`${name} braces are unbalanced`);
}

console.log('Validated the CopilotKit v2 foundation, deterministic AG-UI agent, self-hosted runtime, responsive workspace, security boundaries, and deployment contracts.');

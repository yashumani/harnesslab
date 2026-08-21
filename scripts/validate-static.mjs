import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/index.html',
  'apps/web/styles.css',
  'apps/web/app.js',
  'apps/web/engine.js',
  'apps/web/manifest.webmanifest',
  'apps/web/favicon.svg',
  'apps/web/.nojekyll',
  '.github/workflows/application-ci.yml',
  '.github/workflows/deploy-pages.yml'
];

for (const path of requiredFiles) {
  await access(path, constants.R_OK);
}

const html = await readFile('apps/web/index.html', 'utf8');
const app = await readFile('apps/web/app.js', 'utf8');
const engine = await readFile('apps/web/engine.js', 'utf8');
const deploy = await readFile('.github/workflows/deploy-pages.yml', 'utf8');

const checks = [
  [html.includes('src="./app.js"'), 'index must use a repository-relative app script path'],
  [html.includes('href="./styles.css"'), 'index must use a repository-relative stylesheet path'],
  [html.includes('Deterministic demo'), 'index must disclose the deterministic demo boundary'],
  [app.includes("from './engine.js'"), 'app must import the shared demo engine'],
  [engine.includes('no live model or external tool execution'), 'engine must disclose that live execution is absent'],
  [deploy.includes('actions/deploy-pages@'), 'deployment workflow must use the official Pages deployment action'],
  [deploy.includes('path: apps/web'), 'deployment workflow must publish only the web artifact directory']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /OPENROUTER_API_KEY\s*=\s*[^\s$]/,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/
];

for (const [name, content] of [['index', html], ['app', app], ['engine', engine], ['deploy', deploy]]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`Potential secret found in ${name}`);
  }
}

console.log(`Validated ${requiredFiles.length} deploy-first skeleton files.`);

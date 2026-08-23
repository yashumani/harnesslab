import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const paths = [
  'apps/web/taskzen-theme.css',
  'apps/web/taskzen-responsive.css',
  'apps/web/taskzen-shell.js',
  'scripts/capture-ui-viewport.mjs',
  'tests/taskzen-theme.test.mjs',
  'docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md',
  '.github/workflows/ui-viewport-audit.yml'
];

for (const path of paths) await access(path, constants.R_OK);

const [html, theme, responsive, shell, critic, manifest, applicationCi, verifyPages, verifyTheme] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/taskzen-theme.css', 'utf8'),
  readFile('apps/web/taskzen-responsive.css', 'utf8'),
  readFile('apps/web/taskzen-shell.js', 'utf8'),
  readFile('apps/web/critic-console.css', 'utf8'),
  readFile('apps/web/manifest.webmanifest', 'utf8'),
  readFile('.github/workflows/application-ci.yml', 'utf8'),
  readFile('.github/workflows/verify-pages.yml', 'utf8'),
  readFile('.github/workflows/verify-design-theme.yml', 'utf8')
]);

const baseIndex = html.indexOf('href="./react-app.css"');
const themeIndex = html.indexOf('href="./taskzen-theme.css"');
const responsiveIndex = html.indexOf('href="./taskzen-responsive.css"');
const shellIndex = html.indexOf('src="./taskzen-shell.js"');
const criticIndex = html.indexOf('src="./critic-console.js"');
const appIndex = html.indexOf('src="./app.js"');

const checks = [
  [baseIndex > 0, 'functional stylesheet must load'],
  [themeIndex > baseIndex, 'Taskzen theme must load after the functional stylesheet'],
  [responsiveIndex > themeIndex, 'responsive QA layer must load after the Taskzen theme'],
  [shellIndex > 0 && shellIndex < criticIndex && criticIndex < appIndex, 'shell, critic, and app scripts must load in the required order'],
  [html.includes('data-design="taskzen"'), 'Taskzen design identity is required'],
  [!html.includes('neuronest-theme.css'), 'superseded theme must not load'],
  [theme.includes('--bg-0: #f7f8fc'), 'light canvas token is required'],
  [theme.includes('--cyan: #635bff'), 'indigo primary token is required'],
  [theme.includes('--teal: #0e9384'), 'teal secondary token is required'],
  [responsive.includes('.result-tabs'), 'phone result navigation refinement is required'],
  [responsive.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'phone result tabs must use a two-column grid'],
  [responsive.includes('white-space: normal'), 'phone result labels must wrap instead of clipping'],
  [shell.includes("const DESIGN_ID = 'taskzen'"), 'browser shell must identify the Taskzen design'],
  [shell.includes('dataset.uiOverflow'), 'browser shell must measure overflow'],
  [shell.includes('dataset.uiUndersized'), 'browser shell must measure control size'],
  [shell.includes('dataset.uiClipped'), 'browser shell must measure clipped controls'],
  [critic.includes('--critic-cyan: #635bff'), 'critic visual must share the product accent'],
  [manifest.includes('"background_color": "#F7F8FC"'), 'manifest must use the light canvas'],
  [manifest.includes('"theme_color": "#635BFF"'), 'manifest must use the primary accent'],
  [applicationCi.includes('/taskzen-responsive.css'), 'application CI must fetch the responsive asset'],
  [verifyPages.includes('/taskzen-responsive.css'), 'live Pages verification must fetch the responsive asset'],
  [verifyTheme.includes('/taskzen-responsive.css'), 'live design verification must fetch the responsive asset']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

for (const [name, content] of [['theme', theme], ['responsive', responsive]]) {
  if (/url\s*\(\s*["']?https?:|data:image\//i.test(content)) {
    throw new Error(`${name} stylesheet must not embed remote or data-image artwork`);
  }
  const openings = [...content.matchAll(/\{/g)].length;
  const closings = [...content.matchAll(/\}/g)].length;
  if (openings !== closings) throw new Error(`${name} stylesheet braces are unbalanced`);
}

console.log('Validated the Taskzen theme, responsive QA layer, browser shell, critic, manifest, and release workflows.');

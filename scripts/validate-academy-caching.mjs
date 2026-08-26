import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/academy/caching/index.html',
  'apps/web/academy/caching/module.css',
  'apps/web/academy/caching/module.js',
  'scripts/capture-academy-caching-viewport.mjs',
  'tests/academy-caching-module.test.mjs',
  'docs/architecture/ACADEMY_CACHING_MODULE.md',
  '.github/workflows/academy-caching-integration.yml',
  '.github/workflows/verify-academy-caching-pages.yml'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [html, css, js, learnHub, packageJson, integrationWorkflow, liveWorkflow] = await Promise.all([
  readFile('apps/web/academy/caching/index.html', 'utf8'),
  readFile('apps/web/academy/caching/module.css', 'utf8'),
  readFile('apps/web/academy/caching/module.js', 'utf8'),
  readFile('apps/web/learn-hub.js', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('.github/workflows/academy-caching-integration.yml', 'utf8'),
  readFile('.github/workflows/verify-academy-caching-pages.yml', 'utf8')
]);

const chapterCount = (html.match(/class="lesson-section" data-chapter="/g) || []).length;
const checks = [
  [html.includes('Module 1 — Chat, Prompt, and KV Caching'), 'module title is required'],
  [chapterCount === 16, `expected 16 chapters, found ${chapterCount}`],
  [html.includes('Prompt caching does not cache the answer'), 'prompt-caching correction is required'],
  [html.includes('KV caching is not a Redis-style database'), 'KV correction is required'],
  [html.includes('Conversation history is persistence'), 'conversation-state correction is required'],
  [html.includes('Exact response cache') && html.includes('Semantic response cache'), 'response-cache vocabulary is required'],
  [html.includes('Per-request KV cache') && html.includes('Cross-request prefix cache'), 'KV cache boundaries are required'],
  [html.includes('Tool and retrieval caching often saves more time'), 'tool-cache chapter is required'],
  [html.includes('Recommended caching architecture for a BI narrative agent'), 'BI reference architecture is required'],
  [html.includes('Context, conversation state, memory, and compaction'), 'next-module bridge is required'],
  [html.includes('developers.openai.com/api/docs/guides/prompt-caching'), 'official OpenAI source link is required'],
  [html.includes('platform.claude.com/docs/en/build-with-claude/prompt-caching'), 'official Anthropic source link is required'],
  [html.includes('ai.google.dev/gemini-api/docs/caching'), 'official Gemini source link is required'],
  [html.includes('docs.vllm.ai/en/latest/features/automatic_prefix_caching.html'), 'official vLLM source link is required'],
  [html.includes('redis.io/docs/latest/develop/use-cases/semantic-cache'), 'official Redis semantic-cache source is required'],
  [html.includes('Verified correction') && html.includes('minimum cacheable length varies by model'), 'time-sensitive OpenAI correction is required'],
  [html.includes('connect-src \'none\''), 'module must make no runtime network calls'],
  [html.includes('data-lab="selector"') && html.includes('data-lab="kv"') && html.includes('data-lab="prompt-order"') && html.includes('data-lab="economics"'), 'interactive labs are required'],
  [html.includes('id="knowledgeCheck"'), 'knowledge check is required'],
  [js.includes('CACHE_NEEDS') && js.includes('PROMPT_BLOCKS'), 'interactive curriculum data is required'],
  [js.includes('calculateKvBytes') && js.includes('calculateCacheEconomics'), 'calculator contracts are required'],
  [js.includes("dataset.moduleReady = 'true'"), 'module readiness contract is required'],
  [js.includes('dataset.moduleOverflow') && js.includes('dataset.moduleClipped') && js.includes('dataset.moduleUndersized'), 'viewport evidence contract is required'],
  [css.includes('@media (max-width: 1024px)') && css.includes('@media (max-width: 760px)'), 'tablet and phone layouts are required'],
  [css.includes('overflow-x: clip') && css.includes('.chapter-nav'), 'page containment and chapter navigation are required'],
  [css.includes('prefers-reduced-motion'), 'reduced-motion behavior is required'],
  [learnHub.includes("new URL('./academy/caching/'"), 'learning hub must link to the caching module'],
  [learnHub.includes('Module 1 · Caching'), 'learning hub module label is required'],
  [packageJson.includes('validate-academy-caching.mjs'), 'package validation must include the module'],
  [packageJson.includes('capture-academy-caching-viewport.mjs'), 'syntax validation must include the module viewport audit'],
  [integrationWorkflow.includes('desktop 1440 1000') && integrationWorkflow.includes('phone 390 844'), 'integration workflow must audit desktop and phone'],
  [liveWorkflow.includes('https://yashumani.github.io/harnesslab/academy/caching/'), 'public verifier must target the deployed module route']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

for (const [name, content] of [['module CSS', css], ['module JS', js]]) {
  const openings = [...content.matchAll(/\{/g)].length;
  const closings = [...content.matchAll(/\}/g)].length;
  if (openings !== closings) throw new Error(`${name} braces are unbalanced`);
}

const browserBundle = `${html}\n${css}\n${js}\n${learnHub}`;
for (const pattern of [
  /OPENROUTER_API_KEY/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /authorization\s*:\s*bearer/i
]) {
  if (pattern.test(browserBundle)) throw new Error('The Academy browser bundle must not contain provider credentials or private keys.');
}

if (/url\s*\(\s*["']?https?:|data:image\//i.test(css)) {
  throw new Error('The Academy stylesheet must not embed remote or data-image artwork.');
}

console.log('Validated the 16-chapter caching curriculum, interactive labs, official-source boundaries, responsive UI, and public deployment contracts.');

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, js, learnHub, packageJson] = await Promise.all([
  readFile('apps/web/academy/caching/index.html', 'utf8'),
  readFile('apps/web/academy/caching/module.css', 'utf8'),
  readFile('apps/web/academy/caching/module.js', 'utf8'),
  readFile('apps/web/learn-hub.js', 'utf8'),
  readFile('package.json', 'utf8')
]);

test('ships the complete sixteen-chapter Module 1 curriculum', () => {
  assert.equal((html.match(/class="lesson-section" data-chapter="/g) || []).length, 16);
  for (const phrase of [
    'Prompt caching does not cache the answer',
    'KV caching is not a Redis-style database',
    'Conversation history is persistence',
    'The complete caching vocabulary',
    'What the KV cache actually stores',
    'Prompt caching is hosted prefix reuse',
    'Exact response caching can skip the model entirely',
    'Semantic response caching matches meaning',
    'Recommended caching architecture for a BI narrative agent',
    'Invalidation and observability',
    'Practical experiments and final knowledge check'
  ]) assert.match(html, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('preserves provider details as verified and source-linked material', () => {
  assert.match(html, /August 26, 2026/);
  assert.match(html, /minimum cacheable length varies by model/i);
  assert.match(html, /developers\.openai\.com\/api\/docs\/guides\/prompt-caching/);
  assert.match(html, /platform\.claude\.com\/docs\/en\/build-with-claude\/prompt-caching/);
  assert.match(html, /ai\.google\.dev\/gemini-api\/docs\/caching/);
  assert.match(html, /docs\.vllm\.ai\/en\/latest\/features\/automatic_prefix_caching\.html/);
  assert.match(html, /redis\.io\/docs\/latest\/develop\/use-cases\/semantic-cache/);
});

test('provides executable learning labs without external runtime authority', () => {
  for (const id of [
    'needSelector', 'kvNextButton', 'kvMemoryResult', 'promptOrderList',
    'econSavings', 'knowledgeCheck', 'quizResult'
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(js, /CACHE_NEEDS/);
  assert.match(js, /PROMPT_BLOCKS/);
  assert.match(js, /calculateKvBytes/);
  assert.match(js, /calculateCacheEconomics/);
  assert.match(js, /network-free module runtime/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(`${html}\n${js}`, /OPENROUTER_API_KEY|authorization:\s*bearer/i);
});

test('keeps the module responsive, keyboard visible, and reduced-motion aware', () => {
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /dataset\.moduleOverflow/);
  assert.match(js, /dataset\.moduleClipped/);
});

test('surfaces Module 1 from the existing learning hub and validation lifecycle', () => {
  assert.match(learnHub, /\.\/academy\/caching\//);
  assert.match(learnHub, /Module 1 · Caching/);
  assert.match(packageJson, /validate-academy-caching\.mjs/);
  assert.match(packageJson, /capture-academy-caching-viewport\.mjs/);
});

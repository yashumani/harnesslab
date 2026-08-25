import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainHtml, hubJs, hubCss, guideHtml, guideCss, guideJs] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/learn-hub.js', 'utf8'),
  readFile('apps/web/learn-hub.css', 'utf8'),
  readFile('apps/web/guide/index.html', 'utf8'),
  readFile('apps/web/guide/guide.css', 'utf8'),
  readFile('apps/web/guide/guide.js', 'utf8')
]);

test('adds a non-destructive learning entry after the builder application', () => {
  assert.match(mainHtml, /<harnesslab-learn-hub>/);
  assert.match(mainHtml, /src="\.\/learn-hub\.js"/);
  assert.ok(mainHtml.indexOf('src="./app.js"') < mainHtml.indexOf('src="./learn-hub.js"'));
  assert.match(hubJs, /new URL\('\.\/guide\/'/);
  assert.doesNotMatch(hubJs, /fetch\(|XMLHttpRequest|WebSocket/);
});

test('learning hub provides a modal focus lifecycle and three audience paths', () => {
  assert.match(hubJs, /setBackgroundInert\(true\)/);
  assert.match(hubJs, /setBackgroundInert\(false\)/);
  assert.match(hubJs, /event\.key === 'Escape'/);
  assert.match(hubJs, /event\.key !== 'Tab'/);
  assert.match(hubJs, /End-user path/);
  assert.match(hubJs, /Developer path/);
  assert.match(hubJs, /Architecture path/);
  assert.match(hubCss, /@media \(max-width: 620px\)/);
});

test('ships a detailed eighteen-slide dark presentation', () => {
  const slides = [...guideHtml.matchAll(/id="slide-(\d+)" data-slide="(\d+)"/g)];
  assert.equal(slides.length, 18);
  assert.deepEqual(slides.map((match) => Number(match[1])), Array.from({ length: 18 }, (_, index) => index + 1));
  assert.match(guideHtml, /data-guide-theme="midnight"/);
  assert.match(guideCss, /--bg: #030712/);
  assert.match(guideCss, /--blue: #2b7fff/);
  assert.match(guideCss, /--cyan: #12d9e8/);
  assert.match(guideCss, /--violet: #8a5cff/);
});

test('covers product, user, developer, architecture, protocol, safety, and example material', () => {
  for (const phrase of [
    'What exactly is HarnessLab?',
    'A harness is the control system around AI',
    'Requirement intelligence',
    'Architecture decision ladder',
    'Temporary subagents',
    'Tools, MCP, retrieval, and A2A',
    'Browser-first, provider-neutral, integration-optional',
    'End-user workflow',
    'Developer workflow',
    'Telecom KPI anomaly investigation',
    'Current live scope'
  ]) {
    assert.ok(guideHtml.includes(phrase), `missing guide coverage: ${phrase}`);
  }
});

test('guide supports keyboard, touch, overview, deep links, fullscreen, and print', () => {
  assert.match(guideJs, /event\.key === 'ArrowRight'/);
  assert.match(guideJs, /event\.key === 'ArrowLeft'/);
  assert.match(guideJs, /event\.key === 'Home'/);
  assert.match(guideJs, /event\.key === 'End'/);
  assert.match(guideJs, /location\.hash\.match/);
  assert.match(guideJs, /touchstart/);
  assert.match(guideJs, /touchend/);
  assert.match(guideJs, /requestFullscreen/);
  assert.match(guideJs, /window\.print\(\)/);
  assert.match(guideJs, /shell\.setAttribute\('inert'/);
});

test('guide stays responsive, printable, reduced-motion aware, and network-free', () => {
  assert.match(guideCss, /@media \(max-width: 1024px\)/);
  assert.match(guideCss, /@media \(max-width: 760px\)/);
  assert.match(guideCss, /@media \(max-width: 430px\)/);
  assert.match(guideCss, /@media print/);
  assert.match(guideCss, /prefers-reduced-motion/);
  assert.doesNotMatch(guideJs, /fetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(`${guideHtml}\n${guideJs}\n${guideCss}`, /OPENROUTER_API_KEY|authorization\s*:/i);
});

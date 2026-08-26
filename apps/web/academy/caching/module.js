const MODULE_STORAGE_KEY = 'harnesslab.academy.caching.v1';
const TOTAL_CHAPTERS = 16;
const MAX_KV_STEPS = 8;

const CACHE_NEEDS = Object.freeze({
  memory: {
    mechanism: 'Conversation persistence',
    modelRuns: 'Yes, when you ask the model another question.',
    explanation: 'Store authoritative messages, summaries, facts, and metadata in a durable conversation or memory system. Prompt caching can reduce the cost of replaying that state, but it is not the state itself.'
  },
  exact: {
    mechanism: 'Exact response cache',
    modelRuns: 'No on a valid hit.',
    explanation: 'Return the previously generated answer only when every answer-affecting input matches: tenant, permissions, model and prompt versions, context, data snapshot, locale, safety settings, and request payload.'
  },
  semantic: {
    mechanism: 'Semantic response cache',
    modelRuns: 'No on a safe semantic hit.',
    explanation: 'Search prior question embeddings, apply hard metadata filters, then reuse a complete previous answer only when meaning, tenant, permissions, data version, locale, intent, safety, and freshness all match.'
  },
  prompt: {
    mechanism: 'Prompt/context caching',
    modelRuns: 'Yes.',
    explanation: 'Reuse model state for the identical stable prefix, process the dynamic suffix, and generate a fresh answer. This reduces repeated prefill work rather than returning an old response.'
  },
  kv: {
    mechanism: 'Per-request KV cache',
    modelRuns: 'Yes.',
    explanation: 'Reuse earlier attention key/value tensors while the same generation continues. The runtime avoids recalculating every previous token at every decoding step.'
  },
  prefix: {
    mechanism: 'Cross-request prefix/KV caching',
    modelRuns: 'Yes.',
    explanation: 'Retain reusable KV blocks after one request so a later request with an identical beginning can skip most repeated prefill computation.'
  },
  tool: {
    mechanism: 'Tool or retrieval cache',
    modelRuns: 'Usually, unless the tool result is also the final answer.',
    explanation: 'Cache read-only SQL, API, RAG, document, or MCP results using normalized arguments plus tenant, permissions, tool version, and source-data snapshot. Never replay a side-effect result as though the action ran again.'
  }
});

const PROMPT_BLOCKS = Object.freeze([
  { id: 'tools', label: 'Stable tool and MCP schemas', detail: 'Keep names, descriptions, JSON schemas, and ordering deterministic.', kind: 'stable' },
  { id: 'instructions', label: 'Stable agent instructions', detail: 'Operating rules, role, and task boundaries.', kind: 'stable' },
  { id: 'policies', label: 'Stable safety and policy rules', detail: 'Approval, refusal, privacy, and permission constraints.', kind: 'stable' },
  { id: 'glossary', label: 'Stable glossary and ontology', detail: 'Metric definitions, business semantics, and narrative rules.', kind: 'stable' },
  { id: 'examples', label: 'Stable few-shot examples', detail: 'Examples whose exact serialization rarely changes.', kind: 'stable' },
  { id: 'breakpoint', label: 'Cache breakpoint', detail: 'The reusable boundary after the stable prefix.', kind: 'breakpoint' },
  { id: 'permissions', label: 'Tenant and user permissions', detail: 'Dynamic entitlement and scope for the current request.', kind: 'dynamic' },
  { id: 'retrieval', label: 'Current retrieved data', detail: 'SQL results, document excerpts, and current report values.', kind: 'dynamic' },
  { id: 'timestamp', label: 'Current date, timestamp, or request ID', detail: 'Highly dynamic values that would destroy an early prefix match.', kind: 'dynamic' },
  { id: 'question', label: 'Current user question', detail: 'The changing task or conversational turn.', kind: 'dynamic' }
]);
const RECOMMENDED_ORDER = PROMPT_BLOCKS.map((block) => block.id);

function byId(id) {
  return document.getElementById(id);
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function escapeText(value) {
  return String(value ?? '');
}

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

const storage = safeStorage();

function readStoredState() {
  const fallback = { visited: [], contrast: false };
  if (!storage) return fallback;
  try {
    const parsed = JSON.parse(storage.getItem(MODULE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      visited: Array.isArray(parsed.visited)
        ? parsed.visited.filter((value) => Number.isInteger(value) && value >= 1 && value <= TOTAL_CHAPTERS)
        : [],
      contrast: parsed.contrast === true
    };
  } catch {
    return fallback;
  }
}

const storedState = readStoredState();
const visitedChapters = new Set(storedState.visited);
let activeChapter = null;
let kvStep = 0;
let promptOrder = [...RECOMMENDED_ORDER];

function persistState() {
  if (!storage) return;
  try {
    storage.setItem(MODULE_STORAGE_KEY, JSON.stringify({
      visited: [...visitedChapters].sort((a, b) => a - b),
      contrast: document.documentElement.dataset.moduleTheme === 'contrast'
    }));
  } catch {
    // Progress is an optional enhancement. A blocked store must not block learning.
  }
}

function updateProgress() {
  const percentage = Math.round((visitedChapters.size / TOTAL_CHAPTERS) * 100);
  byId('progressLabel').textContent = `${percentage}%`;
  byId('progressBar').style.width = `${percentage}%`;
  const currentSection = activeChapter
    ? document.querySelector(`[data-chapter="${activeChapter}"]`)
    : null;
  byId('progressDetail').textContent = currentSection
    ? `Chapter ${String(activeChapter).padStart(2, '0')} · ${currentSection.dataset.title}`
    : visitedChapters.size
      ? `${visitedChapters.size} of ${TOTAL_CHAPTERS} chapters visited.`
      : 'Start with the mental model.';
  persistState();
}

function setActiveChapter(chapter) {
  const value = Number(chapter);
  if (!Number.isInteger(value) || value < 1 || value > TOTAL_CHAPTERS) return;
  activeChapter = value;
  visitedChapters.add(value);
  document.querySelectorAll('[data-chapter-link]').forEach((link) => {
    const active = Number(link.dataset.chapterLink) === value;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  updateProgress();
}

function initializeChapterTracking() {
  const sections = [...document.querySelectorAll('.lesson-section[data-chapter]')];
  const initialHash = location.hash.match(/^#chapter-(\d+)$/)?.[1];
  if (initialHash) setActiveChapter(Number(initialHash));

  if ('IntersectionObserver' in globalThis) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio || left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActiveChapter(Number(visible[0].target.dataset.chapter));
    }, {
      rootMargin: '-18% 0px -64% 0px',
      threshold: [0.05, 0.18, 0.35]
    });
    sections.forEach((section) => observer.observe(section));
  } else {
    setActiveChapter(1);
  }

  document.querySelectorAll('[data-chapter-link]').forEach((link) => {
    link.addEventListener('click', () => {
      const chapter = Number(link.dataset.chapterLink);
      setActiveChapter(chapter);
    });
  });

  byId('resetProgressButton').addEventListener('click', () => {
    visitedChapters.clear();
    activeChapter = null;
    document.querySelectorAll('[data-chapter-link]').forEach((link) => {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    });
    updateProgress();
    byId('module-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  updateProgress();
}

function renderNeedSelection() {
  const selected = CACHE_NEEDS[byId('needSelector').value] || CACHE_NEEDS.memory;
  byId('needOutput').innerHTML = `<strong>${selected.mechanism}</strong><br>${selected.explanation}<br><b>Does the model run?</b> ${selected.modelRuns}`;
}

function initializeNeedSelector() {
  byId('needSelector').addEventListener('change', renderNeedSelection);
  renderNeedSelection();
}

function renderKvVisualizer() {
  byId('kvQuery').textContent = `Q${kvStep + 1}`;
  byId('kvStepLabel').textContent = `${kvStep} token${kvStep === 1 ? '' : 's'} cached`;
  const keys = Array.from({ length: kvStep }, (_, index) => `<i>K${index + 1}</i>`).join('');
  const values = Array.from({ length: kvStep }, (_, index) => `<i>V${index + 1}</i>`).join('');
  byId('keyTokens').innerHTML = keys;
  byId('valueTokens').innerHTML = values;
  byId('kvNextButton').disabled = kvStep >= MAX_KV_STEPS;
  byId('kvExplanation').textContent = kvStep === 0
    ? 'Generate the first token to create K₁ and V₁.'
    : kvStep >= MAX_KV_STEPS
      ? `The visualizer is capped at ${MAX_KV_STEPS} tokens. A real runtime continues appending tensors until the context or memory boundary is reached.`
      : `To generate token ${kvStep + 1}, the model reuses ${kvStep} cached K/V pair${kvStep === 1 ? '' : 's'} and computes only the new pair.`;
}

function initializeKvVisualizer() {
  byId('kvNextButton').addEventListener('click', () => {
    kvStep = Math.min(MAX_KV_STEPS, kvStep + 1);
    renderKvVisualizer();
  });
  byId('kvResetButton').addEventListener('click', () => {
    kvStep = 0;
    renderKvVisualizer();
  });
  renderKvVisualizer();
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 bytes';
  const units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const amount = value / (1024 ** index);
  const decimals = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(decimals)} ${units[index]}`;
}

function updateKvMemory() {
  const layers = clampNumber(byId('kvLayers').value, 1, 256, 32);
  const tokens = clampNumber(byId('kvTokens').value, 1, 10_000_000, 4096);
  const heads = clampNumber(byId('kvHeads').value, 1, 256, 8);
  const dimension = clampNumber(byId('kvDimension').value, 1, 1024, 128);
  const bytes = clampNumber(byId('kvBytes').value, 1, 8, 2);
  const batch = clampNumber(byId('kvBatch').value, 1, 4096, 1);
  const total = 2 * layers * tokens * heads * dimension * bytes * batch;
  byId('kvMemoryResult').textContent = formatBytes(total);
}

function initializeKvMemory() {
  ['kvLayers', 'kvTokens', 'kvHeads', 'kvDimension', 'kvBytes', 'kvBatch']
    .forEach((id) => byId(id).addEventListener('input', updateKvMemory));
  updateKvMemory();
}

function promptBlock(id) {
  return PROMPT_BLOCKS.find((block) => block.id === id);
}

function promptOrderScore() {
  let correctPairs = 0;
  let totalPairs = 0;
  for (let left = 0; left < RECOMMENDED_ORDER.length; left += 1) {
    for (let right = left + 1; right < RECOMMENDED_ORDER.length; right += 1) {
      totalPairs += 1;
      if (promptOrder.indexOf(RECOMMENDED_ORDER[left]) < promptOrder.indexOf(RECOMMENDED_ORDER[right])) correctPairs += 1;
    }
  }
  return Math.round((correctPairs / totalPairs) * 100);
}

function movePromptBlock(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= promptOrder.length) return;
  [promptOrder[index], promptOrder[target]] = [promptOrder[target], promptOrder[index]];
  renderPromptOrder();
}

function renderPromptOrder() {
  const list = byId('promptOrderList');
  list.innerHTML = promptOrder.map((id, index) => {
    const block = promptBlock(id);
    const label = escapeText(block.label);
    const detail = escapeText(block.detail);
    return `<li data-kind="${block.kind}">
      <span class="order-index">${String(index + 1).padStart(2, '0')}</span>
      <span><strong>${label}</strong><small>${detail}</small></span>
      <span class="order-actions">
        <button type="button" data-move="up" data-index="${index}" aria-label="Move ${label} earlier" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-move="down" data-index="${index}" aria-label="Move ${label} later" ${index === promptOrder.length - 1 ? 'disabled' : ''}>↓</button>
      </span>
    </li>`;
  }).join('');

  const score = promptOrderScore();
  byId('orderScore').textContent = `Cache score: ${score}%`;
  const breakpointIndex = promptOrder.indexOf('breakpoint');
  const dynamicBefore = promptOrder.slice(0, breakpointIndex).filter((id) => promptBlock(id).kind === 'dynamic');
  const stableAfter = promptOrder.slice(breakpointIndex + 1).filter((id) => promptBlock(id).kind === 'stable');
  byId('orderFeedback').innerHTML = score === 100
    ? '<strong>Cache-friendly order.</strong> Stable content is serialized before the breakpoint and dynamic content follows it.'
    : `<strong>${score}% ordered correctly.</strong> ${dynamicBefore.length ? `${dynamicBefore.length} dynamic block${dynamicBefore.length === 1 ? '' : 's'} appear before the breakpoint. ` : ''}${stableAfter.length ? `${stableAfter.length} stable block${stableAfter.length === 1 ? '' : 's'} appear after it. ` : ''}Move volatile values later and keep stable schemas deterministic.`;

  list.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      movePromptBlock(index, button.dataset.move === 'up' ? -1 : 1);
    });
  });
}

function shuffleArray(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function initializePromptOrder() {
  byId('shuffleOrderButton').addEventListener('click', () => {
    do {
      promptOrder = shuffleArray(promptOrder);
    } while (promptOrderScore() === 100);
    renderPromptOrder();
  });
  byId('optimizeOrderButton').addEventListener('click', () => {
    promptOrder = [...RECOMMENDED_ORDER];
    renderPromptOrder();
  });
  renderPromptOrder();
}

function formatEquivalent(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function updateEconomics() {
  const tokens = clampNumber(byId('econTokens').value, 1, 1_000_000, 8000);
  const requests = Math.round(clampNumber(byId('econRequests').value, 1, 100_000, 10));
  const write = clampNumber(byId('econWrite').value, 0, 10, 1.25);
  const read = clampNumber(byId('econRead').value, 0, 10, 0.1);
  const noCache = tokens * requests;
  const cached = tokens * write + tokens * Math.max(0, requests - 1) * read;
  const savings = noCache > 0 ? (1 - cached / noCache) * 100 : 0;
  byId('econNoCache').textContent = formatEquivalent(noCache);
  byId('econCache').textContent = formatEquivalent(cached);
  byId('econSavings').textContent = `${savings.toFixed(1)}%`;
  byId('econSavings').parentElement.dataset.tone = savings >= 0 ? 'positive' : 'negative';
}

function initializeEconomics() {
  ['econTokens', 'econRequests', 'econWrite', 'econRead']
    .forEach((id) => byId(id).addEventListener('input', updateEconomics));
  updateEconomics();
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy command was unavailable.');
}

function initializeCopyButtons() {
  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = byId(button.dataset.copyTarget);
      if (!target) return;
      const original = button.textContent;
      try {
        await copyText(target.textContent);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Copy unavailable';
      }
      globalThis.setTimeout(() => { button.textContent = original; }, 1800);
    });
  });
}

function checkQuiz(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = [...form.querySelectorAll('fieldset[data-answer]')];
  let score = 0;
  fields.forEach((field) => {
    const selected = field.querySelector('input:checked')?.value;
    const correct = selected === field.dataset.answer;
    if (correct) score += 1;
    field.dataset.state = correct ? 'correct' : 'incorrect';
  });
  byId('quizResult').textContent = score === fields.length
    ? `${score}/${fields.length} · Excellent. The caching boundaries are clear.`
    : `${score}/${fields.length} · Review the highlighted questions, then try again.`;
}

function resetQuiz() {
  const form = byId('knowledgeCheck');
  form.reset();
  form.querySelectorAll('fieldset').forEach((field) => field.removeAttribute('data-state'));
  byId('quizResult').textContent = '';
}

function initializeQuiz() {
  byId('knowledgeCheck').addEventListener('submit', checkQuiz);
  byId('quizResetButton').addEventListener('click', resetQuiz);
}

function initializeTheme() {
  document.documentElement.dataset.moduleTheme = storedState.contrast ? 'contrast' : 'midnight';
  const button = byId('themeButton');
  button.setAttribute('aria-pressed', String(storedState.contrast));
  button.addEventListener('click', () => {
    const contrast = document.documentElement.dataset.moduleTheme !== 'contrast';
    document.documentElement.dataset.moduleTheme = contrast ? 'contrast' : 'midnight';
    button.setAttribute('aria-pressed', String(contrast));
    persistState();
  });
}

function visible(element) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity) !== 0
    && rect.width > 0
    && rect.height > 0;
}

function describeElement(element) {
  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    label: element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function runViewportAudit() {
  const root = document.documentElement;
  const viewportWidth = root.clientWidth;
  const pageWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
  const controls = [...document.querySelectorAll([
    '.topbar-actions button',
    '.topbar-actions a',
    '.hero-actions a',
    '.hero-actions button',
    '.decision-lab select',
    '.kv-toolbar button',
    '.calculator-card input',
    '.order-toolbar button',
    '.prompt-order-list button',
    '.code-toolbar button',
    '.quiz-actions button',
    '.quiz-card input'
  ].join(','))].filter(visible);
  const clipped = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left < -1 || rect.right > viewportWidth + 1;
  });
  const undersized = controls.filter((element) => {
    if (element.matches('input[type="radio"]')) return false;
    const rect = element.getBoundingClientRect();
    const minimum = viewportWidth <= 760 ? 40 : 36;
    return rect.width < minimum || rect.height < minimum;
  });
  const evidence = {
    module: 'caching',
    ready: document.body.dataset.moduleReady === 'true',
    chapterCount: document.querySelectorAll('.lesson-section[data-chapter]').length,
    viewport: { width: innerWidth, height: innerHeight },
    touchPoints: navigator.maxTouchPoints,
    pageWidth,
    overflow: pageWidth > viewportWidth + 1,
    clipped: clipped.map(describeElement),
    undersized: undersized.map(describeElement),
    interactiveLabs: document.querySelectorAll('[data-lab]').length,
    consoleBoundary: 'network-free module runtime'
  };
  document.body.dataset.moduleAudit = 'complete';
  document.body.dataset.moduleOverflow = String(evidence.overflow);
  document.body.dataset.moduleClipped = String(evidence.clipped.length);
  document.body.dataset.moduleUndersized = String(evidence.undersized.length);
  let output = byId('academy-module-audit-output');
  if (!output) {
    output = document.createElement('output');
    output.id = 'academy-module-audit-output';
    output.hidden = true;
    document.body.appendChild(output);
  }
  output.textContent = JSON.stringify(evidence);
  return evidence;
}

function initialize() {
  initializeTheme();
  initializeNeedSelector();
  initializeKvVisualizer();
  initializeKvMemory();
  initializePromptOrder();
  initializeEconomics();
  initializeCopyButtons();
  initializeQuiz();
  initializeChapterTracking();
  document.body.dataset.moduleReady = 'true';
  if (new URLSearchParams(location.search).get('audit') === '1') {
    globalThis.setTimeout(runViewportAudit, 650);
    globalThis.addEventListener('resize', () => globalThis.setTimeout(runViewportAudit, 200), { passive: true });
  }
}

globalThis.HarnessLabCachingModule = Object.freeze({
  CACHE_NEEDS,
  PROMPT_BLOCKS,
  RECOMMENDED_ORDER,
  calculateKvBytes: ({ layers, tokens, heads, dimension, bytes, batch }) => 2 * layers * tokens * heads * dimension * bytes * batch,
  calculateCacheEconomics: ({ tokens, requests, writeMultiplier, readMultiplier }) => ({
    withoutCache: tokens * requests,
    withCache: tokens * writeMultiplier + tokens * Math.max(0, requests - 1) * readMultiplier
  }),
  runViewportAudit
});

initialize();

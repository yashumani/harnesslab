import { analyzeRequirement, examples } from './engine.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#requirement-form');
const input = $('#requirement-input');
const analyzeButton = $('#analyze-button');
const resetButton = $('#reset-button');
const exampleContainer = $('#example-list');
const progress = $('#analysis-progress');
const progressLabel = $('#progress-label');
const results = $('#results');
const errorMessage = $('#form-error');
const copyButton = $('#copy-json');
const jsonOutput = $('#json-output');
const runBadge = $('#run-badge');
let latestResult = null;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function setStatus(message, type = 'neutral') {
  const status = $('#runtime-status');
  status.dataset.type = type;
  status.querySelector('span:last-child').textContent = message;
}

function renderExamples() {
  examples.forEach((example) => {
    const button = createElement('button', 'example-chip', example.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      input.value = example.value;
      input.focus();
      errorMessage.textContent = '';
    });
    exampleContainer.appendChild(button);
  });
}

function scoreTone(score) {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'caution';
  return 'low';
}

function renderMetrics(result) {
  const container = $('#metric-grid');
  clear(container);
  const metrics = [
    { label: 'Complexity', value: result.scores.complexity, suffix: '/100' },
    { label: 'Risk signal', value: result.scores.risk, suffix: '/100' },
    { label: 'Plan confidence', value: result.scores.confidence, suffix: '%' },
    { label: 'Temporary agents', value: result.subagents.length, suffix: '' }
  ];
  metrics.forEach((metric) => {
    const card = createElement('article', 'metric-card');
    card.dataset.tone = scoreTone(metric.value);
    card.append(
      createElement('span', 'metric-label', metric.label),
      createElement('strong', 'metric-value', `${metric.value}${metric.suffix}`)
    );
    container.appendChild(card);
  });
}

function renderOverview(result) {
  $('#result-requirement').textContent = result.requirement;
  $('#architecture-kind').textContent = result.architecture.kind;
  $('#architecture-reason').textContent = result.architecture.reason;
  $('#recommendation').textContent = result.recommendation;
  $('#domain-value').textContent = result.domain;
  $('#evaluation-verdict').textContent = result.evaluation.verdict;
  $('#overall-score').textContent = `${result.evaluation.overall}`;

  const capabilities = $('#capability-list');
  clear(capabilities);
  result.capabilities.forEach((capability) => capabilities.appendChild(createElement('span', 'capability-pill', capability)));

  const questions = $('#question-list');
  clear(questions);
  const items = result.unresolvedQuestions.length ? result.unresolvedQuestions : ['No material requirement gaps detected in this demo pass.'];
  items.forEach((question) => questions.appendChild(createElement('li', '', question)));
}

function renderStages(result) {
  const container = $('#stage-list');
  clear(container);
  result.stages.forEach((stage, index) => {
    const item = createElement('article', 'stage-card');
    const body = createElement('div', 'stage-body');
    body.append(createElement('h3', '', stage.name), createElement('p', '', stage.purpose), createElement('span', 'stage-mode', stage.mode));
    item.append(createElement('span', 'stage-number', String(index + 1).padStart(2, '0')), body);
    container.appendChild(item);
  });
}

function renderProtocols(result) {
  const container = $('#protocol-list');
  clear(container);
  result.protocols.forEach((protocol) => {
    const item = createElement('article', 'protocol-row');
    const heading = createElement('div', 'protocol-heading');
    heading.append(createElement('h3', '', protocol.name), createElement('span', 'decision-badge', protocol.decision));
    item.append(heading, createElement('p', '', protocol.rationale));
    container.appendChild(item);
  });
}

function renderSubagents(result) {
  const container = $('#subagent-list');
  clear(container);
  if (!result.subagents.length) {
    const empty = createElement('article', 'empty-state');
    empty.append(
      createElement('strong', '', 'No temporary subagents recommended'),
      createElement('p', '', 'The expected accuracy or speed benefit does not justify additional orchestration for this requirement.')
    );
    container.appendChild(empty);
    return;
  }

  result.subagents.forEach((subagent) => {
    const card = createElement('article', 'subagent-card');
    const header = createElement('div', 'subagent-header');
    const identity = createElement('div');
    identity.append(createElement('span', 'eyebrow', subagent.id), createElement('h3', '', subagent.role));
    header.append(identity, createElement('span', 'lifecycle-badge', `${subagent.timeoutSeconds}s`));

    const details = createElement('dl', 'detail-list');
    const pairs = [
      ['Objective', subagent.objective],
      ['Context', subagent.context],
      ['Tools', subagent.tools.join(', ')],
      ['Permissions', subagent.permissions],
      ['Return', subagent.returnArtifact]
    ];
    pairs.forEach(([term, description]) => details.append(createElement('dt', '', term), createElement('dd', '', description)));

    const footer = createElement('div', 'subagent-footer');
    footer.append(
      createElement('span', 'guardrail-chip', 'Depth 1'),
      createElement('span', 'guardrail-chip', 'No child agents'),
      createElement('span', 'guardrail-chip', 'Structured return')
    );
    card.append(header, createElement('p', 'subagent-objective', subagent.objective), details, footer);
    container.appendChild(card);
  });
}

function renderPermissions(result) {
  const body = $('#permission-body');
  clear(body);
  result.permissions.forEach((permission) => {
    const row = document.createElement('tr');
    const policy = document.createElement('td');
    const badge = createElement('span', 'policy-badge', permission.policy);
    badge.dataset.policy = permission.policy.toLowerCase().replace(/\s+/g, '-');
    policy.appendChild(badge);
    row.append(createElement('td', '', permission.capability), policy, createElement('td', '', permission.enforcement));
    body.appendChild(row);
  });
}

function renderArtifacts(result) {
  const container = $('#artifact-list');
  clear(container);
  result.artifacts.forEach((artifact) => {
    const item = createElement('article', 'artifact-card');
    const body = createElement('div');
    body.append(createElement('strong', '', artifact.id), createElement('span', '', artifact.type));
    item.append(createElement('span', 'artifact-icon', artifact.type.slice(0, 2).toUpperCase()), body, createElement('span', 'artifact-status', artifact.status));
    container.appendChild(item);
  });
}

function renderConstraints(result) {
  const container = $('#constraint-list');
  clear(container);
  result.constraints.forEach((constraint) => {
    const item = createElement('li');
    item.append(createElement('span', 'constraint-check', '✓'), createElement('span', '', constraint));
    container.appendChild(item);
  });
}

function renderTrace(result) {
  const container = $('#trace-list');
  clear(container);
  result.trace.forEach((entry) => {
    const item = createElement('article', 'trace-row');
    const body = createElement('div', 'trace-body');
    body.append(createElement('strong', '', entry.event), createElement('p', '', entry.detail));
    item.append(
      createElement('span', 'trace-sequence', String(entry.sequence).padStart(2, '0')),
      createElement('span', 'trace-offset', entry.offset),
      body,
      createElement('span', 'trace-status', entry.status)
    );
    container.appendChild(item);
  });
}

function renderEvaluation(result) {
  const container = $('#evaluation-list');
  clear(container);
  result.evaluation.dimensions.forEach((dimension) => {
    const item = createElement('div', 'evaluation-row');
    const heading = createElement('div', 'evaluation-heading');
    heading.append(createElement('span', '', dimension.name), createElement('strong', '', `${dimension.score}%`));
    const track = createElement('div', 'score-track');
    const fill = createElement('span', 'score-fill');
    fill.style.width = `${dimension.score}%`;
    track.appendChild(fill);
    item.append(heading, track);
    container.appendChild(item);
  });
}

function renderResult(result) {
  latestResult = result;
  renderMetrics(result);
  renderOverview(result);
  renderStages(result);
  renderProtocols(result);
  renderSubagents(result);
  renderPermissions(result);
  renderArtifacts(result);
  renderConstraints(result);
  renderTrace(result);
  renderEvaluation(result);
  jsonOutput.textContent = JSON.stringify(result, null, 2);
  runBadge.textContent = result.runId;
  results.hidden = false;
  setStatus('Demo analysis complete', 'success');
}

async function simulateAnalysis(requirement) {
  const phases = ['Compiling the requirement…', 'Selecting the harness topology…', 'Planning bounded temporary agents…', 'Applying policy and evaluation gates…'];
  analyzeButton.disabled = true;
  resetButton.disabled = true;
  progress.hidden = false;
  results.setAttribute('aria-busy', 'true');
  setStatus('Demo analysis running', 'active');
  for (const phase of phases) {
    progressLabel.textContent = phase;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  renderResult(analyzeRequirement(requirement));
  progress.hidden = true;
  analyzeButton.disabled = false;
  resetButton.disabled = false;
  results.setAttribute('aria-busy', 'false');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  try {
    await simulateAnalysis(input.value);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : 'Unable to analyze the requirement.';
    analyzeButton.disabled = false;
    resetButton.disabled = false;
    progress.hidden = true;
    results.setAttribute('aria-busy', 'false');
    setStatus('Requirement needs attention', 'error');
    input.focus();
  }
});

resetButton.addEventListener('click', () => {
  input.value = examples[0].value;
  errorMessage.textContent = '';
  input.focus();
});

copyButton.addEventListener('click', async () => {
  if (!latestResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    copyButton.textContent = 'Copied';
    window.setTimeout(() => { copyButton.textContent = 'Copy JSON'; }, 1400);
  } catch {
    copyButton.textContent = 'Copy unavailable';
  }
});

renderExamples();
input.value = examples[0].value;
renderResult(analyzeRequirement(input.value));

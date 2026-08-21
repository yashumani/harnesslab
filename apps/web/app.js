import { analyzeRequirement, examples } from './engine.js';
import {
  AnalysisGatewayError,
  createAnalysisClient,
  loadRuntimeSettings,
  normalizeGatewayUrl,
  RuntimeModes,
  saveRuntimeSettings
} from './analysis-client.js';
import { createWorkspaceStore } from './workspace-store.js';

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
const resultRuntimeBadge = $('#result-runtime-badge');
const projectSelect = $('#project-select');
const newProjectButton = $('#new-project-button');
const newProjectForm = $('#new-project-form');
const projectNameInput = $('#project-name-input');
const cancelProjectButton = $('#cancel-project-button');
const exportWorkspaceButton = $('#export-workspace-button');
const saveVersionButton = $('#save-version-button');
const historyContainer = $('#run-history');
const projectNameValue = $('#active-project-name');
const projectVersionValue = $('#active-project-versions');
const projectSavedValue = $('#active-project-saved');
const persistenceBadge = $('#persistence-badge');
const workspaceMessage = $('#workspace-message');
const analysisModeSelect = $('#analysis-mode-select');
const gatewayUrlInput = $('#gateway-url-input');
const testGatewayButton = $('#test-gateway-button');
const gatewayHealthBadge = $('#gateway-health-badge');
const gatewayHealthMessage = $('#gateway-health-message');
const analysisModeBadge = $('#analysis-mode-badge');

const MODE_LABELS = Object.freeze({
  [RuntimeModes.BROWSER]: 'Browser deterministic',
  [RuntimeModes.AUTOMATIC]: 'Automatic fallback',
  [RuntimeModes.GATEWAY]: 'Gateway required'
});

let browserStorage = null;
try {
  browserStorage = window.localStorage;
} catch {
  browserStorage = null;
}

const workspaceStore = createWorkspaceStore({ storage: browserStorage });
const analysisClient = createAnalysisClient({ fallbackAnalyze: analyzeRequirement });
let runtimeSettings = loadRuntimeSettings(browserStorage);
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

function setWorkspaceMessage(message, type = 'neutral') {
  workspaceMessage.textContent = message;
  workspaceMessage.dataset.type = type;
}

function setGatewayHealth(state, label, message) {
  gatewayHealthBadge.dataset.state = state;
  gatewayHealthBadge.textContent = label;
  gatewayHealthMessage.textContent = message;
}

function formatTimestamp(value) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function fileSafeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';
}

function captureRuntimeSettings() {
  const gatewayUrl = normalizeGatewayUrl(gatewayUrlInput.value);
  runtimeSettings = saveRuntimeSettings(browserStorage, {
    mode: analysisModeSelect.value,
    gatewayUrl,
    timeoutMs: runtimeSettings.timeoutMs
  });
  renderRuntimeSettings();
  return runtimeSettings;
}

function renderRuntimeSettings() {
  analysisModeSelect.value = runtimeSettings.mode;
  gatewayUrlInput.value = runtimeSettings.gatewayUrl;
  analysisModeBadge.textContent = MODE_LABELS[runtimeSettings.mode] ?? 'Provider-neutral';
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

function renderRuntimeProvenance(result) {
  const runtime = result.runtime ?? {
    source: 'saved',
    provider: 'legacy deterministic',
    model: null,
    latencyMs: 0,
    fallbackUsed: false,
    fallbackReason: null
  };
  $('#runtime-source-value').textContent = runtime.source;
  $('#runtime-provider-value').textContent = runtime.provider;
  $('#runtime-model-value').textContent = runtime.model || 'none';
  $('#runtime-latency-value').textContent = `${Math.max(0, Math.round(runtime.latencyMs || 0))} ms`;
  $('#runtime-fallback-value').textContent = runtime.fallbackUsed
    ? `yes · ${runtime.fallbackReason || 'recorded'}`
    : 'no';

  if (runtime.fallbackUsed) {
    resultRuntimeBadge.dataset.source = 'fallback';
    resultRuntimeBadge.textContent = 'Browser fallback · deterministic';
  } else if (runtime.source === 'gateway') {
    resultRuntimeBadge.dataset.source = 'gateway';
    resultRuntimeBadge.textContent = runtime.model
      ? `${runtime.provider} · ${runtime.model}`
      : `Gateway · ${runtime.provider}`;
  } else {
    resultRuntimeBadge.dataset.source = 'browser';
    resultRuntimeBadge.textContent = runtime.source === 'saved'
      ? 'Saved deterministic artifact'
      : 'Browser · deterministic';
  }
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
  const items = result.unresolvedQuestions.length ? result.unresolvedQuestions : ['No material requirement gaps detected in this pass.'];
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
    const item = document.createElement('li');
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

function renderResult(result, { restored = false } = {}) {
  latestResult = result;
  renderMetrics(result);
  renderRuntimeProvenance(result);
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
  saveVersionButton.disabled = false;
  saveVersionButton.textContent = restored ? 'Save restored run as new version' : 'Save current version';

  if (restored) setStatus('Saved harness version restored', 'success');
  else if (result.runtime?.fallbackUsed) setStatus('Gateway unavailable; browser fallback complete', 'success');
  else if (result.runtime?.source === 'gateway') setStatus('Gateway analysis complete', 'success');
  else setStatus('Browser analysis complete', 'success');
}

function renderWorkspace() {
  const snapshot = workspaceStore.getSnapshot();
  const activeProject = workspaceStore.getActiveProject();
  clear(projectSelect);
  snapshot.projects.forEach((project) => {
    const option = createElement('option', '', project.name);
    option.value = project.id;
    option.selected = project.id === snapshot.activeProjectId;
    projectSelect.appendChild(option);
  });

  projectNameValue.textContent = activeProject.name;
  projectVersionValue.textContent = String(activeProject.runs.length);
  projectSavedValue.textContent = activeProject.runs.length
    ? formatTimestamp(activeProject.runs.at(-1).savedAt)
    : 'Not saved yet';

  const persistent = workspaceStore.getPersistenceMode() === 'browser';
  persistenceBadge.textContent = persistent ? 'Saved in this browser' : 'Temporary memory only';
  persistenceBadge.dataset.mode = persistent ? 'browser' : 'memory';

  clear(historyContainer);
  if (!activeProject.runs.length) {
    const empty = createElement('div', 'workspace-empty');
    empty.append(
      createElement('strong', '', 'No saved harness versions'),
      createElement('p', '', 'Generate a plan, then save it as the first durable version in this project.')
    );
    historyContainer.appendChild(empty);
    return;
  }

  [...activeProject.runs].reverse().forEach((run) => {
    const item = createElement('article', 'history-item');
    const header = createElement('div', 'history-item-header');
    const identity = createElement('div');
    identity.append(
      createElement('span', 'version-chip', `v${run.version}`),
      createElement('strong', '', run.architecture)
    );
    header.append(identity, createElement('span', 'history-score', run.score === null ? '—' : `${run.score}/100`));
    const metadata = createElement('p', 'history-meta', `${formatTimestamp(run.savedAt)} · ${run.runId}`);
    const requirement = createElement('p', 'history-requirement', run.requirement);
    const openButton = createElement('button', 'history-open-button', 'Open version');
    openButton.type = 'button';
    openButton.addEventListener('click', () => {
      const storedRun = workspaceStore.getRun(activeProject.id, run.id);
      if (!storedRun) {
        setWorkspaceMessage('That saved version could not be found.', 'error');
        return;
      }
      input.value = storedRun.requirement;
      renderResult(storedRun.result, { restored: true });
      setWorkspaceMessage(`Opened ${activeProject.name} version ${storedRun.version}.`, 'success');
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    item.append(header, metadata, requirement, openButton);
    historyContainer.appendChild(item);
  });
}

async function executeAnalysis(requirement) {
  const phases = runtimeSettings.mode === RuntimeModes.BROWSER
    ? ['Compiling the requirement…', 'Selecting the harness topology…', 'Applying policy and evaluation gates…']
    : ['Compiling the requirement…', 'Contacting the configured gateway…', 'Validating the returned harness contract…'];
  analyzeButton.disabled = true;
  resetButton.disabled = true;
  progress.hidden = false;
  results.setAttribute('aria-busy', 'true');
  setStatus('Analysis running', 'active');

  for (const phase of phases) {
    progressLabel.textContent = phase;
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }

  const result = await analysisClient.analyze(requirement, runtimeSettings);
  renderResult(result);
  progress.hidden = true;
  analyzeButton.disabled = false;
  resetButton.disabled = false;
  results.setAttribute('aria-busy', 'false');

  if (result.runtime?.fallbackUsed) {
    setWorkspaceMessage('Gateway analysis failed validation or availability checks. The deterministic fallback was used and recorded.', 'neutral');
  } else if (result.runtime?.source === 'gateway') {
    setWorkspaceMessage(`Plan produced through the ${result.runtime.provider} gateway and validated before rendering.`, 'success');
  } else {
    setWorkspaceMessage('Plan generated in the browser. Save it when it represents a meaningful harness version.', 'neutral');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  try {
    captureRuntimeSettings();
    await executeAnalysis(input.value);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    errorMessage.textContent = error instanceof AnalysisGatewayError
      ? `${error.message} (${error.code})`
      : error instanceof Error ? error.message : 'Unable to analyze the requirement.';
    analyzeButton.disabled = false;
    resetButton.disabled = false;
    progress.hidden = true;
    results.setAttribute('aria-busy', 'false');
    setStatus(error instanceof AnalysisGatewayError ? 'Gateway analysis failed' : 'Requirement needs attention', 'error');
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

analysisModeSelect.addEventListener('change', () => {
  try {
    captureRuntimeSettings();
    setGatewayHealth(
      'neutral',
      'Not checked',
      runtimeSettings.mode === RuntimeModes.BROWSER
        ? 'Browser deterministic mode is active; no gateway request will be made.'
        : 'Test the gateway before depending on live or server-side analysis.'
    );
  } catch (error) {
    setGatewayHealth('error', 'Invalid URL', error instanceof Error ? error.message : 'Invalid gateway setting.');
  }
});

gatewayUrlInput.addEventListener('change', () => {
  try {
    captureRuntimeSettings();
    setGatewayHealth('neutral', 'Not checked', 'Gateway setting saved locally. Test the connection before using gateway-required mode.');
  } catch (error) {
    setGatewayHealth('error', 'Invalid URL', error instanceof Error ? error.message : 'Invalid gateway URL.');
  }
});

testGatewayButton.addEventListener('click', async () => {
  testGatewayButton.disabled = true;
  setGatewayHealth('checking', 'Checking', 'Contacting the configured HarnessLab gateway…');
  try {
    const settings = captureRuntimeSettings();
    const health = await analysisClient.checkHealth(settings);
    if (health.provider.available) {
      const model = health.provider.model ? ` · ${health.provider.model}` : '';
      setGatewayHealth('ok', 'Available', `${health.provider.name}${model} is configured and available. Live model: ${health.provider.liveModel ? 'yes' : 'no'}.`);
    } else {
      setGatewayHealth('degraded', 'Degraded', `${health.provider.name} gateway is reachable, but its configured provider is not available.`);
    }
  } catch (error) {
    setGatewayHealth('error', 'Unavailable', error instanceof Error ? error.message : 'Gateway health check failed.');
  } finally {
    testGatewayButton.disabled = false;
  }
});

newProjectButton.addEventListener('click', () => {
  newProjectForm.hidden = false;
  projectNameInput.focus();
});

cancelProjectButton.addEventListener('click', () => {
  newProjectForm.hidden = true;
  projectNameInput.value = '';
  setWorkspaceMessage('', 'neutral');
});

newProjectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const project = workspaceStore.createProject(projectNameInput.value);
    projectNameInput.value = '';
    newProjectForm.hidden = true;
    renderWorkspace();
    setWorkspaceMessage(`Created ${project.name}. Generate and save its first harness version.`, 'success');
    input.focus();
  } catch (error) {
    setWorkspaceMessage(error instanceof Error ? error.message : 'Unable to create the project.', 'error');
    projectNameInput.focus();
  }
});

projectSelect.addEventListener('change', () => {
  try {
    const project = workspaceStore.selectProject(projectSelect.value);
    renderWorkspace();
    const latestRun = project.runs.at(-1);
    if (latestRun) {
      input.value = latestRun.requirement;
      renderResult(latestRun.result, { restored: true });
      setWorkspaceMessage(`Opened ${project.name} at version ${latestRun.version}.`, 'success');
    } else {
      setWorkspaceMessage(`${project.name} has no saved versions yet.`, 'neutral');
    }
  } catch (error) {
    setWorkspaceMessage(error instanceof Error ? error.message : 'Unable to select the project.', 'error');
  }
});

saveVersionButton.addEventListener('click', () => {
  if (!latestResult) return;
  try {
    const run = workspaceStore.saveRun(latestResult, { requirement: input.value });
    renderWorkspace();
    saveVersionButton.textContent = `Saved as v${run.version}`;
    setWorkspaceMessage(`Saved ${run.runId} as immutable version ${run.version}.`, 'success');
    window.setTimeout(() => {
      saveVersionButton.textContent = 'Save current version';
    }, 1800);
  } catch (error) {
    setWorkspaceMessage(error instanceof Error ? error.message : 'Unable to save this harness version.', 'error');
  }
});

exportWorkspaceButton.addEventListener('click', () => {
  try {
    const project = workspaceStore.getActiveProject();
    const payload = workspaceStore.exportWorkspace();
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `harnesslab-${fileSafeName(project.name)}-backup.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setWorkspaceMessage('Workspace backup exported. Keep it private because requirements may contain sensitive context.', 'success');
  } catch (error) {
    setWorkspaceMessage(error instanceof Error ? error.message : 'Unable to export the workspace.', 'error');
  }
});

async function initialize() {
  renderExamples();
  renderWorkspace();
  renderRuntimeSettings();
  input.value = examples[0].value;
  const initialResult = await analysisClient.analyze(input.value, {
    ...runtimeSettings,
    mode: RuntimeModes.BROWSER
  });
  renderResult(initialResult);
  setWorkspaceMessage('The sample plan is not saved yet. Browser projects are local, not encrypted cloud storage.', 'neutral');
}

initialize().catch((error) => {
  errorMessage.textContent = error instanceof Error ? error.message : 'HarnessLab could not initialize.';
  setStatus('Initialization failed', 'error');
});

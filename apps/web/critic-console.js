import { createCriticClient, CriticGatewayError } from './critic-client.js';
import { loadRuntimeSettings, RuntimeModes } from './analysis-client.js';
import { createWorkspaceStore } from './workspace-store.js';

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function modeLabel(mode) {
  if (mode === RuntimeModes.AUTOMATIC) return 'Automatic gateway';
  if (mode === RuntimeModes.GATEWAY) return 'Gateway required';
  return 'Browser deterministic';
}

function statusLabel(status) {
  if (status === 'timed_out') return 'Timed out';
  return status ? status[0].toUpperCase() + status.slice(1) : 'Not run';
}

function findingMarkup(findings, emptyText) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return `<p class="empty-copy">${escapeHtml(emptyText)}</p>`;
  }
  return findings.map((finding) => `
    <article class="finding-card" data-severity="${escapeHtml(finding.severity)}">
      <div class="finding-heading">
        <span>${escapeHtml(finding.category.replaceAll('_', ' '))}</span>
        <strong>${escapeHtml(finding.severity)} · ${Math.round(Number(finding.confidence || 0) * 100)}%</strong>
      </div>
      <p>${escapeHtml(finding.observation)}</p>
      <div class="finding-action"><span>Recommendation</span><p>${escapeHtml(finding.recommendation)}</p></div>
      ${finding.question ? `<div class="finding-question"><span>Question</span><p>${escapeHtml(finding.question)}</p></div>` : ''}
    </article>
  `).join('');
}

class HarnessLabCriticConsole extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.storage = safeStorage();
    this.workspaceStore = createWorkspaceStore({ storage: this.storage });
    this.criticClient = createCriticClient();
    this.open = false;
    this.busy = false;
    this.latestResult = null;
    this.reviewedResult = null;
    this.worker = null;
    this.execution = null;
    this.message = 'Generate a harness plan, then run one bounded deterministic critic locally or use the configured gateway for model-backed review.';
    this.messageType = 'neutral';
    this.onAnalysisResult = this.onAnalysisResult.bind(this);
    this.onCriticResult = this.onCriticResult.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    const activeProject = this.workspaceStore.getActiveProject();
    const latestRun = activeProject?.runs?.at?.(-1);
    if (latestRun?.result) this.latestResult = cloneJson(latestRun.result);
    globalThis.addEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.addEventListener('harnesslab:critic-result', this.onCriticResult);
    globalThis.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  disconnectedCallback() {
    globalThis.removeEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.removeEventListener('harnesslab:critic-result', this.onCriticResult);
    globalThis.removeEventListener('keydown', this.onKeyDown);
  }

  onAnalysisResult(event) {
    if (!event?.detail) return;
    this.latestResult = cloneJson(event.detail);
    this.reviewedResult = null;
    this.worker = null;
    this.execution = null;
    this.message = 'Plan captured. The temporary critic can now inspect its minimum context envelope.';
    this.messageType = 'success';
    this.render();
  }

  onCriticResult(event) {
    if (!event?.detail?.result || !event?.detail?.worker) return;
    this.reviewedResult = cloneJson(event.detail.result);
    this.worker = cloneJson(event.detail.worker);
    this.execution = event.detail.metadata?.execution || (this.worker.liveModel ? 'gateway' : 'deterministic');
    this.message = this.worker.status === 'completed'
      ? 'Critic artifact validated. Deterministic merge rules applied only supported findings.'
      : 'The worker did not complete; the failure state and trace were retained without fabricating findings.';
    this.messageType = this.worker.status === 'completed' ? 'success' : 'warning';
    this.render();
  }

  onKeyDown(event) {
    if (event.key === 'Escape' && this.open) {
      this.open = false;
      this.render();
    }
  }

  getRuntimeSettings() {
    return loadRuntimeSettings(this.storage);
  }

  async runCritic() {
    if (this.busy) return;
    if (!this.latestResult) {
      this.message = 'Generate a harness plan before running the temporary critic.';
      this.messageType = 'warning';
      this.open = true;
      this.render();
      return;
    }
    const settings = this.getRuntimeSettings();
    const browserLocal = settings.mode === RuntimeModes.BROWSER;

    this.busy = true;
    this.message = browserLocal
      ? 'Compiling minimum context and executing one browser-local deterministic architecture critic…'
      : 'Compiling minimum context and executing one gateway-backed architecture critic…';
    this.messageType = 'active';
    this.open = true;
    this.render();
    try {
      const response = await this.criticClient.critique(this.latestResult, settings);
      this.reviewedResult = cloneJson(response.result);
      this.worker = cloneJson(response.worker);
      this.execution = response.metadata?.execution || (browserLocal ? 'browser-local' : 'gateway');
      this.message = this.worker.status === 'completed'
        ? browserLocal
          ? 'Browser-local critic artifact validated with zero network requests.'
          : 'Gateway critic artifact validated. Deterministic merge rules applied only supported findings.'
        : 'The worker did not complete; failure evidence was retained and no finding was applied.';
      this.messageType = this.worker.status === 'completed' ? 'success' : 'warning';
    } catch (error) {
      const criticError = error instanceof CriticGatewayError
        ? error
        : new CriticGatewayError('Temporary critic request failed.', { cause: error });
      this.message = `${criticError.message} (${criticError.code})`;
      this.messageType = 'error';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  async copyReviewedResult() {
    if (!this.reviewedResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.reviewedResult, null, 2));
      this.message = 'Reviewed harness JSON copied to the clipboard.';
      this.messageType = 'success';
    } catch {
      this.message = 'Clipboard access was unavailable. Download the reviewed JSON instead.';
      this.messageType = 'warning';
    }
    this.render();
  }

  saveReviewedVersion() {
    if (!this.reviewedResult) return;
    try {
      const freshWorkspaceStore = createWorkspaceStore({ storage: this.storage });
      const run = freshWorkspaceStore.saveRun(this.reviewedResult, {
        requirement: this.reviewedResult.requirement
      });
      this.workspaceStore = freshWorkspaceStore;
      this.message = `Reviewed result saved as local project version ${run.version}. Reloading the main workspace will refresh its history view.`;
      this.messageType = 'success';
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Unable to save the reviewed version.';
      this.messageType = 'error';
    }
    this.render();
  }

  bindActions() {
    const action = (name, handler) => {
      this.shadowRoot.querySelector(`[data-action="${name}"]`)?.addEventListener('click', handler);
    };
    action('toggle', () => {
      this.open = !this.open;
      this.render();
    });
    action('close', () => {
      this.open = false;
      this.render();
    });
    action('run', () => this.runCritic());
    action('copy', () => this.copyReviewedResult());
    action('download', () => {
      if (!this.reviewedResult) return;
      downloadJson(this.reviewedResult, `harnesslab-reviewed-${this.reviewedResult.runId}.json`);
    });
    action('save', () => this.saveReviewedVersion());
  }

  render() {
    const settings = this.getRuntimeSettings();
    const worker = this.worker;
    const hasResult = Boolean(this.latestResult);
    const browserLocal = settings.mode === RuntimeModes.BROWSER;
    const accepted = worker?.acceptedFindings ?? [];
    const rejected = worker?.rejectedFindings ?? [];
    const status = worker?.status ?? 'idle';
    const executionPath = this.execution === 'browser-local' || (!worker && browserLocal)
      ? 'Browser local · no network'
      : settings.gatewayUrl;
    const buttonLabel = this.busy
      ? 'Critic running'
      : worker
        ? `Critic ${statusLabel(status)}`
        : hasResult ? 'Run temporary critic' : 'Critic waiting';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="./critic-console.css">
      <button class="critic-launcher" data-action="toggle" type="button" aria-expanded="${this.open}" aria-controls="critic-drawer">
        <span class="launcher-orb" data-state="${escapeHtml(this.busy ? 'active' : status)}"></span>
        <span><strong>${escapeHtml(buttonLabel)}</strong><small>1 worker · 1 call · no tools</small></span>
      </button>
      <section id="critic-drawer" class="critic-drawer" data-open="${this.open}" aria-hidden="${!this.open}">
        <div class="drawer-backdrop" data-action="close"></div>
        <div class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="critic-title">
          <header class="drawer-header">
            <div>
              <span class="eyebrow">Executed temporary intelligence</span>
              <h2 id="critic-title">Architecture Critic</h2>
            </div>
            <button class="icon-button" data-action="close" type="button" aria-label="Close temporary critic console">×</button>
          </header>

          <div class="guardrail-strip" aria-label="Temporary worker limits">
            <span>One worker</span><span>${browserLocal ? 'One local invocation' : 'One provider call'}</span><span>No tools</span><span>No child agents</span><span>No external actions</span>
          </div>

          <div class="runtime-card">
            <div><span>Runtime mode</span><strong>${escapeHtml(modeLabel(settings.mode))}</strong></div>
            <div><span>Execution path</span><strong>${escapeHtml(executionPath)}</strong></div>
            <div><span>Captured plan</span><strong>${hasResult ? escapeHtml(this.latestResult.runId) : 'None yet'}</strong></div>
            <div><span>Worker status</span><strong data-status="${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</strong></div>
          </div>

          <p class="console-message" data-type="${escapeHtml(this.messageType)}" aria-live="polite">${escapeHtml(this.message)}</p>

          <div class="primary-actions">
            <button class="run-button" data-action="run" type="button" ${this.busy ? 'disabled' : ''}>
              <span>${this.busy ? 'Running bounded critic…' : 'Execute one bounded critic'}</span><strong>→</strong>
            </button>
            <p>${browserLocal
              ? 'The deterministic critic runs locally with no network request, account, model, API key, or external capability.'
              : 'The configured gateway chooses the provider. The browser sends no provider credential.'}</p>
          </div>

          ${worker ? `
            <section class="worker-summary">
              <div class="summary-heading">
                <div><span class="eyebrow">Lifecycle artifact</span><h3>${escapeHtml(worker.id)}</h3></div>
                <span class="status-pill" data-status="${escapeHtml(worker.status)}">${escapeHtml(statusLabel(worker.status))}</span>
              </div>
              <div class="worker-metrics">
                <div><span>Provider</span><strong>${escapeHtml(worker.provider)}</strong></div>
                <div><span>Model</span><strong>${escapeHtml(worker.model || 'deterministic')}</strong></div>
                <div><span>Latency</span><strong>${escapeHtml(worker.latencyMs)} ms</strong></div>
                <div><span>Context</span><strong>${escapeHtml(worker.inputBytes)} bytes</strong></div>
                <div><span>Accepted</span><strong>${accepted.length}</strong></div>
                <div><span>Rejected</span><strong>${rejected.length}</strong></div>
              </div>
              <div class="artifact-callout"><span>Retained artifact</span><strong>${escapeHtml(worker.artifactId)}</strong></div>
              ${worker.review ? `<blockquote>${escapeHtml(worker.review.summary)}</blockquote>` : ''}
              ${worker.failure ? `<div class="failure-card"><strong>${escapeHtml(worker.failure.code)}</strong><p>${escapeHtml(worker.failure.message)}</p></div>` : ''}
            </section>

            <section class="finding-section">
              <div class="section-heading"><div><span class="eyebrow">Deterministic merge gate</span><h3>Accepted findings</h3></div><span>${accepted.length}</span></div>
              <div class="finding-grid">${findingMarkup(accepted, 'No finding met the deterministic severity and confidence threshold.')}</div>
            </section>

            <section class="finding-section rejected-section">
              <div class="section-heading"><div><span class="eyebrow">Retained, not applied</span><h3>Rejected findings</h3></div><span>${rejected.length}</span></div>
              <div class="finding-grid">${findingMarkup(rejected, 'No critic finding was rejected.')}</div>
            </section>

            <section class="context-section">
              <span class="eyebrow">Minimum context envelope</span>
              <div class="context-fields">${worker.contextFields.map((field) => `<span>${escapeHtml(field)}</span>`).join('')}</div>
              <p>The worker never received provider credentials, tool handles, filesystem access, database access, or the full browser conversation.</p>
            </section>

            <div class="secondary-actions">
              <button data-action="copy" type="button">Copy reviewed JSON</button>
              <button data-action="download" type="button">Download artifact</button>
              <button data-action="save" type="button">Save local version</button>
            </div>
          ` : `
            <section class="empty-state">
              <div class="empty-icon">C</div>
              <h3>No temporary critic has executed</h3>
              <p>Generate or restore a harness plan and execute the deterministic critic immediately in browser mode. Select a compatible gateway only for Ollama or free-only OpenRouter review.</p>
            </section>
          `}
        </div>
      </section>
    `;
    this.bindActions();
  }
}

if (!customElements.get('harnesslab-critic-console')) {
  customElements.define('harnesslab-critic-console', HarnessLabCriticConsole);
}

const consoleElement = document.createElement('harnesslab-critic-console');
document.body.appendChild(consoleElement);

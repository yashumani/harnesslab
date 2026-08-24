import {
  analyzeRequirementIntelligence,
  validateRequirementIntelligence
} from './requirement-intelligence.js';

const COMPOSER_SELECTOR = 'textarea[aria-label="Agent system requirement"]';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusLabel(status) {
  if (status === 'ready') return 'Ready for draft';
  if (status === 'draft') return 'Draft with gaps';
  if (status === 'needs-input') return 'Needs input';
  return 'Waiting for requirement';
}

function dimensionStatusLabel(status) {
  if (status === 'covered') return 'Covered';
  if (status === 'partial') return 'Partial';
  return 'Missing';
}

function priorityLabel(priority) {
  return priority === 'high' ? 'Resolve first' : priority === 'medium' ? 'Next question' : 'Optional';
}

class HarnessLabRequirementIntelligence extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.open = false;
    this.mode = 'live';
    this.liveAnalysis = null;
    this.retainedAnalysis = null;
    this.requirement = '';
    this.textarea = null;
    this.inputTimer = null;
    this.observer = null;
    this.message = 'Describe the use case to see evidence-backed requirement readiness.';
    this.messageTone = 'neutral';
    this.onDocumentInput = this.onDocumentInput.bind(this);
    this.onAnalysisResult = this.onAnalysisResult.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    document.addEventListener('input', this.onDocumentInput);
    globalThis.addEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.addEventListener('keydown', this.onKeyDown);
    this.observeComposer();
    this.render();
  }

  disconnectedCallback() {
    document.removeEventListener('input', this.onDocumentInput);
    globalThis.removeEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.removeEventListener('keydown', this.onKeyDown);
    this.observer?.disconnect();
    globalThis.clearTimeout(this.inputTimer);
  }

  observeComposer() {
    const attach = () => {
      const textarea = document.querySelector(COMPOSER_SELECTOR);
      if (!textarea || textarea === this.textarea) return Boolean(textarea);
      this.textarea = textarea;
      this.updateLiveAnalysis(textarea.value);
      return true;
    };
    attach();
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => attach());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  onDocumentInput(event) {
    if (!event.target?.matches?.(COMPOSER_SELECTOR)) return;
    globalThis.clearTimeout(this.inputTimer);
    this.inputTimer = globalThis.setTimeout(() => this.updateLiveAnalysis(event.target.value), 120);
  }

  updateLiveAnalysis(value) {
    this.requirement = typeof value === 'string' ? value : '';
    const trimmed = this.requirement.trim();
    if (trimmed.length < 8) {
      this.liveAnalysis = null;
      this.mode = this.retainedAnalysis ? this.mode : 'live';
      this.message = 'Add more detail to begin the local readiness assessment.';
      this.messageTone = 'neutral';
      this.render();
      return;
    }
    try {
      this.liveAnalysis = analyzeRequirementIntelligence(trimmed);
      if (!this.retainedAnalysis) this.mode = 'live';
      this.message = 'Live assessment updated locally from the supplied text.';
      this.messageTone = 'success';
    } catch (error) {
      this.liveAnalysis = null;
      this.message = error instanceof Error ? error.message : 'The requirement could not be assessed.';
      this.messageTone = 'error';
    }
    this.render();
  }

  onAnalysisResult(event) {
    const candidate = event?.detail?.requirementAnalysis;
    if (validateRequirementIntelligence(candidate).valid) {
      this.retainedAnalysis = cloneJson(candidate);
      this.mode = 'retained';
      this.message = 'The generated HarnessResult retained this typed requirement assessment.';
      this.messageTone = 'success';
      this.render();
    }
  }

  onKeyDown(event) {
    if (event.key === 'Escape' && this.open) {
      this.open = false;
      this.render();
    }
  }

  get activeAnalysis() {
    if (this.mode === 'retained' && this.retainedAnalysis) return this.retainedAnalysis;
    return this.liveAnalysis || this.retainedAnalysis;
  }

  scrollToComposer() {
    document.querySelector(COMPOSER_SELECTOR)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector(COMPOSER_SELECTOR)?.focus({ preventScroll: true });
    this.open = false;
    this.render();
  }

  async copyQuestions() {
    const analysis = this.activeAnalysis;
    if (!analysis?.questions?.length) return;
    const text = analysis.questions
      .map((question, index) => `${index + 1}. ${question.question}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.message = 'Prioritized questions copied to the clipboard.';
      this.messageTone = 'success';
    } catch {
      this.message = 'Clipboard access was unavailable.';
      this.messageTone = 'warning';
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
    action('live', () => {
      this.mode = 'live';
      this.render();
    });
    action('retained', () => {
      this.mode = 'retained';
      this.render();
    });
    action('composer', () => this.scrollToComposer());
    action('copy', () => this.copyQuestions());
  }

  renderDimension(dimension) {
    const evidence = dimension.evidence.length
      ? `<blockquote>${dimension.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</blockquote>`
      : '<p class="missing-copy">No supporting text was supplied.</p>';
    return `
      <article class="dimension-card" data-status="${escapeHtml(dimension.status)}">
        <header>
          <span class="dimension-index">${escapeHtml(dimension.weight)}%</span>
          <div><strong>${escapeHtml(dimension.label)}</strong><small>${escapeHtml(dimensionStatusLabel(dimension.status))}</small></div>
        </header>
        <p>${escapeHtml(dimension.summary)}</p>
        <details>
          <summary>Source evidence</summary>
          ${evidence}
        </details>
      </article>`;
  }

  renderContradictions(contradictions) {
    if (!contradictions.length) {
      return '<div class="empty-inline" data-tone="success"><strong>No explicit contradiction detected</strong><span>Narrow deterministic rules found no conflicting requirement pair.</span></div>';
    }
    return contradictions.map((item) => `
      <article class="contradiction-card" data-severity="${escapeHtml(item.severity)}">
        <header><span>${escapeHtml(item.severity)}</span><strong>${escapeHtml(item.statement)}</strong></header>
        <div class="evidence-stack">${item.evidence.map((evidence) => `<blockquote>${escapeHtml(evidence)}</blockquote>`).join('')}</div>
        <p><b>Resolve:</b> ${escapeHtml(item.question)}</p>
      </article>`).join('');
  }

  renderQuestions(questions) {
    if (!questions.length) {
      return '<div class="empty-inline" data-tone="success"><strong>No prioritized question remains</strong><span>The supplied requirement covers the current readiness dimensions.</span></div>';
    }
    return questions.map((question, index) => `
      <article class="question-card" data-priority="${escapeHtml(question.priority)}">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <div><small>${escapeHtml(priorityLabel(question.priority))} · ${escapeHtml(question.dimension)}</small><strong>${escapeHtml(question.question)}</strong><p>${escapeHtml(question.reason)}</p></div>
      </article>`).join('');
  }

  render() {
    const analysis = this.activeAnalysis;
    const status = analysis?.status || 'waiting';
    const score = analysis?.score ?? '—';
    const launcherDetail = analysis
      ? `${analysis.counts.covered} covered · ${analysis.counts.missing} missing`
      : 'Evidence-backed local assessment';
    const retainedAvailable = Boolean(this.retainedAnalysis);
    const liveAvailable = Boolean(this.liveAnalysis);

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="./requirement-intelligence-panel.css">
      <button class="readiness-launcher" data-action="toggle" type="button" aria-expanded="${this.open}" aria-controls="requirement-intelligence-drawer">
        <span class="score-orb" data-status="${escapeHtml(status)}">${escapeHtml(score)}</span>
        <span><strong>Requirement readiness</strong><small>${escapeHtml(launcherDetail)}</small></span>
      </button>

      <section id="requirement-intelligence-drawer" class="readiness-drawer" data-open="${this.open}" aria-hidden="${!this.open}">
        <div class="drawer-backdrop" data-action="close"></div>
        <div class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="requirement-intelligence-title">
          <header class="drawer-header">
            <div><span class="eyebrow">Harness Intelligence · M1</span><h2 id="requirement-intelligence-title">Requirement readiness</h2><p>Source-only guidance before architecture becomes execution.</p></div>
            <button class="icon-button" data-action="close" type="button" aria-label="Close requirement readiness">×</button>
          </header>

          ${retainedAvailable ? `
            <div class="mode-switch" role="group" aria-label="Requirement assessment source">
              <button data-action="live" type="button" data-active="${this.mode === 'live'}" ${liveAvailable ? '' : 'disabled'}>Live draft</button>
              <button data-action="retained" type="button" data-active="${this.mode === 'retained'}">Generated result</button>
            </div>` : ''}

          <p class="console-message" data-tone="${escapeHtml(this.messageTone)}" aria-live="polite">${escapeHtml(this.message)}</p>

          ${analysis ? `
            <section class="readiness-overview" data-status="${escapeHtml(analysis.status)}">
              <div class="readiness-score"><strong>${escapeHtml(analysis.score)}</strong><span>/100</span></div>
              <div><span>${escapeHtml(statusLabel(analysis.status))}</span><h3>${escapeHtml(analysis.summary)}</h3><p>${escapeHtml(analysis.sourcePolicy)}</p></div>
            </section>

            <div class="count-grid">
              <div data-tone="covered"><span>Covered</span><strong>${analysis.counts.covered}</strong></div>
              <div data-tone="partial"><span>Partial</span><strong>${analysis.counts.partial}</strong></div>
              <div data-tone="missing"><span>Missing</span><strong>${analysis.counts.missing}</strong></div>
              <div data-tone="contradiction"><span>Contradictions</span><strong>${analysis.contradictions.length}</strong></div>
            </div>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Evidence map</span><h3>Ten requirement dimensions</h3></div><span>${analysis.analysisId}</span></div>
              <div class="dimension-grid">${analysis.dimensions.map((dimension) => this.renderDimension(dimension)).join('')}</div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Consistency gate</span><h3>Explicit contradictions</h3></div><span>${analysis.contradictions.length}</span></div>
              <div class="contradiction-list">${this.renderContradictions(analysis.contradictions)}</div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Guided interview</span><h3>Prioritized questions</h3></div><span>${analysis.questions.length}</span></div>
              <div class="question-list">${this.renderQuestions(analysis.questions)}</div>
            </section>

            <div class="drawer-actions">
              <button class="primary-action" data-action="composer" type="button">Improve the requirement</button>
              <button data-action="copy" type="button" ${analysis.questions.length ? '' : 'disabled'}>Copy questions</button>
            </div>` : `
            <section class="empty-state">
              <span>R</span><h3>Requirement assessment is waiting</h3><p>Enter at least eight characters in the requirement composer. Analysis runs locally and does not call a model, gateway, or external service.</p>
              <button class="primary-action" data-action="composer" type="button">Open requirement composer</button>
            </section>`}
        </div>
      </section>
    `;
    this.bindActions();
  }
}

if (!customElements.get('harnesslab-requirement-intelligence')) {
  customElements.define('harnesslab-requirement-intelligence', HarnessLabRequirementIntelligence);
}

const requirementIntelligence = document.createElement('harnesslab-requirement-intelligence');
document.body.appendChild(requirementIntelligence);

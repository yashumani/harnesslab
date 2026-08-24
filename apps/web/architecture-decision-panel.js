import {
  analyzeArchitectureDecision,
  validateArchitectureDecision
} from './architecture-decision.js';
import { analyzeRequirementIntelligence } from './requirement-intelligence.js';

const COMPOSER_SELECTOR = 'textarea[aria-label="Agent system requirement"]';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

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

function factorStatusLabel(status) {
  if (status === 'present') return 'Supported';
  if (status === 'uncertain') return 'Uncertain';
  return 'Absent';
}

function alternativeStatusLabel(status) {
  if (status === 'selected') return 'Selected';
  if (status === 'simpler-option') return 'Simpler option';
  if (status === 'upgrade-path') return 'Upgrade path';
  return 'Not justified';
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = globalThis.getComputedStyle?.(element);
  return style ? style.visibility !== 'hidden' && style.display !== 'none' : true;
}

class HarnessLabArchitectureDecision extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.open = false;
    this.mode = 'live';
    this.liveDecision = null;
    this.retainedDecision = null;
    this.requirement = '';
    this.textarea = null;
    this.inputTimer = null;
    this.observer = null;
    this.backgroundStates = new Map();
    this.message = 'Describe the use case to see whether agency is justified.';
    this.messageTone = 'neutral';
    this.onDocumentInput = this.onDocumentInput.bind(this);
    this.onAnalysisResult = this.onAnalysisResult.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    document.addEventListener('input', this.onDocumentInput);
    document.addEventListener('change', this.onDocumentInput);
    globalThis.addEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.addEventListener('keydown', this.onKeyDown);
    this.observeComposer();
    this.render();
  }

  disconnectedCallback() {
    document.removeEventListener('input', this.onDocumentInput);
    document.removeEventListener('change', this.onDocumentInput);
    globalThis.removeEventListener('harnesslab:analysis-result', this.onAnalysisResult);
    globalThis.removeEventListener('keydown', this.onKeyDown);
    this.observer?.disconnect();
    globalThis.clearTimeout(this.inputTimer);
    this.setBackgroundInert(false);
  }

  observeComposer() {
    const attach = () => {
      const textarea = document.querySelector(COMPOSER_SELECTOR);
      if (!textarea) return false;
      const nodeChanged = textarea !== this.textarea;
      const valueChanged = textarea.value !== this.requirement;
      this.textarea = textarea;
      if (nodeChanged || valueChanged) this.updateLiveDecision(textarea.value);
      return true;
    };
    attach();
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => attach());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  onDocumentInput(event) {
    if (!event.target?.matches?.(COMPOSER_SELECTOR)) return;
    globalThis.clearTimeout(this.inputTimer);
    this.inputTimer = globalThis.setTimeout(() => this.updateLiveDecision(event.target.value), 120);
  }

  updateLiveDecision(value) {
    this.requirement = typeof value === 'string' ? value : '';
    const trimmed = this.requirement.trim();
    if (trimmed.length < 8) {
      this.liveDecision = null;
      if (!this.retainedDecision) this.mode = 'live';
      this.message = 'Add more detail to begin the local topology decision.';
      this.messageTone = 'neutral';
      this.render();
      return;
    }

    try {
      const readiness = analyzeRequirementIntelligence(trimmed);
      this.liveDecision = analyzeArchitectureDecision(trimmed, readiness);
      if (!this.retainedDecision) this.mode = 'live';
      this.message = 'Live topology decision updated locally from supplied evidence.';
      this.messageTone = 'success';
    } catch (error) {
      this.liveDecision = null;
      this.message = error instanceof Error ? error.message : 'The topology decision could not be produced.';
      this.messageTone = 'error';
    }
    this.render();
  }

  onAnalysisResult(event) {
    if (!event?.detail) return;
    const candidate = event.detail.architectureDecision;
    const validation = validateArchitectureDecision(candidate);
    if (validation.valid) {
      this.retainedDecision = cloneJson(candidate);
      this.mode = 'retained';
      this.message = 'The generated HarnessResult retained this typed topology decision.';
      this.messageTone = 'success';
      this.render();
      return;
    }

    this.retainedDecision = null;
    this.mode = 'live';
    const currentValue = this.textarea?.value ?? this.requirement;
    if (typeof currentValue === 'string' && currentValue !== this.requirement) {
      this.updateLiveDecision(currentValue);
      return;
    }
    this.message = 'This legacy result has no retained topology decision; the live advisor remains available.';
    this.messageTone = 'warning';
    this.render();
  }

  setBackgroundInert(inert) {
    const excludedTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);
    if (inert) {
      for (const element of document.body.children) {
        if (element === this || excludedTags.has(element.tagName) || this.backgroundStates.has(element)) continue;
        this.backgroundStates.set(element, {
          inert: element.hasAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden')
        });
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    for (const [element, state] of this.backgroundStates) {
      if (!element.isConnected) continue;
      if (state.inert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
      if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', state.ariaHidden);
    }
    this.backgroundStates.clear();
  }

  openDrawer() {
    this.open = true;
    this.setBackgroundInert(true);
    this.render();
    globalThis.queueMicrotask(() => this.shadowRoot.querySelector('[data-action="close"]')?.focus());
  }

  closeDrawer({ restoreFocus = true } = {}) {
    this.open = false;
    this.setBackgroundInert(false);
    this.render();
    if (restoreFocus) {
      globalThis.queueMicrotask(() => this.shadowRoot.querySelector('[data-action="toggle"]')?.focus());
    }
  }

  onKeyDown(event) {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = this.shadowRoot.querySelector('.drawer-panel');
    const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const active = this.shadowRoot.activeElement;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  get activeDecision() {
    if (this.mode === 'retained' && this.retainedDecision) return this.retainedDecision;
    return this.liveDecision || this.retainedDecision;
  }

  scrollToComposer() {
    const composer = document.querySelector(COMPOSER_SELECTOR);
    this.closeDrawer({ restoreFocus: false });
    globalThis.queueMicrotask(() => {
      composer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composer?.focus({ preventScroll: true });
    });
  }

  bindActions() {
    const action = (name, handler) => this.shadowRoot
      .querySelector(`[data-action="${name}"]`)
      ?.addEventListener('click', handler);
    action('toggle', () => this.open ? this.closeDrawer() : this.openDrawer());
    action('close', () => this.closeDrawer());
    action('live', () => {
      this.mode = 'live';
      this.render();
    });
    action('retained', () => {
      this.mode = 'retained';
      this.render();
    });
    action('composer', () => this.scrollToComposer());
  }

  renderFactor(factor) {
    const evidence = factor.evidence.length
      ? `<blockquote>${factor.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</blockquote>`
      : '<p class="empty-copy">No supporting phrase was supplied.</p>';
    return `
      <article class="factor-card" data-status="${escapeHtml(factor.status)}" data-impact="${escapeHtml(factor.impact)}">
        <header><div><strong>${escapeHtml(factor.label)}</strong><small>${escapeHtml(factorStatusLabel(factor.status))}</small></div><span>${escapeHtml(factor.impact.replace('-', ' '))}</span></header>
        <p>${escapeHtml(factor.summary)}</p>
        <details><summary>Decision evidence</summary>${evidence}</details>
      </article>`;
  }

  renderAlternative(alternative) {
    return `
      <article class="alternative-card" data-status="${escapeHtml(alternative.status)}">
        <header><strong>${escapeHtml(alternative.label)}</strong><span>${escapeHtml(alternativeStatusLabel(alternative.status))}</span></header>
        <p>${escapeHtml(alternative.reason)}</p>
        <div><small>Use or upgrade when</small><span>${escapeHtml(alternative.upgradeCondition)}</span></div>
      </article>`;
  }

  renderProtocol(protocol) {
    const evidence = protocol.evidence.length
      ? `<small>Evidence: ${escapeHtml(protocol.evidence.join(' · '))}</small>`
      : '<small>No direct protocol evidence supplied.</small>';
    return `
      <article class="protocol-card" data-decision="${escapeHtml(protocol.decision)}">
        <header><strong>${escapeHtml(protocol.label)}</strong><span>${escapeHtml(protocol.decision)}</span></header>
        <p><b>Responsibility:</b> ${escapeHtml(protocol.responsibility)}</p>
        <p>${escapeHtml(protocol.rationale)}</p>
        ${evidence}
      </article>`;
  }

  render() {
    const decision = this.activeDecision;
    const retainedAvailable = Boolean(this.retainedDecision);
    const liveAvailable = Boolean(this.liveDecision);
    const selected = decision?.selectedTopology;
    const launcherDetail = selected
      ? `${selected.label} · ${decision.confidence}%`
      : 'Agent, workflow, swarm, or A2A?';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="./architecture-decision-panel.css">
      <button class="decision-launcher" data-action="toggle" type="button" aria-expanded="${this.open}" aria-controls="architecture-decision-drawer">
        <span class="decision-orb">${decision ? escapeHtml(decision.confidence) : 'D'}</span>
        <span><strong>Topology decision</strong><small>${escapeHtml(launcherDetail)}</small></span>
      </button>

      <section id="architecture-decision-drawer" class="decision-drawer" data-open="${this.open}" aria-hidden="${!this.open}">
        <div class="drawer-backdrop" data-action="close"></div>
        <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="architecture-decision-title" tabindex="-1">
          <header class="drawer-header">
            <div><span class="eyebrow">Harness Intelligence · M1</span><h2 id="architecture-decision-title">Agent necessity and topology</h2><p>Choose the smallest architecture justified by evidence—not the most impressive one.</p></div>
            <button class="icon-button" data-action="close" type="button" aria-label="Close topology decision">×</button>
          </header>

          ${retainedAvailable ? `
            <div class="mode-switch" role="group" aria-label="Topology decision source">
              <button data-action="live" type="button" data-active="${this.mode === 'live'}" ${liveAvailable ? '' : 'disabled'}>Live draft</button>
              <button data-action="retained" type="button" data-active="${this.mode === 'retained'}">Generated result</button>
            </div>` : ''}

          <p class="console-message" data-tone="${escapeHtml(this.messageTone)}" aria-live="polite">${escapeHtml(this.message)}</p>

          ${decision ? `
            <section class="decision-hero">
              <div class="confidence-ring"><strong>${escapeHtml(decision.confidence)}</strong><span>confidence</span></div>
              <div><span class="selected-label">Selected topology</span><h3>${escapeHtml(selected.label)}</h3><p>${escapeHtml(selected.rationale)}</p><small>${escapeHtml(selected.autonomy)}</small></div>
            </section>

            <div class="readiness-strip" data-status="${escapeHtml(decision.readiness.status)}">
              <div><span>Requirement readiness</span><strong>${escapeHtml(decision.readiness.score)}/100 · ${escapeHtml(decision.readiness.status)}</strong></div>
              <div><span>Contradictions</span><strong>${escapeHtml(decision.readiness.contradictions)}</strong></div>
              <div><span>Decision ID</span><strong>${escapeHtml(decision.decisionId)}</strong></div>
            </div>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Decision evidence</span><h3>Nine topology factors</h3></div><span>${decision.factors.filter((factor) => factor.status === 'present').length} supported</span></div>
              <div class="factor-grid">${decision.factors.map((factor) => this.renderFactor(factor)).join('')}</div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Tradeoff map</span><h3>Alternatives and upgrade conditions</h3></div><span>${decision.alternatives.length}</span></div>
              <div class="alternative-list">${decision.alternatives.map((alternative) => this.renderAlternative(alternative)).join('')}</div>
            </section>

            <section class="panel-section">
              <div class="section-heading"><div><span class="eyebrow">Protocol responsibilities</span><h3>Functions, MCP, retrieval, and A2A are not interchangeable</h3></div></div>
              <div class="protocol-grid">${decision.protocols.map((protocol) => this.renderProtocol(protocol)).join('')}</div>
            </section>

            <section class="panel-section guardrail-section">
              <div class="section-heading"><div><span class="eyebrow">Autonomy boundary</span><h3>Guardrails applied to the selected topology</h3></div></div>
              <div class="guardrail-list">${decision.guardrails.map((guardrail, index) => `<div><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(guardrail)}</p></div>`).join('')}</div>
            </section>

            <p class="source-policy">${escapeHtml(decision.sourcePolicy)}</p>
            <div class="drawer-actions"><button class="primary-action" data-action="composer" type="button">Refine the requirement</button></div>
          ` : `
            <section class="empty-state"><span>D</span><h3>Topology decision is waiting</h3><p>Enter at least eight characters in the requirement composer. The advisor runs locally with no model, gateway, account, or network request.</p><button class="primary-action" data-action="composer" type="button">Open requirement composer</button></section>
          `}
        </div>
      </section>
    `;
    this.bindActions();
  }
}

if (!customElements.get('harnesslab-architecture-decision')) {
  customElements.define('harnesslab-architecture-decision', HarnessLabArchitectureDecision);
}

const architectureDecision = document.createElement('harnesslab-architecture-decision');
document.body.appendChild(architectureDecision);

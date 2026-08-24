import {
  analyzeAgentDecision,
  validateAgentDecision
} from './agent-decision.js';
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

function titleCase(value) {
  return String(value ?? '').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function decisionLabel(value) {
  if (value === 'required') return 'Required';
  if (value === 'recommended') return 'Recommended';
  if (value === 'optional') return 'Optional';
  return 'Not needed';
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = globalThis.getComputedStyle?.(element);
  return style ? style.visibility !== 'hidden' && style.display !== 'none' : true;
}

class HarnessLabAgentDecision extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.open = false;
    this.mode = 'live';
    this.requirement = '';
    this.liveDecision = null;
    this.retainedDecision = null;
    this.textarea = null;
    this.observer = null;
    this.inputTimer = null;
    this.backgroundStates = new Map();
    this.message = 'Describe the use case to compare workflow and agent topologies.';
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
      const changed = textarea !== this.textarea || textarea.value !== this.requirement;
      this.textarea = textarea;
      if (changed) this.updateLiveDecision(textarea.value);
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
    if (this.requirement.trim().length < 8) {
      this.liveDecision = null;
      if (!this.retainedDecision) this.mode = 'live';
      this.message = 'Add more detail before selecting an agent topology.';
      this.messageTone = 'neutral';
      this.render();
      return;
    }
    try {
      const readiness = analyzeRequirementIntelligence(this.requirement);
      this.liveDecision = analyzeAgentDecision(this.requirement, readiness);
      if (!this.retainedDecision) this.mode = 'live';
      this.message = 'Agent necessity recalculated locally from source evidence.';
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
    const candidate = event.detail.agentDecision;
    const validation = validateAgentDecision(candidate);
    if (validation.valid) {
      this.retainedDecision = cloneJson(candidate);
      this.mode = 'retained';
      this.message = 'The generated HarnessResult retained this typed agent decision.';
      this.messageTone = 'success';
    } else {
      this.retainedDecision = null;
      this.mode = 'live';
      this.message = 'This legacy result has no retained agent decision; the live source-based decision remains visible.';
      this.messageTone = 'warning';
    }
    this.render();
  }

  get activeDecision() {
    if (this.mode === 'retained' && this.retainedDecision) return this.retainedDecision;
    return this.liveDecision || this.retainedDecision;
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
    if (restoreFocus) globalThis.queueMicrotask(() => this.shadowRoot.querySelector('[data-action="toggle"]')?.focus());
  }

  onKeyDown(event) {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = this.shadowRoot.querySelector('.decision-panel');
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

  scrollToBlueprint() {
    this.closeDrawer({ restoreFocus: false });
    globalThis.queueMicrotask(() => document.getElementById('blueprint')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  bindActions() {
    const action = (name, handler) => this.shadowRoot.querySelector(`[data-action="${name}"]`)?.addEventListener('click', handler);
    action('toggle', () => this.open ? this.closeDrawer() : this.openDrawer());
    action('close', () => this.closeDrawer());
    action('live', () => { this.mode = 'live'; this.render(); });
    action('retained', () => { this.mode = 'retained'; this.render(); });
    action('blueprint', () => this.scrollToBlueprint());
  }

  renderFactor(factor) {
    return `
      <article class="factor-card" data-state="${escapeHtml(factor.state)}">
        <header><div><strong>${escapeHtml(factor.label)}</strong><small>${escapeHtml(titleCase(factor.state))}</small></div><span>${escapeHtml(factor.score)}</span></header>
        <p>${escapeHtml(factor.effect)}</p>
        ${factor.evidence.length ? `<details><summary>Source evidence</summary>${factor.evidence.map((item) => `<blockquote>${escapeHtml(item)}</blockquote>`).join('')}</details>` : '<span class="no-evidence">No signal in the supplied requirement.</span>'}
      </article>`;
  }

  renderAlternative(alternative) {
    return `
      <article class="alternative-card" data-status="${escapeHtml(alternative.status)}">
        <header><strong>${escapeHtml(alternative.label)}</strong><span>${escapeHtml(titleCase(alternative.status))}</span></header>
        <p>${escapeHtml(alternative.reason)}</p>
        <small><b>Change when:</b> ${escapeHtml(alternative.upgradeCondition)}</small>
      </article>`;
  }

  renderProtocol(protocol) {
    return `
      <article class="protocol-card" data-decision="${escapeHtml(protocol.decision)}">
        <header><strong>${escapeHtml(protocol.label)}</strong><span>${escapeHtml(decisionLabel(protocol.decision))}</span></header>
        <p>${escapeHtml(protocol.responsibility)}</p>
        <small>${escapeHtml(protocol.rationale)}</small>
      </article>`;
  }

  render() {
    const decision = this.activeDecision;
    const retainedAvailable = Boolean(this.retainedDecision);
    const liveAvailable = Boolean(this.liveDecision);
    const mode = decision?.selected?.mode || 'waiting';
    const confidence = decision?.selected?.confidence ?? '—';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="./agent-decision-panel.css">
      <button class="decision-launcher" data-action="toggle" type="button" aria-expanded="${this.open}" aria-controls="agent-decision-drawer">
        <span class="decision-orb" data-mode="${escapeHtml(mode)}">${escapeHtml(confidence)}</span>
        <span><strong>Why this architecture?</strong><small>${decision ? escapeHtml(decision.selected.label) : 'Workflow vs agent guidance'}</small></span>
      </button>
      <section id="agent-decision-drawer" class="decision-drawer" data-open="${this.open}" aria-hidden="${!this.open}">
        <div class="decision-backdrop" data-action="close"></div>
        <div class="decision-panel" role="dialog" aria-modal="true" aria-labelledby="agent-decision-title" tabindex="-1">
          <header class="drawer-header">
            <div><span class="eyebrow">Harness Intelligence · M1</span><h2 id="agent-decision-title">Agent necessity advisor</h2><p>Choose the least complex topology that satisfies the evidence.</p></div>
            <button class="icon-button" data-action="close" type="button" aria-label="Close agent necessity advisor">×</button>
          </header>

          ${retainedAvailable ? `<div class="mode-switch" role="group" aria-label="Agent decision source"><button data-action="live" data-active="${this.mode === 'live'}" type="button" ${liveAvailable ? '' : 'disabled'}>Live requirement</button><button data-action="retained" data-active="${this.mode === 'retained'}" type="button">Generated result</button></div>` : ''}
          <p class="console-message" data-tone="${escapeHtml(this.messageTone)}" aria-live="polite">${escapeHtml(this.message)}</p>

          ${decision ? `
            <section class="decision-hero" data-mode="${escapeHtml(decision.selected.mode)}">
              <div class="decision-score"><strong>${escapeHtml(decision.selected.confidence)}</strong><span>% confidence</span></div>
              <div><span>${escapeHtml(decision.selected.mode)}</span><h3>${escapeHtml(decision.selected.label)}</h3><p>${escapeHtml(decision.selected.rationale)}</p></div>
            </section>

            <section class="readiness-strip" data-ready="${decision.readiness.executionReady}">
              <div><span>Requirement readiness</span><strong>${escapeHtml(decision.readiness.status)}${decision.readiness.score === null ? '' : ` · ${escapeHtml(decision.readiness.score)}/100`}</strong></div>
              <div><span>Autonomy</span><strong>${escapeHtml(decision.autonomy.level)}</strong></div>
              <div><span>Human approval</span><strong>${decision.autonomy.approvalRequired ? 'Required for risky actions' : 'External writes denied'}</strong></div>
            </section>

            <section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">Decision evidence</span><h3>Nine topology factors</h3></div><span>${escapeHtml(decision.decisionId)}</span></div><div class="factor-grid">${decision.factors.map((factor) => this.renderFactor(factor)).join('')}</div></section>
            <section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">Complexity challenge</span><h3>Alternatives and upgrade conditions</h3></div></div><div class="alternative-list">${decision.alternatives.map((alternative) => this.renderAlternative(alternative)).join('')}</div></section>
            <section class="drawer-section"><div class="section-heading"><div><span class="eyebrow">Protocol responsibilities</span><h3>Functions, MCP, retrieval, and A2A</h3></div></div><div class="protocol-grid">${decision.protocols.map((protocol) => this.renderProtocol(protocol)).join('')}</div></section>
            <section class="drawer-section autonomy-section"><div class="section-heading"><div><span class="eyebrow">Containment</span><h3>Autonomy guidance</h3></div></div><ol>${decision.autonomy.guidance.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></section>
            <button class="primary-action" data-action="blueprint" type="button">Inspect the retained harness blueprint</button>
          ` : `<section class="empty-state"><span>A</span><h3>Agent decision is waiting</h3><p>Enter at least eight characters in the requirement composer. The advisor runs locally with no model, gateway, key, or network request.</p></section>`}
        </div>
      </section>
    `;
    this.bindActions();
  }
}

if (!customElements.get('harnesslab-agent-decision')) {
  customElements.define('harnesslab-agent-decision', HarnessLabAgentDecision);
}

document.body.appendChild(document.createElement('harnesslab-agent-decision'));
const GUIDE_URL = new URL('./guide/', import.meta.url).href;
const GUIDE_END_USER_URL = new URL('./guide/#slide-15', import.meta.url).href;
const GUIDE_DEVELOPER_URL = new URL('./guide/#slide-16', import.meta.url).href;
const GUIDE_ARCHITECTURE_URL = new URL('./guide/#slide-7', import.meta.url).href;
const CACHE_MODULE_URL = new URL('./academy/caching/', import.meta.url).href;
const STYLESHEET_URL = new URL('./learn-hub.css', import.meta.url).href;
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

class HarnessLabLearnHub extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.open = false;
    this.backgroundStates = new Map();
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    globalThis.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  disconnectedCallback() {
    globalThis.removeEventListener('keydown', this.onKeyDown);
    this.setBackgroundInert(false);
  }

  setBackgroundInert(inert) {
    const excluded = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);
    if (inert) {
      for (const element of document.body.children) {
        if (element === this || excluded.has(element.tagName) || this.backgroundStates.has(element)) continue;
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

  openPanel() {
    this.open = true;
    this.setBackgroundInert(true);
    this.render();
    queueMicrotask(() => this.shadowRoot.querySelector('[data-action="close"]')?.focus());
  }

  closePanel({ restoreFocus = true } = {}) {
    this.open = false;
    this.setBackgroundInert(false);
    this.render();
    if (restoreFocus) queueMicrotask(() => this.shadowRoot.querySelector('[data-action="open"]')?.focus());
  }

  onKeyDown(event) {
    if (!this.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = this.shadowRoot.querySelector('.learn-panel');
    const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    const active = this.shadowRoot.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  bindActions() {
    this.shadowRoot.querySelector('[data-action="open"]')?.addEventListener('click', () => this.openPanel());
    this.shadowRoot.querySelector('[data-action="close"]')?.addEventListener('click', () => this.closePanel());
    this.shadowRoot.querySelector('[data-action="backdrop"]')?.addEventListener('click', () => this.closePanel());
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${STYLESHEET_URL}">
      <button class="learn-launcher" data-action="open" type="button" aria-expanded="${this.open}" aria-controls="harnesslab-learn-panel">
        <span class="launcher-icon" aria-hidden="true">?</span>
        <span><strong>Learn HarnessLab</strong><small>Interactive architecture guide + Academy modules</small></span>
        <i aria-hidden="true">New</i>
      </button>

      <section class="learn-layer" data-open="${this.open}" aria-hidden="${!this.open}">
        <div class="learn-backdrop" data-action="backdrop"></div>
        <aside id="harnesslab-learn-panel" class="learn-panel" role="dialog" aria-modal="true" aria-labelledby="learn-title" tabindex="-1">
          <header class="learn-header">
            <div class="learn-brand"><span aria-hidden="true">H</span><div><small>HarnessLab learning hub</small><h2 id="learn-title">Understand the system before you build it</h2></div></div>
            <button class="close-button" data-action="close" type="button" aria-label="Close learning hub">×</button>
          </header>

          <section class="guide-feature">
            <div class="feature-copy">
              <span class="feature-kicker">Academy curriculum + 18-chapter guide</span>
              <h3>From AI idea to dependable harness</h3>
              <p>Learn core agent-engineering concepts in detailed modules, then use the architecture guide to connect those concepts to HarnessLab decisions and implementation.</p>
              <div class="feature-tags"><span>Plain English</span><span>Technical detail</span><span>Diagrams</span><span>Interactive labs</span></div>
            </div>
            <div class="guide-preview" aria-hidden="true">
              <article><span>M1</span><b>Caching foundations</b><i></i></article>
              <article><span>07</span><b>Decision ladder</b><i></i></article>
              <article><span>11</span><b>System architecture</b><i></i></article>
            </div>
          </section>

          <a class="primary-guide-link" href="${CACHE_MODULE_URL}">
            <span><b>Module 1 · Caching</b><small>Chat state, response caching, prompt prefixes, KV tensors, and tool caches</small></span><i aria-hidden="true">→</i>
          </a>

          <div class="learning-paths">
            <a href="${GUIDE_URL}"><span class="path-icon">G</span><div><b>Full architecture guide</b><small>Explore all 18 chapters with diagrams, keyboard navigation, fullscreen, and print.</small></div><i>→</i></a>
            <a href="${GUIDE_END_USER_URL}"><span class="path-icon">U</span><div><b>End-user path</b><small>How to describe, refine, review, and save a harness.</small></div><i>→</i></a>
            <a href="${GUIDE_DEVELOPER_URL}"><span class="path-icon">D</span><div><b>Developer path</b><small>How to translate decisions into layers, contracts, and tests.</small></div><i>→</i></a>
            <a href="${GUIDE_ARCHITECTURE_URL}"><span class="path-icon">A</span><div><b>Architecture path</b><small>Workflow vs agent vs temporary subagents vs A2A.</small></div><i>→</i></a>
          </div>

          <section class="scope-note">
            <span aria-hidden="true">✓</span>
            <div><b>Academy modules separate durable concepts from time-sensitive provider details.</b><p>Provider behavior is verified against official documentation and labeled with a verification date. No lesson receives credentials, tool authority, or model execution.</p></div>
          </section>

          <footer class="learn-footer"><span>Press <kbd>Esc</kbd> to close</span><a href="${GUIDE_URL}#slide-18">Quick start →</a></footer>
        </aside>
      </section>
    `;
    this.bindActions();
  }
}

if (!customElements.get('harnesslab-learn-hub')) {
  customElements.define('harnesslab-learn-hub', HarnessLabLearnHub);
}

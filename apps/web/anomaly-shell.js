const THEME_STORAGE_KEY = 'harnesslab.anomaly-palette.v1';

export const HARNESSLAB_PALETTES = Object.freeze([
  { id: 'midnight', label: 'Paper', group: 'Editorial', description: 'Warm editorial paper with lime and amber signals.', swatches: ['#F3E5CF', '#B9F126', '#F7BB3D'], themeColor: '#F3E5CF' },
  { id: 'slate', label: 'Ink', group: 'Editorial', description: 'Dark presentation room with aqua and amber accents.', swatches: ['#171717', '#5BC7C1', '#F7BB3D'], themeColor: '#171717' },
  { id: 'warm', label: 'Clay', group: 'Editorial', description: 'Warm clay, coral, and gold for management reviews.', swatches: ['#F2CFB1', '#DC5B51', '#F7BB3D'], themeColor: '#F2CFB1' },
  { id: 'light', label: 'Mint', group: 'Editorial', description: 'Fresh mint surfaces with lime and aqua highlights.', swatches: ['#DFF2E8', '#B9F126', '#5BC7C1'], themeColor: '#DFF2E8' },
  { id: 'verizon', label: 'Verizon', group: 'Brand-inspired', description: 'Crisp white, black, and high-impact red.', swatches: ['#FFFFFF', '#000000', '#EE0000'], themeColor: '#FFFFFF' },
  { id: 'att', label: 'AT&T', group: 'Brand-inspired', description: 'Clean white, network blue, and deep navy.', swatches: ['#FFFFFF', '#009FDB', '#0057B8'], themeColor: '#FFFFFF' },
  { id: 'tmobile', label: 'T-Mobile', group: 'Brand-inspired', description: 'Bold magenta, black, and soft white.', swatches: ['#F5F0F4', '#E20074', '#111111'], themeColor: '#F5F0F4' },
  { id: 'nvidia', label: 'NVIDIA', group: 'Brand-inspired', description: 'Technical black with vivid green signals.', swatches: ['#111111', '#76B900', '#F5F5F5'], themeColor: '#111111' },
  { id: 'meta', label: 'Meta', group: 'Brand-inspired', description: 'Bright blue, pale blue, and white.', swatches: ['#FFFFFF', '#0668E1', '#DCEBFF'], themeColor: '#FFFFFF' },
  { id: 'google', label: 'Google', group: 'Brand-inspired', description: 'White canvas with blue, red, yellow, and green cues.', swatches: ['#FFFFFF', '#4285F4', '#FABB05'], themeColor: '#FFFFFF' },
  { id: 'cfo-navy', label: 'CFO Navy', group: 'Executive', description: 'Boardroom navy with cyan and gold.', swatches: ['#071B33', '#45C6D4', '#F5B942'], themeColor: '#071B33' },
  { id: 'emerald', label: 'Emerald', group: 'Executive', description: 'Deep green, mint, and cream for performance reviews.', swatches: ['#073B32', '#29C789', '#F4F1E8'], themeColor: '#073B32' },
  { id: 'copper', label: 'Copper', group: 'Executive', description: 'Charcoal, copper, and sand for OpEx and CapEx.', swatches: ['#22201F', '#C97842', '#E8D6BD'], themeColor: '#22201F' },
  { id: 'royal', label: 'Royal', group: 'Executive', description: 'Indigo, electric violet, and pearl.', swatches: ['#17143B', '#6E56CF', '#EEEAFE'], themeColor: '#17143B' },
  { id: 'solar', label: 'Solar', group: 'Executive', description: 'Graphite with solar yellow and orange.', swatches: ['#202020', '#FFD21F', '#FF7A1A'], themeColor: '#202020' },
  { id: 'arctic', label: 'Arctic', group: 'Executive', description: 'Ice white, slate blue, and cyan.', swatches: ['#F4FAFF', '#3D5A80', '#54C7EC'], themeColor: '#F4FAFF' },
  { id: 'plum', label: 'Plum', group: 'Executive', description: 'Dark plum, orchid, and warm cream.', swatches: ['#2A1731', '#C56CF0', '#F6EBDC'], themeColor: '#2A1731' },
  { id: 'monochrome', label: 'Monochrome', group: 'Executive', description: 'Black, white, and neutral gray for printing and formal reviews.', swatches: ['#F7F7F5', '#111111', '#9A9A94'], themeColor: '#F7F7F5' }
]);

const PALETTE_GROUPS = Object.freeze(['Editorial', 'Brand-inspired', 'Executive']);
const PALETTE_IDS = new Set(HARNESSLAB_PALETTES.map((palette) => palette.id));

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readPalette() {
  const stored = safeStorage()?.getItem(THEME_STORAGE_KEY);
  return PALETTE_IDS.has(stored) ? stored : 'midnight';
}

function paletteById(id) {
  return HARNESSLAB_PALETTES.find((palette) => palette.id === id) ?? HARNESSLAB_PALETTES[0];
}

function layoutForWidth(width) {
  if (width <= 640) return 'phone';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

export function applyHarnessLabPalette(id, { persist = true } = {}) {
  const palette = paletteById(PALETTE_IDS.has(id) ? id : 'midnight');
  document.documentElement.dataset.theme = palette.id;
  document.documentElement.style.colorScheme = ['slate', 'nvidia', 'cfo-navy', 'emerald', 'copper', 'royal', 'solar', 'plum'].includes(palette.id)
    ? 'dark'
    : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.themeColor);
  if (persist) {
    try {
      safeStorage()?.setItem(THEME_STORAGE_KEY, palette.id);
    } catch {
      // Theme persistence is optional. The selected theme remains active for this session.
    }
  }
  globalThis.dispatchEvent(new CustomEvent('harnesslab:theme-change', { detail: { palette } }));
  return palette;
}

function applyLayoutMode() {
  document.documentElement.dataset.layout = layoutForWidth(globalThis.innerWidth || 1280);
}

applyHarnessLabPalette(readPalette(), { persist: false });
applyLayoutMode();
globalThis.addEventListener('resize', applyLayoutMode, { passive: true });
globalThis.addEventListener('orientationchange', applyLayoutMode, { passive: true });

class HarnessLabThemePicker extends HTMLElement {
  constructor() {
    super();
    this.onDocumentPointer = this.onDocumentPointer.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    if (this.dataset.ready === 'true') return;
    this.dataset.ready = 'true';
    this.className = 'theme-picker-menu';
    this.render();
    document.addEventListener('pointerdown', this.onDocumentPointer);
    document.addEventListener('keydown', this.onKeyDown);
    globalThis.addEventListener('harnesslab:theme-change', () => this.render(), { passive: true });
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onDocumentPointer);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onDocumentPointer(event) {
    if (!this.contains(event.target)) this.querySelector('details')?.removeAttribute('open');
  }

  onKeyDown(event) {
    if (event.key === 'Escape') this.querySelector('details')?.removeAttribute('open');
  }

  choose(id) {
    applyHarnessLabPalette(id);
    this.querySelector('details')?.removeAttribute('open');
    this.render();
  }

  render() {
    const active = paletteById(document.documentElement.dataset.theme || 'midnight');
    this.innerHTML = `
      <details>
        <summary aria-label="Current color theme: ${active.label}">
          <span class="theme-picker-copy"><small>Theme</small><strong>${active.label}</strong></span>
          <span class="palette-dots" aria-hidden="true">${active.swatches.map((color) => `<i style="background:${color}"></i>`).join('')}</span>
          <span class="theme-picker-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="theme-picker-popover" role="dialog" aria-label="Choose a HarnessLab presentation theme">
          <div class="theme-picker-heading">
            <div><strong>Choose a presentation theme</strong><span>18 palettes shared with the anomaly investigation product.</span></div>
            <button type="button" data-close aria-label="Close theme picker">×</button>
          </div>
          ${PALETTE_GROUPS.map((group) => `
            <section class="theme-group">
              <h4>${group}</h4>
              <div class="theme-grid">
                ${HARNESSLAB_PALETTES.filter((palette) => palette.group === group).map((palette) => `
                  <button type="button" data-palette="${palette.id}" class="${palette.id === active.id ? 'active' : ''}" aria-pressed="${palette.id === active.id}" title="${palette.description}">
                    <span class="palette-dots" aria-hidden="true">${palette.swatches.map((color) => `<i style="background:${color}"></i>`).join('')}</span>
                    <span><strong>${palette.label}</strong><small>${palette.description}</small></span>
                  </button>`).join('')}
              </div>
            </section>`).join('')}
          <p class="theme-trademark-note">Brand-inspired palettes use recognizable color families only. No logo, endorsement, or affiliation is implied.</p>
        </div>
      </details>`;

    this.querySelector('[data-close]')?.addEventListener('click', () => this.querySelector('details')?.removeAttribute('open'));
    this.querySelectorAll('[data-palette]').forEach((button) => {
      button.addEventListener('click', () => this.choose(button.dataset.palette));
    });
  }
}

if (!customElements.get('harnesslab-theme-picker')) {
  customElements.define('harnesslab-theme-picker', HarnessLabThemePicker);
}

function cycleMarkup() {
  return `
    <section class="development-cycle" aria-label="HarnessLab development cycle" data-stage="design">
      <div class="cycle-copy"><span>Deploy-first development cycle</span><strong>Design → Validate → Deploy → Observe → Improve</strong></div>
      <ol>
        <li data-cycle="design" class="complete"><span>01</span><strong>Design</strong><small>Requirement + harness</small></li>
        <li data-cycle="validate"><span>02</span><strong>Validate</strong><small>Contracts + critic</small></li>
        <li data-cycle="deploy" class="complete"><span>03</span><strong>Deploy</strong><small>Pages live</small></li>
        <li data-cycle="observe"><span>04</span><strong>Observe</strong><small>Trace + evidence</small></li>
        <li data-cycle="improve"><span>05</span><strong>Improve</strong><small>Next safe seam</small></li>
      </ol>
    </section>`;
}

function setCycle(stage) {
  const cycle = document.querySelector('.development-cycle');
  if (!cycle) return;
  const order = ['design', 'validate', 'deploy', 'observe', 'improve'];
  const activeIndex = Math.max(0, order.indexOf(stage));
  cycle.dataset.stage = stage;
  cycle.querySelectorAll('[data-cycle]').forEach((item) => {
    const index = order.indexOf(item.dataset.cycle);
    item.classList.toggle('complete', index < activeIndex || item.dataset.cycle === 'deploy');
    item.classList.toggle('active', index === activeIndex);
  });
}

function syncCycleFromDom() {
  if (document.querySelector('.results-section')) setCycle('validate');
  if (document.querySelector('harnesslab-critic-console')) {
    const consoleElement = document.querySelector('harnesslab-critic-console');
    const status = consoleElement?.shadowRoot?.querySelector('[data-status="completed"]');
    if (status) setCycle('observe');
  }
}

function mountShellEnhancements() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.querySelector('harnesslab-theme-picker')) {
    sidebar.appendChild(document.createElement('harnesslab-theme-picker'));
  }

  const topbar = document.querySelector('.topbar');
  if (topbar && !document.querySelector('.development-cycle')) {
    topbar.insertAdjacentHTML('afterend', cycleMarkup());
  }

  syncCycleFromDom();
}

const shellObserver = new MutationObserver(() => mountShellEnhancements());
shellObserver.observe(document.documentElement, { childList: true, subtree: true });
mountShellEnhancements();

globalThis.addEventListener('harnesslab:analysis-result', () => setCycle('validate'));
globalThis.addEventListener('harnesslab:critic-result', () => setCycle('observe'));
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('.analyze-button, .run-mini-button, .primary-cta')) setCycle('design');
  if (event.target.closest('[data-action="run"]')) setCycle('validate');
});

function visible(element) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
}

function runViewportAudit() {
  const root = document.documentElement;
  const viewportWidth = root.clientWidth;
  const pageWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
  const selectors = [
    '.nav-button', '.run-mini-button', '.primary-cta', '.ghost-cta', '.soft-button', '.save-button',
    '.mode-card', '.test-button', '.analyze-button', '.result-tabs button', '.history-row',
    '.theme-picker-menu summary', '.theme-grid button'
  ].join(',');
  const controls = [...document.querySelectorAll(selectors)].filter(visible);
  const undersized = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width < 40 || rect.height < 36;
  });
  const clipped = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left < -1 || rect.right > viewportWidth + 1;
  });
  const overflow = pageWidth > viewportWidth + 1;
  const data = document.body.dataset;
  data.uiAudit = 'complete';
  data.uiOverflow = String(overflow);
  data.uiUndersized = String(undersized.length);
  data.uiClipped = String(clipped.length);
  data.uiLayout = document.documentElement.dataset.layout || 'desktop';

  let output = document.getElementById('ui-audit-output');
  if (!output) {
    output = document.createElement('output');
    output.id = 'ui-audit-output';
    output.hidden = true;
    document.body.appendChild(output);
  }
  output.textContent = JSON.stringify({
    layout: data.uiLayout,
    viewportWidth,
    pageWidth,
    overflow,
    undersized: undersized.length,
    clipped: clipped.length,
    controls: controls.length,
    palette: document.documentElement.dataset.theme
  });
}

if (new URLSearchParams(location.search).get('ui-audit') === '1') {
  globalThis.addEventListener('load', () => globalThis.setTimeout(runViewportAudit, 1800), { once: true });
  globalThis.addEventListener('resize', () => globalThis.setTimeout(runViewportAudit, 250), { passive: true });
}

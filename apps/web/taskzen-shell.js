const DESIGN_ID = 'taskzen';
const AUDIT_QUERY = 'ui-audit';

document.documentElement.dataset.design = DESIGN_ID;

function layoutForWidth(width) {
  if (width <= 760) return 'phone';
  if (width <= 1120) return 'tablet';
  return 'desktop';
}

function applyLayout() {
  document.documentElement.dataset.layout = layoutForWidth(globalThis.innerWidth || 1280);
}

applyLayout();
globalThis.addEventListener('resize', applyLayout, { passive: true });
globalThis.addEventListener('orientationchange', applyLayout, { passive: true });

function isVisible(element) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  if (rect.width <= 0 || rect.height <= 0) return false;
  const drawer = element.closest('.sidebar');
  if (drawer && globalThis.innerWidth <= 1120 && !drawer.classList.contains('sidebar-open')) return false;
  return true;
}

function describeElement(element) {
  const label = element.getAttribute('aria-label')
    || element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80)
    || element.className
    || element.tagName;
  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    label,
    className: typeof element.className === 'string' ? element.className : '',
    x: Math.round(rect.x),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function runViewportAudit() {
  const root = document.documentElement;
  const viewportWidth = root.clientWidth;
  const pageWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
  const selectors = [
    '.nav-button',
    '.menu-button',
    '.run-mini-button',
    '.primary-cta',
    '.ghost-cta',
    '.soft-button',
    '.save-button',
    '.mode-card',
    '.test-button',
    '.analyze-button',
    '.result-tabs button',
    '.history-row',
    '.json-toolbar button'
  ].join(',');
  const controls = [...document.querySelectorAll(selectors)].filter(isVisible);
  const undersized = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    const phone = document.documentElement.dataset.layout === 'phone';
    const minimum = phone ? 40 : 36;
    return rect.width < minimum || rect.height < minimum;
  });
  const clipped = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left < -1 || rect.right > viewportWidth + 1;
  });
  const tolerance = 2;
  const overflow = pageWidth > viewportWidth + tolerance;

  document.body.dataset.uiAudit = 'complete';
  document.body.dataset.uiOverflow = String(overflow);
  document.body.dataset.uiUndersized = String(undersized.length);
  document.body.dataset.uiClipped = String(clipped.length);
  document.body.dataset.uiLayout = document.documentElement.dataset.layout || 'desktop';
  document.body.dataset.uiDesign = DESIGN_ID;

  let output = document.getElementById('ui-audit-output');
  if (!output) {
    output = document.createElement('output');
    output.id = 'ui-audit-output';
    output.hidden = true;
    document.body.appendChild(output);
  }
  output.textContent = JSON.stringify({
    design: DESIGN_ID,
    layout: document.body.dataset.uiLayout,
    viewportWidth,
    pageWidth,
    overflow,
    controls: controls.length,
    undersized: undersized.map(describeElement),
    clipped: clipped.map(describeElement)
  });
}

function markReady() {
  if (!document.querySelector('.app-shell')) return false;
  document.body.dataset.taskzenReady = 'true';
  if (new URLSearchParams(location.search).get(AUDIT_QUERY) === '1') {
    globalThis.setTimeout(runViewportAudit, 1200);
  }
  return true;
}

if (!markReady()) {
  const observer = new MutationObserver(() => {
    if (markReady()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

globalThis.addEventListener('load', () => {
  markReady();
  if (new URLSearchParams(location.search).get(AUDIT_QUERY) === '1') {
    globalThis.setTimeout(runViewportAudit, 1600);
    globalThis.addEventListener('resize', () => globalThis.setTimeout(runViewportAudit, 220), { passive: true });
  }
}, { once: true });

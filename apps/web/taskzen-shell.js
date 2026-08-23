const DESIGN_ID = 'taskzen';
const AUDIT_QUERY = 'ui-audit';
const DRAWER_BREAKPOINT = 1120;
const NAVIGATION_ID = 'harnesslab-navigation';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let drawerWasOpen = false;
let focusRestoreTarget = null;
let navigationObserver = null;
let synchronizingDrawer = false;

document.documentElement.dataset.design = DESIGN_ID;

function layoutForWidth(width) {
  if (width <= 760) return 'phone';
  if (width <= DRAWER_BREAKPOINT) return 'tablet';
  return 'desktop';
}

function isDrawerLayout() {
  return (globalThis.innerWidth || 1280) <= DRAWER_BREAKPOINT;
}

function setInert(element, inert) {
  if (!element) return;
  element.inert = inert;
  if (inert) element.setAttribute('inert', '');
  else element.removeAttribute('inert');
}

function visibleFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.closest('[inert]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity) !== 0
      && element.getClientRects().length > 0;
  });
}

function drawerElements() {
  return {
    sidebar: document.querySelector('.sidebar'),
    main: document.getElementById('main-content') || document.querySelector('.main-content'),
    menu: document.querySelector('.menu-button')
  };
}

function syncDrawerAccessibility({ manageFocus = true } = {}) {
  if (synchronizingDrawer) return false;
  synchronizingDrawer = true;

  try {
    const { sidebar, main, menu } = drawerElements();
    if (!sidebar || !main || !menu) return false;

    sidebar.id = NAVIGATION_ID;
    menu.setAttribute('aria-controls', NAVIGATION_ID);

    const drawerLayout = isDrawerLayout();
    const open = drawerLayout && sidebar.classList.contains('sidebar-open');
    menu.setAttribute('aria-expanded', String(open));

    if (!drawerLayout) {
      setInert(sidebar, false);
      setInert(main, false);
      sidebar.removeAttribute('aria-hidden');
      sidebar.removeAttribute('aria-modal');
      sidebar.removeAttribute('role');
      drawerWasOpen = false;
      focusRestoreTarget = null;
      return true;
    }

    if (open) {
      if (!drawerWasOpen) focusRestoreTarget = menu;
      setInert(sidebar, false);
      setInert(main, true);
      sidebar.removeAttribute('aria-hidden');
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');

      if (!drawerWasOpen && manageFocus) {
        globalThis.setTimeout(() => {
          const closeButton = sidebar.querySelector('.sidebar-close');
          const firstFocusable = visibleFocusableElements(sidebar)[0];
          (closeButton || firstFocusable)?.focus({ preventScroll: true });
        }, 0);
      }
    } else {
      const focusWasInsideDrawer = sidebar.contains(document.activeElement);
      setInert(sidebar, true);
      setInert(main, false);
      sidebar.setAttribute('aria-hidden', 'true');
      sidebar.removeAttribute('aria-modal');
      sidebar.removeAttribute('role');

      if ((drawerWasOpen || focusWasInsideDrawer) && manageFocus) {
        const target = focusRestoreTarget || menu;
        globalThis.setTimeout(() => target?.focus({ preventScroll: true }), 0);
      }
    }

    drawerWasOpen = open;
    return true;
  } finally {
    synchronizingDrawer = false;
  }
}

function observeNavigationDrawer() {
  const { sidebar } = drawerElements();
  if (!sidebar) return false;
  navigationObserver?.disconnect();
  navigationObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes' && mutation.attributeName === 'class')) {
      syncDrawerAccessibility();
    }
  });
  navigationObserver.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  syncDrawerAccessibility({ manageFocus: false });
  return true;
}

function handleDrawerKeyboard(event) {
  const { sidebar } = drawerElements();
  if (!sidebar || !isDrawerLayout() || !sidebar.classList.contains('sidebar-open')) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    sidebar.querySelector('.sidebar-close')?.click();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = visibleFocusableElements(sidebar);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !sidebar.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !sidebar.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', handleDrawerKeyboard);

function applyLayout() {
  document.documentElement.dataset.layout = layoutForWidth(globalThis.innerWidth || 1280);
  syncDrawerAccessibility();
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
  if (drawer && isDrawerLayout() && !drawer.classList.contains('sidebar-open')) return false;
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

function drawerAudit() {
  const { sidebar, main, menu } = drawerElements();
  if (!sidebar || !main || !menu) return null;
  const drawerLayout = isDrawerLayout();
  const open = drawerLayout && sidebar.classList.contains('sidebar-open');
  return {
    drawerLayout,
    open,
    inert: sidebar.inert,
    ariaHidden: sidebar.getAttribute('aria-hidden'),
    role: sidebar.getAttribute('role'),
    ariaModal: sidebar.getAttribute('aria-modal'),
    backgroundInert: main.inert,
    menuExpanded: menu.getAttribute('aria-expanded'),
    menuControls: menu.getAttribute('aria-controls'),
    tabbableDrawerControls: visibleFocusableElements(sidebar).length,
    activeElementClass: typeof document.activeElement?.className === 'string'
      ? document.activeElement.className
      : document.activeElement?.tagName || ''
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
    clipped: clipped.map(describeElement),
    drawer: drawerAudit()
  });
}

function markReady() {
  if (!document.querySelector('.app-shell')) return false;
  document.body.dataset.taskzenReady = 'true';
  observeNavigationDrawer();
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

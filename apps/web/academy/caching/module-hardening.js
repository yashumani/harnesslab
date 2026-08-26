const AUDIT_QUERY = 'audit';
const HARDENING_STYLESHEET = './module-hardening.css';

function loadHardeningStyles() {
  const existing = document.querySelector(`link[data-academy-hardening="true"]`);
  if (existing) return Promise.resolve(existing);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HARDENING_STYLESHEET;
  link.dataset.academyHardening = 'true';
  const ready = new Promise((resolve) => {
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => resolve(link), { once: true });
  });
  document.head.appendChild(link);
  return ready;
}

const stylesReady = loadHardeningStyles();
const auditMode = new URLSearchParams(location.search).get(AUDIT_QUERY) === '1';
let settling = false;
let settled = false;
let observer = null;

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function runSettledAudit() {
  if (!auditMode || settling || settled) return;
  settling = true;

  const earlyOutput = document.getElementById('academy-module-audit-output');
  if (earlyOutput) earlyOutput.textContent = '';
  document.body.dataset.moduleAudit = 'settling';

  await stylesReady;
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font readiness is an optimization signal, not a release dependency.
    }
  }
  await nextFrame();
  await nextFrame();
  await new Promise((resolve) => setTimeout(resolve, 180));

  settled = true;
  globalThis.HarnessLabCachingModule?.runViewportAudit?.();
  document.body.dataset.moduleHardening = 'complete';
  observer?.disconnect();
}

if (auditMode) {
  observer = new MutationObserver(() => {
    if (settled || settling) return;
    const output = document.getElementById('academy-module-audit-output');
    if (output?.textContent) runSettledAudit();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  globalThis.setTimeout(() => {
    if (!settled && globalThis.HarnessLabCachingModule) runSettledAudit();
  }, 950);
}

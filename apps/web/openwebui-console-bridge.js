const integrations = [
  {
    selector: 'harnesslab-requirement-intelligence',
    styleId: 'openwebui-mobile-readiness',
    css: `
      @media (max-width: 760px) {
        .readiness-launcher {
          top: 128px;
          right: 10px;
          bottom: auto;
          width: 46px;
          min-width: 46px;
          max-width: 46px;
          height: 46px;
          min-height: 46px;
          justify-content: center;
          gap: 0;
          padding: 0;
          border-radius: 14px;
        }
        .readiness-launcher > span:last-child { display: none !important; }
        .score-orb { width: 32px; height: 32px; }
      }
    `
  },
  {
    selector: 'harnesslab-critic-console',
    styleId: 'openwebui-mobile-critic',
    css: `
      @media (max-width: 760px) {
        .critic-launcher {
          top: 184px;
          right: 10px;
          bottom: auto;
          width: 46px;
          min-width: 46px;
          max-width: 46px;
          height: 46px;
          min-height: 46px;
          justify-content: center;
          gap: 0;
          padding: 0;
          border-radius: 14px;
        }
        .critic-launcher > span:last-child { display: none !important; }
        .launcher-orb { width: 15px; height: 15px; }
      }
    `
  }
];

const installed = new WeakSet();

function attachIntegration({ selector, styleId, css }) {
  const host = document.querySelector(selector);
  if (!host?.shadowRoot || installed.has(host)) return false;

  const inject = () => {
    if (host.shadowRoot.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    host.shadowRoot.appendChild(style);
  };

  inject();
  const observer = new MutationObserver(() => globalThis.requestAnimationFrame(inject));
  observer.observe(host.shadowRoot, { childList: true });
  installed.add(host);
  return true;
}

function synchronizeEmbeddedConsoles() {
  for (const integration of integrations) attachIntegration(integration);
}

synchronizeEmbeddedConsoles();
const documentObserver = new MutationObserver(synchronizeEmbeddedConsoles);
documentObserver.observe(document.documentElement, { childList: true, subtree: true });

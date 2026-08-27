const COPILOT_URL = new URL('./copilot/', import.meta.url).href;

const style = document.createElement('style');
style.textContent = `
  .harnesslab-copilotkit-launcher {
    position: fixed;
    top: 152px;
    right: 22px;
    z-index: 74;
    display: grid;
    grid-template-columns: 36px minmax(0,1fr) auto;
    min-width: 248px;
    min-height: 50px;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border: 1px solid rgba(99,91,255,.34);
    border-radius: 14px;
    color: #111827;
    background: rgba(255,255,255,.94);
    box-shadow: 0 18px 46px rgba(15,23,42,.14);
    backdrop-filter: blur(14px);
    text-decoration: none;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }
  .harnesslab-copilotkit-launcher:hover {
    transform: translateY(-2px);
    border-color: rgba(99,91,255,.65);
    box-shadow: 0 22px 56px rgba(15,23,42,.2);
  }
  .harnesslab-copilotkit-launcher:focus-visible { outline: 3px solid rgba(99,91,255,.34); outline-offset: 3px; }
  .harnesslab-copilotkit-launcher > span:first-child {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 10px;
    color: #fff;
    background: linear-gradient(135deg,#7c3aed,#2563eb);
    font-size: .72rem;
    font-weight: 900;
  }
  .harnesslab-copilotkit-launcher > span:nth-child(2) { display: grid; min-width: 0; }
  .harnesslab-copilotkit-launcher strong { font-size: .72rem; }
  .harnesslab-copilotkit-launcher small { margin-top: 2px; color: #667085; font-size: .55rem; }
  .harnesslab-copilotkit-launcher i { color: #635bff; font-size: .8rem; font-style: normal; }
  @media (max-width: 1024px) {
    .harnesslab-copilotkit-launcher { top: 136px; right: 14px; min-width: 214px; }
  }
  @media (max-width: 620px) {
    .harnesslab-copilotkit-launcher { top: 126px; right: 10px; grid-template-columns: 34px auto; min-width: 0; width: auto; }
    .harnesslab-copilotkit-launcher small, .harnesslab-copilotkit-launcher i { display: none; }
  }
  @media (max-width: 390px) {
    .harnesslab-copilotkit-launcher { width: 48px; grid-template-columns: 1fr; padding: 6px; }
    .harnesslab-copilotkit-launcher > span:nth-child(2) { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .harnesslab-copilotkit-launcher { transition-duration: .01ms !important; }
  }
`;
document.head.appendChild(style);

const launcher = document.createElement('a');
launcher.className = 'harnesslab-copilotkit-launcher';
launcher.href = COPILOT_URL;
launcher.setAttribute('aria-label', 'Open HarnessLab Copilot, the CopilotKit conversational harness workspace');
launcher.innerHTML = '<span>CK</span><span><strong>HarnessLab Copilot</strong><small>CopilotKit conversational workspace</small></span><i>→</i>';
document.body.appendChild(launcher);

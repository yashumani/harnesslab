import { analyzeRequirement, examples } from './engine.js';
import {
  AnalysisGatewayError,
  createAnalysisClient,
  loadRuntimeSettings,
  RuntimeModes,
  saveRuntimeSettings
} from './analysis-client.js';
import { createWorkspaceStore } from './workspace-store.js';

const ReactRuntime = globalThis.React;
const ReactDomRuntime = globalThis.ReactDOM;
const HtmRuntime = globalThis.htm;
const rootElement = document.getElementById('root');

if (!ReactRuntime || !ReactDomRuntime || !HtmRuntime) {
  rootElement.innerHTML = `
    <div class="fatal-card" role="alert">
      <strong>The React runtime could not be loaded.</strong>
      <span>Check the network connection or content-security settings, then reload HarnessLab.</span>
    </div>`;
  throw new Error('Pinned no-build React runtime was unavailable.');
}

const {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} = ReactRuntime;
const html = HtmRuntime.bind(ReactRuntime.createElement);

const MAX_REQUIREMENT_LENGTH = 1600;
const DEFAULT_REQUIREMENT = examples[0].value;
const NAV_ITEMS = [
  { id: 'mission', label: 'Mission', icon: 'spark' },
  { id: 'workspace', label: 'Workspace', icon: 'layers' },
  { id: 'runtime', label: 'Runtime', icon: 'pulse' },
  { id: 'architect', label: 'Architect', icon: 'wand' },
  { id: 'blueprint', label: 'Blueprint', icon: 'nodes' },
  { id: 'evidence', label: 'Evidence', icon: 'trace' }
];
const RESULT_TABS = [
  { id: 'blueprint', label: 'Blueprint', icon: 'nodes' },
  { id: 'agents', label: 'Temporary agents', icon: 'agents' },
  { id: 'controls', label: 'Controls', icon: 'shield' },
  { id: 'evidence', label: 'Evidence', icon: 'trace' },
  { id: 'json', label: 'Harness JSON', icon: 'code' }
];
const PHASES = [
  'Compiling the requirement',
  'Selecting the harness topology',
  'Planning bounded temporary intelligence',
  'Applying policy and evidence gates'
];

const ICONS = {
  spark: '<path d="m12 2 1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Z"/><path d="m5 15 .9 2.6L9 19l-3.1 1.4L5 23l-.9-2.6L1 19l3.1-1.4L5 15Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  wand: '<path d="m15 4 5 5L8 21l-5-5L15 4Z"/><path d="m6 14 5 5"/><path d="M6 3v3M4.5 4.5h3M19 15v4M17 17h4"/>',
  nodes: '<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="9" y="15" width="6" height="6" rx="2"/><path d="M9 6h6M6 9v3l6 3 6-3V9"/>',
  trace: '<path d="M4 5h16M4 12h10M4 19h7"/><circle cx="18" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>',
  agents: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.7-6 6-6s6 2 6 6M14 15c3.5-.5 7 1.2 7 5"/>',
  shield: '<path d="M12 3 20 6v5c0 5.2-3.3 8.5-8 10-4.7-1.5-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  save: '<path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M7 7a7 7 0 0 1 11.5 2M17 17A7 7 0 0 1 5.5 15"/>'
};

function Icon({ name, size = 18, className = '' }) {
  const markup = ICONS[name] || ICONS.spark;
  return html`<svg className=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: markup }} />`;
}

function cx(...values) {
  return values.filter(Boolean).join(' ');
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function formatTimestamp(value, { compact = false } = {}) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, compact
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' }
  ).format(date);
}

function fileSafeName(value) {
  return String(value || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace';
}

function downloadText(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function modeLabel(mode) {
  if (mode === RuntimeModes.AUTOMATIC) return 'Automatic fallback';
  if (mode === RuntimeModes.GATEWAY) return 'Gateway required';
  return 'Browser deterministic';
}

function runtimeTone(runtime) {
  if (runtime?.fallbackUsed) return 'warning';
  if (runtime?.source === 'gateway' && runtime?.provider !== 'deterministic') return 'live';
  if (runtime?.source === 'gateway') return 'connected';
  return 'local';
}

function SectionHeading({ eyebrow, title, description, action = null }) {
  return html`
    <div className="section-heading">
      <div>
        <span className="eyebrow">${eyebrow}</span>
        <h2>${title}</h2>
      </div>
      <div className="section-heading-side">
        ${description ? html`<p>${description}</p>` : null}
        ${action}
      </div>
    </div>`;
}

function StatusPill({ tone = 'neutral', children, icon = null }) {
  return html`<span className=${`status-pill status-${tone}`}>${icon ? html`<${Icon} name=${icon} size=${14} />` : null}${children}</span>`;
}

function Sidebar({ activeSection, onNavigate, mobileOpen, onClose }) {
  return html`
    <aside className=${cx('sidebar', mobileOpen && 'sidebar-open')} aria-label="HarnessLab navigation">
      <div className="sidebar-top">
        <button className="brand-button" type="button" onClick=${() => onNavigate('mission')} aria-label="HarnessLab mission control">
          <span className="brand-orbit"><span className="brand-core">H</span></span>
          <span><strong>HarnessLab</strong><small>Agent systems studio</small></span>
        </button>
        <button className="icon-button sidebar-close" type="button" onClick=${onClose} aria-label="Close navigation"><${Icon} name="close" /></button>
      </div>

      <nav className="nav-stack">
        <span className="nav-label">Command center</span>
        ${NAV_ITEMS.map((item, index) => html`
          <button key=${item.id} className=${cx('nav-button', activeSection === item.id && 'active')} type="button" onClick=${() => onNavigate(item.id)}>
            <span className="nav-index">${String(index + 1).padStart(2, '0')}</span>
            <${Icon} name=${item.icon} size=${17} />
            <span>${item.label}</span>
            <span className="nav-active-dot"></span>
          </button>`)}
      </nav>

      <div className="sidebar-system-card">
        <div className="system-card-head"><span className="live-dot"></span><strong>No-build React</strong></div>
        <p>Source files run directly on GitHub Pages. No generated bundle or browser API key.</p>
        <div className="system-micro-grid">
          <span><b>React</b> 18.3.1</span>
          <span><b>Build</b> none</span>
          <span><b>Fallback</b> ready</span>
          <span><b>Writes</b> gated</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <span>Agents are disposable.</span>
        <strong>Harnesses are durable.</strong>
      </div>
    </aside>`;
}

function Topbar({ status, onMenu, onRun, analyzing }) {
  return html`
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" type="button" onClick=${onMenu} aria-label="Open navigation"><${Icon} name="menu" /></button>
        <div className="breadcrumb"><span>HarnessLab</span><i>/</i><strong>Command center</strong></div>
      </div>
      <div className="topbar-actions">
        <${StatusPill} tone=${status.tone} icon=${status.icon}>${status.label}<//>
        <button className="run-mini-button" type="button" onClick=${onRun} disabled=${analyzing}>
          <${Icon} name=${analyzing ? 'pulse' : 'play'} size=${15} />
          ${analyzing ? 'Analyzing' : 'Run architect'}
        </button>
      </div>
    </header>`;
}

function MissionHero({ latestResult, runtimeSettings, onRun }) {
  const runtime = latestResult?.runtime;
  const agentCount = latestResult?.subagents?.length ?? 0;
  const score = latestResult?.evaluation?.overall ?? 0;
  return html`
    <section id="mission" className="mission-hero section-anchor">
      <div className="hero-grid-glow"></div>
      <div className="hero-content">
        <div className="hero-badge-row">
          <${StatusPill} tone="live" icon="spark">Deploy-first architecture studio<//>
          <${StatusPill} tone="neutral">React · no build<//>
        </div>
        <h1>Design the system that makes an agent <span>dependable.</span></h1>
        <p>Turn a raw use case into a bounded harness: architecture, temporary intelligence, permissions, protocol choices, artifacts, evidence, and failure-aware controls.</p>
        <div className="hero-actions">
          <button className="primary-cta" type="button" onClick=${onRun}><${Icon} name="wand" />Architect this use case<${Icon} name="arrow" /></button>
          <a className="ghost-cta" href="https://github.com/yashumani/harnesslab" target="_blank" rel="noreferrer"><${Icon} name="external" />Repository</a>
        </div>
      </div>
      <div className="hero-console" aria-label="Current harness status">
        <div className="console-head"><span className="window-dots"><i></i><i></i><i></i></span><span>harness://current-run</span><span className="console-online">ready</span></div>
        <div className="console-flow">
          <div className="flow-node primary"><span>01</span><strong>Requirement</strong><small>compiled</small></div>
          <div className="flow-line"><i></i></div>
          <div className="flow-node"><span>02</span><strong>Architecture</strong><small>${latestResult?.architecture?.kind || 'pending'}</small></div>
          <div className="flow-line"><i></i></div>
          <div className="flow-node accent"><span>03</span><strong>Temporary agents</strong><small>${agentCount} planned · 0 executed</small></div>
          <div className="flow-line"><i></i></div>
          <div className="flow-node success"><span>04</span><strong>Evidence gate</strong><small>${score}/100</small></div>
        </div>
        <div className="console-stats">
          <div><span>Runtime</span><strong>${runtime?.provider || modeLabel(runtimeSettings.mode)}</strong></div>
          <div><span>Source</span><strong>${runtime?.source || 'browser'}</strong></div>
          <div><span>Policy</span><strong>least privilege</strong></div>
        </div>
      </div>
    </section>`;
}

function WorkspacePanel({ snapshot, activeProject, persistenceMode, onSelect, onCreate, onExport, onRestore, latestResult, onSave }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const runs = activeProject?.runs || [];
  const latestSaved = runs.at(-1);

  function submit(event) {
    event.preventDefault();
    if (onCreate(name)) {
      setName('');
      setCreating(false);
    }
  }

  return html`
    <section id="workspace" className="content-section section-anchor">
      <${SectionHeading}
        eyebrow="Durable workspace"
        title="Projects and immutable harness versions"
        description="The current adapter stores data only in this browser. It is not encrypted cloud storage or synchronization."
      />
      <div className="workspace-layout">
        <article className="glass-panel project-panel">
          <div className="panel-topline">
            <div>
              <span className="panel-label">Active project</span>
              <select className="project-select" value=${activeProject?.id || ''} onChange=${(event) => onSelect(event.target.value)} aria-label="Active project">
                ${(snapshot?.projects || []).map((project) => html`<option key=${project.id} value=${project.id}>${project.name}</option>`)}
              </select>
            </div>
            <div className="inline-actions">
              <button className="soft-button" type="button" onClick=${() => setCreating((value) => !value)}><${Icon} name="plus" size=${15} />New</button>
              <button className="soft-button" type="button" onClick=${onExport}><${Icon} name="download" size=${15} />Backup</button>
            </div>
          </div>
          ${creating ? html`
            <form className="create-project-row" onSubmit=${submit}>
              <input value=${name} onInput=${(event) => setName(event.target.value)} minLength="2" maxLength="80" placeholder="New project name" autoFocus />
              <button type="submit">Create</button>
              <button type="button" onClick=${() => setCreating(false)}>Cancel</button>
            </form>` : null}
          <div className="project-kpis">
            <div><span>Versions</span><strong>${runs.length}</strong><small>immutable snapshots</small></div>
            <div><span>Last saved</span><strong>${latestSaved ? formatTimestamp(latestSaved.savedAt, { compact: true }) : '—'}</strong><small>${latestSaved?.runId || 'No saved run'}</small></div>
            <div><span>Persistence</span><strong>${persistenceMode === 'browser' ? 'Browser' : 'Memory'}</strong><small>${persistenceMode === 'browser' ? 'survives refresh' : 'temporary session'}</small></div>
          </div>
          <div className="storage-boundary"><${Icon} name="lock" size=${17} /><p><strong>Local boundary</strong> Do not enter API keys, credentials, production data, or secrets.</p></div>
        </article>

        <article className="glass-panel history-panel">
          <div className="panel-topline history-title-row">
            <div><span className="panel-label">Version history</span><h3>Retained harness evidence</h3></div>
            <button className="save-button" type="button" onClick=${onSave} disabled=${!latestResult}><${Icon} name="save" size=${15} />Save version</button>
          </div>
          <div className="history-list">
            ${runs.length ? [...runs].reverse().slice(0, 5).map((run) => html`
              <button key=${run.id} type="button" className="history-row" onClick=${() => onRestore(run.id)}>
                <span className="version-number">v${run.version}</span>
                <span className="history-main"><strong>${run.architecture}</strong><small>${run.requirement}</small></span>
                <span className="history-side"><b>${run.score ?? '—'}</b><small>${formatTimestamp(run.savedAt, { compact: true })}</small></span>
                <${Icon} name="chevron" size=${16} />
              </button>`)
              : html`<div className="empty-history"><span className="empty-orbit"><${Icon} name="database" /></span><strong>No saved versions yet</strong><p>Generate a harness plan, then save the first immutable project version.</p></div>`}
          </div>
        </article>
      </div>
    </section>`;
}

function RuntimePanel({ settings, gatewayDraft, setGatewayDraft, onMode, onTimeout, health, testing, onTest }) {
  const modes = [
    { id: RuntimeModes.BROWSER, label: 'Browser', detail: 'Always available', icon: 'globe' },
    { id: RuntimeModes.AUTOMATIC, label: 'Automatic', detail: 'Gateway + fallback', icon: 'refresh' },
    { id: RuntimeModes.GATEWAY, label: 'Gateway', detail: 'Required, no fallback', icon: 'pulse' }
  ];
  return html`
    <section id="runtime" className="content-section section-anchor">
      <${SectionHeading}
        eyebrow="Provider-neutral runtime"
        title="Choose how architecture guidance is produced"
        description="The browser never accepts provider credentials. Ollama and free-only OpenRouter stay behind the gateway."
      />
      <article className="glass-panel runtime-panel">
        <div className="mode-card-grid">
          ${modes.map((mode) => html`
            <button key=${mode.id} type="button" className=${cx('mode-card', settings.mode === mode.id && 'selected')} onClick=${() => onMode(mode.id)}>
              <span className="mode-icon"><${Icon} name=${mode.icon} /></span>
              <span><strong>${mode.label}</strong><small>${mode.detail}</small></span>
              <i className="mode-radio"></i>
            </button>`)}
        </div>
        <div className="gateway-config-row">
          <label>
            <span>HarnessLab gateway URL</span>
            <div className="input-with-icon"><${Icon} name="globe" size=${16} /><input value=${gatewayDraft} onInput=${(event) => setGatewayDraft(event.target.value)} type="url" spellCheck="false" aria-label="HarnessLab gateway URL" /></div>
          </label>
          <label className="timeout-field">
            <span>Timeout</span>
            <select value=${settings.timeoutMs} onChange=${(event) => onTimeout(Number(event.target.value))}>
              <option value="3000">3 seconds</option>
              <option value="5000">5 seconds</option>
              <option value="8000">8 seconds</option>
              <option value="15000">15 seconds</option>
              <option value="30000">30 seconds</option>
            </select>
          </label>
          <button className="test-button" type="button" onClick=${onTest} disabled=${testing || settings.mode === RuntimeModes.BROWSER}>
            <${Icon} name=${testing ? 'pulse' : 'check'} size=${16} />${testing ? 'Checking' : 'Test connection'}
          </button>
        </div>
        <div className=${cx('gateway-health', `health-${health.state}`)}>
          <span className="health-indicator"></span>
          <div><strong>${health.label}</strong><p>${health.message}</p></div>
          <span className="credential-boundary"><${Icon} name="lock" size=${13} />No provider keys in browser</span>
        </div>
      </article>
    </section>`;
}

function RequirementComposer({ requirement, setRequirement, analyzing, phase, onAnalyze }) {
  return html`
    <section id="architect" className="content-section section-anchor">
      <${SectionHeading}
        eyebrow="AI-assisted harness architect"
        title="Describe what the agent system must accomplish"
        description="HarnessLab decides what should stay deterministic, what needs reasoning, and when temporary specialists add real value."
      />
      <article className="composer-panel">
        <div className="composer-glow"></div>
        <div className="composer-top">
          <div className="composer-mode"><span className="ai-glyph"><${Icon} name="spark" /></span><div><strong>Requirement intake</strong><small>Natural language → typed harness contract</small></div></div>
          <span className="character-count">${requirement.length}/${MAX_REQUIREMENT_LENGTH}</span>
        </div>
        <textarea value=${requirement} onInput=${(event) => setRequirement(event.target.value)} maxLength=${MAX_REQUIREMENT_LENGTH} minLength="8" rows="7" placeholder="Build an agent that investigates KPI anomalies, validates data quality, queries approved systems, and returns an evidence-backed root-cause report…" aria-label="Agent system requirement"></textarea>
        <div className="example-strip">
          <span>Try a scenario</span>
          <div>${examples.map((example) => html`<button key=${example.label} type="button" onClick=${() => setRequirement(example.value)}>${example.label}</button>`)}</div>
        </div>
        <div className="composer-footer">
          <div className="composer-assurances"><span><${Icon} name="shield" size=${14} />Policy gated</span><span><${Icon} name="trace" size=${14} />Fully traced</span><span><${Icon} name="agents" size=${14} />Adaptive subagents</span></div>
          <button className="analyze-button" type="button" onClick=${onAnalyze} disabled=${analyzing || requirement.trim().length < 8}>
            ${analyzing ? html`<span className="spinner"></span><span>${PHASES[phase]}…</span>` : html`<${Icon} name="wand" /><span>Generate harness blueprint</span><${Icon} name="arrow" />`}
          </button>
        </div>
      </article>
    </section>`;
}

function MetricCard({ label, value, suffix = '', detail, tone = 'cyan', icon }) {
  return html`
    <article className=${`metric-card tone-${tone}`}>
      <span className="metric-icon"><${Icon} name=${icon} size=${18} /></span>
      <div><span>${label}</span><strong>${value}<small>${suffix}</small></strong><p>${detail}</p></div>
      <i></i>
    </article>`;
}

function ArchitectureGraph({ result }) {
  const subagentCount = result.subagents?.length || 0;
  const nodes = [
    { label: 'Request gateway', meta: 'validate', tone: 'base', icon: 'shield' },
    { label: 'Requirement compiler', meta: 'structure', tone: 'cyan', icon: 'wand' },
    { label: 'Architecture decision', meta: result.architecture.kind, tone: 'violet', icon: 'nodes' },
    { label: subagentCount ? 'Temporary agent pool' : 'Direct reasoning', meta: subagentCount ? `${subagentCount} planned · 0 executed` : 'no swarm needed', tone: 'amber', icon: 'agents' },
    { label: 'Artifact judge', meta: 'schema + evidence', tone: 'blue', icon: 'trace' },
    { label: 'Policy gate', meta: 'least privilege', tone: 'green', icon: 'shield' },
    { label: 'Result synthesizer', meta: 'validated output', tone: 'cyan', icon: 'spark' }
  ];
  return html`
    <div className="architecture-map">
      <div className="map-rail"></div>
      ${nodes.map((node, index) => html`
        <${Fragment} key=${node.label}>
          <article className=${`architecture-node node-${node.tone}`}>
            <span className="node-number">${String(index + 1).padStart(2, '0')}</span>
            <span className="node-icon"><${Icon} name=${node.icon} size=${17} /></span>
            <div><strong>${node.label}</strong><small>${node.meta}</small></div>
          </article>
          ${index < nodes.length - 1 ? html`<span className="node-connector"><i></i><${Icon} name="arrow" size=${13} /></span>` : null}
        <//>`)}
    </div>`;
}

function ProtocolCards({ protocols = [] }) {
  return html`
    <div className="protocol-card-grid">
      ${protocols.map((protocol) => {
        const decision = protocol.decision.toLowerCase();
        const tone = decision.includes('recommend') || decision.includes('start') ? 'positive' : decision.includes('not') ? 'muted' : 'optional';
        return html`
          <article key=${protocol.name} className=${`protocol-card protocol-${tone}`}>
            <div><span>${protocol.name.includes('A2A') ? 'A2A' : protocol.name.includes('MCP') ? 'MCP' : protocol.name.includes('Retrieval') ? 'RAG' : 'FN'}</span><${StatusPill} tone=${tone === 'positive' ? 'connected' : tone === 'muted' ? 'neutral' : 'warning'}>${protocol.decision}<//></div>
            <h4>${protocol.name}</h4>
            <p>${protocol.rationale}</p>
          </article>`;
      })}
    </div>`;
}

function BlueprintView({ result }) {
  return html`
    <div className="tab-content blueprint-view">
      <article className="result-panel architecture-decision-card">
        <div className="decision-top">
          <div><span className="panel-label">Recommended topology</span><h3>${result.architecture.kind}</h3></div>
          <${StatusPill} tone="connected" icon="check">Validated plan<//>
        </div>
        <p>${result.architecture.reason}</p>
        <div className="recommendation-callout"><${Icon} name="spark" /><div><span>Architect recommendation</span><strong>${result.recommendation}</strong></div></div>
      </article>
      <article className="result-panel map-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Durable execution graph</span><h3>Harness stages remain stable while models change</h3></div><span className="planned-label">PLAN · NOT EXECUTION</span></div>
        <${ArchitectureGraph} result=${result} />
      </article>
      <article className="result-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Protocol advisor</span><h3>Use protocols only where boundaries require them</h3></div></div>
        <${ProtocolCards} protocols=${result.protocols} />
      </article>
      <article className="result-panel stage-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Stage contract</span><h3>${result.stages.length} controlled stages</h3></div></div>
        <div className="stage-grid">
          ${result.stages.map((stage, index) => html`
            <article key=${stage.name} className="stage-item"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${stage.name}</strong><p>${stage.purpose}</p><small>${stage.mode}</small></div></article>`)}
        </div>
      </article>
    </div>`;
}

function AgentsView({ result }) {
  const agents = result.subagents || [];
  return html`
    <div className="tab-content agents-view">
      <div className="execution-boundary-banner"><${Icon} name="alert" /><div><strong>Temporary agents are planned, not executed, in this visual slice.</strong><p>The cards define the future worker contract: minimum context, read-only tools, timeout, no child spawning, and one structured artifact.</p></div><${StatusPill} tone="warning">0 live workers<//></div>
      ${agents.length ? html`
        <div className="agent-card-grid">
          ${agents.map((agent, index) => html`
            <article key=${agent.id} className="agent-card">
              <div className="agent-card-head"><span className="agent-avatar">${String(index + 1).padStart(2, '0')}</span><div><span>${agent.id}</span><h3>${agent.role}</h3></div><${StatusPill} tone="neutral">planned<//></div>
              <p className="agent-objective">${agent.objective}</p>
              <dl>
                <div><dt>Context envelope</dt><dd>${agent.context}</dd></div>
                <div><dt>Tool boundary</dt><dd>${agent.tools.join(', ')}</dd></div>
                <div><dt>Permission</dt><dd>${agent.permissions}</dd></div>
                <div><dt>Return artifact</dt><dd><code>${agent.returnArtifact}</code></dd></div>
              </dl>
              <div className="agent-footer"><span><${Icon} name="clock" size=${14} />${agent.timeoutSeconds}s timeout</span><span><${Icon} name="shield" size=${14} />Depth 1</span><span><${Icon} name="lock" size=${14} />No child agents</span></div>
            </article>`)}
        </div>` : html`
        <div className="no-agents-card"><span><${Icon} name="agents" /></span><strong>No temporary subagents recommended</strong><p>The expected accuracy or speed benefit does not justify additional orchestration for this requirement.</p></div>`}
      <article className="result-panel lifecycle-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Lifecycle contract</span><h3>Spawn → isolate → validate → dispose</h3></div></div>
        <div className="lifecycle-flow">
          ${['Bounded task', 'Minimum context', 'Restricted tools', 'Structured return', 'Artifact validation', 'Worker disposal'].map((item, index) => html`<div key=${item}><span>${index + 1}</span><strong>${item}</strong>${index < 5 ? html`<i></i>` : null}</div>`)}
        </div>
      </article>
    </div>`;
}

function ControlsView({ result }) {
  return html`
    <div className="tab-content controls-view">
      <article className="result-panel permission-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Capability-by-capability autonomy</span><h3>Permission matrix</h3></div><${StatusPill} tone="connected" icon="shield">Least privilege<//></div>
        <div className="permission-table" role="table" aria-label="Harness permission matrix">
          <div className="permission-row permission-header" role="row"><span>Capability</span><span>Policy</span><span>Enforcement</span></div>
          ${result.permissions.map((permission) => {
            const normalized = permission.policy.toLowerCase();
            const tone = normalized.includes('deny') ? 'denied' : normalized.includes('approval') ? 'approval' : normalized.includes('allow') ? 'allowed' : 'neutral';
            return html`<div key=${permission.capability} className="permission-row" role="row"><strong>${permission.capability}</strong><span className=${`permission-badge permission-${tone}`}>${permission.policy}</span><p>${permission.enforcement}</p></div>`;
          })}
        </div>
      </article>
      <article className="result-panel constraint-card">
        <div className="result-panel-heading"><div><span className="panel-label">Non-negotiable boundaries</span><h3>Safe defaults applied before execution</h3></div></div>
        <div className="constraint-grid">
          ${result.constraints.map((constraint, index) => html`<div key=${constraint}><span>${index + 1}</span><p>${constraint}</p></div>`)}
        </div>
      </article>
    </div>`;
}

function EvaluationRing({ score }) {
  return html`<div className="evaluation-ring" style=${{ '--score': `${score * 3.6}deg` }}><div><strong>${score}</strong><span>/100</span></div></div>`;
}

function EvidenceView({ result }) {
  return html`
    <div className="tab-content evidence-view" id="evidence">
      <div className="evidence-layout">
        <article className="result-panel trace-panel">
          <div className="result-panel-heading"><div><span className="panel-label">Execution trace</span><h3>Every decision leaves evidence</h3></div><${StatusPill} tone="connected">${result.trace.length} events<//></div>
          <div className="trace-timeline">
            ${result.trace.map((entry) => html`
              <div key=${`${entry.sequence}-${entry.event}`} className="trace-entry">
                <div className="trace-axis"><span>${String(entry.sequence).padStart(2, '0')}</span><i></i></div>
                <div className="trace-copy"><div><strong>${entry.event}</strong><small>${entry.offset}</small></div><p>${entry.detail}</p></div>
                <span className="trace-complete"><${Icon} name="check" size=${13} />${entry.status}</span>
              </div>`)}
          </div>
        </article>
        <article className="result-panel evaluation-card">
          <${EvaluationRing} score=${result.evaluation.overall} />
          <span className="panel-label">Evaluation verdict</span>
          <h3>${result.evaluation.verdict}</h3>
          <div className="evaluation-bars">
            ${result.evaluation.dimensions.map((dimension) => html`
              <div key=${dimension.name}><div><span>${dimension.name}</span><strong>${dimension.score}%</strong></div><span className="score-track"><i style=${{ width: `${dimension.score}%` }}></i></span></div>`)}
          </div>
        </article>
      </div>
      <article className="result-panel artifact-panel">
        <div className="result-panel-heading"><div><span className="panel-label">Artifact blackboard</span><h3>Knowledge retained after agents disappear</h3></div></div>
        <div className="artifact-grid">
          ${result.artifacts.map((artifact) => html`
            <article key=${artifact.id} className="artifact-card"><span className="artifact-symbol">${artifact.type.slice(0, 2).toUpperCase()}</span><div><strong>${artifact.type}</strong><code>${artifact.id}</code></div><${StatusPill} tone=${artifact.status.toLowerCase().includes('planned') ? 'warning' : 'connected'}>${artifact.status}<//></article>`)}
        </div>
      </article>
    </div>`;
}

function JsonView({ result, onCopy, onDownload }) {
  return html`
    <div className="tab-content json-view">
      <article className="result-panel json-card">
        <div className="json-toolbar"><div><span className="panel-label">Portable harness artifact</span><h3>Validated HarnessResult JSON</h3></div><div><button type="button" onClick=${onCopy}><${Icon} name="copy" size=${15} />Copy</button><button type="button" onClick=${onDownload}><${Icon} name="download" size=${15} />Download</button></div></div>
        <pre><code>${JSON.stringify(result, null, 2)}</code></pre>
      </article>
    </div>`;
}

function ResultsCommandCenter({ result, selectedTab, setSelectedTab, onCopy, onDownload }) {
  if (!result) return null;
  const runtime = result.runtime || { source: 'browser', provider: 'deterministic', model: null, latencyMs: 0, fallbackUsed: false };
  const complexityTone = result.scores.complexity >= 75 ? 'violet' : result.scores.complexity >= 50 ? 'amber' : 'cyan';
  const riskTone = result.scores.risk >= 65 ? 'rose' : result.scores.risk >= 40 ? 'amber' : 'green';

  return html`
    <section id="blueprint" className="results-section section-anchor">
      <div className="results-heading">
        <div><span className="eyebrow">Generated harness blueprint</span><h2>A planning contract with controls, evidence, and provenance.</h2></div>
        <div className="run-identifiers"><${StatusPill} tone=${runtimeTone(runtime)} icon=${runtime.source === 'gateway' ? 'pulse' : 'globe'}>${runtime.source} · ${runtime.provider}<//><code>${result.runId}</code></div>
      </div>

      <div className="metric-grid">
        <${MetricCard} label="Complexity" value=${result.scores.complexity} suffix="/100" detail=${result.architecture.kind} tone=${complexityTone} icon="nodes" />
        <${MetricCard} label="Risk signal" value=${result.scores.risk} suffix="/100" detail="Policy boundaries applied" tone=${riskTone} icon="shield" />
        <${MetricCard} label="Plan confidence" value=${result.scores.confidence} suffix="%" detail=${`${result.unresolvedQuestions.length} unresolved questions`} tone="green" icon="check" />
        <${MetricCard} label="Temporary agents" value=${result.subagents.length} detail="Planned · not executed" tone="blue" icon="agents" />
      </div>

      <article className="provenance-strip">
        <div><span>Source</span><strong>${runtime.source}</strong></div>
        <div><span>Provider</span><strong>${runtime.provider}</strong></div>
        <div><span>Model</span><strong>${runtime.model || 'none'}</strong></div>
        <div><span>Latency</span><strong>${Number.isFinite(runtime.latencyMs) ? `${runtime.latencyMs} ms` : 'n/a'}</strong></div>
        <div><span>Fallback</span><strong>${runtime.fallbackUsed ? runtime.fallbackReason || 'used' : 'not used'}</strong></div>
        <div><span>Domain</span><strong>${result.domain}</strong></div>
      </article>

      <div className="result-tabs" role="tablist" aria-label="Harness result views">
        ${RESULT_TABS.map((tab) => html`<button key=${tab.id} role="tab" aria-selected=${selectedTab === tab.id} className=${selectedTab === tab.id ? 'active' : ''} type="button" onClick=${() => setSelectedTab(tab.id)}><${Icon} name=${tab.icon} size=${16} />${tab.label}</button>`)}
      </div>

      ${selectedTab === 'blueprint' ? html`<${BlueprintView} result=${result} />` : null}
      ${selectedTab === 'agents' ? html`<${AgentsView} result=${result} />` : null}
      ${selectedTab === 'controls' ? html`<${ControlsView} result=${result} />` : null}
      ${selectedTab === 'evidence' ? html`<${EvidenceView} result=${result} />` : null}
      ${selectedTab === 'json' ? html`<${JsonView} result=${result} onCopy=${onCopy} onDownload=${onDownload} />` : null}
    </section>`;
}

function Toast({ toast }) {
  if (!toast) return null;
  return html`<div className=${`toast toast-${toast.tone}`} role="status" aria-live="polite"><span><${Icon} name=${toast.tone === 'error' ? 'alert' : toast.tone === 'warning' ? 'alert' : 'check'} /></span><div><strong>${toast.title}</strong><p>${toast.message}</p></div></div>`;
}

function App() {
  const storage = useMemo(() => getBrowserStorage(), []);
  const workspaceStore = useMemo(() => createWorkspaceStore({ storage }), [storage]);
  const analysisClient = useMemo(() => createAnalysisClient({ fallbackAnalyze: analyzeRequirement }), []);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [requirement, setRequirement] = useState(DEFAULT_REQUIREMENT);
  const [latestResult, setLatestResult] = useState(null);
  const [runtimeSettings, setRuntimeSettings] = useState(() => loadRuntimeSettings(storage));
  const [gatewayDraft, setGatewayDraft] = useState(() => loadRuntimeSettings(storage).gatewayUrl);
  const [health, setHealth] = useState({ state: 'neutral', label: 'Browser runtime ready', message: 'Use browser mode without any server, account, API key, or model download.' });
  const [testingGateway, setTestingGateway] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [selectedTab, setSelectedTab] = useState('blueprint');
  const [activeSection, setActiveSection] = useState('mission');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const snapshot = useMemo(() => workspaceStore.getSnapshot(), [workspaceStore, workspaceRevision]);
  const activeProject = useMemo(() => workspaceStore.getActiveProject(), [workspaceStore, workspaceRevision]);
  const persistenceMode = workspaceStore.getPersistenceMode();

  const notify = useCallback((title, message, tone = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ title, message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const persistRuntime = useCallback((patch) => {
    const next = saveRuntimeSettings(storage, { ...runtimeSettings, ...patch, gatewayUrl: patch.gatewayUrl ?? gatewayDraft });
    setRuntimeSettings(next);
    setGatewayDraft(next.gatewayUrl);
    return next;
  }, [gatewayDraft, runtimeSettings, storage]);

  const navigate = useCallback((sectionId) => {
    setActiveSection(sectionId);
    setMobileOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const runAnalysis = useCallback(async () => {
    const trimmed = requirement.trim();
    if (trimmed.length < 8) {
      notify('Requirement needs detail', 'Describe the use case in at least eight characters.', 'error');
      return;
    }
    setAnalyzing(true);
    setPhase(0);
    const phaseTimer = window.setInterval(() => setPhase((current) => Math.min(current + 1, PHASES.length - 1)), 250);
    try {
      const settings = persistRuntime({});
      const [result] = await Promise.all([
        analysisClient.analyze(trimmed, settings),
        sleep(900)
      ]);
      setLatestResult(result);
      setSelectedTab('blueprint');
      notify(
        result.runtime?.fallbackUsed ? 'Fallback recorded' : 'Harness blueprint ready',
        result.runtime?.fallbackUsed
          ? 'The gateway was unavailable, so HarnessLab used and traced deterministic browser analysis.'
          : `${result.architecture.kind} selected with ${result.subagents.length} temporary agents planned.`,
        result.runtime?.fallbackUsed ? 'warning' : 'success'
      );
      window.setTimeout(() => navigate('blueprint'), 60);
    } catch (error) {
      const message = error instanceof AnalysisGatewayError || error instanceof Error
        ? error.message
        : 'The harness analysis could not be completed.';
      notify('Analysis failed', message, 'error');
    } finally {
      window.clearInterval(phaseTimer);
      setAnalyzing(false);
      setPhase(0);
    }
  }, [analysisClient, navigate, notify, persistRuntime, requirement]);

  useEffect(() => {
    let current = true;
    analysisClient.analyze(DEFAULT_REQUIREMENT, {
      ...runtimeSettings,
      mode: RuntimeModes.BROWSER
    }).then((result) => {
      if (current) setLatestResult(result);
    }).catch((error) => {
      console.error('Initial HarnessLab analysis failed.', error);
    });
    return () => {
      current = false;
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  function handleMode(mode) {
    try {
      const next = persistRuntime({ mode });
      setHealth(mode === RuntimeModes.BROWSER
        ? { state: 'ready', label: 'Browser runtime ready', message: 'No network request will be made for analysis.' }
        : { state: 'neutral', label: 'Gateway not checked', message: `Test ${next.gatewayUrl} before relying on gateway analysis.` });
    } catch (error) {
      notify('Runtime setting rejected', error.message, 'error');
    }
  }

  function handleTimeout(timeoutMs) {
    try {
      persistRuntime({ timeoutMs });
    } catch (error) {
      notify('Timeout rejected', error.message, 'error');
    }
  }

  async function testGateway() {
    setTestingGateway(true);
    setHealth({ state: 'checking', label: 'Checking gateway', message: 'Validating HarnessLab identity and provider availability…' });
    try {
      const settings = persistRuntime({ gatewayUrl: gatewayDraft });
      const result = await analysisClient.checkHealth(settings);
      const available = result.provider.available;
      setHealth({
        state: available ? 'ready' : 'degraded',
        label: available ? `${result.provider.name} ready` : `${result.provider.name} degraded`,
        message: `${result.gatewayUrl} · ${result.provider.model || 'no model'} · ${result.provider.liveModel ? 'live model provider' : 'deterministic provider'}`
      });
      notify(available ? 'Gateway connected' : 'Gateway responded with limits', available ? 'The provider is available for validated harness analysis.' : 'The gateway is compatible, but its selected provider is unavailable.', available ? 'success' : 'warning');
    } catch (error) {
      setHealth({ state: 'error', label: 'Gateway unavailable', message: error.message });
      notify('Gateway check failed', error.message, 'error');
    } finally {
      setTestingGateway(false);
    }
  }

  function createProject(name) {
    try {
      const project = workspaceStore.createProject(name);
      setWorkspaceRevision((value) => value + 1);
      notify('Project created', `${project.name} is ready for its first harness version.`);
      return true;
    } catch (error) {
      notify('Project not created', error.message, 'error');
      return false;
    }
  }

  function selectProject(projectId) {
    try {
      const project = workspaceStore.selectProject(projectId);
      setWorkspaceRevision((value) => value + 1);
      const latest = project.runs.at(-1);
      if (latest) {
        setRequirement(latest.requirement);
        setLatestResult(clone(latest.result));
        notify('Project opened', `${project.name} restored at version ${latest.version}.`);
      } else {
        notify('Project opened', `${project.name} has no saved versions yet.`);
      }
    } catch (error) {
      notify('Project not opened', error.message, 'error');
    }
  }

  function saveVersion() {
    if (!latestResult) return;
    try {
      const run = workspaceStore.saveRun(latestResult, { requirement });
      setWorkspaceRevision((value) => value + 1);
      notify('Immutable version saved', `${run.runId} is now version ${run.version} in ${activeProject.name}.`);
    } catch (error) {
      notify('Version not saved', error.message, 'error');
    }
  }

  function restoreRun(runId) {
    const run = workspaceStore.getRun(activeProject.id, runId);
    if (!run) {
      notify('Saved version unavailable', 'The selected version could not be found.', 'error');
      return;
    }
    setRequirement(run.requirement);
    setLatestResult(clone(run.result));
    setSelectedTab('blueprint');
    notify('Version restored', `${activeProject.name} version ${run.version} is open in the command center.`);
    window.setTimeout(() => navigate('blueprint'), 50);
  }

  function exportWorkspace() {
    try {
      const content = workspaceStore.exportWorkspace();
      downloadText(`harnesslab-${fileSafeName(activeProject.name)}-workspace.json`, content);
      notify('Workspace exported', 'The backup contains project requirements and harness artifacts; handle it as a private file.');
    } catch (error) {
      notify('Export failed', error.message, 'error');
    }
  }

  async function copyJson() {
    if (!latestResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
      notify('Harness JSON copied', 'The validated artifact is now on the clipboard.');
    } catch {
      notify('Clipboard unavailable', 'Use the download action to save the harness artifact instead.', 'warning');
    }
  }

  function downloadJson() {
    if (!latestResult) return;
    downloadText(`${latestResult.runId.toLowerCase()}-harness.json`, JSON.stringify(latestResult, null, 2));
    notify('Harness downloaded', 'The JSON artifact includes runtime provenance, controls, trace, and evaluation evidence.');
  }

  const topbarStatus = analyzing
    ? { tone: 'active', icon: 'pulse', label: PHASES[phase] }
    : latestResult?.runtime?.fallbackUsed
      ? { tone: 'warning', icon: 'alert', label: 'Fallback recorded' }
      : latestResult?.runtime?.source === 'gateway'
        ? { tone: 'live', icon: 'pulse', label: `${latestResult.runtime.provider} gateway` }
        : { tone: 'connected', icon: 'check', label: 'Browser runtime ready' };

  return html`
    <div className="app-shell">
      <${Sidebar} activeSection=${activeSection} onNavigate=${navigate} mobileOpen=${mobileOpen} onClose=${() => setMobileOpen(false)} />
      <div className="mobile-overlay" data-open=${mobileOpen ? 'true' : 'false'} onClick=${() => setMobileOpen(false)}></div>
      <main id="main-content" className="main-content">
        <${Topbar} status=${topbarStatus} onMenu=${() => setMobileOpen(true)} onRun=${runAnalysis} analyzing=${analyzing} />
        <${MissionHero} latestResult=${latestResult} runtimeSettings=${runtimeSettings} onRun=${() => navigate('architect')} />
        <${WorkspacePanel}
          snapshot=${snapshot}
          activeProject=${activeProject}
          persistenceMode=${persistenceMode}
          onSelect=${selectProject}
          onCreate=${createProject}
          onExport=${exportWorkspace}
          onRestore=${restoreRun}
          latestResult=${latestResult}
          onSave=${saveVersion}
        />
        <${RuntimePanel}
          settings=${runtimeSettings}
          gatewayDraft=${gatewayDraft}
          setGatewayDraft=${setGatewayDraft}
          onMode=${handleMode}
          onTimeout=${handleTimeout}
          health=${health}
          testing=${testingGateway}
          onTest=${testGateway}
        />
        <${RequirementComposer}
          requirement=${requirement}
          setRequirement=${setRequirement}
          analyzing=${analyzing}
          phase=${phase}
          onAnalyze=${runAnalysis}
        />
        <${ResultsCommandCenter}
          result=${latestResult}
          selectedTab=${selectedTab}
          setSelectedTab=${setSelectedTab}
          onCopy=${copyJson}
          onDownload=${downloadJson}
        />
        <footer className="site-footer"><div><span className="footer-mark">H</span><div><strong>HarnessLab</strong><small>Deploy first. Replace seams safely. Keep the harness durable.</small></div></div><div><span>React 18 · HTM · zero build</span><a href="https://github.com/yashumani/harnesslab" target="_blank" rel="noreferrer">Source <${Icon} name="external" size=${13} /></a></div></footer>
      </main>
      <${Toast} toast=${toast} />
    </div>`;
}

ReactDomRuntime.createRoot(rootElement).render(html`<${App} />`);

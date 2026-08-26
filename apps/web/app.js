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
const PHASES = [
  'Reading the requirement',
  'Checking readiness and contradictions',
  'Selecting the harness topology',
  'Planning bounded temporary intelligence',
  'Applying policy and evidence gates'
];
const MAIN_VIEWS = Object.freeze({
  CHAT: 'chat',
  PROJECTS: 'projects',
  RUNTIME: 'runtime',
  EVIDENCE: 'evidence'
});
const RESULT_TABS = [
  { id: 'blueprint', label: 'Blueprint', icon: 'nodes' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'controls', label: 'Controls', icon: 'shield' },
  { id: 'evidence', label: 'Evidence', icon: 'trace' },
  { id: 'json', label: 'JSON', icon: 'code' }
];

const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chat: '<path d="M5 5h14v10H9l-4 4V5Z"/>',
  folder: '<path d="M3 6h7l2 2h9v10H3V6Z"/>',
  pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  trace: '<path d="M4 5h16M4 12h10M4 19h7"/><circle cx="18" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>',
  nodes: '<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="9" y="15" width="6" height="6" rx="2"/><path d="M9 6h6M6 9v3l6 3 6-3V9"/>',
  agents: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.7-6 6-6s6 2 6 6M14 15c3.5-.5 7 1.2 7 5"/>',
  shield: '<path d="M12 3 20 6v5c0 5.2-3.3 8.5-8 10-4.7-1.5-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
  spark: '<path d="m12 2 1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Z"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
  save: '<path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M7 7a7 7 0 0 1 11.5 2M17 17A7 7 0 0 1 5.5 15"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};

function Icon({ name, size = 18, className = '' }) {
  return html`<svg className=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[name] || ICONS.spark }} />`;
}

function cx(...values) {
  return values.filter(Boolean).join(' ');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function fileSafeName(value) {
  return String(value || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace';
}

function formatTimestamp(value, compact = false) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, compact
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' }
  ).format(date);
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

function runtimeLabel(mode) {
  if (mode === RuntimeModes.AUTOMATIC) return 'Automatic';
  if (mode === RuntimeModes.GATEWAY) return 'Gateway';
  return 'Browser';
}

function Badge({ tone = 'neutral', icon = null, children }) {
  return html`<span className=${`owui-badge badge-${tone}`}>${icon ? html`<${Icon} name=${icon} size=${13} />` : null}${children}</span>`;
}

function EmptyNotice({ icon = 'spark', title, description, action = null }) {
  return html`
    <div className="owui-empty-notice">
      <span className="owui-empty-icon"><${Icon} name=${icon} size=${22} /></span>
      <strong>${title}</strong>
      <p>${description}</p>
      ${action}
    </div>`;
}

function Sidebar({
  snapshot,
  activeProject,
  activeView,
  mobileOpen,
  onClose,
  onNavigate,
  onNewHarness,
  onSelectProject,
  onCreateProject,
  onRestoreRun
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const projects = (snapshot?.projects || []).filter((project) => !normalizedSearch || project.name.toLowerCase().includes(normalizedSearch));
  const recentRuns = (snapshot?.projects || [])
    .flatMap((project) => project.runs.map((run) => ({ ...run, projectId: project.id, projectName: project.name })))
    .filter((run) => !normalizedSearch || `${run.requirement} ${run.architecture} ${run.projectName}`.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)))
    .slice(0, 8);

  function create(event) {
    event.preventDefault();
    if (onCreateProject(projectName)) {
      setProjectName('');
      setCreating(false);
    }
  }

  return html`
    <aside className=${cx('sidebar', 'owui-sidebar', mobileOpen && 'sidebar-open')} aria-label="HarnessLab workspace navigation">
      <div className="owui-sidebar-header">
        <button className="owui-brand" type="button" onClick=${() => onNavigate(MAIN_VIEWS.CHAT)} aria-label="Open HarnessLab chat workspace">
          <span className="owui-logo">H</span>
          <span><strong>HarnessLab</strong><small>Agent harness workspace</small></span>
        </button>
        <button className="owui-icon-button sidebar-close" type="button" onClick=${onClose} aria-label="Close navigation"><${Icon} name="close" /></button>
      </div>

      <button className="owui-new-button primary-cta" type="button" onClick=${onNewHarness}>
        <${Icon} name="plus" size=${17} />
        <span>New harness</span>
        <kbd>⌘ K</kbd>
      </button>

      <label className="owui-search">
        <${Icon} name="search" size=${15} />
        <input value=${search} onInput=${(event) => setSearch(event.target.value)} placeholder="Search projects and runs" aria-label="Search projects and runs" />
      </label>

      <nav className="nav-stack owui-main-nav" aria-label="Workspace views">
        <button className=${cx('nav-button', activeView === MAIN_VIEWS.CHAT && 'active')} type="button" onClick=${() => onNavigate(MAIN_VIEWS.CHAT)}><${Icon} name="chat" /><span>Harness chat</span></button>
        <button className=${cx('nav-button', activeView === MAIN_VIEWS.PROJECTS && 'active')} type="button" onClick=${() => onNavigate(MAIN_VIEWS.PROJECTS)}><${Icon} name="folder" /><span>Projects</span><b>${snapshot?.projects?.length || 0}</b></button>
        <button className=${cx('nav-button', activeView === MAIN_VIEWS.RUNTIME && 'active')} type="button" onClick=${() => onNavigate(MAIN_VIEWS.RUNTIME)}><${Icon} name="pulse" /><span>Runtime</span></button>
        <button className=${cx('nav-button', activeView === MAIN_VIEWS.EVIDENCE && 'active')} type="button" onClick=${() => onNavigate(MAIN_VIEWS.EVIDENCE)}><${Icon} name="trace" /><span>Evidence</span></button>
      </nav>

      <div className="owui-sidebar-scroll">
        <section className="owui-sidebar-section">
          <div className="owui-sidebar-section-title"><span>Projects</span><button type="button" onClick=${() => setCreating((value) => !value)} aria-label="Create project"><${Icon} name="plus" size=${14} /></button></div>
          ${creating ? html`
            <form className="owui-create-project" onSubmit=${create}>
              <input value=${projectName} onInput=${(event) => setProjectName(event.target.value)} minLength="2" maxLength="80" placeholder="Project name" autoFocus />
              <button type="submit">Create</button>
            </form>` : null}
          <div className="owui-project-list">
            ${projects.map((project) => html`
              <button key=${project.id} className=${cx('owui-project-row', project.id === activeProject?.id && 'active')} type="button" onClick=${() => onSelectProject(project.id)}>
                <span className="project-avatar">${project.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>${project.name}</strong><small>${project.runs.length} saved version${project.runs.length === 1 ? '' : 's'}</small></span>
                <${Icon} name="more" size=${15} />
              </button>`)}
          </div>
        </section>

        <section className="owui-sidebar-section">
          <div className="owui-sidebar-section-title"><span>Recent harnesses</span></div>
          <div className="owui-run-list">
            ${recentRuns.length ? recentRuns.map((run) => html`
              <button key=${run.id} className="owui-run-row history-row" type="button" onClick=${() => onRestoreRun(run.projectId, run.id)}>
                <${Icon} name="chat" size=${14} />
                <span><strong>${run.requirement}</strong><small>${run.projectName} · v${run.version}</small></span>
              </button>`)
              : html`<p className="owui-sidebar-empty">Saved harness versions will appear here.</p>`}
          </div>
        </section>
      </div>

      <div className="owui-sidebar-footer">
        <a href="./guide/" className="owui-learn-link"><${Icon} name="spark" size=${16} /><span><strong>Learn HarnessLab</strong><small>Interactive architecture guide</small></span></a>
        <div className="owui-profile-row">
          <span className="owui-profile-avatar">L</span>
          <span><strong>Local workspace</strong><small>No provider keys in browser</small></span>
          <${Icon} name="more" size=${16} />
        </div>
      </div>
    </aside>`;
}

function Header({ activeProject, runtimeSettings, status, onMenu, onRuntime, onInspector, inspectorOpen }) {
  return html`
    <header className="topbar owui-header">
      <div className="owui-header-left">
        <button className="owui-icon-button menu-button" type="button" onClick=${onMenu} aria-label="Open navigation"><${Icon} name="menu" /></button>
        <div className="owui-project-heading">
          <strong>${activeProject?.name || 'Harness workspace'}</strong>
          <span>Private browser workspace</span>
        </div>
      </div>
      <div className="owui-header-actions">
        <label className="owui-runtime-select">
          <span className="sr-only">Analysis runtime</span>
          <select value=${runtimeSettings.mode} onChange=${(event) => onRuntime(event.target.value)}>
            <option value=${RuntimeModes.BROWSER}>Browser deterministic</option>
            <option value=${RuntimeModes.AUTOMATIC}>Automatic fallback</option>
            <option value=${RuntimeModes.GATEWAY}>Gateway required</option>
          </select>
        </label>
        <${Badge} tone=${status.tone} icon=${status.icon}>${status.label}<//>
        <button className=${cx('owui-icon-button', 'inspector-button', inspectorOpen && 'active')} type="button" onClick=${onInspector} aria-expanded=${inspectorOpen} aria-controls="harness-inspector" aria-label="Toggle harness artifacts"><${Icon} name="panel" /></button>
      </div>
    </header>`;
}

function StarterWorkspace({ onUseExample }) {
  return html`
    <div className="owui-starter">
      <div className="owui-starter-mark"><span>H</span></div>
      <h1>What do you want to build?</h1>
      <p>Describe an AI use case. HarnessLab will turn it into a durable, permission-aware harness blueprint with evidence and bounded temporary intelligence.</p>
      <div className="owui-starter-grid">
        ${examples.slice(0, 4).map((example, index) => html`
          <button key=${example.label} type="button" onClick=${() => onUseExample(example.value)}>
            <span><${Icon} name=${['trace', 'shield', 'agents', 'nodes'][index] || 'spark'} size=${17} /></span>
            <strong>${example.label}</strong>
            <small>${example.value.slice(0, 112)}${example.value.length > 112 ? '…' : ''}</small>
          </button>`)}
      </div>
      <div className="owui-boundary-note"><${Icon} name="lock" size=${14} /> Do not enter secrets, credentials, or production data.</div>
    </div>`;
}

function UserMessage({ requirement }) {
  return html`
    <article className="owui-message owui-user-message">
      <div className="owui-message-avatar">Y</div>
      <div className="owui-message-body">
        <div className="owui-message-meta"><strong>You</strong><span>Requirement</span></div>
        <p>${requirement}</p>
      </div>
    </article>`;
}

function ScoreCard({ label, value, detail }) {
  return html`<div className="owui-score-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
}

function BlueprintView({ result }) {
  return html`
    <div className="owui-result-view">
      <section className="owui-callout">
        <div><span>Recommended topology</span><h3>${result.architecture.kind}</h3></div>
        <${Badge} tone="success" icon="check">Validated plan<//>
        <p>${result.architecture.reason}</p>
      </section>
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Durable workflow</span><h3>Harness stages</h3></div><small>Planned, not executed</small></div>
        <div className="owui-stage-list">
          ${(result.stages || []).map((stage, index) => html`
            <article key=${`${stage.name}-${index}`}>
              <span>${String(index + 1).padStart(2, '0')}</span>
              <div><strong>${stage.name}</strong><p>${stage.purpose}</p></div>
              <${Badge}>${stage.mode}<//>
            </article>`)}
        </div>
      </section>
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Integration choices</span><h3>Protocols and capabilities</h3></div></div>
        <div className="owui-card-grid">
          ${(result.protocols || []).map((protocol) => html`
            <article key=${protocol.name} className="owui-small-card">
              <div><strong>${protocol.name}</strong><${Badge}>${protocol.decision}<//></div>
              <p>${protocol.rationale}</p>
            </article>`)}
        </div>
      </section>
      ${result.unresolvedQuestions?.length ? html`
        <section className="owui-view-section">
          <div className="owui-view-heading"><div><span>Clarify before production</span><h3>Unresolved questions</h3></div></div>
          <ul className="owui-question-list">${result.unresolvedQuestions.map((question) => html`<li key=${question}>${question}</li>`)}</ul>
        </section>` : null}
    </div>`;
}

function AgentsView({ result }) {
  return html`
    <div className="owui-result-view">
      <section className="owui-inline-boundary"><${Icon} name="agents" /><div><strong>${result.subagents?.length || 0} temporary agents planned, 0 live workers</strong><p>These are bounded contracts in the blueprint. General planning does not execute workers.</p></div></section>
      <div className="agent-card-grid owui-agent-grid">
        ${(result.subagents || []).length ? result.subagents.map((agent, index) => html`
          <article key=${agent.id} className="owui-agent-card">
            <div className="owui-agent-card-top"><span>${String(index + 1).padStart(2, '0')}</span><${Badge} tone="warning">${agent.timeoutSeconds}s timeout<//></div>
            <h3>${agent.role}</h3>
            <p>${agent.objective}</p>
            <dl><div><dt>Context</dt><dd>${agent.context}</dd></div><div><dt>Permissions</dt><dd>${agent.permissions}</dd></div><div><dt>Returns</dt><dd>${agent.returnArtifact}</dd></div></dl>
            <div className="owui-tool-list">${(agent.tools || []).map((tool) => html`<span key=${tool}>${tool}</span>`)}</div>
            <small>${agent.childSpawning ? 'Child spawning requested' : 'No child agents'}</small>
          </article>`)
          : html`<${EmptyNotice} icon="agents" title="No temporary agents required" description="This topology stays direct and deterministic enough to avoid a temporary specialist pool." />`}
      </div>
    </div>`;
}

function ControlsView({ result }) {
  return html`
    <div className="owui-result-view">
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Least privilege</span><h3>Permission matrix</h3></div></div>
        <div className="permission-table owui-permission-table" role="table" aria-label="Harness permission matrix">
          <div role="row" className="owui-table-head"><span role="columnheader">Capability</span><span role="columnheader">Policy</span><span role="columnheader">Enforcement</span></div>
          ${(result.permissions || []).map((permission) => html`
            <div role="row" key=${permission.capability}><strong role="cell">${permission.capability}</strong><span role="cell">${permission.policy}</span><span role="cell">${permission.enforcement}</span></div>`)}
        </div>
      </section>
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Non-negotiable boundaries</span><h3>Constraints</h3></div></div>
        <div className="owui-chip-list">${(result.constraints || []).map((constraint) => html`<span key=${constraint}><${Icon} name="shield" size=${13} />${constraint}</span>`)}</div>
      </section>
    </div>`;
}

function EvidenceView({ result }) {
  return html`
    <div className="owui-result-view">
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Retained output</span><h3>Artifacts</h3></div></div>
        <div className="owui-artifact-list">
          ${(result.artifacts || []).map((artifact) => html`
            <article key=${artifact.id}><span className="owui-artifact-icon"><${Icon} name="code" /></span><div><strong>${artifact.id}</strong><small>${artifact.type}</small></div><${Badge} tone=${artifact.retained ? 'success' : 'neutral'}>${artifact.status}<//></article>`)}
        </div>
      </section>
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Audit trail</span><h3>Execution trace</h3></div></div>
        <div className="trace-timeline owui-trace-list">
          ${(result.trace || []).map((entry) => html`
            <article key=${entry.sequence}><span>${String(entry.sequence).padStart(2, '0')}</span><div><div><strong>${entry.event}</strong><small>${entry.offset}</small></div><p>${entry.detail}</p></div><${Badge} tone=${entry.status === 'complete' || entry.status === 'completed' ? 'success' : 'neutral'}>${entry.status}<//></article>`)}
        </div>
      </section>
      <section className="owui-view-section">
        <div className="owui-view-heading"><div><span>Evaluation</span><h3>${result.evaluation.verdict}</h3></div><strong className="owui-big-score">${result.evaluation.overall}</strong></div>
        <div className="owui-dimension-grid">${(result.evaluation.dimensions || []).map((dimension) => html`<div key=${dimension.name}><span>${dimension.name}</span><strong>${dimension.score}</strong><i><b style=${{ width: `${dimension.score}%` }}></b></i></div>`)}</div>
      </section>
    </div>`;
}

function JsonView({ result, onCopy, onDownload }) {
  return html`
    <div className="owui-result-view owui-json-view">
      <div className="owui-json-toolbar"><span>Validated harness result</span><div><button type="button" onClick=${onCopy}><${Icon} name="copy" size=${15} />Copy</button><button type="button" onClick=${onDownload}><${Icon} name="download" size=${15} />Download</button></div></div>
      <pre><code>${JSON.stringify(result, null, 2)}</code></pre>
    </div>`;
}

function AssistantResult({ result, selectedTab, onTab, onCopy, onDownload, onOpenInspector }) {
  const readiness = result.requirementAnalysis;
  return html`
    <article className="owui-message owui-assistant-message">
      <div className="owui-message-avatar owui-assistant-avatar">H</div>
      <div className="owui-message-body">
        <div className="owui-message-meta"><strong>HarnessLab</strong><span>${result.runId}</span></div>
        <div className="owui-assistant-intro">
          <h2>${result.architecture.kind}</h2>
          <p>${result.recommendation}</p>
          <div className="owui-score-row">
            <${ScoreCard} label="Readiness" value=${readiness?.score ?? result.scores?.confidence ?? '—'} detail=${readiness?.status || 'requirement confidence'} />
            <${ScoreCard} label="Complexity" value=${result.scores?.complexity ?? '—'} detail="topology pressure" />
            <${ScoreCard} label="Risk" value=${result.scores?.risk ?? '—'} detail="control pressure" />
            <${ScoreCard} label="Evidence" value=${result.evaluation?.overall ?? '—'} detail=${result.evaluation?.verdict || 'evaluation'} />
          </div>
          <div className="owui-provenance-line"><span>${result.runtime?.source || 'browser'} · ${result.runtime?.provider || 'deterministic'}</span><span>${result.subagents?.length || 0} temporary agents planned, not executed</span><button type="button" onClick=${onOpenInspector}>Open artifacts <${Icon} name="arrow" size=${13} /></button></div>
        </div>
        <div className="result-tabs owui-result-tabs" role="tablist" aria-label="Harness result views">
          ${RESULT_TABS.map((tab) => html`<button key=${tab.id} role="tab" aria-selected=${selectedTab === tab.id} className=${selectedTab === tab.id ? 'active' : ''} type="button" onClick=${() => onTab(tab.id)}><${Icon} name=${tab.icon} size=${15} />${tab.label}</button>`)}
        </div>
        ${selectedTab === 'blueprint' ? html`<${BlueprintView} result=${result} />` : null}
        ${selectedTab === 'agents' ? html`<${AgentsView} result=${result} />` : null}
        ${selectedTab === 'controls' ? html`<${ControlsView} result=${result} />` : null}
        ${selectedTab === 'evidence' ? html`<${EvidenceView} result=${result} />` : null}
        ${selectedTab === 'json' ? html`<${JsonView} result=${result} onCopy=${onCopy} onDownload=${onDownload} />` : null}
      </div>
    </article>`;
}

function ChatWorkspace({ requirement, result, selectedTab, onTab, onUseExample, onCopy, onDownload, onOpenInspector }) {
  return html`
    <div className="owui-chat-scroll">
      <div className="owui-chat-width">
        ${result ? html`
          <${UserMessage} requirement=${result.requirement || requirement} />
          <${AssistantResult} result=${result} selectedTab=${selectedTab} onTab=${onTab} onCopy=${onCopy} onDownload=${onDownload} onOpenInspector=${onOpenInspector} />`
          : html`<${StarterWorkspace} onUseExample=${onUseExample} />`}
      </div>
    </div>`;
}

function Composer({ requirement, onRequirement, analyzing, phase, onAnalyze, onUseExample, runtimeSettings }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
  }, []);

  function keyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onAnalyze();
    }
  }

  return html`
    <div className="owui-composer-wrap">
      <div className="owui-composer composer-panel">
        <textarea ref=${inputRef} value=${requirement} onInput=${(event) => onRequirement(event.target.value)} onKeyDown=${keyDown} maxLength=${MAX_REQUIREMENT_LENGTH} rows="3" placeholder="Describe the agent system, its users, data, tools, allowed actions, prohibited actions, approval rules, output, and success criteria…" aria-label="Agent system requirement"></textarea>
        <div className="owui-composer-tools">
          <div className="owui-composer-left">
            <button className="owui-icon-button" type="button" onClick=${() => onUseExample(examples[Math.floor(Math.random() * examples.length)].value)} aria-label="Load another example"><${Icon} name="refresh" size=${16} /></button>
            <span>${runtimeLabel(runtimeSettings.mode)} runtime</span>
            <span>${requirement.length}/${MAX_REQUIREMENT_LENGTH}</span>
          </div>
          <button className="analyze-button owui-send-button" type="button" onClick=${onAnalyze} disabled=${analyzing || requirement.trim().length < 8} aria-label=${analyzing ? PHASES[phase] : 'Generate harness blueprint'}>
            ${analyzing ? html`<span className="spinner"></span><span>${PHASES[phase]}</span>` : html`<span>Generate</span><${Icon} name="arrow" size=${16} />`}
          </button>
        </div>
      </div>
      <p className="owui-composer-disclaimer">HarnessLab can make mistakes. Review permissions, assumptions, and evidence before implementation.</p>
    </div>`;
}

function ProjectsWorkspace({ snapshot, activeProject, persistenceMode, onSelectProject, onCreateProject, onRestoreRun, onSave, onExport, result }) {
  const [name, setName] = useState('');
  function create(event) {
    event.preventDefault();
    if (onCreateProject(name)) setName('');
  }
  return html`
    <div className="owui-page-scroll"><div className="owui-page-width">
      <div className="owui-page-heading"><div><span>Workspace</span><h1>Projects</h1><p>Organize requirements and immutable harness versions in this browser.</p></div><div><button className="owui-secondary-button" type="button" onClick=${onExport}><${Icon} name="download" size=${15} />Export workspace</button><button className="owui-primary-button" type="button" onClick=${onSave} disabled=${!result}><${Icon} name="save" size=${15} />Save current version</button></div></div>
      <section className="owui-settings-card">
        <form className="owui-project-create-bar" onSubmit=${create}><div><strong>Create project</strong><small>Projects isolate local harness histories.</small></div><input value=${name} onInput=${(event) => setName(event.target.value)} minLength="2" maxLength="80" placeholder="Project name" /><button type="submit">Create</button></form>
        <div className="owui-storage-boundary"><${Icon} name="lock" /><span><strong>${persistenceMode === 'browser' ? 'Browser storage' : 'Memory-only fallback'}</strong><small>Not encrypted cloud storage or synchronization.</small></span></div>
      </section>
      <div className="owui-project-cards">
        ${(snapshot?.projects || []).map((project) => html`
          <article key=${project.id} className=${cx('owui-project-card', project.id === activeProject?.id && 'active')}>
            <button type="button" className="owui-project-card-main" onClick=${() => onSelectProject(project.id)}><span className="project-avatar">${project.name.slice(0, 1).toUpperCase()}</span><span><strong>${project.name}</strong><small>Updated ${formatTimestamp(project.updatedAt, true)}</small></span><${Badge}>${project.runs.length} versions<//></button>
            <div className="owui-project-run-stack">
              ${project.runs.length ? [...project.runs].reverse().slice(0, 5).map((run) => html`<button key=${run.id} type="button" onClick=${() => onRestoreRun(project.id, run.id)}><span>v${run.version}</span><span><strong>${run.architecture}</strong><small>${run.requirement}</small></span><b>${run.score ?? '—'}</b><${Icon} name="chevron" size=${14} /></button>`)
                : html`<p>No saved harness versions.</p>`}
            </div>
          </article>`)}
      </div>
    </div></div>`;
}

function RuntimeWorkspace({ settings, gatewayDraft, onGatewayDraft, health, testing, onMode, onTimeout, onTest }) {
  return html`
    <div className="owui-page-scroll"><div className="owui-page-width owui-narrow-page">
      <div className="owui-page-heading"><div><span>Settings</span><h1>Runtime</h1><p>Choose where architecture guidance runs. Provider credentials never enter the browser.</p></div></div>
      <section className="owui-settings-card">
        <div className="owui-setting-row"><div><strong>Analysis mode</strong><small>Browser is deterministic. Automatic records fallback. Gateway never silently falls back.</small></div><select value=${settings.mode} onChange=${(event) => onMode(event.target.value)}><option value=${RuntimeModes.BROWSER}>Browser deterministic</option><option value=${RuntimeModes.AUTOMATIC}>Automatic fallback</option><option value=${RuntimeModes.GATEWAY}>Gateway required</option></select></div>
        <div className="owui-setting-row"><div><strong>HarnessLab gateway URL</strong><small>Only gateway metadata is retained locally.</small></div><input value=${gatewayDraft} onInput=${(event) => onGatewayDraft(event.target.value)} type="url" spellCheck="false" /></div>
        <div className="owui-setting-row"><div><strong>Request timeout</strong><small>Applies to gateway analysis and health checks.</small></div><select value=${settings.timeoutMs} onChange=${(event) => onTimeout(Number(event.target.value))}><option value="3000">3 seconds</option><option value="5000">5 seconds</option><option value="8000">8 seconds</option><option value="15000">15 seconds</option><option value="30000">30 seconds</option></select></div>
        <div className="owui-runtime-health"><span className=${`health-dot health-${health.state}`}></span><div><strong>${health.label}</strong><p>${health.message}</p></div><button className="test-button" type="button" onClick=${onTest} disabled=${testing || settings.mode === RuntimeModes.BROWSER}>${testing ? 'Checking…' : 'Test connection'}</button></div>
      </section>
      <section className="owui-info-card"><${Icon} name="shield" /><div><strong>No provider keys in browser</strong><p>Ollama and free-only OpenRouter remain server-side gateway choices. The browser stores only a validated URL, mode, and timeout.</p></div></section>
    </div></div>`;
}

function EvidenceWorkspace({ result, onCopy, onDownload, onSave }) {
  return html`
    <div className="owui-page-scroll"><div className="owui-page-width">
      <div className="owui-page-heading"><div><span>Review</span><h1>Evidence</h1><p>Inspect retained artifacts, trace events, evaluation scores, and runtime provenance.</p></div>${result ? html`<div><button className="owui-secondary-button" type="button" onClick=${onCopy}><${Icon} name="copy" size=${15} />Copy JSON</button><button className="owui-secondary-button" type="button" onClick=${onDownload}><${Icon} name="download" size=${15} />Download</button><button className="owui-primary-button" type="button" onClick=${onSave}><${Icon} name="save" size=${15} />Save version</button></div>` : null}</div>
      ${result ? html`<${EvidenceView} result=${result} />` : html`<${EmptyNotice} icon="trace" title="No evidence yet" description="Generate a harness blueprint to create artifacts, trace events, runtime provenance, and an evaluation record." />`}
    </div></div>`;
}

function Inspector({ result, open, onClose, onSave, onCopy, onDownload }) {
  const runtime = result?.runtime || {};
  return html`
    <aside id="harness-inspector" className=${cx('owui-inspector', open && 'inspector-open')} aria-label="Harness artifact inspector">
      <div className="owui-inspector-header"><div><span>Artifacts</span><strong>${result?.runId || 'No active harness'}</strong></div><button className="owui-icon-button inspector-close" type="button" onClick=${onClose} aria-label="Close artifact inspector"><${Icon} name="close" /></button></div>
      ${result ? html`
        <div className="owui-inspector-scroll">
          <section className="owui-inspector-summary"><span className="owui-inspector-mark"><${Icon} name="nodes" /></span><h2>${result.architecture.kind}</h2><p>${result.architecture.reason}</p><div><${Badge} tone="success">${result.evaluation.overall}/100 evidence<//><${Badge}>${result.subagents.length} planned agents<//></div></section>
          <section className="owui-inspector-section"><h3>Runtime provenance</h3><dl><div><dt>Source</dt><dd>${runtime.source || 'browser'}</dd></div><div><dt>Provider</dt><dd>${runtime.provider || 'deterministic'}</dd></div><div><dt>Model</dt><dd>${runtime.model || 'none'}</dd></div><div><dt>Latency</dt><dd>${Number.isFinite(runtime.latencyMs) ? `${runtime.latencyMs} ms` : 'n/a'}</dd></div><div><dt>Fallback</dt><dd>${runtime.fallbackUsed ? runtime.fallbackReason || 'used' : 'not used'}</dd></div></dl></section>
          <section className="owui-inspector-section"><h3>Retained artifacts</h3><div className="owui-inspector-artifacts">${(result.artifacts || []).map((artifact) => html`<div key=${artifact.id}><${Icon} name="code" size=${15} /><span><strong>${artifact.id}</strong><small>${artifact.type}</small></span><b>${artifact.status}</b></div>`)}</div></section>
          <section className="owui-inspector-section"><h3>Requirement boundary</h3><p>${result.requirement}</p></section>
        </div>
        <div className="owui-inspector-actions"><button type="button" onClick=${onCopy}><${Icon} name="copy" size=${15} />Copy</button><button type="button" onClick=${onDownload}><${Icon} name="download" size=${15} />Download</button><button className="save-button" type="button" onClick=${onSave}><${Icon} name="save" size=${15} />Save version</button></div>`
        : html`<${EmptyNotice} icon="panel" title="No harness selected" description="Generate or restore a harness to populate this inspector." />`}
    </aside>`;
}

function Toast({ toast }) {
  if (!toast) return null;
  return html`<div className=${`toast owui-toast toast-${toast.tone}`} role="status" aria-live="polite"><span><${Icon} name=${toast.tone === 'error' || toast.tone === 'warning' ? 'alert' : 'check'} /></span><div><strong>${toast.title}</strong><p>${toast.message}</p></div></div>`;
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
  const [health, setHealth] = useState({ state: 'ready', label: 'Browser runtime ready', message: 'Deterministic analysis is available without a server, account, API key, or model download.' });
  const [testingGateway, setTestingGateway] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [selectedTab, setSelectedTab] = useState('blueprint');
  const [activeView, setActiveView] = useState(MAIN_VIEWS.CHAT);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const snapshot = useMemo(() => workspaceStore.getSnapshot(), [workspaceStore, workspaceRevision]);
  const activeProject = useMemo(() => workspaceStore.getActiveProject(), [workspaceStore, workspaceRevision]);
  const persistenceMode = workspaceStore.getPersistenceMode();

  const notify = useCallback((title, message, tone = 'success') => {
    globalThis.clearTimeout(toastTimer.current);
    setToast({ title, message, tone });
    toastTimer.current = globalThis.setTimeout(() => setToast(null), 4200);
  }, []);

  const persistRuntime = useCallback((patch) => {
    const next = saveRuntimeSettings(storage, { ...runtimeSettings, ...patch, gatewayUrl: patch.gatewayUrl ?? gatewayDraft });
    setRuntimeSettings(next);
    setGatewayDraft(next.gatewayUrl);
    return next;
  }, [gatewayDraft, runtimeSettings, storage]);

  const navigate = useCallback((view) => {
    setActiveView(view);
    setSidebarOpen(false);
  }, []);

  const runAnalysis = useCallback(async () => {
    const trimmed = requirement.trim();
    if (trimmed.length < 8) {
      notify('Requirement needs detail', 'Describe the use case in at least eight characters.', 'error');
      return;
    }
    setAnalyzing(true);
    setPhase(0);
    const phaseTimer = globalThis.setInterval(() => setPhase((current) => Math.min(current + 1, PHASES.length - 1)), 260);
    try {
      const settings = persistRuntime({});
      const [result] = await Promise.all([analysisClient.analyze(trimmed, settings), sleep(900)]);
      setLatestResult(result);
      setSelectedTab('blueprint');
      setActiveView(MAIN_VIEWS.CHAT);
      setInspectorOpen(globalThis.innerWidth >= 1280);
      globalThis.dispatchEvent(new CustomEvent('harnesslab:analysis-result', { detail: result }));
      notify(
        result.runtime?.fallbackUsed ? 'Fallback recorded' : 'Harness blueprint ready',
        result.runtime?.fallbackUsed
          ? 'The gateway was unavailable, so deterministic browser analysis completed and retained fallback evidence.'
          : `${result.architecture.kind} selected with ${result.subagents.length} temporary agents planned, not executed.`,
        result.runtime?.fallbackUsed ? 'warning' : 'success'
      );
    } catch (error) {
      const message = error instanceof AnalysisGatewayError || error instanceof Error ? error.message : 'The harness analysis could not be completed.';
      notify('Analysis failed', message, 'error');
    } finally {
      globalThis.clearInterval(phaseTimer);
      setAnalyzing(false);
      setPhase(0);
    }
  }, [analysisClient, notify, persistRuntime, requirement]);

  useEffect(() => {
    let current = true;
    analysisClient.analyze(DEFAULT_REQUIREMENT, { ...runtimeSettings, mode: RuntimeModes.BROWSER })
      .then((result) => {
        if (!current) return;
        setLatestResult(null);
        globalThis.__HARNESSLAB_STARTER_RESULT__ = result;
      })
      .catch((error) => console.error('Initial HarnessLab analysis failed.', error));
    return () => {
      current = false;
      globalThis.clearTimeout(toastTimer.current);
    };
  }, []);

  function newHarness() {
    setRequirement('');
    setLatestResult(null);
    setSelectedTab('blueprint');
    setActiveView(MAIN_VIEWS.CHAT);
    setSidebarOpen(false);
    setInspectorOpen(false);
    notify('New harness started', 'Describe the use case in the composer.');
    globalThis.setTimeout(() => document.querySelector('.owui-composer textarea')?.focus(), 40);
  }

  function useExample(value) {
    setRequirement(value);
    setActiveView(MAIN_VIEWS.CHAT);
    globalThis.setTimeout(() => document.querySelector('.owui-composer textarea')?.focus(), 40);
  }

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
      setHealth({ state: available ? 'ready' : 'degraded', label: available ? `${result.provider.name} ready` : `${result.provider.name} degraded`, message: `${result.gatewayUrl} · ${result.provider.model || 'no model'} · ${result.provider.liveModel ? 'live model provider' : 'deterministic provider'}` });
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
        globalThis.dispatchEvent(new CustomEvent('harnesslab:analysis-result', { detail: latest.result }));
        notify('Project opened', `${project.name} restored at version ${latest.version}.`);
      } else {
        setLatestResult(null);
        notify('Project opened', `${project.name} has no saved versions yet.`);
      }
      setActiveView(MAIN_VIEWS.CHAT);
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

  function restoreRun(projectId, runId) {
    try {
      if (activeProject?.id !== projectId) workspaceStore.selectProject(projectId);
      const run = workspaceStore.getRun(projectId, runId);
      if (!run) throw new Error('The selected version could not be found.');
      setWorkspaceRevision((value) => value + 1);
      setRequirement(run.requirement);
      setLatestResult(clone(run.result));
      setSelectedTab('blueprint');
      setActiveView(MAIN_VIEWS.CHAT);
      setSidebarOpen(false);
      globalThis.dispatchEvent(new CustomEvent('harnesslab:analysis-result', { detail: run.result }));
      notify('Version restored', `Version ${run.version} is open in the harness chat.`);
    } catch (error) {
      notify('Saved version unavailable', error.message, 'error');
    }
  }

  function exportWorkspace() {
    try {
      downloadText(`harnesslab-${fileSafeName(activeProject.name)}-workspace.json`, workspaceStore.exportWorkspace());
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

  const status = analyzing
    ? { tone: 'active', icon: 'pulse', label: PHASES[phase] }
    : latestResult?.runtime?.fallbackUsed
      ? { tone: 'warning', icon: 'alert', label: 'Fallback recorded' }
      : latestResult?.runtime?.source === 'gateway'
        ? { tone: 'live', icon: 'pulse', label: `${latestResult.runtime.provider} gateway` }
        : { tone: 'success', icon: 'check', label: 'Browser ready' };

  return html`
    <div className=${cx('app-shell', 'owui-app', inspectorOpen && 'has-inspector')} data-ui-pattern="openwebui">
      <${Sidebar}
        snapshot=${snapshot}
        activeProject=${activeProject}
        activeView=${activeView}
        mobileOpen=${sidebarOpen}
        onClose=${() => setSidebarOpen(false)}
        onNavigate=${navigate}
        onNewHarness=${newHarness}
        onSelectProject=${selectProject}
        onCreateProject=${createProject}
        onRestoreRun=${restoreRun}
      />
      <div className="mobile-overlay owui-sidebar-overlay" data-open=${sidebarOpen ? 'true' : 'false'} onClick=${() => setSidebarOpen(false)}></div>
      <main id="main-content" className="main-content owui-main">
        <${Header}
          activeProject=${activeProject}
          runtimeSettings=${runtimeSettings}
          status=${status}
          onMenu=${() => setSidebarOpen(true)}
          onRuntime=${handleMode}
          onInspector=${() => setInspectorOpen((value) => !value)}
          inspectorOpen=${inspectorOpen}
        />
        <div className="owui-main-body">
          ${activeView === MAIN_VIEWS.CHAT ? html`<${ChatWorkspace} requirement=${requirement} result=${latestResult} selectedTab=${selectedTab} onTab=${setSelectedTab} onUseExample=${useExample} onCopy=${copyJson} onDownload=${downloadJson} onOpenInspector=${() => setInspectorOpen(true)} />` : null}
          ${activeView === MAIN_VIEWS.PROJECTS ? html`<${ProjectsWorkspace} snapshot=${snapshot} activeProject=${activeProject} persistenceMode=${persistenceMode} onSelectProject=${selectProject} onCreateProject=${createProject} onRestoreRun=${restoreRun} onSave=${saveVersion} onExport=${exportWorkspace} result=${latestResult} />` : null}
          ${activeView === MAIN_VIEWS.RUNTIME ? html`<${RuntimeWorkspace} settings=${runtimeSettings} gatewayDraft=${gatewayDraft} onGatewayDraft=${setGatewayDraft} health=${health} testing=${testingGateway} onMode=${handleMode} onTimeout=${handleTimeout} onTest=${testGateway} />` : null}
          ${activeView === MAIN_VIEWS.EVIDENCE ? html`<${EvidenceWorkspace} result=${latestResult} onCopy=${copyJson} onDownload=${downloadJson} onSave=${saveVersion} />` : null}
        </div>
        ${activeView === MAIN_VIEWS.CHAT ? html`<${Composer} requirement=${requirement} onRequirement=${setRequirement} analyzing=${analyzing} phase=${phase} onAnalyze=${runAnalysis} onUseExample=${useExample} runtimeSettings=${runtimeSettings} />` : null}
      </main>
      <div className="owui-inspector-overlay" data-open=${inspectorOpen ? 'true' : 'false'} onClick=${() => setInspectorOpen(false)}></div>
      <${Inspector} result=${latestResult} open=${inspectorOpen} onClose=${() => setInspectorOpen(false)} onSave=${saveVersion} onCopy=${copyJson} onDownload=${downloadJson} />
      <${Toast} toast=${toast} />
    </div>`;
}

ReactDomRuntime.createRoot(rootElement).render(html`<${App} />`);

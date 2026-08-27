import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CopilotChat,
  useAgent,
  useAgentContext,
  useCopilotKit,
  useFrontendTool
} from '@copilotkit/react-core/v2';
import { z } from 'zod';
import { analyzeRequirement, examples } from '../../web/engine.js';
import { assertHarnessResult } from '../../web/result-contract.js';

const STORAGE_KEY = 'harnesslab.copilotkit.runtime.v1';
const AGENT_ID = 'harnessArchitect';
const VIEWS = ['overview', 'requirements', 'agents', 'controls', 'evidence', 'json'];

function runtimeFromLocation() {
  const query = new URLSearchParams(globalThis.location.search).get('runtime');
  if (query) return query;
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch {
    // Runtime configuration is optional and non-secret.
  }
  return ['localhost', '127.0.0.1'].includes(globalThis.location.hostname)
    ? 'http://127.0.0.1:8790/api/copilotkit'
    : '';
}

function normalizeRuntimeUrl(value) {
  const url = new URL(String(value || '').trim());
  if (url.username || url.password) throw new Error('Runtime URLs cannot contain embedded credentials.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Use HTTPS for hosted runtimes or HTTP only for a loopback development runtime.');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

function safePersistRuntime(value) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The runtime URL is non-secret convenience state. A blocked store is non-fatal.
  }
}

function icon(name) {
  const icons = {
    spark: '✦',
    architecture: '⌘',
    shield: '◇',
    agents: '◎',
    evidence: '≋',
    code: '</>',
    requirement: '▤',
    connect: '↗',
    back: '←',
    copy: '⧉',
    play: '▶'
  };
  return icons[name] || '•';
}

function Pill({ tone = 'neutral', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Header({ connected, runtimeUrl, onChangeRuntime }) {
  return (
    <header className="copilot-header">
      <a className="brand" href="../" aria-label="Back to HarnessLab">
        <span className="brand-mark">H</span>
        <span><strong>HarnessLab Copilot</strong><small>CopilotKit v2 · AG-UI</small></span>
      </a>
      <div className="header-center">
        <span className="header-kicker">Conversational harness engineering</span>
        <strong>Deterministic controls. Copilot experience.</strong>
      </div>
      <div className="header-actions">
        <Pill tone={connected ? 'success' : 'warning'}>
          <i className="status-dot" />{connected ? 'Runtime connected' : 'Runtime required'}
        </Pill>
        {runtimeUrl ? <button type="button" className="icon-action" onClick={onChangeRuntime}>Change runtime</button> : null}
        <a className="icon-action" href="../">{icon('back')} Builder</a>
      </div>
    </header>
  );
}

function BoundaryStrip() {
  return (
    <div className="boundary-strip" aria-label="Pilot execution boundaries">
      <span>CopilotKit v2</span>
      <span>Self-hosted runtime</span>
      <span>Deterministic provider</span>
      <span>0 model calls</span>
      <span>0 tools</span>
      <span>0 external actions</span>
    </div>
  );
}

function RuntimeSetup({ initialUrl, onConnected }) {
  const [draft, setDraft] = useState(initialUrl);
  const [status, setStatus] = useState({ tone: 'neutral', message: 'Enter the self-hosted CopilotKit runtime endpoint.' });
  const [checking, setChecking] = useState(false);
  const sample = useMemo(() => assertHarnessResult(analyzeRequirement(examples[0].value)), []);

  useEffect(() => {
    document.body.dataset.copilotkitMode = 'setup';
    globalThis.__HARNESSLAB_COPILOTKIT_AUDIT__ = {
      ready: true,
      mode: 'setup',
      resultReady: false,
      providerKeysInBrowser: false
    };
  }, []);

  async function connect(event) {
    event.preventDefault();
    setChecking(true);
    try {
      const runtimeUrl = normalizeRuntimeUrl(draft);
      const response = await fetch(`${runtimeUrl}/info`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Runtime info returned HTTP ${response.status}.`);
      const info = await response.json();
      const serialized = JSON.stringify(info);
      if (!serialized.includes(AGENT_ID)) throw new Error(`The runtime does not advertise the ${AGENT_ID} agent.`);
      safePersistRuntime(runtimeUrl);
      setStatus({ tone: 'success', message: 'CopilotKit runtime verified. Opening the conversational workspace…' });
      onConnected(runtimeUrl);
    } catch (error) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to verify the CopilotKit runtime.'
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="setup-layout" data-copilotkit-root="ready">
      <section className="setup-copy">
        <Pill tone="accent">CopilotKit adoption milestone</Pill>
        <h1>Connect conversation to the <span>HarnessLab control plane.</span></h1>
        <p>
          CopilotKit provides chat, streaming, shared state, and future approval surfaces. HarnessLab still validates every architecture artifact and remains authoritative for permissions, evidence, and failure boundaries.
        </p>
        <div className="setup-principles">
          <article><b>Conversation layer</b><span>CopilotChat, AG-UI events, shared application state.</span></article>
          <article><b>Control layer</b><span>Requirement intelligence, result validation, policy, evidence.</span></article>
          <article><b>Execution layer</b><span>Self-hosted runtime now; Ollama and free-only providers later.</span></article>
        </div>
        <form className="runtime-form" onSubmit={connect}>
          <label htmlFor="runtime-url">CopilotKit runtime URL</label>
          <div className="runtime-input-row">
            <input
              id="runtime-url"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="http://127.0.0.1:8790/api/copilotkit"
              spellCheck="false"
              autoComplete="off"
            />
            <button type="submit" disabled={checking || !draft.trim()}>{checking ? 'Checking…' : 'Connect runtime'}</button>
          </div>
          <div className={`connection-message connection-${status.tone}`} role="status">{status.message}</div>
        </form>
        <div className="local-command">
          <span>Local deterministic runtime</span>
          <code>npm install &amp;&amp; npm run copilotkit:runtime</code>
          <small>No CopilotKit account, model account, or provider key is required for this first slice.</small>
        </div>
      </section>

      <section className="preview-card" data-copilotkit-result="preview">
        <div className="preview-head">
          <span><i /> Read-only artifact preview</span>
          <Pill tone="neutral">Runtime disconnected</Pill>
        </div>
        <div className="preview-score-row">
          <div><span>Architecture</span><strong>{sample.architecture.kind}</strong></div>
          <div><span>Evaluation</span><strong>{sample.evaluation.overall}<small>/100</small></strong></div>
          <div><span>Temporary agents</span><strong>{sample.subagents.length}</strong></div>
        </div>
        <h2>{sample.recommendation}</h2>
        <p>{sample.architecture.reason}</p>
        <div className="preview-flow" aria-label="CopilotKit integration flow">
          {['Conversation', 'AG-UI runtime', 'Requirement intelligence', 'Harness contract', 'Structured UI'].map((item, index) => (
            <React.Fragment key={item}>
              <span>{item}</span>{index < 4 ? <i>→</i> : null}
            </React.Fragment>
          ))}
        </div>
        <div className="preview-note">
          This preview proves the artifact layout without pretending the CopilotKit agent ran. Connect the local runtime to execute the complete conversation-to-harness path.
        </div>
      </section>
    </div>
  );
}

function EmptyArtifact({ onSample, ready, running }) {
  return (
    <div className="empty-artifact">
      <span className="empty-glyph">{icon('architecture')}</span>
      <h2>Your validated harness will appear here</h2>
      <p>Describe an agent use case in the CopilotKit conversation, or run the sample to verify the complete AG-UI state path.</p>
      <button type="button" onClick={onSample} disabled={!ready || running}>
        {icon('play')} {running ? 'Architecting…' : 'Run sample requirement'}
      </button>
    </div>
  );
}

function ScoreCard({ label, value, detail, tone }) {
  return (
    <article className={`score-card score-${tone}`}>
      <span>{label}</span><strong>{value}</strong><small>{detail}</small>
    </article>
  );
}

function RequirementsView({ result }) {
  const analysis = result.requirementAnalysis;
  if (!analysis) return <p className="empty-copy">This saved result predates requirement intelligence.</p>;
  return (
    <div className="requirements-view">
      <div className="readiness-summary">
        <ScoreCard label="Readiness" value={`${analysis.readinessScore ?? 0}%`} detail={analysis.readinessLevel || 'assessed'} tone="blue" />
        <ScoreCard label="Covered" value={analysis.counts?.covered ?? 0} detail="requirement dimensions" tone="green" />
        <ScoreCard label="Partial" value={analysis.counts?.partial ?? 0} detail="needs refinement" tone="amber" />
        <ScoreCard label="Missing" value={analysis.counts?.missing ?? 0} detail="not supplied" tone="rose" />
      </div>
      <div className="dimension-grid">
        {(analysis.dimensions || []).map((dimension) => (
          <article key={dimension.id} data-status={dimension.status}>
            <div><strong>{dimension.label}</strong><Pill tone={dimension.status === 'covered' ? 'success' : dimension.status === 'partial' ? 'warning' : 'neutral'}>{dimension.status}</Pill></div>
            <p>{dimension.explanation}</p>
            {dimension.evidence?.length ? <blockquote>{dimension.evidence[0]}</blockquote> : null}
          </article>
        ))}
      </div>
      {(analysis.contradictions || []).length ? (
        <section className="contradiction-list">
          <h3>Contradictions to resolve</h3>
          {analysis.contradictions.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.explanation}</p></article>)}
        </section>
      ) : null}
    </div>
  );
}

function OverviewView({ result }) {
  return (
    <div className="overview-view">
      <div className="score-grid">
        <ScoreCard label="Complexity" value={result.scores.complexity} detail="system coordination" tone="blue" />
        <ScoreCard label="Risk" value={result.scores.risk} detail="required controls" tone="rose" />
        <ScoreCard label="Confidence" value={result.scores.confidence} detail="decision confidence" tone="green" />
        <ScoreCard label="Evaluation" value={result.evaluation.overall} detail={result.evaluation.verdict} tone="violet" />
      </div>
      <article className="architecture-card">
        <div><Pill tone="accent">Recommended topology</Pill><Pill tone="success">Validated result</Pill></div>
        <h2>{result.architecture.kind}</h2>
        <p>{result.architecture.reason}</p>
        <blockquote>{result.recommendation}</blockquote>
      </article>
      <div className="protocol-grid">
        {(result.protocols || []).map((protocol) => (
          <article key={protocol.name}>
            <div><strong>{protocol.name}</strong><Pill tone="neutral">{protocol.decision}</Pill></div>
            <p>{protocol.rationale}</p>
          </article>
        ))}
      </div>
      <div className="stage-list">
        {(result.stages || []).map((stage, index) => (
          <article key={stage.name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{stage.name}</strong><p>{stage.purpose}</p><small>{stage.mode}</small></div></article>
        ))}
      </div>
    </div>
  );
}

function AgentsView({ result }) {
  if (!result.subagents?.length) return <p className="empty-copy">This use case does not justify temporary specialists.</p>;
  return (
    <div className="agent-grid">
      {result.subagents.map((agent, index) => (
        <article key={agent.id}>
          <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{agent.id}</small><h3>{agent.role}</h3></div><Pill tone="neutral">planned</Pill></header>
          <p>{agent.objective}</p>
          <dl>
            <div><dt>Context</dt><dd>{agent.context}</dd></div>
            <div><dt>Permissions</dt><dd>{agent.permissions}</dd></div>
            <div><dt>Timeout</dt><dd>{agent.timeoutSeconds}s</dd></div>
            <div><dt>Return artifact</dt><dd>{agent.returnArtifact}</dd></div>
          </dl>
          <footer><span>{agent.tools?.length ? agent.tools.join(', ') : 'No tools'}</span><strong>{agent.childSpawning ? 'Child spawning allowed' : 'No child agents'}</strong></footer>
        </article>
      ))}
    </div>
  );
}

function ControlsView({ result }) {
  return (
    <div className="controls-view">
      <div className="permission-table" role="table" aria-label="Permission policy">
        <div className="permission-row permission-head" role="row"><span>Capability</span><span>Policy</span><span>Enforcement</span></div>
        {(result.permissions || []).map((permission) => (
          <div className="permission-row" role="row" key={permission.capability}>
            <strong>{permission.capability}</strong><span>{permission.policy}</span><small>{permission.enforcement}</small>
          </div>
        ))}
      </div>
      <section className="constraint-list">
        <h3>Safety and operating constraints</h3>
        {(result.constraints || []).map((constraint) => <p key={constraint}><span>✓</span>{constraint}</p>)}
      </section>
    </div>
  );
}

function EvidenceView({ result }) {
  return (
    <div className="evidence-view">
      <section>
        <h3>Retained artifacts</h3>
        <div className="artifact-grid">
          {(result.artifacts || []).map((artifact) => (
            <article key={artifact.id}><span>{artifact.type}</span><strong>{artifact.id}</strong><small>{artifact.status} · {artifact.retained ? 'retained' : 'transient'}</small></article>
          ))}
        </div>
      </section>
      <section>
        <h3>Execution trace</h3>
        <div className="trace-list">
          {(result.trace || []).map((event) => (
            <article key={`${event.sequence}-${event.event}`}><span>{event.sequence}</span><div><strong>{event.event}</strong><p>{event.detail}</p></div><small>{event.offset} · {event.status}</small></article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ArtifactPanel({ state, activeView, setActiveView }) {
  const result = state?.result;
  const [copied, setCopied] = useState(false);

  async function copyJson() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="artifact-panel" data-copilotkit-result={result ? 'ready' : 'waiting'}>
      <header className="artifact-header">
        <div><span>Structured harness artifact</span><strong>{result?.runId || 'Waiting for a CopilotKit run'}</strong></div>
        <div>{result ? <button type="button" onClick={copyJson}>{icon('copy')} {copied ? 'Copied' : 'Copy JSON'}</button> : null}</div>
      </header>
      {result ? (
        <>
          <nav className="artifact-tabs" aria-label="Harness artifact views">
            {VIEWS.map((view) => <button type="button" key={view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>{view}</button>)}
          </nav>
          <div className="artifact-body">
            {activeView === 'overview' ? <OverviewView result={result} /> : null}
            {activeView === 'requirements' ? <RequirementsView result={result} /> : null}
            {activeView === 'agents' ? <AgentsView result={result} /> : null}
            {activeView === 'controls' ? <ControlsView result={result} /> : null}
            {activeView === 'evidence' ? <EvidenceView result={result} /> : null}
            {activeView === 'json' ? <pre className="json-view"><code>{JSON.stringify(result, null, 2)}</code></pre> : null}
          </div>
          <footer className="artifact-footer">
            <span>Authority: {state.provenance?.authoritativeValidator || 'HarnessLab result contract'}</span>
            <span>{state.provenance?.latencyMs ?? 0} ms · {state.provenance?.toolsExecuted ?? 0} tools · {state.provenance?.externalActions ?? 0} external actions</span>
          </footer>
        </>
      ) : <EmptyArtifact onSample={() => {}} ready={false} running={false} />}
    </section>
  );
}

function CopilotWorkspace({ runtimeUrl, onChangeRuntime }) {
  const { agent, isReady } = useAgent({ agentId: AGENT_ID, threadId: 'main' });
  const { copilotkit } = useCopilotKit();
  const [activeView, setActiveView] = useState('overview');
  const autoRun = useRef(false);
  const state = agent.state || {};
  const result = state.result || null;

  useAgentContext({
    description: 'HarnessLab UI state and immutable safety boundaries',
    value: useMemo(() => ({
      activeArtifactView: activeView,
      runtime: 'self-hosted CopilotKit',
      provider: 'deterministic',
      toolsAllowed: false,
      childAgentsAllowed: false,
      externalActionsAllowed: false,
      productionMutationAllowed: false
    }), [activeView])
  });

  useFrontendTool({
    name: 'selectHarnessView',
    description: 'Select a read-only HarnessLab artifact view in the browser. This tool cannot change the harness or execute an external action.',
    parameters: z.object({ view: z.enum(VIEWS) }),
    handler: async ({ view }) => {
      setActiveView(view);
      return { selected: view, mutatedHarness: false, externalAction: false };
    }
  });

  const runRequirement = useCallback(async (requirement) => {
    if (!isReady || agent.isRunning) return;
    agent.addMessage({
      id: globalThis.crypto.randomUUID(),
      role: 'user',
      content: requirement
    });
    await copilotkit.runAgent({ agent });
  }, [agent, copilotkit, isReady]);

  useEffect(() => {
    if (!isReady || autoRun.current) return;
    if (new URLSearchParams(globalThis.location.search).get('sample') !== '1') return;
    autoRun.current = true;
    runRequirement(examples[1]?.value || examples[0].value);
  }, [isReady, runRequirement]);

  useEffect(() => {
    document.body.dataset.copilotkitMode = 'connected';
    globalThis.__HARNESSLAB_COPILOTKIT_AUDIT__ = {
      ready: true,
      mode: 'connected',
      agentReady: isReady,
      running: agent.isRunning,
      resultReady: Boolean(result),
      runId: result?.runId || null,
      architecture: result?.architecture?.kind || null,
      providerKeysInBrowser: false,
      runtimeUrl
    };
  }, [agent.isRunning, isReady, result, runtimeUrl]);

  return (
    <div className="copilot-shell" data-copilotkit-root="ready">
      <Header connected runtimeUrl={runtimeUrl} onChangeRuntime={onChangeRuntime} />
      <BoundaryStrip />
      <main className="workspace-grid">
        <section className="chat-panel">
          <div className="panel-title">
            <div><span>Copilot conversation</span><h1>Build the harness through dialogue</h1></div>
            <Pill tone={agent.isRunning ? 'warning' : isReady ? 'success' : 'neutral'}>{agent.isRunning ? 'Running' : isReady ? 'Agent ready' : 'Connecting'}</Pill>
          </div>
          <div className="starter-actions">
            <button type="button" onClick={() => runRequirement(examples[0].value)} disabled={!isReady || agent.isRunning}>Simple workflow</button>
            <button type="button" onClick={() => runRequirement(examples[1]?.value || examples[0].value)} disabled={!isReady || agent.isRunning}>Data investigation</button>
            <button type="button" onClick={() => runRequirement(examples[2]?.value || examples[0].value)} disabled={!isReady || agent.isRunning}>Software delivery</button>
          </div>
          <div className="chat-frame">
            <CopilotChat agentId={AGENT_ID} />
          </div>
          <div className="chat-boundary-note">
            CopilotKit owns the conversational interface. The custom agent can only call the deterministic HarnessLab engine; it has no model credential, tool executor, filesystem, MCP client, A2A peer, or production authority.
          </div>
        </section>

        {result ? <ArtifactPanel state={state} activeView={activeView} setActiveView={setActiveView} /> : (
          <section className="artifact-panel" data-copilotkit-result="waiting">
            <EmptyArtifact onSample={() => runRequirement(examples[1]?.value || examples[0].value)} ready={isReady} running={agent.isRunning} />
          </section>
        )}
      </main>
    </div>
  );
}

export function App({ CopilotProvider }) {
  const [runtimeUrl, setRuntimeUrl] = useState(runtimeFromLocation);
  const [connectedUrl, setConnectedUrl] = useState('');
  const [providerError, setProviderError] = useState('');

  function changeRuntime() {
    setConnectedUrl('');
    setProviderError('');
  }

  if (!connectedUrl) {
    return (
      <div className="copilot-shell">
        <Header connected={false} runtimeUrl={runtimeUrl} onChangeRuntime={changeRuntime} />
        <BoundaryStrip />
        <main className="setup-main">
          <RuntimeSetup
            initialUrl={runtimeUrl}
            onConnected={(url) => {
              setRuntimeUrl(url);
              setConnectedUrl(url);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <CopilotProvider
      runtimeUrl={connectedUrl}
      showDevConsole={false}
      onError={({ error }) => setProviderError(error?.message || 'CopilotKit runtime error')}
      properties={{ product: 'HarnessLab', mode: 'deterministic-pilot' }}
    >
      {providerError ? <div className="provider-error" role="alert">{providerError}</div> : null}
      <CopilotWorkspace runtimeUrl={connectedUrl} onChangeRuntime={changeRuntime} />
    </CopilotProvider>
  );
}

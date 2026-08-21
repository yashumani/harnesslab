export const WORKSPACE_STORAGE_KEY = 'harnesslab.workspace.v1';
export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_RUNS_PER_PROJECT = 50;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeName(value) {
  if (typeof value !== 'string') throw new TypeError('Project name must be a string.');
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) throw new Error('Project name must contain at least 2 characters.');
  if (normalized.length > 80) throw new Error('Project name must be 80 characters or fewer.');
  return normalized;
}

function makeDefaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateStoredRun(run) {
  return isRecord(run)
    && typeof run.id === 'string'
    && run.id.length > 0
    && Number.isInteger(run.version)
    && run.version > 0
    && typeof run.savedAt === 'string'
    && typeof run.requirement === 'string'
    && typeof run.runId === 'string'
    && typeof run.architecture === 'string'
    && (run.score === null || Number.isFinite(run.score))
    && isRecord(run.result);
}

function validateStoredProject(project) {
  return isRecord(project)
    && typeof project.id === 'string'
    && project.id.length > 0
    && typeof project.name === 'string'
    && project.name.trim().length >= 2
    && project.name.length <= 80
    && typeof project.createdAt === 'string'
    && typeof project.updatedAt === 'string'
    && Array.isArray(project.runs)
    && project.runs.every(validateStoredRun);
}

function validateState(value) {
  return isRecord(value)
    && value.schemaVersion === WORKSPACE_SCHEMA_VERSION
    && typeof value.updatedAt === 'string'
    && typeof value.activeProjectId === 'string'
    && Array.isArray(value.projects)
    && value.projects.length > 0
    && value.projects.every(validateStoredProject)
    && value.projects.some((project) => project.id === value.activeProjectId);
}

function projectSnapshot(project) {
  return project ? cloneJson(project) : null;
}

export function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

export function createWorkspaceStore({
  storage = null,
  now = () => new Date().toISOString(),
  idFactory = makeDefaultId
} = {}) {
  let memoryValue = null;
  let persistenceMode = storage ? 'browser' : 'memory';

  function nextId(prefix) {
    const raw = String(idFactory()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || makeDefaultId();
    return `${prefix}-${raw}`;
  }

  function readRaw() {
    if (!storage) return memoryValue;
    try {
      return storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      persistenceMode = 'memory';
      return memoryValue;
    }
  }

  function writeRaw(raw) {
    memoryValue = raw;
    if (!storage || persistenceMode === 'memory') return;
    try {
      storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    } catch {
      persistenceMode = 'memory';
    }
  }

  function createStarterState() {
    const timestamp = now();
    const projectId = nextId('PRJ');
    return {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      updatedAt: timestamp,
      activeProjectId: projectId,
      projects: [{
        id: projectId,
        name: 'Starter harness project',
        createdAt: timestamp,
        updatedAt: timestamp,
        runs: []
      }]
    };
  }

  function loadState() {
    const raw = readRaw();
    if (!raw) {
      const starter = createStarterState();
      writeRaw(JSON.stringify(starter));
      return starter;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!validateState(parsed)) throw new Error('Invalid workspace schema.');
      const normalized = cloneJson(parsed);
      normalized.projects.forEach((project) => {
        project.runs = project.runs
          .sort((left, right) => left.version - right.version)
          .slice(-MAX_RUNS_PER_PROJECT);
      });
      return normalized;
    } catch {
      const starter = createStarterState();
      writeRaw(JSON.stringify(starter));
      return starter;
    }
  }

  let state = loadState();

  function persist() {
    writeRaw(JSON.stringify(state));
  }

  function getActiveProjectInternal() {
    return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
  }

  function getSnapshot() {
    return cloneJson(state);
  }

  function getActiveProject() {
    return projectSnapshot(getActiveProjectInternal());
  }

  function createProject(name) {
    const timestamp = now();
    const project = {
      id: nextId('PRJ'),
      name: normalizeName(name),
      createdAt: timestamp,
      updatedAt: timestamp,
      runs: []
    };
    state.projects.push(project);
    state.activeProjectId = project.id;
    state.updatedAt = timestamp;
    persist();
    return projectSnapshot(project);
  }

  function selectProject(projectId) {
    if (typeof projectId !== 'string' || !state.projects.some((project) => project.id === projectId)) {
      throw new Error('Project was not found.');
    }
    state.activeProjectId = projectId;
    state.updatedAt = now();
    persist();
    return getActiveProject();
  }

  function saveRun(result, { requirement = null } = {}) {
    if (!isRecord(result) || typeof result.runId !== 'string' || !isRecord(result.architecture) || !isRecord(result.evaluation)) {
      throw new TypeError('A complete harness result is required before saving a version.');
    }

    const project = getActiveProjectInternal();
    const timestamp = now();
    const version = project.runs.reduce((maximum, run) => Math.max(maximum, run.version), 0) + 1;
    const storedResult = cloneJson(result);
    const run = {
      id: nextId('VER'),
      version,
      savedAt: timestamp,
      requirement: typeof requirement === 'string' && requirement.trim()
        ? requirement.trim()
        : typeof storedResult.requirement === 'string' ? storedResult.requirement : '',
      runId: storedResult.runId,
      architecture: typeof storedResult.architecture.kind === 'string' ? storedResult.architecture.kind : 'Unspecified architecture',
      score: Number.isFinite(storedResult.evaluation.overall) ? storedResult.evaluation.overall : null,
      result: storedResult
    };

    project.runs.push(run);
    project.runs = project.runs.slice(-MAX_RUNS_PER_PROJECT);
    project.updatedAt = timestamp;
    state.updatedAt = timestamp;
    persist();
    return cloneJson(run);
  }

  function getRun(projectId, runId) {
    const project = state.projects.find((candidate) => candidate.id === projectId);
    const run = project?.runs.find((candidate) => candidate.id === runId);
    return run ? cloneJson(run) : null;
  }

  function exportWorkspace() {
    return JSON.stringify({
      exportType: 'HarnessLabWorkspaceBackup',
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      exportedAt: now(),
      workspace: getSnapshot()
    }, null, 2);
  }

  return {
    getSnapshot,
    getActiveProject,
    getPersistenceMode: () => persistenceMode,
    createProject,
    selectProject,
    saveRun,
    getRun,
    exportWorkspace
  };
}

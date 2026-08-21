import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  createWorkspaceStore,
  MAX_RUNS_PER_PROJECT,
  WORKSPACE_STORAGE_KEY
} from '../apps/web/workspace-store.js';

function sequence(values) {
  let index = 0;
  return () => values[index++] ?? `id-${index}`;
}

function result(overrides = {}) {
  return {
    runId: 'DEMO-ABC12345',
    requirement: 'Build a bounded analytics agent.',
    architecture: { kind: 'Single orchestrator with bounded tools' },
    evaluation: { overall: 91 },
    trace: [],
    ...overrides
  };
}

test('creates and persists a starter project', () => {
  const storage = createMemoryStorage();
  const store = createWorkspaceStore({
    storage,
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['starter'])
  });

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.projects.length, 1);
  assert.equal(snapshot.projects[0].name, 'Starter harness project');
  assert.equal(snapshot.activeProjectId, 'PRJ-starter');
  assert.ok(storage.getItem(WORKSPACE_STORAGE_KEY));
  assert.equal(store.getPersistenceMode(), 'browser');
});

test('creates and selects a named project', () => {
  const storage = createMemoryStorage();
  const store = createWorkspaceStore({
    storage,
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['starter', 'telecom'])
  });

  const project = store.createProject('  Telecom   anomaly lab  ');
  assert.equal(project.name, 'Telecom anomaly lab');
  assert.equal(store.getActiveProject().id, 'PRJ-telecom');
  assert.throws(() => store.createProject('x'), /at least 2 characters/);
  assert.throws(() => store.selectProject('missing'), /not found/);
});

test('saves immutable harness versions and survives a store reload', () => {
  const storage = createMemoryStorage();
  const timestamps = sequence([
    '2026-08-21T10:00:00.000Z',
    '2026-08-21T10:01:00.000Z',
    '2026-08-21T10:02:00.000Z'
  ]);
  const ids = sequence(['starter', 'version-1', 'version-2']);
  const store = createWorkspaceStore({ storage, now: timestamps, idFactory: ids });
  const original = result();

  const saved = store.saveRun(original, { requirement: 'A longer original requirement that should be retained.' });
  original.architecture.kind = 'Mutated after save';

  assert.equal(saved.version, 1);
  assert.equal(saved.requirement, 'A longer original requirement that should be retained.');
  assert.equal(store.getActiveProject().runs[0].result.architecture.kind, 'Single orchestrator with bounded tools');

  const reloaded = createWorkspaceStore({
    storage,
    now: () => '2026-08-21T10:03:00.000Z',
    idFactory: sequence(['unused'])
  });
  const project = reloaded.getActiveProject();
  assert.equal(project.runs.length, 1);
  assert.equal(project.runs[0].version, 1);
  assert.deepEqual(reloaded.getRun(project.id, saved.id), project.runs[0]);
});

test('recovers safely from malformed stored data', () => {
  const storage = createMemoryStorage({ [WORKSPACE_STORAGE_KEY]: '{broken-json' });
  const store = createWorkspaceStore({
    storage,
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['recovered'])
  });

  assert.equal(store.getSnapshot().activeProjectId, 'PRJ-recovered');
  assert.doesNotThrow(() => JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)));
});

test('falls back to memory when browser storage throws', () => {
  const failingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  const store = createWorkspaceStore({
    storage: failingStorage,
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['memory'])
  });

  assert.equal(store.getPersistenceMode(), 'memory');
  assert.equal(store.getActiveProject().id, 'PRJ-memory');
  assert.doesNotThrow(() => store.saveRun(result()));
});

test('caps retained history while preserving monotonically increasing versions', () => {
  const storage = createMemoryStorage();
  const store = createWorkspaceStore({
    storage,
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })()
  });

  for (let index = 0; index < MAX_RUNS_PER_PROJECT + 4; index += 1) {
    store.saveRun(result({ runId: `DEMO-${index}`, requirement: `Requirement ${index}` }));
  }

  const runs = store.getActiveProject().runs;
  assert.equal(runs.length, MAX_RUNS_PER_PROJECT);
  assert.equal(runs[0].version, 5);
  assert.equal(runs.at(-1).version, MAX_RUNS_PER_PROJECT + 4);
});

test('exports a versioned workspace backup', () => {
  const store = createWorkspaceStore({
    storage: createMemoryStorage(),
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['starter'])
  });
  store.saveRun(result());

  const backup = JSON.parse(store.exportWorkspace());
  assert.equal(backup.exportType, 'HarnessLabWorkspaceBackup');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.workspace.projects[0].runs.length, 1);
});

test('rejects incomplete result objects', () => {
  const store = createWorkspaceStore({
    storage: createMemoryStorage(),
    now: () => '2026-08-21T10:00:00.000Z',
    idFactory: sequence(['starter'])
  });
  assert.throws(() => store.saveRun({ runId: 'incomplete' }), /complete harness result/);
});

import express from 'express';
import {
  CopilotRuntime,
  InMemoryAgentRunner
} from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { createHarnessLabDeterministicAgent } from '../../apps/copilotkit-web/src/harnesslab-agent.js';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:4180',
  'http://localhost:4180',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'https://yashumani.github.io'
];

function parseOrigins(value) {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
  ]);
}

export function createHarnessLabCopilotServer({
  allowedOrigins = parseOrigins(process.env.COPILOTKIT_ALLOWED_ORIGINS)
} = {}) {
  const agent = createHarnessLabDeterministicAgent({ agentId: 'harnessArchitect' });
  const runtime = new CopilotRuntime({
    agents: { harnessArchitect: agent },
    runner: new InMemoryAgentRunner()
  });

  const app = express();
  app.disable('x-powered-by');

  app.use((request, response, next) => {
    const origin = request.headers.origin;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Vary', 'Origin, Access-Control-Request-Headers');

    if (origin && !allowedOrigins.has(origin)) {
      response.status(403).json({
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'This origin is not allowed to use the HarnessLab Copilot runtime.'
        }
      });
      return;
    }

    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader(
        'Access-Control-Allow-Headers',
        request.headers['access-control-request-headers'] || 'Content-Type, Authorization'
      );
      response.setHeader('Access-Control-Max-Age', '600');
      response.status(204).end();
      return;
    }

    next();
  });

  app.get('/health', (_request, response) => {
    response.json({
      service: 'harnesslab-copilotkit-runtime',
      status: 'ready',
      framework: 'CopilotKit v2',
      protocol: 'AG-UI',
      agents: ['harnessArchitect'],
      provider: 'deterministic',
      model: null,
      threadStore: 'memory',
      capabilities: {
        tools: false,
        childAgents: false,
        externalActions: false,
        productionMutation: false
      }
    });
  });

  app.use(
    '/api/copilotkit',
    createCopilotExpressHandler({
      runtime,
      basePath: '/'
    })
  );

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested HarnessLab Copilot runtime route does not exist.'
      }
    });
  });

  return { app, runtime, agent };
}

export function startHarnessLabCopilotServer() {
  const host = process.env.COPILOTKIT_HOST || '127.0.0.1';
  const port = Number(process.env.COPILOTKIT_PORT || 8790);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('COPILOTKIT_PORT must be an integer between 1024 and 65535.');
  }

  const { app } = createHarnessLabCopilotServer();
  const server = app.listen(port, host, () => {
    console.log(JSON.stringify({
      event: 'harnesslab.copilotkit.started',
      host,
      port,
      runtimeUrl: `http://${host}:${port}/api/copilotkit`,
      provider: 'deterministic',
      credentialsRequired: false
    }));
  });

  const shutdown = (signal) => {
    server.close(() => {
      console.log(JSON.stringify({ event: 'harnesslab.copilotkit.stopped', signal }));
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startHarnessLabCopilotServer();
}

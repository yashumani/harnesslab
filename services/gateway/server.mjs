import { loadGatewayConfig } from './config.mjs';
import { createGatewayServer } from './app.mjs';
import { createConfiguredProvider } from './provider-registry.mjs';

function createLogger() {
  function write(level, event, details = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details
    };
    const output = JSON.stringify(record);
    if (level === 'error') console.error(output);
    else console.log(output);
  }
  return {
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details)
  };
}

const config = loadGatewayConfig();
const provider = createConfiguredProvider(config);
const logger = createLogger();
const server = createGatewayServer({ config, provider, logger });
server.requestTimeout = config.requestTimeoutMs + 5000;
server.headersTimeout = Math.min(server.requestTimeout, 10000);
server.keepAliveTimeout = 5000;
server.maxRequestsPerSocket = 100;

server.listen(config.port, config.host, () => {
  logger.info('gateway.started', {
    host: config.host,
    port: config.port,
    environment: config.environment,
    provider: provider.name,
    model: provider.model,
    liveModel: provider.liveModel,
    configured: provider.configured,
    allowedOriginCount: config.allowedOrigins.length
  });
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('gateway.stopping', { signal });
  const forceTimer = setTimeout(() => {
    logger.error('gateway.stop.timeout', { signal });
    process.exit(1);
  }, 5000);
  forceTimer.unref();
  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      logger.error('gateway.stop.failed', { signal, code: error.code ?? 'UNKNOWN' });
      process.exit(1);
    }
    logger.info('gateway.stopped', { signal });
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

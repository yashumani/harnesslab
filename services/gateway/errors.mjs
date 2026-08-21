export class GatewayError extends Error {
  constructor(message, { code = 'GATEWAY_ERROR', status = 500, cause = null, expose = true } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    this.expose = expose;
    if (cause) this.cause = cause;
  }
}

export class RequestValidationError extends GatewayError {
  constructor(message, { code = 'INVALID_REQUEST', status = 400, cause = null } = {}) {
    super(message, { code, status, cause, expose: true });
    this.name = 'RequestValidationError';
  }
}

export class ProviderUnavailableError extends GatewayError {
  constructor(message = 'The configured model provider is unavailable.', { cause = null } = {}) {
    super(message, { code: 'PROVIDER_UNAVAILABLE', status: 503, cause, expose: true });
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderResponseError extends GatewayError {
  constructor(message = 'The configured model provider returned an invalid response.', { cause = null } = {}) {
    super(message, { code: 'PROVIDER_RESPONSE_ERROR', status: 502, cause, expose: true });
    this.name = 'ProviderResponseError';
  }
}

export class ProviderTimeoutError extends GatewayError {
  constructor(message = 'The configured model provider timed out.', { cause = null } = {}) {
    super(message, { code: 'PROVIDER_TIMEOUT', status: 504, cause, expose: true });
    this.name = 'ProviderTimeoutError';
  }
}

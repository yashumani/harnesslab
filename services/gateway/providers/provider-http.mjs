import {
  ProviderResponseError,
  ProviderTimeoutError,
  ProviderUnavailableError
} from '../errors.mjs';

export const DEFAULT_MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

function providerName(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : 'Provider';
}

export async function fetchProviderJson({
  fetchImpl,
  url,
  options = {},
  timeoutMs,
  upstreamSignal = null,
  providerLabel,
  maxResponseBytes = DEFAULT_MAX_PROVIDER_RESPONSE_BYTES
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Provider transport requires fetch.');
  const label = providerName(providerLabel);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('provider timeout')), timeoutMs);
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason ?? new Error('request aborted'));
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abortFromUpstream();
    else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
  }

  let response = null;
  let text;
  try {
    response = await fetchImpl(url, { ...options, signal: controller.signal });
    text = await response.text();
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new ProviderTimeoutError(`${label} did not complete within the configured timeout.`, { cause });
    }
    if (response) {
      throw new ProviderResponseError(`Unable to read the ${label} response.`, { cause });
    }
    throw new ProviderUnavailableError(`Unable to reach the configured ${label} service.`, { cause });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.('abort', abortFromUpstream);
  }

  if (text.length > maxResponseBytes) {
    throw new ProviderResponseError(`${label} response exceeded the allowed size.`);
  }

  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (cause) {
      throw new ProviderResponseError(`${label} returned invalid JSON.`, { cause });
    }
  }

  return { response, payload };
}

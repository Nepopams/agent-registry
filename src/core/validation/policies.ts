import type { AgentCard } from '../../types/agent-card.js';
import type { AjvError } from './agentCardValidator.js';

const TRANSPORT_PROTOCOLS: Record<string, string[]> = {
  http: ['http:'],
  https: ['https:'],
  websocket: ['ws:', 'wss:'],
  nats: ['nats:'],
  grpc: ['grpc:'],
  mqtt: ['mqtt:', 'mqtts:'],
  jsonrpc: ['https:', 'wss:']
};

const PROTOCOL_HINTS: Record<string, string> = {
  'http:': 'http://',
  'https:': 'https://',
  'ws:': 'ws://',
  'wss:': 'wss://',
  'grpc:': 'grpc://',
  'nats:': 'nats://',
  'mqtt:': 'mqtt://',
  'mqtts:': 'mqtts://'
};

const formatAllowed = (protocols: string[]): string =>
  protocols.map((proto) => PROTOCOL_HINTS[proto] ?? proto).join(' or ');

const parseProtocol = (url: string): string | null => {
  try {
    return new URL(url).protocol.toLowerCase();
  } catch {
    return null;
  }
};

const validateTransportUrl = (
  transport: string,
  url: string | undefined,
  path: string
): AjvError | null => {
  if (!transport || !url) {
    return null;
  }

  const expectedProtocols = TRANSPORT_PROTOCOLS[transport];
  if (!expectedProtocols || expectedProtocols.length === 0) {
    return null;
  }

  const protocol = parseProtocol(url);
  if (!protocol) {
    return {
      path,
      message: `${path} must be a valid URI for transport "${transport}".`
    } satisfies AjvError;
  }

  if (!expectedProtocols.includes(protocol)) {
    return {
      path,
      message: `${path} must use ${formatAllowed(expectedProtocols)} for transport "${transport}".`
    } satisfies AjvError;
  }

  return null;
};

export const assertTransportConsistency = (card: AgentCard): AjvError[] => {
  const errors: AjvError[] = [];
  const topLevelError = validateTransportUrl(card.preferredTransport, card.transportUrl, '/transportUrl');
  if (topLevelError) {
    errors.push(topLevelError);
  }

  if (Array.isArray(card.additionalInterfaces)) {
    card.additionalInterfaces.forEach((iface, index) => {
      const error = validateTransportUrl(
        iface.transport,
        iface.url,
        `/additionalInterfaces/${index}/url`
      );

      if (error) {
        errors.push(error);
      }
    });
  }

  return errors;
};

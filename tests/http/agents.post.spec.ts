import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import agentSeeds from '../../src/db/seed-agents.js';
import { buildServer } from '../../src/http/server.js';

describe('POST /agents', () => {
  const [seedAgent] = agentSeeds;
  let app = buildServer();

  beforeEach(async () => {
    app = buildServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 for a valid AgentCard payload', async () => {
    const response = await request(app.server).post('/agents').send(structuredClone(seedAgent));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'accepted' });
  });

  it('returns 400 when required fields are missing', async () => {
    const { version, ...brokenPayload } = structuredClone(seedAgent);
    delete (brokenPayload as Record<string, unknown>).version;

    const response = await request(app.server).post('/agents').send(brokenPayload);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('/version is required.');
    expect(response.body.details[0]).toEqual({
      path: '/version',
      message: '/version is required.'
    });
  });

  const mismatchedTransports = [
    {
      name: 'http',
      transport: 'http',
      url: 'https://transport.example.com/over-http',
      expectedHint: 'http://'
    },
    {
      name: 'jsonrpc',
      transport: 'jsonrpc',
      url: 'grpc://transport.example.com/jsonrpc',
      expectedHint: 'https:// or wss://'
    },
    {
      name: 'grpc',
      transport: 'grpc',
      url: 'https://transport.example.com/grpc',
      expectedHint: 'grpc://'
    }
  ] as const;

  for (const scenario of mismatchedTransports) {
    it(`returns 422 when preferred transport ${scenario.name} mismatches URL scheme`, async () => {
      const payload = structuredClone(seedAgent);
      payload.preferredTransport = scenario.transport as typeof payload.preferredTransport;
      payload.transportUrl = scenario.url;

      const response = await request(app.server).post('/agents').send(payload);

      expect(response.status).toBe(422);
      expect(response.body.message).toContain(scenario.expectedHint);
      expect(response.body.details[0].path).toBe('/transportUrl');
      expect(response.body.details[0].message).toContain(scenario.expectedHint);
    });
  }
});

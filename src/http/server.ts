import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import agentSeeds from '../db/seed-agents.js';
import { validateAgentCard } from '../core/validation/agentCardValidator.js';
import { assertTransportConsistency } from '../core/validation/policies.js';
import type { AgentCard } from '../types/agent-card.js';
import { agentCardSchema, agentSkillSchema } from '../types/agent-card.js';

const exampleAgents = agentSeeds.slice(0, 3);

const PAGINATION_SCHEMA = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    offset: { type: 'integer', minimum: 0 }
  }
} as const;

const cloneSchema = <T>(schema: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(schema)
    : JSON.parse(JSON.stringify(schema));

const agentCardRouteSchema = cloneSchema(agentCardSchema);
delete (agentCardRouteSchema as { $schema?: string }).$schema;

const skillRouteSchema = cloneSchema(agentSkillSchema);
delete (skillRouteSchema as { $schema?: string }).$schema;
skillRouteSchema.$id = './agent-skill.schema.json';

const skillsProperty = (agentCardRouteSchema as Record<string, any>).properties?.skills;
if (skillsProperty?.items) {
  skillsProperty.items = skillRouteSchema;
}

const listResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: agentCardRouteSchema
    }
  },
  example: {
    items: exampleAgents
  }
} as const;

const singleResponseSchema = {
  type: 'object',
  properties: {
    card: agentCardRouteSchema
  },
  example: {
    card: exampleAgents[0]
  }
} as const;

const normalizeLimit = (limit?: number) => {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 100);
};

const normalizeOffset = (offset?: number) => {
  if (typeof offset !== 'number' || Number.isNaN(offset) || offset < 0) {
    return 0;
  }

  return offset;
};

const paginate = (items: AgentCard[], limit?: number, offset?: number) => {
  const normalizedLimit = normalizeLimit(limit);
  const normalizedOffset = normalizeOffset(offset);
  return items.slice(normalizedOffset, normalizedOffset + normalizedLimit);
};

const buildAgentsRoute = (app: FastifyInstance) => {
  app.post<{
    Body: AgentCard;
  }>('/agents', {
    schema: {
      summary: 'Publish an AgentCard',
      tags: ['Agents'],
      body: {
        ...agentCardRouteSchema,
        examples: exampleAgents.map((card) => ({
          summary: card.name,
          value: card
        }))
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          },
          example: {
            status: 'accepted'
          }
        }
      }
    }
  }, async (request, reply) => {
    const validation = validateAgentCard(request.body);

    if (!validation.ok) {
      const [firstError] = validation.errors;
      return reply.status(400).send({
        statusCode: 400,
        error: 'ValidationError',
        message: firstError?.message ?? 'AgentCard payload is invalid.',
        details: validation.errors
      });
    }

    const policyErrors = assertTransportConsistency(request.body);
    if (policyErrors.length > 0) {
      const [firstPolicyError] = policyErrors;
      return reply.status(422).send({
        statusCode: 422,
        error: 'TransportPolicyViolation',
        message: firstPolicyError?.message ?? 'Transport configuration is invalid.',
        details: policyErrors
      });
    }

    return reply.status(200).send({
      status: 'accepted'
    });
  });
};

const buildReadRoutes = (app: FastifyInstance) => {
  app.get('/agents', {
    schema: {
      summary: 'List published agents',
      tags: ['Agents'],
      querystring: PAGINATION_SCHEMA,
      response: { 200: listResponseSchema }
    }
  }, async (request) => {
    const { limit, offset } = request.query as { limit?: number; offset?: number };
    return { items: paginate(agentSeeds, limit, offset) };
  });

  app.get('/agents/:name', {
    schema: {
      summary: 'Get the latest agent by name',
      tags: ['Agents'],
      params: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } }
      },
      response: { 200: singleResponseSchema }
    }
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const card = agentSeeds.find((seed) => seed.name === name);
    if (!card) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Agent not found'
      });
    }
    return { card };
  });

  app.get('/agents/:name/versions/:version', {
    schema: {
      summary: 'Get a specific agent version',
      tags: ['Agents'],
      params: {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' }
        }
      },
      response: { 200: singleResponseSchema }
    }
  }, async (request, reply) => {
    const { name, version } = request.params as { name: string; version: string };
    const card = agentSeeds.find((seed) => seed.name === name && seed.version === version);
    if (!card) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'NotFound',
        message: 'Agent version not found'
      });
    }
    return { card };
  });

  app.get('/search', {
    schema: {
      summary: 'Search agents by skill identifier',
      tags: ['Agents'],
      querystring: {
        type: 'object',
        required: ['skill'],
        properties: {
          skill: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 }
        }
      },
      response: { 200: listResponseSchema }
    }
  }, async (request, reply) => {
    const { skill, limit, offset } = request.query as {
      skill?: string;
      limit?: number;
      offset?: number;
    };

    if (!skill) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'BadRequest',
        message: 'Query parameter "skill" is required.'
      });
    }

    const matches = agentSeeds.filter(
      (card) => Array.isArray(card.skills) && card.skills.some((s) => s.id === skill)
    );

    return { items: paginate(matches, limit, offset) };
  });
};

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: false
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Agent Registry API',
        version: '0.1.0'
      },
      tags: [
        {
          name: 'Agents',
          description: 'Operations for publishing and discovering AgentCards.'
        }
      ]
    }
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });

  app.addSchema(skillRouteSchema);
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  buildAgentsRoute(app);
  buildReadRoutes(app);

  return app;
};

export default buildServer;

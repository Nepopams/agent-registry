import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import agentSeeds from '../src/db/seed-agents.js';
import { AgentCard, agentCardSchema, agentSkillSchema } from '../src/types/agent-card.js';

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addSchema(agentSkillSchema, agentSkillSchema.$id);
addFormats(ajv);
const validateAgentCard = ajv.compile<AgentCard>(agentCardSchema);

const analyticsSkill = {
  name: 'analyze-events',
  version: '1.0.0',
  description: 'Aggregates and analyzes product events.',
  category: 'analytics',
  visibility: 'public',
  inputs: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'Raw events to aggregate.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            payload: { type: 'object' }
          },
          required: ['id']
        }
      }
    },
    required: ['events']
  },
  outputs: {
    type: 'object',
    properties: {
      aggregates: {
        type: 'object',
        description: 'Metrics grouped by dimension.'
      }
    },
    required: ['aggregates']
  },
  runtime: {
    type: 'http',
    entryPoint: 'POST /skills/analyze-events',
    timeoutMs: 800
  },
  examples: [
    {
      name: 'count-events',
      description: 'Returns counts grouped by id.',
      input: { events: [{ id: 'a1', payload: { foo: 'bar' } }] },
      output: { aggregates: { a1: 1 } }
    }
  ]
} as const;

const translationSkill = {
  name: 'translate-text',
  version: '3.2.1',
  description: 'Translates text snippets between languages.',
  category: 'nlp',
  visibility: 'public',
  inputs: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      targetLocale: { type: 'string' }
    },
    required: ['text', 'targetLocale']
  },
  outputs: {
    type: 'object',
    properties: {
      translated: { type: 'string' }
    },
    required: ['translated']
  },
  runtime: {
    type: 'process',
    entryPoint: 'node skills/translate.js',
    timeoutMs: 600
  },
  examples: [
    {
      name: 'ru-to-en',
      description: 'Translate text from Russian to English.',
      input: { text: 'Привет, мир', targetLocale: 'en-US' },
      output: { translated: 'Hello, world' }
    }
  ]
} as const;

const additionalValidCards: AgentCard[] = [
  {
    protocolVersion: 'a2a/1.0',
    name: 'Product Analytics Agent',
    version: '1.0.0',
    description: 'Produces behavioral analytics by aggregating instrumentation streams.',
    skills: [analyticsSkill],
    securitySchemes: [
      {
        name: 'analytics-api-key',
        type: 'apiKey',
        in: 'header',
        keyName: 'x-api-key',
        description: 'API key securing analytics agent.'
      }
    ],
    security: [
      {
        scheme: 'analytics-api-key'
      }
    ],
    preferredTransport: 'https',
    transportUrl: 'https://analytics.example.com/api'
  },
  {
    protocolVersion: 'a2a/1.0',
    name: 'Polyglot Translator',
    version: '3.2.1',
    description: 'Offers near real-time translations across twenty locales for short texts.',
    skills: [translationSkill],
    securitySchemes: [
      {
        name: 'polyglot-oauth',
        type: 'oauth2',
        description: 'OAuth2 scopes for translator access.'
      }
    ],
    security: [
      {
        scheme: 'polyglot-oauth',
        scopes: ['translations:write']
      }
    ],
    preferredTransport: 'websocket',
    transportUrl: 'wss://polyglot.example/ws',
    additionalTransports: ['https']
  }
];

type InvalidCase = {
  name: string;
  card: AgentCard;
  expectedPath: string;
};

const invalidCases: InvalidCase[] = [
  {
    name: 'missing-description',
    card: {
      protocolVersion: 'a2a/1.0',
      name: 'Broken Card',
      version: '1.0.0',
      skills: [translationSkill],
      securitySchemes: [],
      security: [],
      preferredTransport: 'https',
      transportUrl: 'https://broken.example/api'
    } as AgentCard,
    expectedPath: ''
  },
  {
    name: 'invalid-version-format',
    card: {
      protocolVersion: 'a2a/1.0',
      name: 'Bad Version',
      version: '1.0',
      description: 'Version string does not follow semver spec.',
      skills: [translationSkill],
      securitySchemes: [],
      security: [],
      preferredTransport: 'https',
      transportUrl: 'https://bad-version.example/api'
    } as AgentCard,
    expectedPath: '/version'
  },
  {
    name: 'skill-missing-examples',
    card: {
      protocolVersion: 'a2a/1.0',
      name: 'Example Missing',
      version: '1.1.0',
      description: 'Skill does not provide required example payloads.',
      skills: [
        {
          ...analyticsSkill,
          examples: []
        }
      ],
      securitySchemes: [],
      security: [],
      preferredTransport: 'https',
      transportUrl: 'https://missing-examples.example/api'
    } as AgentCard,
    expectedPath: '/skills/0/examples'
  },
  {
    name: 'unsupported-transport',
    card: {
      protocolVersion: 'a2a/1.0',
      name: 'Unknown Transport',
      version: '1.0.0',
      description: 'Uses a transport that is not part of the contract.',
      skills: [translationSkill],
      securitySchemes: [],
      security: [],
      preferredTransport: 'smtp',
      transportUrl: 'smtp://unsupported.example'
    } as AgentCard,
    expectedPath: '/preferredTransport'
  },
  {
    name: 'invalid-example-structure',
    card: {
      protocolVersion: 'a2a/1.0',
      name: 'Bad Example',
      version: '1.0.1',
      description: 'Example payload is malformed.',
      skills: [
        {
          ...translationSkill,
          examples: [
            {
              name: 'broken',
              description: 'missing structured output',
              input: 'not-an-object' as unknown as Record<string, unknown>,
              output: { translated: 'ok' }
            }
          ]
        }
      ],
      securitySchemes: [],
      security: [],
      preferredTransport: 'https',
      transportUrl: 'https://bad-example.example/api'
    } as AgentCard,
    expectedPath: '/skills/0/examples/0/input'
  }
];

describe('AgentCard schema', () => {
  it('compiles with Ajv without throwing', () => {
    expect(validateAgentCard.schema).toBeDefined();
  });

  it('accepts 5 valid agent cards', () => {
    const validCards = [...agentSeeds, ...additionalValidCards];
    expect(validCards).toHaveLength(5);

    for (const card of validCards) {
      const result = validateAgentCard(card);
      const errors = validateAgentCard.errors;
      expect(result).toBe(true);
      expect(errors).toBeNull();
    }
  });

  it('rejects invalid cards with precise instancePath', () => {
    for (const invalid of invalidCases) {
      const result = validateAgentCard(invalid.card);
      expect(result).toBe(false);
      const [firstError] = validateAgentCard.errors ?? [];
      expect(firstError?.instancePath).toBe(invalid.expectedPath);
      expect(firstError?.message).toBeDefined();
    }
  });
});

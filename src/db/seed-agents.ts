import { AgentCard } from '../types/agent-card.js';

export const agentSeeds: AgentCard[] = [
  {
    protocolVersion: 'a2a/1.0',
    name: 'Atlas Research Agent',
    version: '1.3.0',
    description:
      'Research-focused agent that orchestrates web search, ranking and evidence packaging for downstream consumers.',
    tags: ['research', 'web', 'analysis'],
    maintainers: [
      { name: 'Helena Rao', email: 'helena@atlas.example' }
    ],
    homepage: 'https://agents.example.com/atlas',
    documentation: 'https://docs.example.com/atlas',
    security: {
      authentication: 'api-key',
      encryption: 'required',
      audience: 'atlas-clients'
    },
    preferredTransport: 'https',
    additionalTransports: ['websocket'],
    additionalInterfaces: [
      {
        name: 'status-endpoint',
        endpoint: 'https://agents.example.com/atlas/status',
        protocol: 'rest',
        description: 'Operational status feed for Atlas'
      }
    ],
    preferredLocales: ['en-US'],
    metadata: {
      maturity: 'stable',
      owners: 'insights'
    },
    createdAt: '2025-01-12T10:00:00.000Z',
    updatedAt: '2025-02-01T16:35:00.000Z',
    skills: [
      {
        name: 'search-web',
        version: '1.1.0',
        description: 'Executes federated web search with ranking heuristics.',
        category: 'discovery',
        visibility: 'public',
        inputs: {
          type: 'object',
          description: 'Fields required to perform a web search.',
          properties: {
            query: {
              type: 'string',
              description: 'Free text query.'
            },
            topK: {
              type: 'integer',
              description: 'Number of ranked results to return.'
            }
          },
          required: ['query']
        },
        outputs: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              description: 'Ranked search hits.',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Result title.'
                  },
                  url: {
                    type: 'string',
                    description: 'Canonical URL.'
                  }
                },
                required: ['title', 'url']
              }
            }
          },
          required: ['results']
        },
        runtime: {
          type: 'http',
          entryPoint: 'POST /skills/atlas/search-web',
          timeoutMs: 1200,
          dependencies: ['serp-stack@2.0']
        },
        telemetry: {
          emitsLogs: true,
          emitsMetrics: true
        },
        security: {
          requiresAuth: true,
          scopes: ['search:execute']
        },
        examples: [
          {
            name: 'basic-search',
            description: 'Search for Fastify articles.',
            input: { query: 'Fastify security best practices' },
            output: {
              results: [
                {
                  title: 'Fastify Best Practices',
                  url: 'https://fastify.dev/best-practices'
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    protocolVersion: 'a2a/1.0',
    name: 'Workflow Automator',
    version: '2.0.0',
    description:
      'Agent that chains internal tools, approvals and notifications to automate repetitive workflows.',
    tags: ['automation', 'internal'],
    maintainers: [
      { name: 'Priya Kapoor', email: 'priya@workflows.example' }
    ],
    security: {
      authentication: 'oauth2',
      encryption: 'required',
      audience: 'workspace-automation'
    },
    preferredTransport: 'grpc',
    metadata: {
      environment: 'production'
    },
    createdAt: '2024-10-01T08:00:00.000Z',
    updatedAt: '2025-01-05T09:00:00.000Z',
    skills: [
      {
        name: 'route-approval',
        version: '2.0.0',
        description: 'Routes approval objects to the correct approver based on policy.',
        category: 'workflow',
        visibility: 'internal',
        inputs: {
          type: 'object',
          properties: {
            approvalType: {
              type: 'string',
              description: 'Type of approval being requested.'
            },
            payload: {
              type: 'object',
              description: 'Opaque approval payload.'
            }
          },
          required: ['approvalType', 'payload']
        },
        outputs: {
          type: 'object',
          properties: {
            routedTo: {
              type: 'string',
              description: 'Identifier of the approver.'
            }
          },
          required: ['routedTo']
        },
        runtime: {
          type: 'container',
          entryPoint: 'gcr.io/agents/workflow:2.0.0',
          timeoutMs: 2000,
          memory: 256
        },
        security: {
          requiresAuth: true,
          scopes: ['approvals:route']
        },
        examples: [
          {
            name: 'hardware-request',
            description: 'Route laptop approval to direct manager.',
            input: {
              approvalType: 'hardware',
              payload: { employeeId: 'E-100', amount: 2400 }
            },
            output: { routedTo: 'manager:E-100' }
          }
        ]
      }
    ]
  },
  {
    protocolVersion: 'a2a/1.0',
    name: 'Insight Summarizer',
    version: '0.9.0',
    description:
      'Summarizes collections of documents with citations, footnotes and precision scoring.',
    tags: ['summarization', 'nlp'],
    maintainers: [
      { name: 'Marco Stein', email: 'marco@summaries.example' }
    ],
    security: {
      authentication: 'mutual-tls',
      encryption: 'required',
      audience: 'summaries-clients'
    },
    preferredTransport: 'https',
    documentation: 'https://docs.example.com/insight-summarizer',
    createdAt: '2024-06-11T12:00:00.000Z',
    updatedAt: '2025-02-14T12:00:00.000Z',
    skills: [
      {
        name: 'summarize-documents',
        version: '0.9.0',
        description: 'Summarizes a batch of documents with citation mapping.',
        category: 'nlp',
        visibility: 'private',
        inputs: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              description: 'List of documents to summarize.',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Document identifier.'
                  },
                  body: {
                    type: 'string',
                    description: 'Content of the document.'
                  }
                },
                required: ['id', 'body']
              }
            },
            style: {
              type: 'string',
              description: 'Tone of the summary.'
            }
          },
          required: ['documents']
        },
        outputs: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Resulting summary.'
            },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  documentId: {
                    type: 'string',
                    description: 'Source document id.'
                  },
                  sentence: {
                    type: 'string',
                    description: 'Excerpt used in the summary.'
                  }
                },
                required: ['documentId', 'sentence']
              }
            }
          },
          required: ['summary']
        },
        runtime: {
          type: 'process',
          entryPoint: 'python skills/summarize.py',
          timeoutMs: 1500,
          dependencies: ['spacy==3.7.0']
        },
        telemetry: {
          emitsLogs: true,
          emitsMetrics: false
        },
        examples: [
          {
            name: 'two-documents',
            description: 'Summarize two internal updates.',
            input: {
              documents: [
                { id: 'doc-1', body: 'Release notes for sprint 12.' },
                { id: 'doc-2', body: 'Incident review for outage 22.' }
              ]
            },
            output: {
              summary: 'Provides consolidated release and incident summary.',
              citations: [
                { documentId: 'doc-1', sentence: 'Release notes for sprint 12.' }
              ]
            }
          }
        ]
      }
    ]
  }
];

export default agentSeeds;

import Fastify, { type FastifyInstance } from 'fastify';
import { validateAgentCard } from '../core/validation/agentCardValidator.js';
import { assertTransportConsistency } from '../core/validation/policies.js';
import type { AgentCard } from '../types/agent-card.js';

const buildAgentsRoute = (app: FastifyInstance) => {
  app.post<{
    Body: AgentCard;
  }>('/agents', async (request, reply) => {
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

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: false
  });

  buildAgentsRoute(app);

  return app;
};

export default buildServer;

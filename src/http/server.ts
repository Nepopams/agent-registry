import Fastify, { type FastifyInstance } from 'fastify';
import { validateAgentCard } from '../core/validation/agentCardValidator.js';
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

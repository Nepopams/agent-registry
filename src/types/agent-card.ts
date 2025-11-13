import agentCardSchemaSource from '../../schemas/agent-card.schema.json' assert { type: 'json' };
import agentSkillSchemaSource from '../../schemas/agent-skill.schema.json' assert { type: 'json' };
import { FromSchema } from 'json-schema-to-ts';

export const agentSkillSchema = agentSkillSchemaSource as const;
export type AgentSkill = FromSchema<typeof agentSkillSchema>;

export const agentCardSchema = agentCardSchemaSource as const;
export type AgentCard = FromSchema<typeof agentCardSchema>;

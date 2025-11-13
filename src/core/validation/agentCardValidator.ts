import Ajv, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {
  type AgentCard,
  agentCardSchema,
  agentSkillSchema
} from '../../types/agent-card.js';

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  allowUnionTypes: true
});

addFormats(ajv);
ajv.addSchema(agentSkillSchema, agentSkillSchema.$id);

const validateAgentCardSchema = ajv.compile<AgentCard>(agentCardSchema);

const REQUIRED_TOP_LEVEL_FIELDS: Array<keyof AgentCard> = [
  'protocolVersion',
  'name',
  'version'
];

export type AjvError = {
  path: string;
  message: string;
};

export type AgentCardValidationResult =
  | { ok: true }
  | {
      ok: false;
      errors: AjvError[];
    };

const toPath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

const normalizePath = (error: ErrorObject): string => {
  if (
    error.keyword === 'required' &&
    typeof (error.params as { missingProperty?: string }).missingProperty === 'string'
  ) {
    const missing = (error.params as { missingProperty: string }).missingProperty;
    const basePath = error.instancePath || '';
    const normalized = `${basePath}/${missing}`.replace(/\/{2,}/g, '/');
    return normalized ? toPath(normalized) : toPath(missing);
  }

  return error.instancePath ? error.instancePath : '/';
};

const normalizeMessage = (error: ErrorObject, path: string): string => {
  if (error.keyword === 'required') {
    return `${path} is required.`;
  }

  if (error.keyword === 'minItems' && path === '/skills') {
    return `${path} must contain at least one skill.`;
  }

  const suffix = error.message ? error.message.replace(/^(must|should)\s*/i, '') : 'is invalid.';
  return `${path} ${suffix}`.trim().replace(/\s+\./g, '.');
};

const mapErrors = (errors: ErrorObject[] | null | undefined): AjvError[] => {
  if (!errors?.length) {
    return [];
  }

  return errors.map((error) => {
    const path = normalizePath(error);
    return {
      path,
      message: normalizeMessage(error, path)
    };
  });
};

const preflightRequiredFields = (card: Record<string, unknown>): AjvError[] => {
  const payload = card as Record<string, unknown>;
  const errors: AjvError[] = [];

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (payload[field] === undefined) {
      errors.push({
        path: `/${field.toString()}`,
        message: `/${field.toString()} is required.`
      });
    }
  }

  const skills = payload.skills;
  if (!Array.isArray(skills) || skills.length === 0) {
    errors.push({
      path: '/skills',
      message: '/skills must contain at least one skill.'
    });
  }

  return errors;
};

export const validateAgentCard = (card: unknown): AgentCardValidationResult => {
  if (!card || typeof card !== 'object') {
    return {
      ok: false,
      errors: [
        {
          path: '/',
          message: '/ must be a JSON object.'
        }
      ]
    };
  }

  const preflight = preflightRequiredFields(card as Record<string, unknown>);

  const valid = validateAgentCardSchema(card);

  if (valid) {
    return { ok: true };
  }

  const ajvErrors = mapErrors(validateAgentCardSchema.errors);
  const merged: AjvError[] = [...preflight];

  for (const error of ajvErrors) {
    if (!merged.some((existing) => existing.path === error.path && existing.message === error.message)) {
      merged.push(error);
    }
  }

  return {
    ok: false,
    errors: merged
  };
};

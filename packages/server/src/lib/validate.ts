import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeAny, z } from "zod";

interface ValidationIssue {
  path: string;
  message: string;
}

function formatIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function sendValidationError(reply: FastifyReply, error: z.ZodError): void {
  reply.code(400).send({
    error: "ValidationError",
    message: "Request validation failed",
    issues: formatIssues(error),
  });
}

/**
 * Fastify preValidation hook that replaces the raw payload with the parsed
 * (and therefore stripped) value. Anything the schema does not accept is
 * rejected with 400 before it reaches a database query.
 */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      sendValidationError(reply, result.error);
      return;
    }
    request.body = result.data;
  };
}

export function validateQuery<S extends ZodTypeAny>(schema: S) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      sendValidationError(reply, result.error);
      return;
    }
    request.query = result.data as typeof request.query;
  };
}

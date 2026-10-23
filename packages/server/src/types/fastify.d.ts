import type { UserRole } from "@hrp/shared";
import "fastify";
import type { ActorScope } from "../authz/scope.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      role: UserRole;
      facilityId: string;
    };
    actor: ActorScope;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role?: UserRole; facilityId?: string; type?: string };
    user: { sub: string; role: UserRole; facilityId: string };
  }
}

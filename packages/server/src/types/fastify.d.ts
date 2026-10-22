import "fastify";
import type { UserRole } from "@hrp/shared";

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
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role?: UserRole; facilityId?: string; type?: string };
    user: { sub: string; role: UserRole; facilityId: string };
  }
}

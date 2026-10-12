import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';

export const facilityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async () => {
    return db.selectFrom('facilities').selectAll().orderBy('level').execute();
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const facility = await db.selectFrom('facilities').selectAll().where('id', '=', id).executeTakeFirst();
    if (!facility) return reply.code(404).send({ message: 'Facility not found' });
    return facility;
  });

  app.get('/:id/children', async (request) => {
    const { id } = request.params as { id: string };
    return db.selectFrom('facilities').selectAll().where('parent_id', '=', id).execute();
  });
};
import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';

export const queueRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const user = request.user;
    return db.selectFrom('sync_queue')
      .selectAll()
      .where('status', 'in', ['PENDING', 'FAILED', 'CONFLICT'])
      .orderBy('created_at', 'asc')
      .execute();
  });

  app.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await db.selectFrom('sync_queue').selectAll().where('id', '=', id).executeTakeFirst();
    if (!item) return reply.code(404).send({ message: 'Queue item not found' });

    await db.updateTable('sync_queue')
      .set({ status: 'PENDING', retry_count: item.retry_count + 1, last_error: null, updated_at: new Date() })
      .where('id', '=', id)
      .execute();

    return { ...item, status: 'PENDING', retry_count: item.retry_count + 1 };
  });
};
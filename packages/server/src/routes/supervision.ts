import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { SupervisionFilterSchema, PaginationSchema } from '@hrp/shared';

export const supervisionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/alerts', {
    schema: { querystring: SupervisionFilterSchema.merge(PaginationSchema) },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', ...filters } = request.query;

    let query = db.selectFrom('supervision_alerts').selectAll();

    if (filters.facilityId) query = query.where('facility_id', '=', filters.facilityId);
    if (filters.type) query = query.where('type', '=', filters.type);
    if (filters.severity) query = query.where('severity', '=', filters.severity);
    if (filters.acknowledged !== undefined) query = query.where('acknowledged', '=', filters.acknowledged);
    if (filters.dateFrom) query = query.where('created_at', '>=', filters.dateFrom);
    if (filters.dateTo) query = query.where('created_at', '<=', filters.dateTo);

    const total = await query.select(db.fn.count('id').as('count')).executeTakeFirstOrThrow();
    const data = await query
      .orderBy(sortBy, sortOrder as 'asc' | 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .execute();

    return { data, total: Number(total.count), page, limit };
  });

  app.post('/alerts/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const result = await db.updateTable('supervision_alerts')
      .set({
        acknowledged: true,
        acknowledged_by: user.sub,
        acknowledged_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return reply.code(404).send({ message: 'Alert not found' });
    return result;
  });
};
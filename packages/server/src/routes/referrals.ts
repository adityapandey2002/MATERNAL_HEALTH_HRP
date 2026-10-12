import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { CreateReferralSchema, PaginationSchema } from '@hrp/shared';

export const referralRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', {
    schema: { querystring: PaginationSchema },
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query;

    const total = await db.selectFrom('referrals').select(db.fn.count('id').as('count')).executeTakeFirstOrThrow();
    const data = await db.selectFrom('referrals')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .execute();

    return { data, total: Number(total.count), page, limit };
  });

  app.post('/', {
    schema: { body: CreateReferralSchema },
  }, async (request, reply) => {
    const data = request.body;
    const user = request.user;

    const result = await db.insertInto('referrals')
      .values({ ...data, referred_by: user.sub })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(result);
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body;
    const user = request.user;

    const result = await db.updateTable('referrals')
      .set({
        ...data,
        status: data.status,
        responded_at: data.status !== 'PENDING' ? new Date() : null,
        responded_by: data.status !== 'PENDING' ? user.sub : null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return reply.code(404).send({ message: 'Referral not found' });
    return result;
  });
};
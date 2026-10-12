import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { CreatePatientSchema, UpdatePatientSchema, PatientFilterSchema, PaginationSchema } from '@hrp/shared';
import { calculateRiskScore } from '@hrp/shared/rules';

export const patientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', {
    schema: { querystring: PatientFilterSchema.merge(PaginationSchema) },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', ...filters } = request.query;

    let query = db.selectFrom('patients').selectAll();

    if (filters.facilityId) query = query.where('facility_id', '=', filters.facilityId);
    if (filters.riskLevel) query = query.where('risk_level', '=', filters.riskLevel);
    if (filters.isHighRisk !== undefined) query = query.where('is_high_risk', '=', filters.isHighRisk);
    if (filters.search) {
      query = query.where(eb => eb.or([
        eb('name', 'ilike', `%${filters.search}%`),
        eb('phone', 'ilike', `%${filters.search}%`),
        eb('id', 'ilike', `%${filters.search}%`),
      ]));
    }
    if (filters.gestationalWeeksMin !== undefined) {
      query = query.where('gestational_weeks', '>=', filters.gestationalWeeksMin);
    }
    if (filters.gestationalWeeksMax !== undefined) {
      query = query.where('gestational_weeks', '<=', filters.gestationalWeeksMax);
    }

    const total = await query.select(db.fn.count('id').as('count')).executeTakeFirstOrThrow();
    const data = await query
      .orderBy(sortBy, sortOrder as 'asc' | 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .execute();

    return { data, total: Number(total.count), page, limit };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await db.selectFrom('patients').selectAll().where('id', '=', id).executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: 'Patient not found' });
    return patient;
  });

  app.post('/', {
    schema: { body: CreatePatientSchema },
  }, async (request, reply) => {
    const data = request.body;
    const user = request.user;

    const { score, level, factors } = calculateRiskScore(
      { ...data, id: '', risk_factors: data.riskFactors, risk_score: 0, risk_level: 'GREEN', is_high_risk: false } as any,
      null
    );

    const result = await db.insertInto('patients')
      .values({
        ...data,
        facility_id: user.facilityId,
        registered_by: user.sub,
        lmp: data.lmp ? new Date(data.lmp) : null,
        edd: data.lmp ? new Date(new Date(data.lmp).getTime() + 280 * 24 * 60 * 60 * 1000) : null,
        risk_factors: data.riskFactors,
        risk_score: score,
        risk_level: level,
        is_high_risk: level !== 'GREEN',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(result);
  });

  app.patch('/:id', {
    schema: { body: UpdatePatientSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body;

    const existing = await db.selectFrom('patients').selectAll().where('id', '=', id).executeTakeFirst();
    if (!existing) return reply.code(404).send({ message: 'Patient not found' });

    const merged = { ...existing, ...data, risk_factors: data.riskFactors ?? existing.risk_factors };
    const { score, level } = calculateRiskScore(merged as any, null);

    const result = await db.updateTable('patients')
      .set({
        ...data,
        risk_factors: data.riskFactors ?? existing.risk_factors,
        risk_score: score,
        risk_level: level,
        is_high_risk: level !== 'GREEN',
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom('patients').where('id', '=', id).execute();
    return reply.code(204).send();
  });
};
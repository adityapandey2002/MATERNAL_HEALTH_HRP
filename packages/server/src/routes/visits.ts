import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { CreateVisitSchema, VisitFilterSchema, PaginationSchema } from '@hrp/shared';

export const visitRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', {
    schema: { querystring: VisitFilterSchema.merge(PaginationSchema) },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'visit_date', sortOrder = 'desc', ...filters } = request.query;

    let query = db.selectFrom('visits').selectAll();

    if (filters.patientId) query = query.where('patient_id', '=', filters.patientId);
    if (filters.facilityId) query = query.where('facility_id', '=', filters.facilityId);
    if (filters.conductedBy) query = query.where('conducted_by', '=', filters.conductedBy);
    if (filters.dateFrom) query = query.where('visit_date', '>=', filters.dateFrom);
    if (filters.dateTo) query = query.where('visit_date', '<=', filters.dateTo);

    const total = await query.select(db.fn.count('id').as('count')).executeTakeFirstOrThrow();
    const data = await query
      .orderBy(sortBy, sortOrder as 'asc' | 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .execute();

    return { data, total: Number(total.count), page, limit };
  });

  app.get('/by-patient/:patientId', async (request) => {
    const { patientId } = request.params as { patientId: string };
    return db.selectFrom('visits')
      .selectAll()
      .where('patient_id', '=', patientId)
      .orderBy('visit_number', 'asc')
      .execute();
  });

  app.post('/', {
    schema: { body: CreateVisitSchema },
  }, async (request, reply) => {
    const data = request.body;
    const user = request.user;

    const result = await db.insertInto('visits')
      .values({
        ...data,
        facility_id: user.facilityId,
        conducted_by: user.sub,
        visit_date: new Date(data.visitDate),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const patient = await db.selectFrom('patients')
      .selectAll()
      .where('id', '=', data.patientId)
      .executeTakeFirst();

    if (patient) {
      const visits = await db.selectFrom('visits')
        .selectAll()
        .where('patient_id', '=', data.patientId)
        .execute();
      const latestVisit = visits.sort((a, b) => b.visit_number - a.visit_number)[0];
      if (latestVisit) {
        const allSigns = new Set([...patient.risk_factors, ...latestVisit.danger_signs]);
        const { score, level } = await import('@hrp/shared/rules').then(m =>
          m.calculateRiskScore({ ...patient, risk_factors: Array.from(allSigns) } as any, latestVisit as any)
        );
        await db.updateTable('patients')
          .set({ risk_score: score, risk_level: level, is_high_risk: level !== 'GREEN', updated_at: new Date() })
          .where('id', '=', data.patientId)
          .execute();
      }
    }

    return reply.code(201).send(result);
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body;

    const result = await db.updateTable('visits')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return reply.code(404).send({ message: 'Visit not found' });
    return result;
  });
};
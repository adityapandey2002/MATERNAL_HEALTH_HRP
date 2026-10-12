import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/client.js';
import { SyncPayloadSchema, SyncResponseSchema } from '@hrp/shared';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/push', {
    schema: { body: SyncPayloadSchema, response: { 200: SyncResponseSchema } },
  }, async (request, reply) => {
    const { patients = [], visits = [], referrals = [] } = request.body;
    const user = request.user;
    const serverTimestamp = new Date();
    const conflicts: any[] = [];

    for (const p of patients) {
      const existing = await db.selectFrom('patients').selectAll().where('id', '=', p.id).executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(p.updatedAt)) {
        conflicts.push({ entityType: 'PATIENT', entityId: p.id, serverVersion: existing, clientVersion: p });
        continue;
      }
      await db.insertInto('patients')
        .values({ ...p, facility_id: user.facilityId, registered_by: user.sub })
        .onConflict(oc => oc.column('id').doUpdateSet({ ...p, updated_at: serverTimestamp }))
        .execute();
    }

    for (const v of visits) {
      const existing = await db.selectFrom('visits').selectAll().where('id', '=', v.id).executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(v.updatedAt)) {
        conflicts.push({ entityType: 'VISIT', entityId: v.id, serverVersion: existing, clientVersion: v });
        continue;
      }
      await db.insertInto('visits')
        .values({ ...v, facility_id: user.facilityId, conducted_by: user.sub })
        .onConflict(oc => oc.column('id').doUpdateSet({ ...v, updated_at: serverTimestamp }))
        .execute();
    }

    for (const r of referrals) {
      const existing = await db.selectFrom('referrals').selectAll().where('id', '=', r.id).executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(r.updatedAt)) {
        conflicts.push({ entityType: 'REFERRAL', entityId: r.id, serverVersion: existing, clientVersion: r });
        continue;
      }
      await db.insertInto('referrals')
        .values({ ...r, referred_by: user.sub })
        .onConflict(oc => oc.column('id').doUpdateSet({ ...r, updated_at: serverTimestamp }))
        .execute();
    }

    return {
      patients: await db.selectFrom('patients').selectAll().where('facility_id', '=', user.facilityId).execute(),
      visits: await db.selectFrom('visits').selectAll().where('facility_id', '=', user.facilityId).execute(),
      referrals: await db.selectFrom('referrals').selectAll().where('from_facility_id', '=', user.facilityId).execute(),
      serverTimestamp,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  });

  app.get('/pull', async (request) => {
    const { since } = request.query as { since?: string };
    const user = request.user;
    const sinceDate = since ? new Date(since) : new Date(0);

    return {
      patients: await db.selectFrom('patients')
        .selectAll()
        .where('facility_id', '=', user.facilityId)
        .where('updated_at', '>', sinceDate)
        .execute(),
      visits: await db.selectFrom('visits')
        .selectAll()
        .where('facility_id', '=', user.facilityId)
        .where('updated_at', '>', sinceDate)
        .execute(),
      referrals: await db.selectFrom('referrals')
        .selectAll()
        .where('from_facility_id', '=', user.facilityId)
        .where('updated_at', '>', sinceDate)
        .execute(),
      serverTimestamp: new Date(),
    };
  });
};
import { db } from './client.js';
import bcrypt from 'bcryptjs';

export async function seed() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const state = await db.insertInto('facilities')
    .values({
      code: 'GJ',
      name: 'Gujarat',
      level: 'STATE',
      parent_id: null,
      path: 'INDIA.GUJARAT',
      state: 'Gujarat',
      district: '',
      block: '',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const district = await db.insertInto('facilities')
    .values({
      code: 'AHM',
      name: 'Ahmedabad',
      level: 'DISTRICT',
      parent_id: state.id,
      path: 'INDIA.GUJARAT.AHMEDABAD',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: '',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const block = await db.insertInto('facilities')
    .values({
      code: 'DSK',
      name: 'Daskroi',
      level: 'CHC',
      parent_id: district.id,
      path: 'INDIA.GUJARAT.AHMEDABAD.DASKROI',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: 'Daskroi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const chc = await db.insertInto('facilities')
    .values({
      code: 'CHC_BAR',
      name: 'CHC Bareja',
      level: 'CHC',
      parent_id: block.id,
      path: 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: 'Daskroi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const phc = await db.insertInto('facilities')
    .values({
      code: 'PHC_KUH',
      name: 'PHC Kuha',
      level: 'PHC',
      parent_id: chc.id,
      path: 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: 'Daskroi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const hwc = await db.insertInto('facilities')
    .values({
      code: 'HWC_PAS',
      name: 'HWC Pasunj',
      level: 'HWC',
      parent_id: phc.id,
      path: 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: 'Daskroi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const village = await db.insertInto('facilities')
    .values({
      code: 'VIL_PAS',
      name: 'Pasunj Village',
      level: 'VILLAGE',
      parent_id: hwc.id,
      path: 'INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA.PHC_KUHA.HWC_PASUNJ.VIL_PAS',
      state: 'Gujarat',
      district: 'Ahmedabad',
      block: 'Daskroi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const cho = await db.insertInto('users')
    .values({
      employee_id: 'CHO001',
      name: 'Dr. Priya Patel',
      phone: '9876543210',
      password_hash: passwordHash,
      role: 'CHO',
      facility_id: hwc.id,
      language: 'hi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const anm = await db.insertInto('users')
    .values({
      employee_id: 'ANM001',
      name: 'Asha Ben',
      phone: '9876543211',
      password_hash: passwordHash,
      role: 'ANM',
      facility_id: village.id,
      language: 'hi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const mo = await db.insertInto('users')
    .values({
      employee_id: 'MO001',
      name: 'Dr. Rajesh Kumar',
      phone: '9876543212',
      password_hash: passwordHash,
      role: 'MO',
      facility_id: chc.id,
      language: 'hi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const admin = await db.insertInto('users')
    .values({
      employee_id: 'ADM001',
      name: 'District Admin',
      phone: '9876543213',
      password_hash: passwordHash,
      role: 'DISTRICT_ADMIN',
      facility_id: district.id,
      language: 'hi',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const patient1 = await db.insertInto('patients')
    .values({
      facility_id: village.id,
      registered_by: anm.id,
      name: 'Rekha Devi',
      age: 26,
      phone: '9988776655',
      address: 'Pasunj Village, Daskroi',
      lmp: new Date('2025-01-15'),
      edd: new Date('2025-10-22'),
      gravida: 2,
      para: 1,
      abortions: 0,
      risk_factors: ['HYPERTENSION', 'SEVERE_ANEMIA'],
      risk_level: 'RED',
      risk_score: 65,
      is_high_risk: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const patient2 = await db.insertInto('patients')
    .values({
      facility_id: village.id,
      registered_by: anm.id,
      name: 'Sunita Patel',
      age: 22,
      phone: '9988776656',
      address: 'Pasunj Village, Daskroi',
      lmp: new Date('2025-03-01'),
      edd: new Date('2025-12-06'),
      gravida: 1,
      para: 0,
      abortions: 0,
      risk_factors: ['GESTATIONAL_DIABETES'],
      risk_level: 'AMBER',
      risk_score: 35,
      is_high_risk: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const patient3 = await db.insertInto('patients')
    .values({
      facility_id: village.id,
      registered_by: anm.id,
      name: 'Meena Sharma',
      age: 28,
      phone: '9988776657',
      address: 'Pasunj Village, Daskroi',
      lmp: new Date('2025-02-10'),
      edd: new Date('2025-11-17'),
      gravida: 3,
      para: 2,
      abortions: 0,
      risk_factors: [],
      risk_level: 'GREEN',
      risk_score: 0,
      is_high_risk: false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db.insertInto('visits')
    .values([
      {
        patient_id: patient1.id,
        facility_id: village.id,
        conducted_by: anm.id,
        visit_number: 1,
        gestational_weeks: 12,
        visit_date: new Date('2025-04-01'),
        bp_systolic: 150,
        bp_diastolic: 95,
        hb: 6.8,
        weight: 55,
        fundal_height: 12,
        fetal_heart_rate: 140,
        danger_signs: ['HYPERTENSION', 'SEVERE_ANEMIA'],
        ifa_given: true,
        calcium_given: true,
        albendazole_given: true,
      },
      {
        patient_id: patient2.id,
        facility_id: village.id,
        conducted_by: anm.id,
        visit_number: 1,
        gestational_weeks: 10,
        visit_date: new Date('2025-05-10'),
        bp_systolic: 110,
        bp_diastolic: 70,
        hb: 11.2,
        weight: 52,
        fundal_height: 10,
        fetal_heart_rate: 145,
        danger_signs: ['GESTATIONAL_DIABETES'],
        ifa_given: true,
        calcium_given: true,
        albendazole_given: false,
      },
      {
        patient_id: patient3.id,
        facility_id: village.id,
        conducted_by: anm.id,
        visit_number: 2,
        gestational_weeks: 20,
        visit_date: new Date('2025-06-25'),
        bp_systolic: 115,
        bp_diastolic: 75,
        hb: 12.5,
        weight: 60,
        fundal_height: 20,
        fetal_heart_rate: 142,
        danger_signs: [],
        ifa_given: true,
        calcium_given: true,
        albendazole_given: true,
      },
    ])
    .execute();

  await db.insertInto('referrals')
    .values({
      patient_id: patient1.id,
      from_facility_id: village.id,
      to_facility_id: chc.id,
      referred_by: anm.id,
      reason: 'Severe hypertension (150/95) with anemia (Hb 6.8). Needs MgSO4 and blood transfusion.',
      urgency: 'RED',
      status: 'PENDING',
    })
    .execute();

  await db.insertInto('supervision_alerts')
    .values([
      {
        facility_id: village.id,
        type: 'HIGH_RISK_UNATTENDED',
        severity: 'RED',
        message: 'Patient Rekha Devi (RED risk) has not had follow-up visit in 14 days',
        related_entity_id: patient1.id,
      },
      {
        facility_id: village.id,
        type: 'ANM_OFFLINE',
        severity: 'AMBER',
        message: 'ANM Asha Ben has not synced data for 3 days',
        related_entity_id: anm.id,
      },
    ])
    .execute();

  console.log('Seed completed');
  console.log('Test users:');
  console.log('  ANM: ANM001 / password123');
  console.log('  CHO: CHO001 / password123');
  console.log('  MO: MO001 / password123');
  console.log('  Admin: ADM001 / password123');
}

await seed();
await db.destroy();
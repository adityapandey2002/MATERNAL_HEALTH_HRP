import bcrypt from "bcryptjs";
import { db } from "./client.js";

// Auto-generated from HR_DATA_RANIGANJ.xlsx
// Raniganj block, Araria district - real ANM + CHO accounts
// Default password for all accounts: Raniganj@2026 (change on first login)

const DEFAULT_PASSWORD = "Raniganj@2026";

const HSCS = [
  "BAIJNATHPUR",
  "BAIRAKH",
  "BARAHARA",
  "BASETHI",
  "BAUSHI",
  "BELSARA 1",
  "BHAWANI NAGAR",
  "DHOBANIYA",
  "DUMARIYA",
  "DUMARIYA  (HASANPUR)",
  "DUMARIYA (BISTORIYA)",
  "FARKIYA",
  "GHAGHRI (IKRA)",
  "GHAGRI",
  "GHARBANDHA",
  "GHARBANDHA (BAGULAHA)",
  "GIDWASH",
  "GOPALPUR",
  "GUNWANTI",
  "GUNWANTI 1",
  "HIRDEYPUR (DHAMA)",
  "HRIDAYPUR",
  "INDARPUR",
  "INDARPUR (BARBANNA)",
  "INDARPUR (BARBANNA1)",
  "JAGTA",
  "JAGTA (KHARSAHI)",
  "KALABALUA",
  "KALABALUA 1",
  "KAMALPUR",
  "KAMALPUR(HANSHA )",
  "KARNKIYA",
  "KHARHAT",
  "KOSKAPUR",
  "KUMHRA (NANDANPUR)",
  "KUMRAHA",
  "LALPUR",
  "LALPUR (KOHBARA BISANPUR)",
  "MIRJAPUR (MAHSELI)",
  "MIRZAPUR",
  "MOHNI",
  "MOHNI (HARPUR)",
  "NARAYANPUR",
  "NARAYANPUR (CHATIYONA)",
  "NARAYANPUR (REHUA)",
  "PACHIRA",
  "PACHIRA (KAJRA )",
  "PARIHARI",
  "PARMANADPUR  (HINGNA)",
  "PARMANANDPUR",
  "PARMANANDPUR (KADWA)",
  "PARMANANDPUR (KUPARI)",
  "PARSAHAT",
  "RAGHOPUR",
  "RAMPUR",
  "RAMPUR (BHORHA )",
  "RUPAILI (SANJHELI)",
  "RUPELI",
  "TAMGHATTI",
  "TAMGHATTI (UPHRAIL)",
];

interface AnmSeed {
  name: string;
  phone: string;
  empId: string;
  primaryHsc: string;
}
const ANMS: AnmSeed[] = [
  {
    name: "PUJA KUMARI",
    phone: "8540973073",
    empId: "ARR_RANIGANJ_GHARBANDHA_01",
    primaryHsc: "GHARBANDHA",
  },
  {
    name: "REKHA KUMARI",
    phone: "8210697726",
    empId: "ARR_RANIGANJ_MOHNI_01",
    primaryHsc: "MOHNI",
  },
  {
    name: "SHARMILA KUMARI",
    phone: "8544444987",
    empId: "ARR_RANIGANJ_MOHNI_HARPUR_01",
    primaryHsc: "MOHNI (HARPUR)",
  },
  {
    name: "MONIKA KUMARI",
    phone: "9123117665",
    empId: "ARR_RANIGANJ_KUMHRA_NANDANPUR_01",
    primaryHsc: "KUMHRA (NANDANPUR)",
  },
  {
    name: "RANI KUMARI",
    phone: "6200353507",
    empId: "ARR_RANIGANJ_KAMALPUR_HANSHA_01",
    primaryHsc: "KAMALPUR(HANSHA )",
  },
  {
    name: "SIMA KUMARI",
    phone: "7631381401",
    empId: "ARR_RANIGANJ_PACHIRA_KAJRA_01",
    primaryHsc: "PACHIRA (KAJRA )",
  },
  {
    name: "ANSHU BHARTI",
    phone: "9570340178",
    empId: "ARR_RANIGANJ_PACHIRA_KAJRA_02",
    primaryHsc: "PACHIRA (KAJRA )",
  },
  {
    name: "MANISHA KUMARI",
    phone: "6206782658",
    empId: "ARR_RANIGANJ_DUMARIYA_HASANPUR_01",
    primaryHsc: "DUMARIYA  (HASANPUR)",
  },
  {
    name: "SANGITA KUMARI",
    phone: "9771355139",
    empId: "ARR_RANIGANJ_JAGTA_KHARSAHI_01",
    primaryHsc: "JAGTA (KHARSAHI)",
  },
  {
    name: "TANUJA KUMARI",
    phone: "9155411567",
    empId: "ARR_RANIGANJ_LALPUR_KOHBARA_BISANPUR_01",
    primaryHsc: "LALPUR (KOHBARA BISANPUR)",
  },
  {
    name: "SONI KUMARI",
    phone: "9693059968",
    empId: "ARR_RANIGANJ_PARMANADPUR_HINGNA_01",
    primaryHsc: "PARMANADPUR  (HINGNA)",
  },
  { name: "RUPA KUMARI", phone: "9570501570", empId: "ARR_RANIGANJ_JAGTA_01", primaryHsc: "JAGTA" },
  {
    name: "BANDITA SHREE",
    phone: "6202354819",
    empId: "ARR_RANIGANJ_KAMALPUR_01",
    primaryHsc: "KAMALPUR",
  },
  {
    name: "GURIA KUMARI",
    phone: "9234032297",
    empId: "ARR_RANIGANJ_KAMALPUR_02",
    primaryHsc: "KAMALPUR",
  },
  {
    name: "RINKI KUMARI",
    phone: "9570690777",
    empId: "ARR_RANIGANJ_DUMARIYA_BISTORIYA_01",
    primaryHsc: "DUMARIYA (BISTORIYA)",
  },
  {
    name: "RUPAM KUMARI",
    phone: "8709491955",
    empId: "ARR_RANIGANJ_GHAGHRI_IKRA_01",
    primaryHsc: "GHAGHRI (IKRA)",
  },
  {
    name: "PRITI KUMARI",
    phone: "7349828994",
    empId: "ARR_RANIGANJ_MIRJAPUR_MAHSELI_01",
    primaryHsc: "MIRJAPUR (MAHSELI)",
  },
  {
    name: "VEENA KUMARI",
    phone: "9852344520",
    empId: "ARR_RANIGANJ_PARMANANDPUR_KUPARI_01",
    primaryHsc: "PARMANANDPUR (KUPARI)",
  },
  {
    name: "DUJA KUMARI",
    phone: "7479554607",
    empId: "ARR_RANIGANJ_PARMANANDPUR_01",
    primaryHsc: "PARMANANDPUR",
  },
  {
    name: "LOVELY KUMARI",
    phone: "7250728107",
    empId: "ARR_RANIGANJ_GUNWANTI_01",
    primaryHsc: "GUNWANTI",
  },
  {
    name: "PRATIMA KUMARI",
    phone: "8789166157",
    empId: "ARR_RANIGANJ_KARNKIYA_01",
    primaryHsc: "KARNKIYA",
  },
  {
    name: "PRAGATI KUMARI",
    phone: "6200489993",
    empId: "ARR_RANIGANJ_NARAYANPUR_CHATIYONA_01",
    primaryHsc: "NARAYANPUR (CHATIYONA)",
  },
  {
    name: "RICHA KUMARI",
    phone: "6204022028",
    empId: "ARR_RANIGANJ_GHAGRI_01",
    primaryHsc: "GHAGRI",
  },
  {
    name: "GURIYA KUMARI",
    phone: "7903653170",
    empId: "ARR_RANIGANJ_MIRZAPUR_01",
    primaryHsc: "MIRZAPUR",
  },
  {
    name: "ONIMA KUMARI",
    phone: "9534421122",
    empId: "ARR_RANIGANJ_LALPUR_01",
    primaryHsc: "LALPUR",
  },
  {
    name: "ANITA TUDDU",
    phone: "8294975911",
    empId: "ARR_RANIGANJ_LALPUR_02",
    primaryHsc: "LALPUR",
  },
  {
    name: "SUDHA KUMARI",
    phone: "9334490694",
    empId: "ARR_RANIGANJ_RAMPUR_BHORHA_01",
    primaryHsc: "RAMPUR (BHORHA )",
  },
  {
    name: "KOMAL KUMARI",
    phone: "7488941095",
    empId: "ARR_RANIGANJ_RAMPUR_BHORHA_02",
    primaryHsc: "RAMPUR (BHORHA )",
  },
  {
    name: "ANKITA KUMARI",
    phone: "7856839441",
    empId: "ARR_RANIGANJ_DHOBANIYA_01",
    primaryHsc: "DHOBANIYA",
  },
  {
    name: "SWATI PRIYA",
    phone: "9472584925",
    empId: "ARR_RANIGANJ_TAMGHATTI_UPHRAIL_01",
    primaryHsc: "TAMGHATTI (UPHRAIL)",
  },
  {
    name: "KARISHMA KUMARI",
    phone: "6206429118",
    empId: "ARR_RANIGANJ_TAMGHATTI_UPHRAIL_02",
    primaryHsc: "TAMGHATTI (UPHRAIL)",
  },
  {
    name: "SWEETY KUMARI",
    phone: "7979095397",
    empId: "ARR_RANIGANJ_RUPAILI_SANJHELI_01",
    primaryHsc: "RUPAILI (SANJHELI)",
  },
  {
    name: "NOOTAN KUMARI",
    phone: "7667881200",
    empId: "ARR_RANIGANJ_RAGHOPUR_01",
    primaryHsc: "RAGHOPUR",
  },
  {
    name: "ANITA KUMARI",
    phone: "9696572719",
    empId: "ARR_RANIGANJ_GHARBANDHA_BAGULAHA_01",
    primaryHsc: "GHARBANDHA (BAGULAHA)",
  },
  {
    name: "SUNITA KUMARI",
    phone: "7295079568",
    empId: "ARR_RANIGANJ_BAIJNATHPUR_01",
    primaryHsc: "BAIJNATHPUR",
  },
  {
    name: "NITU SINHA",
    phone: "9155939620",
    empId: "ARR_RANIGANJ_BAIRAKH_01",
    primaryHsc: "BAIRAKH",
  },
  {
    name: "RUHI BHARTI",
    phone: "9508704077",
    empId: "ARR_RANIGANJ_BARAHARA_01",
    primaryHsc: "BARAHARA",
  },
  {
    name: "CHUMBKI KUMARI",
    phone: "9661233394",
    empId: "ARR_RANIGANJ_INDARPUR_BARBANNA_01",
    primaryHsc: "INDARPUR (BARBANNA)",
  },
  {
    name: "PRABHA KUMARI",
    phone: "9162239100",
    empId: "ARR_RANIGANJ_BAUSHI_01",
    primaryHsc: "BAUSHI",
  },
  {
    name: "MINA KARN",
    phone: "8987063061",
    empId: "ARR_RANIGANJ_BELSARA_1_01",
    primaryHsc: "BELSARA 1",
  },
  {
    name: "NISHA KUMARI",
    phone: "9204354382",
    empId: "ARR_RANIGANJ_KALABALUA_1_01",
    primaryHsc: "KALABALUA 1",
  },
  {
    name: "RITU KUMARI",
    phone: "9123280759",
    empId: "ARR_RANIGANJ_BHAWANI_NAGAR_01",
    primaryHsc: "BHAWANI NAGAR",
  },
  {
    name: "SONAMANI KUMARI",
    phone: "6203005310",
    empId: "ARR_RANIGANJ_HIRDEYPUR_DHAMA_01",
    primaryHsc: "HIRDEYPUR (DHAMA)",
  },
  {
    name: "DIVYA BHARTI",
    phone: "7260932033",
    empId: "ARR_RANIGANJ_GIDWASH_01",
    primaryHsc: "GIDWASH",
  },
  {
    name: "DIVYA KUMARI",
    phone: "7061846743",
    empId: "ARR_RANIGANJ_GOPALPUR_01",
    primaryHsc: "GOPALPUR",
  },
  {
    name: "MANNU KUMARI",
    phone: "7909037956",
    empId: "ARR_RANIGANJ_GOPALPUR_02",
    primaryHsc: "GOPALPUR",
  },
  {
    name: "RANJU KUMARI",
    phone: "6299765277",
    empId: "ARR_RANIGANJ_DUMARIYA_01",
    primaryHsc: "DUMARIYA",
  },
  {
    name: "POONAM KUMARI",
    phone: "6202197660",
    empId: "ARR_RANIGANJ_PARIHARI_01",
    primaryHsc: "PARIHARI",
  },
  {
    name: "SHILA KUMARI",
    phone: "8226836021",
    empId: "ARR_RANIGANJ_KOSKAPUR_01",
    primaryHsc: "KOSKAPUR",
  },
  {
    name: "ANSHU KUMARI",
    phone: "6201445825",
    empId: "ARR_RANIGANJ_KOSKAPUR_02",
    primaryHsc: "KOSKAPUR",
  },
  {
    name: "PRIYANKA KUMARI",
    phone: "8789181455",
    empId: "ARR_RANIGANJ_KALABALUA_01",
    primaryHsc: "KALABALUA",
  },
  {
    name: "PRIYANKA BHARTI",
    phone: "8340171665",
    empId: "ARR_RANIGANJ_GUNWANTI_1_01",
    primaryHsc: "GUNWANTI 1",
  },
  {
    name: "SUSHILA KUMARI",
    phone: "9534420715",
    empId: "ARR_RANIGANJ_HRIDAYPUR_01",
    primaryHsc: "HRIDAYPUR",
  },
  {
    name: "SARBATI KUMARI",
    phone: "7368977288",
    empId: "ARR_RANIGANJ_NARAYANPUR_01",
    primaryHsc: "NARAYANPUR",
  },
  {
    name: "RUBI KUMARI",
    phone: "8969344029",
    empId: "ARR_RANIGANJ_RAMPUR_01",
    primaryHsc: "RAMPUR",
  },
  {
    name: "SARASWATI SINHA",
    phone: "8210729926",
    empId: "ARR_RANIGANJ_KUMRAHA_01",
    primaryHsc: "KUMRAHA",
  },
  {
    name: "LAKSHMI KUMARI",
    phone: "7061949971",
    empId: "ARR_RANIGANJ_PARSAHAT_01",
    primaryHsc: "PARSAHAT",
  },
  {
    name: "RITA KUMARI",
    phone: "6299894254",
    empId: "ARR_RANIGANJ_FARKIYA_01",
    primaryHsc: "FARKIYA",
  },
  {
    name: "JEEVAN JYOTI",
    phone: "6201565237",
    empId: "ARR_RANIGANJ_INDARPUR_01",
    primaryHsc: "INDARPUR",
  },
  {
    name: "SWETA KUMARI",
    phone: "7004706478",
    empId: "ARR_RANIGANJ_KHARHAT_01",
    primaryHsc: "KHARHAT",
  },
];

function hscCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/\(/g, "_")
    .replace(/\)/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function seedRaniganj() {
  console.log("Seeding Raniganj block data...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await db.deleteFrom("responsibilities").execute();
  await db.deleteFrom("sync_queue").execute();
  await db.deleteFrom("supervision_alerts").execute();
  await db.deleteFrom("referrals").execute();
  await db.deleteFrom("visits").execute();
  await db.deleteFrom("patients").execute();
  await db.deleteFrom("users").execute();
  await db.deleteFrom("facilities").execute();

  const facilityIds = new Map<string, string>();
  const insertFacility = async (
    code: string,
    name: string,
    level: string,
    parentCode: string | null,
    state: string,
    district: string,
    block: string
  ) => {
    const parentId = parentCode ? facilityIds.get(parentCode) : undefined;
    const inserted = await db
      .insertInto("facilities")
      .values({
        code,
        name,
        level: level as "STATE" | "DISTRICT" | "BLOCK" | "HSC",
        parent_id: parentId ?? null,
        path: code,
        state,
        district,
        block,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    facilityIds.set(code, inserted.id);
    return inserted.id;
  };

  await insertFacility("BIHAR", "Bihar", "STATE", null, "Bihar", "", "");
  await insertFacility("ARARIA", "Araria", "DISTRICT", "BIHAR", "Bihar", "Araria", "");
  await insertFacility(
    "ARR_RANIGANJ",
    "Raniganj",
    "BLOCK",
    "ARARIA",
    "Bihar",
    "Araria",
    "Raniganj"
  );

  const blockId = facilityIds.get("ARR_RANIGANJ") as string;
  const districtId = facilityIds.get("ARARIA") as string;

  for (const hsc of HSCS) {
    await insertFacility(hscCode(hsc), hsc, "HSC", "ARR_RANIGANJ", "Bihar", "Araria", "Raniganj");
  }

  const anmValues = ANMS.map((a) => ({
    employee_id: a.empId,
    name: a.name,
    phone: a.phone,
    password_hash: passwordHash,
    role: "ANM" as const,
    facility_id: facilityIds.get(hscCode(a.primaryHsc)) as string,
    language: "hi",
  }));
  await db.insertInto("users").values(anmValues).execute();

  // CHO accounts - one per HSC
  const choValues = HSCS.map((hsc, idx) => ({
    employee_id: `CHO_RANIGANJ_${hscCode(hsc)}_${String(idx + 1).padStart(2, "0")}`,
    name: `CHO ${hsc}`,
    phone: `910000${String(idx + 1).padStart(4, "0")}`,
    password_hash: passwordHash,
    role: "CHO" as const,
    facility_id: facilityIds.get(hscCode(hsc)) as string,
    language: "hi",
  }));
  await db.insertInto("users").values(choValues).execute();

  await db
    .insertInto("users")
    .values([
      {
        employee_id: "BHM_RANIGANJ_01",
        name: "BHM Raniganj",
        phone: "9000000002",
        password_hash: passwordHash,
        role: "BHM",
        facility_id: blockId,
        language: "hi",
      },
      {
        employee_id: "HD_BLOCK_RANIGANJ_01",
        name: "Helpdesk Block Raniganj",
        email: "helpdesk.block.raniganj@araria.gov.in",
        phone: "9000000003",
        password_hash: passwordHash,
        role: "HRP_HELPDESK_BLOCK",
        facility_id: blockId,
        language: "hi",
      },
      {
        employee_id: "HD_DIST_ARARIA_01",
        name: "Helpdesk District Araria",
        email: "helpdesk.district.araria@araria.gov.in",
        phone: "9000000004",
        password_hash: passwordHash,
        role: "HRP_HELPDESK_DISTRICT",
        facility_id: districtId,
        language: "hi",
      },
      {
        employee_id: "DHS_ARARIA_01",
        name: "DHS Araria",
        phone: "9000000005",
        password_hash: passwordHash,
        role: "DHS",
        facility_id: districtId,
        language: "hi",
      },
    ])
    .execute();

  console.log(
    `Seeded ${ANMS.length} ANMs, ${HSCS.length} HSCs, ${choValues.length} CHOs, and 4 helpdesk/BHM/DHS accounts.`
  );
  console.log(`Default password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log("Employee IDs: ARR_RANIGANJ_<HSC>_<NN>");
  console.log("CHO IDs: CHO_RANIGANJ_<HSC>_<NN>");
}

const isMain =
  process.argv[1] !== undefined &&
  (await import("node:path")).resolve(process.argv[1]) ===
    (await import("node:url")).fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await seedRaniganj();
  } finally {
    await db.destroy();
  }
}

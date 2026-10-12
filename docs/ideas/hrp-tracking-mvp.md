# HRP Tracking Platform — MVP One-Pager

## Problem Statement
**How Might We** enable ANMs in low-connectivity rural India to reliably capture high-risk pregnancy signals during routine ANC visits, so CHOs can triage and escalate before complications become emergencies?

---

## Recommended Direction
**Minimal Capture + CHO-Centric Triage + Unified ANC + Supervision Layer**

Build a **single offline-first PWA** that serves both ANMs (mobile) and CHOs (desktop/tablet). ANMs capture *only* what's feasible in the field: MCP card photo, 5 danger signs, vitals, voice note. CHOs receive a prioritized line list with auto-calculated HRP scores and generate follow-up plans. The same app tracks routine ANC visits (unified workflow). Supervision dashboards show sync health and visit adherence — the human-layer safety net.

**Why this combination:**
- ANM cognitive load stays low (variation #2 inversion)
- One app for all pregnancy touchpoints drives adoption (variation #5)
- Supervision addresses the #1 failure mode: human non-adoption (variation #6)
- Technical scope fits 6-8 months with 5-8 devs (variation #1 simplification)
- Defers ABDM, ltree, RLS, CRDTs, Web Crypto, Push to v2

---

## Key Assumptions to Validate

| # | Assumption | Validation Strategy |
|---|------------|---------------------|
| 1 | ANMs can reliably identify 5 danger signs with minimal training | Pilot with 10 ANMs; measure inter-rater reliability vs CHO assessment |
| 2 | MCP card photo + OCR/voice captures enough structured data | Build OCR prototype; test on 100 real MCP cards; measure field accuracy |
| 3 | CHOs will actually use the triage dashboard daily | Shadow 5 CHOs for 1 week; measure time-to-triage per patient |
| 4 | Offline sync works on existing ANM smartphones (Android 8+) | Device lab test on 10 lowest-spec deployed devices |
| 5 | Unified ANC+HRP workflow doesn't confuse ANMs | Usability test: task completion rate for "register ANC + flag HRP" |
| 6 | Supervision nudges change ANM behavior (sync frequency, visit completion) | A/B test: nudges vs no nudges over 4 weeks |
| 7 | State/district leadership will mandate adoption | Secure written commitment from 1 district before month 3 |

---

## MVP Scope (6-8 Months)

### IN — Core v1

| Module | Description | Effort |
|--------|-------------|--------|
| **ANM Mobile PWA** | Offline-first: MCP photo capture, 5 danger signs (HTN, GDM, anemia, bleeding, reduced fetal movement), vitals (BP, Hb, weight, fundal height), voice note, ANC visit log. IndexedDB + background sync. | 3 devs × 4 mo |
| **CHO Desktop Dashboard** | Line list with auto HRP score (rule engine), urgency tags (red/amber/green), follow-up plan builder, patient timeline, referral generator. | 2 devs × 3 mo |
| **Rule Engine** | Configurable HRP scoring: weights per danger sign, comorbidity multipliers, gestational age adjustments. JSON-driven, no code deploy. | 1 dev × 2 mo |
| **Supervision Layer** | ANM: visit due reminders, sync health banner. CHO: "ANM offline >48h" alerts, block-level adherence heatmap. District: aggregate sync/visit rates. | 1 dev × 2 mo |
| **Sync & Backend** | REST API (Node/Go), PostgreSQL (simple schema: facilities, patients, visits, referrals), auth (JWT + role), audit log. | 2 devs × 3 mo |
| **Auth & Roles** | ANM, CHO, MO, District Admin. Facility-scoped data access (app-layer, not RLS). | 1 dev × 1 mo |
| **Testing & Hardening** | Offline stress test, conflict simulation, load test (10k patients), security audit. | 2 devs × 1.5 mo |

### OUT — Explicitly Deferred to v2+

| Feature | Reason |
|---------|--------|
| ABDM M1/M2/M3 integration | Certification takes 6+ months; blocks nothing in v1 |
| PostgreSQL `ltree` + GiST indexing | Simple adjacency list + materialized path in app layer suffices for 1 district |
| Row-Level Security (RLS) | App-layer facility scoping is adequate for single-tenant v1 |
| Web Crypto / AES-256-GCM on device | Device encryption (Android FBE) + TLS-in-transit + app-layer scoping = sufficient |
| CRDTs / LWW conflict resolution | Single-writer-per-patient (ANM owns capture, CHO owns triage) eliminates most conflicts |
| Service Worker Push / Web Push API | SMS via CDAC Mobile Seva covers urgent alerts; push is nice-to-have |
| FHIR R4 bundles | Not needed without ABDM |
| eSanjeevani teleconsultation integration | CHO can manually launch eSanjeevani; deep link later |
| Multi-state / multi-tenant | v1 = 1 district pilot |
| Advanced analytics / ML risk prediction | Rule engine is transparent and auditable; ML later |
| iOS / PWA install prompts | ANMs use Android only |

---

## Not Doing (and Why)

| Thing | Reason |
|-------|--------|
| **Full clinical form on mobile** | ANMs have 5 min per patient; photo + 5 taps + voice is realistic |
| **Patient-facing app** | No smartphone penetration among target pregnant women |
| **Offline maps / GPS** | Not needed for core workflow; adds 20% bundle size |
| **Multi-language at launch** | Start with Hindi + English; add Gujarati/Telugu/etc. per state rollout |
| **Blockchain / zero-trust / microservices** | Over-engineering; monolith deploys faster, debugs easier |
| **Custom hardware / Bluetooth devices** | BP cuffs, Hb meters exist but integration is flaky; manual entry v1 |
| **Real-time chat / messaging** | SMS + phone call works; in-app chat adds complexity |

---

## Implementation Roadmap (6-8 Months)

### Month 1-2: Foundation
- [ ] Project setup: repo, CI/CD, staging env, device lab
- [ ] Database schema + API skeleton (patients, visits, facilities, users)
- [ ] Auth system with role-based facility scoping
- [ ] **Validation:** Device compatibility test on 10 ANM phones

### Month 2-4: ANM Mobile PWA (Core)
- [ ] MCP card photo capture + local storage
- [ ] 5 danger sign selectors + vitals input + voice recorder
- [ ] ANC visit scheduler (LMP-based due dates)
- [ ] IndexedDB + sync queue + conflict handling (simple LWW)
- [ ] **Validation:** Usability test with 5 ANMs (task: "register new ANC + flag HRP")

### Month 3-5: CHO Dashboard + Rule Engine
- [ ] Line list with filters, sorting, pagination
- [ ] HRP rule engine (configurable JSON rules)
- [ ] Auto-scoring + urgency tags + follow-up plan form
- [ ] Referral PDF generator (CHO → MO/CHC)
- [ ] **Validation:** Shadow 3 CHOs triaging 20 patients each; measure accuracy vs manual

### Month 4-6: Supervision Layer
- [ ] ANM: local due-list, sync banner, push-to-sync button
- [ ] CHO: ANM heartbeat monitor, block adherence view
- [ ] District: aggregate sync/visit rates, export CSV
- [ ] SMS integration (CDAC Mobile Seva) for due-list + urgent alerts
- [ ] **Validation:** 4-week A/B nudge test in 1 block

### Month 6-7: Hardening & Pilot Prep
- [ ] Offline stress test (7 days offline, 50 patients/day)
- [ ] Load test: 10k patients, 100 concurrent ANMs
- [ ] Security audit (OWASP mobile + API)
- [ ] Training materials: video walkthroughs, job aids, FAQ
- [ ] **Validation:** Dry-run pilot with 20 ANMs + 5 CHOs for 2 weeks

### Month 7-8: District Pilot Launch
- [ ] Deploy to 1 district (3 blocks, ~30 ANMs, ~8 CHOs)
- [ ] Weekly retros, bug bashes, rapid iterations
- [ ] Measure: sync rate, visit completion, HRP detection rate, referral timeliness
- [ ] **Go/No-Go** for state-scale based on metrics

---

## Open Questions (Resolve Before Month 3)

1. **MCP card OCR vs voice-only?** — Test both; pick higher accuracy/lower friction.
2. **Exact 5 danger signs?** — Confirm with state NHM clinical guidelines; may be 6-7.
3. **HRP scoring weights?** — Convene 3 obstetricians + 1 data scientist; agree on v1 weights.
4. **SMS template approval?** — CDAC Mobile Seva requires pre-approved templates; start paperwork now.
5. **District selection criteria?** — Pick district with: supportive DM, good ANM smartphone penetration, existing PMSMA momentum.
6. **Data export format for HMIS integration?** — Align with state HMIS team early to avoid rework.
7. **What happens when ANM transfers?** — Facility reassignment flow needed in auth system.

---

## Success Metrics (Pilot)

| Metric | Target | Measurement |
|--------|--------|-------------|
| ANM daily sync rate | >80% | Backend sync logs |
| ANC visit completion (per trimester) | >90% | Visit records vs due list |
| HRP detection rate (vs paper baseline) | 2x increase | CHO-validated flags / total ANC |
| Referral-to-CHc time (median) | <48h | Referral timestamp → CHC acknowledgment |
| CHO triage time per patient | <3 min | Dashboard analytics |
| ANM app crash rate | <0.1% sessions | Sentry / Firebase Crashlytics |

---

## Next Steps

1. **Week 1:** Finalize district MoU, recruit clinical advisor, start SMS template approval
2. **Week 2:** Device lab procurement, set up staging env, hire/contract 2 more devs
3. **Week 3:** Begin MCP card OCR spike + danger sign finalization workshop
4. **Month 1 end:** Go/No-Go on technical architecture (PWA vs React Native) — recommend PWA
import {
  ANEMIA_GRADE_BADGE,
  ANEMIA_GRADE_LABEL,
  type DangerSign,
  type ReferralFacilityType,
  anemiaGradeFromHb,
  gestationalAgeWeeks,
  getPatientDisplayId,
} from "@hrp/shared";
import type { RecordFollowUpVisit } from "@hrp/shared/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../lib/api";
import { followUpRepo, patientRepo, visitRepo } from "../../lib/db/repositories";
import type { FollowUpRow } from "../../lib/hrp";
import { useIsFieldRole } from "../../lib/session";
import { getCachedSession } from "../../lib/session-cache";
import { enqueueOp } from "../../lib/sync/queue";
import { ActivityIcon, CalendarIcon, CheckIcon, DropletIcon, XIcon } from "../ui/Icons";

interface RecordFollowUpVisitModalProps {
  open: boolean;
  row: FollowUpRow | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DANGER_SIGN_OPTIONS: {
  value: DangerSign;
  label: string;
  sub: string;
}[] = [
  {
    value: "SEVERE_ANEMIA",
    label: "Severe Anemia",
    sub: "Hb < 7 g/dL or extreme pallor",
  },
  {
    value: "HYPERTENSION",
    label: "High BP / PIH",
    sub: "BP ≥ 140/90 mmHg or pre-eclampsia",
  },
  {
    value: "VAGINAL_BLEEDING",
    label: "Vaginal Bleeding",
    sub: "Spotting or active hemorrhage",
  },
  {
    value: "SEVERE_HEADACHE",
    label: "Severe Headache",
    sub: "Visual disturbance or epigastric pain",
  },
  {
    value: "REDUCED_FETAL_MOVEMENT",
    label: "Reduced Fetal Movement",
    sub: "< 10 kicks in 12 hours",
  },
  {
    value: "EPILEPSY",
    label: "Convulsions / Fits",
    sub: "Eclampsia or seizure episodes",
  },
];

export function RecordFollowUpVisitModal({
  open,
  row,
  onClose,
  onSuccess,
}: RecordFollowUpVisitModalProps) {
  const queryClient = useQueryClient();
  const fieldRole = useIsFieldRole();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const patientId = row?.patientId;
  const { data: visitsData } = useQuery({
    queryKey: ["visits", "byPatient", patientId],
    queryFn: () => (patientId ? api.visits.byPatient(patientId) : []),
    enabled: Boolean(patientId && open),
  });

  const localVisits = useLiveQuery(
    () => (patientId ? visitRepo.byPatient(patientId) : []),
    [patientId]
  );

  const { data: patientData } = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => (patientId ? api.patients.get(patientId) : null),
    enabled: Boolean(patientId && open),
  });

  const localPatient = useLiveQuery(
    () => (patientId ? patientRepo.get(patientId) : undefined),
    [patientId]
  );

  const patient = patientData ?? localPatient ?? null;
  const visitsCount = visitsData?.length ?? localVisits?.length ?? 0;
  const calculatedVisitNumber = visitsCount + 1;

  // Form State
  const [visitDate, setVisitDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weight, setWeight] = useState<string>("");
  const [bpSystolic, setBpSystolic] = useState<string>("");
  const [bpDiastolic, setBpDiastolic] = useState<string>("");
  const [hb, setHb] = useState<string>("");
  const [dangerSigns, setDangerSigns] = useState<DangerSign[]>([]);
  const [ifaGiven, setIfaGiven] = useState(true);
  const [calciumGiven, setCalciumGiven] = useState(true);
  const [albendazoleGiven, setAlbendazoleGiven] = useState(false);
  const [fcmAdministered, setFcmAdministered] = useState(false);
  const [referred, setReferred] = useState(false);
  const [referralFacilityType, setReferralFacilityType] = useState<ReferralFacilityType>("DH");
  const [referralReason, setReferralReason] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!open || !row) return;
    setVisitDate(format(new Date(), "yyyy-MM-dd"));
    setWeight("");
    setBpSystolic("");
    setBpDiastolic("");
    setHb("");
    setDangerSigns([]);
    setIfaGiven(true);
    setCalciumGiven(true);
    setAlbendazoleGiven(false);
    setFcmAdministered(row.fcmAdministered === true);
    setReferred(false);
    setReferralFacilityType(fieldRole ? "CHC_FRU" : "DH");
    setReferralReason("");
    setNotes("");
    setErrors({});
  }, [open, row, fieldRole]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  const gestationalWeeks = patient?.lmp
    ? (gestationalAgeWeeks({ lmp: patient.lmp, edd: patient.edd ?? null }, new Date(visitDate)) ??
      24)
    : 24;

  const toggleDangerSign = (sign: DangerSign) => {
    setDangerSigns((prev) =>
      prev.includes(sign) ? prev.filter((item) => item !== sign) : [...prev, sign]
    );
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string | undefined> = {};
    if (!visitDate) nextErrors.visitDate = "Visit date is required.";
    if (weight) {
      const val = Number(weight);
      if (Number.isNaN(val) || val < 30 || val > 150) {
        nextErrors.weight = "Weight must be between 30 and 150 kg.";
      }
    }
    if (bpSystolic || bpDiastolic) {
      const s = Number(bpSystolic);
      const d = Number(bpDiastolic);
      if (Number.isNaN(s) || s < 60 || s > 250) {
        nextErrors.bp = "Systolic BP must be between 60 and 250.";
      } else if (Number.isNaN(d) || d < 30 || d > 160) {
        nextErrors.bp = "Diastolic BP must be between 30 and 160.";
      }
    }
    if (hb.trim()) {
      const val = Number(hb);
      if (Number.isNaN(val) || val < 2 || val > 20) {
        nextErrors.hb = "Hemoglobin must be between 2 and 20 g/dL.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("No follow-up row selected");
      const user = getCachedSession()?.user;
      const now = new Date().toISOString();

      const payload: RecordFollowUpVisit = {
        patientId: row.patientId,
        followUpId: row.followUpId ?? null,
        visitDate: new Date(visitDate),
        visitNumber: calculatedVisitNumber,
        gestationalWeeks: Math.max(0, Math.round(gestationalWeeks)),
        bpSystolic: bpSystolic ? Number(bpSystolic) : null,
        bpDiastolic: bpDiastolic ? Number(bpDiastolic) : null,
        hb: hb.trim() ? Number(hb) : null,
        weight: weight.trim() ? Number(weight) : null,
        fundalHeight: null,
        fetalHeartRate: null,
        dangerSigns,
        ifaGiven,
        calciumGiven,
        albendazoleGiven,
        fcmAdministered,
        referred,
        referralFacilityType: referred ? referralFacilityType : null,
        referralReason: referred ? referralReason : null,
        notes: notes.trim() || null,
      };

      try {
        await api.hrp.followUps.recordVisit(payload);
      } catch (_onlineError) {
        await saveOfflineVisitAndFollowUp({
          payload,
          row,
          userId: user?.id ?? "",
          facilityId: user?.facilityId ?? "",
          now,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrp"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      onSuccess?.();
      onClose();
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    submitMutation.mutate();
  };

  if (!open || !row) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto p-3 sm:p-4 bg-transparent max-w-2xl w-full backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
      aria-labelledby={titleId}
    >
      <div className="w-full bg-canvas rounded-2xl shadow-2xl border border-line overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-teal-900 text-white px-5 py-4 shrink-0 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-teal-900 shadow-sm">
                <ActivityIcon className="h-3.5 w-3.5 text-teal-700" />
                Follow-up #{calculatedVisitNumber}
              </span>
              <span className="text-2xs font-mono uppercase tracking-wider text-teal-200 bg-teal-950/60 px-2 py-0.5 rounded">
                {getPatientDisplayId(row.patientId)}
              </span>
              <span className="text-2xs font-medium text-teal-100 bg-teal-800/80 px-2 py-0.5 rounded">
                GA {Math.round(gestationalWeeks)}w
              </span>
            </div>
            <h2 id={titleId} className="text-lg font-bold text-white tracking-tight">
              {row.patientName}
            </h2>
            <p className="text-xs text-teal-200 mt-0.5">
              {row.age} yrs · {row.village ?? "Village not recorded"}
              {row.blockName ? ` · ${row.blockName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {submitMutation.isError ? (
            <div
              className="rounded-xl border border-triage-red-line bg-triage-red-bg p-3.5 text-sm text-triage-red"
              role="alert"
            >
              Could not save the visit record. Please check the values and retry.
            </div>
          ) : null}

          {/* Step 1: Vitals */}
          <VitalsSection
            visitDate={visitDate}
            setVisitDate={setVisitDate}
            weight={weight}
            setWeight={setWeight}
            bpSystolic={bpSystolic}
            setBpSystolic={setBpSystolic}
            bpDiastolic={bpDiastolic}
            setBpDiastolic={setBpDiastolic}
            hb={hb}
            setHb={setHb}
            errors={errors}
            setErrors={setErrors}
            visitNumber={calculatedVisitNumber}
          />

          {/* Step 2: Danger Signs */}
          <DangerSignsSection dangerSigns={dangerSigns} onToggle={toggleDangerSign} />

          {/* Step 3: Supplements & Interventions */}
          <SupplementsSection
            ifaGiven={ifaGiven}
            setIfaGiven={setIfaGiven}
            calciumGiven={calciumGiven}
            setCalciumGiven={setCalciumGiven}
            albendazoleGiven={albendazoleGiven}
            setAlbendazoleGiven={setAlbendazoleGiven}
            fcmAdministered={fcmAdministered}
            setFcmAdministered={setFcmAdministered}
          />

          {/* Step 4: Referral */}
          <ReferralSection
            referred={referred}
            setReferred={setReferred}
            fieldRole={fieldRole}
            referralFacilityType={referralFacilityType}
            setReferralFacilityType={setReferralFacilityType}
            referralReason={referralReason}
            setReferralReason={setReferralReason}
          />

          {/* Step 5: Notes */}
          <div className="space-y-1.5">
            <label htmlFor="anc-notes-field" className="block text-xs font-bold text-ink">
              Clinical Advice & Counseling Notes (Optional)
            </label>
            <textarea
              id="anc-notes-field"
              rows={2}
              className="input text-xs py-2"
              placeholder="e.g. Advised green leafy vegetables, IFA compliance, attended PMSMA clinic..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-line flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitMutation.isPending}
              className="btn btn-secondary w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="btn btn-primary w-full sm:w-auto min-w-[200px] shadow-md bg-teal-700 hover:bg-teal-800 text-white"
            >
              {submitMutation.isPending ? (
                "Saving Visit..."
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Save & Complete Follow-up #{calculatedVisitNumber}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function VitalsSection({
  visitDate,
  setVisitDate,
  weight,
  setWeight,
  bpSystolic,
  setBpSystolic,
  bpDiastolic,
  setBpDiastolic,
  hb,
  setHb,
  errors,
  setErrors,
  visitNumber,
}: {
  visitDate: string;
  setVisitDate: (val: string) => void;
  weight: string;
  setWeight: (val: string) => void;
  bpSystolic: string;
  setBpSystolic: (val: string) => void;
  bpDiastolic: string;
  setBpDiastolic: (val: string) => void;
  hb: string;
  setHb: (val: string) => void;
  errors: Record<string, string | undefined>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
  visitNumber: number;
}) {
  const systolicNum = Number(bpSystolic);
  const diastolicNum = Number(bpDiastolic);
  const isHighBp = systolicNum >= 140 || diastolicNum >= 90;
  const isPreHtn =
    !isHighBp &&
    ((systolicNum >= 120 && systolicNum < 140) || (diastolicNum >= 80 && diastolicNum < 90));

  const hbNum = hb.trim() ? Number(hb) : null;
  const anemiaGrade = hbNum !== null && !Number.isNaN(hbNum) ? anemiaGradeFromHb(hbNum) : null;

  const adjustWeight = (delta: number) => {
    const current = Number(weight) || 50;
    const next = Math.max(30, Math.min(150, current + delta));
    setWeight(String(next));
    setErrors((prev) => ({ ...prev, weight: undefined }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-line-soft pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
          Step 1: Check-up Date & Clinical Vitals
        </span>
        <span className="text-2xs text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded">
          Auto-calculated #{visitNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="visit-date-input" className="block text-xs font-bold text-ink mb-1.5">
            Visit / Check-up Date <span className="text-triage-red">*</span>
          </label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
            <input
              id="visit-date-input"
              type="date"
              className="input pl-9 text-sm"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>
          {errors.visitDate && (
            <p className="mt-1 text-2xs text-triage-red font-medium">{errors.visitDate}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="maternal-weight-input" className="text-xs font-bold text-ink">
              Maternal Weight (kg)
            </label>
            <span className="text-2xs text-ink-subtle">Target: +1-2 kg/mo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustWeight(-1)}
              className="h-9 w-9 rounded-lg border border-line bg-canvas hover:bg-canvas-subtle font-bold text-ink flex items-center justify-center transition-colors"
            >
              -
            </button>
            <input
              id="maternal-weight-input"
              type="number"
              step="0.1"
              placeholder="e.g. 52.5"
              className="input text-center font-bold text-ink flex-1 text-sm"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setErrors((prev) => ({ ...prev, weight: undefined }));
              }}
            />
            <button
              type="button"
              onClick={() => adjustWeight(1)}
              className="h-9 w-9 rounded-lg border border-line bg-canvas hover:bg-canvas-subtle font-bold text-ink flex items-center justify-center transition-colors"
            >
              +
            </button>
          </div>
          {errors.weight && (
            <p className="mt-1 text-2xs text-triage-red font-medium">{errors.weight}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="rounded-xl border border-line-soft bg-canvas-subtle p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <ActivityIcon className="h-4 w-4 text-primary" />
              Blood Pressure
            </span>
            {isHighBp ? (
              <span className="badge badge-red text-2xs">High BP (≥ 140/90)</span>
            ) : isPreHtn ? (
              <span className="badge badge-amber text-2xs">Pre-HTN</span>
            ) : bpSystolic && bpDiastolic ? (
              <span className="badge badge-green text-2xs">Normal BP</span>
            ) : (
              <span className="text-2xs text-ink-subtle">mmHg</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Sys (120)"
              aria-label="BP Systolic"
              className="input text-center text-sm font-semibold"
              value={bpSystolic}
              onChange={(e) => {
                setBpSystolic(e.target.value);
                setErrors((prev) => ({ ...prev, bp: undefined }));
              }}
            />
            <span className="text-ink-subtle font-bold">/</span>
            <input
              type="number"
              placeholder="Dia (80)"
              aria-label="BP Diastolic"
              className="input text-center text-sm font-semibold"
              value={bpDiastolic}
              onChange={(e) => {
                setBpDiastolic(e.target.value);
                setErrors((prev) => ({ ...prev, bp: undefined }));
              }}
            />
          </div>
          {errors.bp && <p className="text-2xs text-triage-red font-medium">{errors.bp}</p>}
        </div>

        <div className="rounded-xl border border-line-soft bg-canvas-subtle p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <DropletIcon className="h-4 w-4 text-triage-red" />
              Hemoglobin (Hb)
            </span>
            <span className="text-2xs text-ink-subtle">g/dL</span>
          </div>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 8.5"
            aria-label="Hemoglobin (Hb)"
            className="input text-sm font-semibold"
            value={hb}
            onChange={(e) => {
              setHb(e.target.value);
              setErrors((prev) => ({ ...prev, hb: undefined }));
            }}
          />
          {anemiaGrade ? (
            <span
              className={`badge ${ANEMIA_GRADE_BADGE[anemiaGrade]} text-2xs w-full justify-center`}
            >
              {ANEMIA_GRADE_LABEL[anemiaGrade]}
            </span>
          ) : hbNum !== null && hbNum >= 11 ? (
            <span className="badge badge-green text-2xs w-full justify-center">
              Normal (≥ 11 g/dL)
            </span>
          ) : null}
          {errors.hb && <p className="text-2xs text-triage-red font-medium">{errors.hb}</p>}
        </div>
      </div>
    </div>
  );
}

function DangerSignsSection({
  dangerSigns,
  onToggle,
}: {
  dangerSigns: DangerSign[];
  onToggle: (sign: DangerSign) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-line-soft pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
          Step 2: Danger Signs Observed
        </span>
        <span className="text-2xs text-ink-subtle">
          {dangerSigns.length > 0 ? `${dangerSigns.length} Selected` : "Tap to select"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DANGER_SIGN_OPTIONS.map((item) => {
          const selected = dangerSigns.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onToggle(item.value)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                selected
                  ? "border-triage-red-line bg-triage-red-bg ring-1 ring-triage-red"
                  : "border-line bg-canvas hover:border-line-soft hover:bg-canvas-subtle"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-md flex shrink-0 items-center justify-center text-2xs font-bold mt-0.5 ${
                  selected
                    ? "bg-triage-red text-white"
                    : "border border-line-soft bg-canvas text-transparent"
                }`}
              >
                ✓
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-bold leading-tight ${
                    selected ? "text-triage-red" : "text-ink"
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-2xs text-ink-muted mt-0.5 leading-tight">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SupplementsSection({
  ifaGiven,
  setIfaGiven,
  calciumGiven,
  setCalciumGiven,
  albendazoleGiven,
  setAlbendazoleGiven,
  fcmAdministered,
  setFcmAdministered,
}: {
  ifaGiven: boolean;
  setIfaGiven: (val: boolean) => void;
  calciumGiven: boolean;
  setCalciumGiven: (val: boolean) => void;
  albendazoleGiven: boolean;
  setAlbendazoleGiven: (val: boolean) => void;
  fcmAdministered: boolean;
  setFcmAdministered: (val: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-line-soft pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
          Step 3: Supplements & Interventions Given
        </span>
        <span className="text-2xs text-teal-700 font-semibold">Field / Helpdesk</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            ifaGiven ? "border-primary bg-primary-light" : "border-line bg-canvas"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary-ring"
            checked={ifaGiven}
            onChange={(e) => setIfaGiven(e.target.checked)}
          />
          <div>
            <p className="text-xs font-bold text-ink">IFA Tablets Given</p>
            <p className="text-2xs text-ink-muted">100 / 180 iron folic acid tablets</p>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            calciumGiven ? "border-primary bg-primary-light" : "border-line bg-canvas"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary-ring"
            checked={calciumGiven}
            onChange={(e) => setCalciumGiven(e.target.checked)}
          />
          <div>
            <p className="text-xs font-bold text-ink">Calcium Given</p>
            <p className="text-2xs text-ink-muted">360 tablets (2/day from 14w)</p>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            albendazoleGiven ? "border-primary bg-primary-light" : "border-line bg-canvas"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary-ring"
            checked={albendazoleGiven}
            onChange={(e) => setAlbendazoleGiven(e.target.checked)}
          />
          <div>
            <p className="text-xs font-bold text-ink">Albendazole Given</p>
            <p className="text-2xs text-ink-muted">Single dose deworming after 1st tri</p>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            fcmAdministered
              ? "border-teal-600 bg-teal-50 shadow-sm"
              : "border-teal-200 bg-teal-50/40 hover:bg-teal-50/80"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-teal-400 text-teal-600 focus:ring-teal-500"
            checked={fcmAdministered}
            onChange={(e) => setFcmAdministered(e.target.checked)}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-teal-950">FCM Administered</p>
              <span className="badge badge-teal text-2xs">IV Injection</span>
            </div>
            <p className="text-2xs text-teal-800">Ferric Carboxymaltose at CHC / DH</p>
          </div>
        </label>
      </div>
    </div>
  );
}

function ReferralSection({
  referred,
  setReferred,
  fieldRole,
  referralFacilityType,
  setReferralFacilityType,
  referralReason,
  setReferralReason,
}: {
  referred: boolean;
  setReferred: (val: boolean) => void;
  fieldRole: boolean;
  referralFacilityType: ReferralFacilityType;
  setReferralFacilityType: (val: ReferralFacilityType) => void;
  referralReason: string;
  setReferralReason: (val: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-line-soft pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
          Step 4: Referral Decision
        </span>
        <span className="text-2xs text-ink-subtle">Higher Facility Escalation</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setReferred(false)}
          className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
            !referred
              ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500"
              : "border-line bg-canvas text-ink-subtle hover:bg-canvas-subtle"
          }`}
        >
          No — Routine Care
        </button>
        <button
          type="button"
          onClick={() => setReferred(true)}
          className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
            referred
              ? "border-triage-red bg-triage-red-bg text-triage-red ring-1 ring-triage-red"
              : "border-line bg-canvas text-ink-subtle hover:bg-canvas-subtle"
          }`}
        >
          Yes — Refer Facility
        </button>
      </div>

      {referred && (
        <div className="p-3.5 rounded-xl border border-line-soft bg-canvas-subtle space-y-3 animate-fade-in">
          <p className="block text-xs font-bold text-ink">Referral Destination</p>
          {fieldRole ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReferralFacilityType("CHC_FRU")}
                className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                  referralFacilityType === "CHC_FRU"
                    ? "border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600"
                    : "border-line bg-canvas text-ink-muted"
                }`}
              >
                CHC / FRU (Block)
              </button>
              <button
                type="button"
                onClick={() => setReferralFacilityType("DH")}
                className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                  referralFacilityType === "DH"
                    ? "border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600"
                    : "border-line bg-canvas text-ink-muted"
                }`}
              >
                Sadar Hospital (DH)
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg border border-purple-500 bg-purple-50 text-purple-900 text-xs font-bold flex items-center justify-between">
              <span>Sadar Hospital / District Hospital (DH)</span>
              <span className="badge badge-purple text-2xs">Specialized Care</span>
            </div>
          )}

          <input
            type="text"
            placeholder="Reason for referral (e.g. Severe Anemia, High BP, FCM not responding)"
            aria-label="Reason for referral"
            className="input text-xs"
            value={referralReason}
            onChange={(e) => setReferralReason(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

async function saveOfflineVisitAndFollowUp({
  payload,
  row,
  userId,
  facilityId,
  now,
}: {
  payload: RecordFollowUpVisit;
  row: FollowUpRow;
  userId: string;
  facilityId: string;
  now: string;
}) {
  const visitId = crypto.randomUUID();
  const followUpId = row.followUpId ?? crypto.randomUUID();

  await visitRepo.upsert({
    id: visitId,
    patientId: row.patientId,
    facilityId: facilityId,
    conductedBy: userId,
    visitNumber: payload.visitNumber,
    visitDate: (payload.visitDate instanceof Date
      ? payload.visitDate
      : new Date(payload.visitDate)
    ).toISOString(),
    gestationalWeeks: payload.gestationalWeeks,
    bpSystolic: payload.bpSystolic ?? null,
    bpDiastolic: payload.bpDiastolic ?? null,
    hemoglobin: payload.hb ?? null,
    weight: payload.weight ?? null,
    dangerSigns: payload.dangerSigns ?? [],
    supplements: {
      ifaGiven: payload.ifaGiven ?? false,
      calciumGiven: payload.calciumGiven ?? false,
      albendazoleGiven: payload.albendazoleGiven ?? false,
      fcmAdministered: payload.fcmAdministered ?? false,
    },
    fcmAdministered: payload.fcmAdministered ?? false,
    referred: payload.referred ?? false,
    referralFacilityType: payload.referralFacilityType ?? null,
    notes: payload.notes ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  await enqueueOp({
    entityType: "visit",
    entityId: visitId,
    op: "create",
    payload: { ...payload, id: visitId },
    clientUpdatedAt: now,
  });

  await followUpRepo.upsert({
    id: followUpId,
    patientId: row.patientId,
    assignedToUserId: userId,
    assignedByUserId: userId,
    level: "ANM",
    status: "COMPLETE",
    track: row.track,
    scheduledDate: (payload.visitDate instanceof Date
      ? payload.visitDate
      : new Date(payload.visitDate)
    ).toISOString(),
    completedAt: now,
    completedByUserId: userId || null,
    fcmAdministered: payload.fcmAdministered ?? false,
    notes: payload.notes ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  await enqueueOp({
    entityType: "followUp",
    entityId: followUpId,
    op: "update",
    payload: {
      id: followUpId,
      patientId: row.patientId,
      status: "COMPLETE",
      completedAt: now,
      fcmAdministered: payload.fcmAdministered,
      updatedAt: now,
    },
    clientUpdatedAt: now,
  });
}

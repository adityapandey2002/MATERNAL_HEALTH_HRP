import {
  ANEMIA_GRADE_BADGE,
  ANEMIA_GRADE_LABEL,
  type CreatePatient,
  HRP_COMPLICATIONS,
  type HrpComplication,
  anemiaGradeFromHb,
  getPatientDisplayId,
  hrpReasonForComplication,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "../components/ui/Icons";
import { api } from "../lib/api";
import type { LocalPatient } from "../lib/db/local-db";
import { patientRepo } from "../lib/db/repositories";
import { eddFromLmp, gestationalAgeLabel } from "../lib/hrp";
import { useUnsavedChangesGuard } from "../lib/native";
import { useUserRole } from "../lib/session";
import { getCachedSession } from "../lib/session-cache";
import { enqueueOp } from "../lib/sync/queue";

interface FormState {
  name: string;
  phone: string;
  age: string;
  villageId: string;
  lmp: string;
  complications: HrpComplication[];
  referred: boolean;
  referralFacilityType: "CHC_FRU" | "DH";
  hb: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  age: "",
  villageId: "",
  lmp: "",
  complications: [],
  referred: false,
  referralFacilityType: "CHC_FRU",
  hb: "",
};

const VILLAGE_LEVELS = new Set(["VILLAGE", "HSC", "HWC"]);

function BloodDropIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 21.5c-3.6 0-6.5-2.9-6.5-6.5 0-4 6.5-12 6.5-12s6.5 8 6.5 12c0 3.6-2.9 6.5-6.5 6.5z"
      />
    </svg>
  );
}

function HeartPulseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h2l1-2 2 4 1-2h2"
      />
    </svg>
  );
}

function GlucoseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  );
}

function HeightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 3v18M7 3l-3 3M7 3l3 3M7 21l-3-3M7 21l3 3M13 7h7M13 12h5M13 17h7"
      />
    </svg>
  );
}

function SurgeryIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242L10.757 7.757m3.364 6.364l-3.364-3.364"
      />
    </svg>
  );
}

function MultiparaIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function TwinsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function RhNegativeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 16h4" />
    </svg>
  );
}

const COMPLICATION_CONFIG: Record<
  HrpComplication,
  {
    active: string;
    inactive: string;
    icon: (props: { className?: string }) => JSX.Element;
  }
> = {
  ANEMIA: {
    active: "bg-gradient-to-r from-rose-500 to-rose-600 text-white border-rose-600 shadow-sm",
    inactive: "bg-rose-50/80 hover:bg-rose-100/90 text-rose-950 border-rose-200/90",
    icon: BloodDropIcon,
  },
  PIH: {
    active: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-500 shadow-sm",
    inactive: "bg-amber-50/80 hover:bg-amber-100/90 text-amber-950 border-amber-200/90",
    icon: HeartPulseIcon,
  },
  GDM: {
    active: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-600 shadow-sm",
    inactive: "bg-purple-50/80 hover:bg-purple-100/90 text-purple-950 border-purple-200/90",
    icon: GlucoseIcon,
  },
  SHORT_STATURE: {
    active: "bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-600 shadow-sm",
    inactive: "bg-amber-50/80 hover:bg-amber-100/90 text-amber-950 border-amber-200/90",
    icon: HeightIcon,
  },
  PRE_LSCS: {
    active: "bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-600 shadow-sm",
    inactive: "bg-teal-50/80 hover:bg-teal-100/90 text-teal-950 border-teal-200/90",
    icon: SurgeryIcon,
  },
  MULTI_GRAVIDA: {
    active: "bg-gradient-to-r from-cyan-600 to-teal-600 text-white border-cyan-600 shadow-sm",
    inactive: "bg-cyan-50/80 hover:bg-cyan-100/90 text-cyan-950 border-cyan-200/90",
    icon: MultiparaIcon,
  },
  TWINS_MULTIPLE_PREGNANCY: {
    active: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-sm",
    inactive: "bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-950 border-indigo-200/90",
    icon: TwinsIcon,
  },
  TEENAGE_PREGNANCY: {
    active: "bg-gradient-to-r from-rose-500 to-pink-600 text-white border-pink-600 shadow-sm",
    inactive: "bg-pink-50/80 hover:bg-pink-100/90 text-pink-950 border-pink-200/90",
    icon: BloodDropIcon,
  },
  EDEMA: {
    active: "bg-gradient-to-r from-blue-600 to-sky-600 text-white border-blue-600 shadow-sm",
    inactive: "bg-blue-50/80 hover:bg-blue-100/90 text-blue-950 border-blue-200/90",
    icon: RhNegativeIcon,
  },
};

function HeroBanner({
  title,
  displayId,
}: {
  title: string;
  displayId: string;
}) {
  return (
    <div className="w-full bg-gradient-to-br from-[#095751] via-[#0d7a73] to-[#044c48] text-white rounded-3xl p-5 shadow-xl shadow-teal-950/15 relative overflow-hidden">
      <div className="absolute -right-6 -bottom-8 w-36 h-36 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-300/10 rounded-full blur-xl pointer-events-none" />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-black/25 backdrop-blur-md border border-white/15 px-2.5 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">
              Rapid Intake • Field V4
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">{title}</h1>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white flex-shrink-0 shadow-inner">
          <UserPlusIcon className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between relative z-10 flex-wrap gap-2">
        <span className="text-xs text-emerald-100 flex items-center gap-1.5 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />7 Core Parameters
        </span>
        <span className="text-xs font-semibold bg-white/90 text-teal-950 px-3 py-1 rounded-full shadow-xs">
          Unique Patient ID:{" "}
          <strong className="font-mono text-teal-950 font-bold">{displayId}</strong>
        </span>
      </div>
    </div>
  );
}

function LiveSyncBanner({ facilityName }: { facilityName?: string }) {
  return (
    <div className="w-full bg-gradient-to-r from-teal-50 via-cyan-50 to-blue-50 border border-teal-100/90 text-teal-900 px-3.5 py-2 rounded-2xl flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-teal-600/10 text-teal-700 flex items-center justify-center">
          <ShieldCheckIcon className="h-4 w-4 text-teal-700" />
        </div>
        <span className="text-xs font-semibold tracking-tight text-teal-950">
          Offline Ready • Local Active
        </span>
      </div>
      <span className="text-[11px] bg-white shadow-xs border border-teal-200 text-teal-800 font-bold px-2.5 py-0.5 rounded-lg">
        {facilityName || "HSC Field Unit"}
      </span>
    </div>
  );
}

function MaternalAgeCard({
  age,
  onChangeAge,
  error,
}: {
  age: string;
  onChangeAge: (val: string) => void;
  error?: string;
}) {
  const ageNum = age.trim() ? Number(age) : null;
  const validAge = ageNum !== null && !Number.isNaN(ageNum);

  let ageTagText = "Optimal Bracket";
  let ageTagColor = "bg-emerald-50 text-emerald-800 border-emerald-200";

  if (validAge) {
    if (ageNum < 19) {
      ageTagText = "Teen Pregnancy";
      ageTagColor = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (ageNum >= 35) {
      ageTagText = "Advanced Age";
      ageTagColor = "bg-rose-50 text-rose-700 border-rose-200";
    }
  } else {
    ageTagText = "Age (15–55)";
    ageTagColor = "bg-slate-100 text-slate-600 border-slate-200";
  }

  const stepAge = (delta: number) => {
    const current = validAge ? ageNum : 24;
    const next = Math.max(15, Math.min(55, current + delta));
    onChangeAge(String(next));
  };

  const QUICK_AGES = [18, 21, 24, 28, 35];

  return (
    <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-emerald-500 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs"
            aria-hidden="true"
          >
            3
          </span>
          <label htmlFor="patient-age" className="text-sm font-bold text-slate-800">
            Age (completed years) <span className="text-red-500">*</span>
          </label>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${ageTagColor}`}>
          {ageTagText}
        </span>
      </div>

      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-2xl">
        <button
          type="button"
          aria-label="Decrease age"
          onClick={() => stepAge(-1)}
          className="w-11 h-11 rounded-xl bg-white text-emerald-700 font-bold border border-slate-200 flex items-center justify-center active:scale-95 shadow-xs hover:bg-emerald-50 transition-all text-xl"
        >
          −
        </button>
        <div className="flex items-baseline gap-1 text-center">
          <input
            id="patient-age"
            type="number"
            inputMode="numeric"
            min={15}
            max={55}
            value={age}
            onChange={(e) => onChangeAge(e.target.value)}
            placeholder="24"
            className="w-20 text-center text-3xl font-extrabold text-emerald-950 font-mono bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
          />
          <span className="text-xs text-slate-500 font-semibold uppercase">Years</span>
        </div>
        <button
          type="button"
          aria-label="Increase age"
          onClick={() => stepAge(1)}
          className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-95 shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition-all text-xl"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
        {QUICK_AGES.map((qAge) => {
          const isSelected = validAge && ageNum === qAge;
          return (
            <button
              key={qAge}
              type="button"
              onClick={() => onChangeAge(String(qAge))}
              className={`h-9 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {qAge}
              {qAge === 35 ? "+" : ""}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

function ComplicationsMultiSelect({
  selected,
  onToggle,
  error,
}: {
  selected: HrpComplication[];
  onToggle: (comp: HrpComplication) => void;
  error?: string;
}) {
  return (
    <fieldset className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-rose-500 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-xs"
            aria-hidden="true"
          >
            6
          </span>
          <legend className="text-sm font-bold text-slate-800">
            Complications <span className="text-red-500">*</span>
          </legend>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${
            selected.length > 0 ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          {selected.length > 0 ? `${selected.length} Selected` : "Select Complications"}
        </span>
      </div>

      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 pt-0.5">
        {HRP_COMPLICATIONS.map((option) => {
          const isChecked = selected.includes(option.value);
          const config = COMPLICATION_CONFIG[option.value] ?? COMPLICATION_CONFIG.ANEMIA;
          const Icon = config.icon;

          return (
            <label
              key={option.value}
              className={`cursor-pointer flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.98] ${
                isChecked ? config.active : config.inactive
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isChecked ? "bg-white/20 text-white" : "bg-white text-slate-700 shadow-xs"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight truncate">
                    {option.label}
                  </span>
                  <span
                    className={`block text-[10px] leading-tight truncate mt-0.5 ${
                      isChecked ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {option.hint}
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                value={option.value}
                checked={isChecked}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0 ml-2"
              />
            </label>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function AnemiaHbSection({
  hb,
  onChangeHb,
  error,
}: {
  hb: string;
  onChangeHb: (val: string) => void;
  error?: string;
}) {
  const hbNum = hb.trim() ? Number(hb) : null;
  const grade = hbNum !== null && !Number.isNaN(hbNum) ? anemiaGradeFromHb(hbNum) : null;

  return (
    <div className="w-full bg-gradient-to-br from-rose-50/70 via-orange-50/40 to-amber-50/50 rounded-2xl p-4 border border-rose-200/90 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor="patient-hb" className="text-xs font-bold text-slate-800">
          Haemoglobin (Hb) — g/dL <span className="text-red-500">*</span>
        </label>
        <span className="text-[11px] text-slate-500 font-medium">From MCP card / lab report</span>
      </div>
      <input
        id="patient-hb"
        type="number"
        inputMode="decimal"
        step="0.1"
        min={1}
        max={20}
        value={hb}
        onChange={(e) => onChangeHb(e.target.value)}
        placeholder="e.g. 7.2"
        className="w-full h-11 px-3.5 bg-white text-slate-900 font-mono text-sm font-semibold rounded-xl border border-rose-300 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-400"
      />
      {error && (
        <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {grade && (
        <div className="flex items-center gap-2 pt-0.5" aria-live="polite">
          <span className={`badge ${ANEMIA_GRADE_BADGE[grade]} text-xs font-semibold shadow-xs`}>
            {ANEMIA_GRADE_LABEL[grade]}
          </span>
        </div>
      )}
    </div>
  );
}

function ReferralSection({
  referred,
  referralFacilityType,
  onSetReferred,
  onSetFacilityType,
}: {
  referred: boolean;
  referralFacilityType: "CHC_FRU" | "DH";
  onSetReferred: (ref: boolean) => void;
  onSetFacilityType: (type: "CHC_FRU" | "DH") => void;
}) {
  return (
    <fieldset className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-red-600 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-xs"
            aria-hidden="true"
          >
            7
          </span>
          <legend className="text-sm font-bold text-slate-800">Referring or not?</legend>
        </div>
        <span className="text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-md uppercase">
          Required
        </span>
      </div>

      <div className="space-y-2 pt-0.5">
        <label
          className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between active:scale-[0.98] ${
            referred
              ? "bg-gradient-to-r from-red-50 to-rose-50 border-red-500 shadow-sm"
              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                referred
                  ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/25"
                  : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              <AlertTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-red-950 flex items-center gap-1.5">
                {referred && <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />}
                Yes — Refer case
              </span>
              <span className="block text-xs text-slate-500">
                Helpdesk will be notified to complete 15-day follow-up
              </span>
            </div>
          </div>
          <input
            type="radio"
            name="referred"
            value="yes"
            checked={referred}
            onChange={() => onSetReferred(true)}
            className="h-4 w-4 text-red-600 focus:ring-red-500 ml-2"
          />
        </label>

        <label
          className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between active:scale-[0.98] ${
            !referred
              ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-500 shadow-sm"
              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                !referred
                  ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25"
                  : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              <HomeIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-800">
                No — Routine Field Management
              </span>
              <span className="block text-xs text-slate-500">Managed at local HSC cluster</span>
            </div>
          </div>
          <input
            type="radio"
            name="referred"
            value="no"
            checked={!referred}
            onChange={() => onSetReferred(false)}
            className="h-4 w-4 text-teal-600 focus:ring-teal-500 ml-2"
          />
        </label>
      </div>

      {referred && (
        <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-red-50/60 to-rose-50/40 border border-red-200 space-y-2">
          <label
            htmlFor="patient-referral-facility"
            className="text-xs font-bold text-red-950 block"
          >
            Referral destination <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="patient-referral-facility"
              aria-label="Referral destination facility"
              className="w-full h-11 pl-3.5 pr-10 bg-white text-slate-900 text-sm font-semibold rounded-xl border border-red-300 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 appearance-none transition-all cursor-pointer"
              value={referralFacilityType}
              onChange={(e) => onSetFacilityType(e.target.value as "CHC_FRU" | "DH")}
            >
              <option value="CHC_FRU">CHC / FRU (Block HRP Helpdesk follow-up)</option>
              <option value="DH">DH / Sadar Hospital (District HRP Helpdesk follow-up)</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-red-600 flex items-center">
              <ChevronDownIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xs text-slate-500">
            {referralFacilityType === "DH"
              ? "District HRP Helpdesk will be notified to conduct the repeating 15-day contact."
              : "Block HRP Helpdesk will be notified to conduct the repeating 15-day contact."}
          </p>
        </div>
      )}
    </fieldset>
  );
}

export default function AddPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useUserRole();
  const [patientId] = useState(() => crypto.randomUUID());
  const displayId = getPatientDisplayId(patientId);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [duplicate, setDuplicate] = useState<LocalPatient | null>(null);

  useUnsavedChangesGuard(JSON.stringify(form) !== JSON.stringify(INITIAL_FORM));

  const { data: facilities } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.facilities.list(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const villageOptions = useMemo(() => {
    const list = Array.isArray(facilities) ? facilities : [];
    return list
      .filter((facility) => VILLAGE_LEVELS.has(facility.level))
      .map((facility) => ({ value: facility.id, label: facility.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facilities]);

  const cachedSession = getCachedSession();
  const facilityList = Array.isArray(facilities) ? facilities : [];
  const activeFacilityName = facilityList.find(
    (f) => f.id === cachedSession?.user.facilityId
  )?.name;

  const isAnemiaSelected = form.complications.includes("ANEMIA");

  const createMutation = useMutation({
    mutationFn: async (data: CreatePatient & { id?: string }) => {
      const id = data.id || patientId;
      const cached = getCachedSession();
      let user = cached?.user;
      if (!user) {
        try {
          user = await api.auth.me();
        } catch {
          throw new Error("Sign in once with a connection before adding a case offline.");
        }
      }
      const facilityId = user?.facilityId ?? "";
      const anmName = user?.name ?? null;
      const now = new Date().toISOString();

      const registrationHb = typeof data.registrationHb === "number" ? data.registrationHb : null;
      const anemiaGrade = anemiaGradeFromHb(registrationHb);

      await patientRepo.upsert({
        id,
        abhaId: data.abhaId ?? null,
        facilityId,
        registeredBy: user?.id ?? "",
        anmName,
        name: data.name,
        age: data.age,
        phone: data.phone ?? null,
        address: data.address ?? null,
        hrpReason: (data.hrpReason ?? null) as string | null,
        hrpComplication: (data.hrpComplication ?? null) as string | null,
        hrpComplications: form.complications,
        registrationHb,
        anemiaGrade,
        ashaName: data.ashaName ?? null,
        ashaPhone: data.ashaPhone ?? null,
        referred: data.referred,
        referralFacilityType: form.referred ? form.referralFacilityType : null,
        isHrp: data.isHrp ?? true,
        followUpTrack: null,
        followUpScheduledDate: null,
        followUpStatus: data.followUpStatus ?? "PENDING",
        lmp: data.lmp ? new Date(data.lmp).toISOString() : null,
        edd: data.edd ? new Date(data.edd).toISOString() : null,
        gravida: data.gravida ?? 0,
        para: data.para ?? 0,
        abortions: data.abortions ?? 0,
        riskFactors: data.riskFactors ?? [],
        riskLevel: "AMBER",
        riskScore: 0,
        isHighRisk: true,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      });
      await enqueueOp({
        entityType: "patient",
        entityId: id,
        op: "create",
        payload: {
          ...data,
          id,
          hrpComplication: form.complications.includes("ANEMIA")
            ? "ANEMIA"
            : (form.complications[0] ?? null),
          hrpComplications: form.complications,
          referralFacilityType: form.referred ? form.referralFacilityType : null,
        },
        clientUpdatedAt: now,
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["hrp"] });
      navigate("/follow-ups");
    },
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "name") setDuplicate(null);
  };

  const toggleComplication = (comp: HrpComplication) => {
    setForm((prev) => {
      const next = prev.complications.includes(comp)
        ? prev.complications.filter((c) => c !== comp)
        : [...prev.complications, comp];
      const hb = next.includes("ANEMIA") ? prev.hb : "";
      return { ...prev, complications: next, hb };
    });
    setErrors((prev) => ({ ...prev, complications: undefined, hb: undefined }));
  };

  const checkForDuplicate = async (name: string) => {
    const facilityId = getCachedSession()?.user.facilityId;
    if (!facilityId || name.trim().length < 3) {
      setDuplicate(null);
      return;
    }
    try {
      const matches = await patientRepo.findByExactName(facilityId, name);
      setDuplicate(matches[0] ?? null);
    } catch {
      setDuplicate(null);
    }
  };

  const lmpDate = form.lmp ? new Date(`${form.lmp}T00:00:00`) : null;
  const validLmp = lmpDate && !Number.isNaN(lmpDate.getTime()) ? lmpDate : null;
  const edd = validLmp ? eddFromLmp(validLmp) : null;

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Enter the mother's full name";

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) next.phone = "Enter her 10-digit mobile number";
    else if (phoneDigits.length !== 10) next.phone = "Enter a 10-digit mobile number";

    const age = Number(form.age);
    if (!form.age.trim() || Number.isNaN(age) || !Number.isInteger(age)) {
      next.age = "Enter her age in completed years";
    } else if (age < 15 || age > 55) {
      next.age = "Age must be between 15 and 55";
    }

    if (villageOptions.length > 0 && !form.villageId) next.villageId = "Select the village / HWC";
    if (!validLmp) next.lmp = "Enter the last menstrual period date";
    else if (validLmp.getTime() > Date.now()) next.lmp = "LMP cannot be in the future";
    if (form.complications.length === 0)
      next.complications = "Select at least one HRP complication";

    if (isAnemiaSelected) {
      const hbNum = Number(form.hb);
      if (!form.hb.trim() || Number.isNaN(hbNum)) {
        next.hb = "Enter the Hb value (g/dL) from the MCP card";
      } else if (hbNum < 1 || hbNum > 20) {
        next.hb = "Hb must be between 1 and 20 g/dL";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || !validLmp || form.complications.length === 0) return;

    const villageName = villageOptions.find((option) => option.value === form.villageId)?.label;
    const hbNum = form.hb.trim() ? Number(form.hb) : null;
    const primaryComplication = form.complications.includes("ANEMIA")
      ? "ANEMIA"
      : (form.complications[0] ?? null);

    createMutation.mutate({
      id: patientId,
      name: form.name.trim(),
      age: Number(form.age),
      phone: form.phone.replace(/\D/g, ""),
      address: villageName ?? null,
      hrpComplication: primaryComplication,
      hrpComplications: form.complications,
      hrpReason: hrpReasonForComplication(primaryComplication),
      registrationHb: isAnemiaSelected && hbNum !== null && !Number.isNaN(hbNum) ? hbNum : null,
      isHrp: true,
      referred: form.referred,
      referralFacilityType: form.referred ? form.referralFacilityType : null,
      followUpStatus: "PENDING",
      lmp: validLmp,
      edd: eddFromLmp(validLmp),
      ashaName: null,
      ashaPhone: null,
      gravida: 0,
      para: 0,
      abortions: 0,
      riskFactors: [],
    });
  };

  const isBlockRole =
    role === "HRP_HELPDESK_BLOCK" ||
    role === "BHM" ||
    role === "HRP_HELPDESK_DISTRICT" ||
    role === "DHS";
  const title = isBlockRole ? "Add HRP case" : "Add case";

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top Navigation & Live Sync Status */}
      <div className="flex items-center justify-between px-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <LiveSyncBanner facilityName={activeFacilityName} />

      {/* Hero Intake Header Banner */}
      <HeroBanner title={title} displayId={displayId} />

      {createMutation.isError && (
        <div
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 shadow-xs"
          role="alert"
        >
          <p className="text-sm font-bold text-red-900">Could not save registration</p>
          <p className="text-xs text-red-700 mt-0.5">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Check the values and try again"}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Field 1: Mother's Full Name */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-teal-600 space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-xs"
                aria-hidden="true"
              >
                1
              </span>
              <label htmlFor="patient-name" className="text-sm font-bold text-slate-800">
                Mother's full name <span className="text-red-500">*</span>
              </label>
            </div>
            <span className="text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md">
              MCP Linked
            </span>
          </div>
          <div className="relative">
            <input
              id="patient-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={(e) => void checkForDuplicate(e.target.value)}
              placeholder="Full name"
              className="w-full h-12 px-3.5 bg-slate-50 text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-3 focus:ring-teal-500/20 transition-all placeholder:text-slate-400"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
              {errors.name}
            </p>
          )}
          {duplicate && (
            <output className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 block text-xs text-amber-900">
              A woman named{" "}
              <Link
                to={`/patients/${duplicate.id}`}
                className="font-semibold underline text-amber-950"
              >
                {duplicate.name}
              </Link>{" "}
              is already registered at this facility. Open that case before adding a duplicate.
            </output>
          )}
        </div>

        {/* Field 2: Mobile Number */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-sky-500 space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center text-xs font-bold shadow-xs"
                aria-hidden="true"
              >
                2
              </span>
              <label htmlFor="patient-phone" className="text-sm font-bold text-slate-800">
                Mobile number <span className="text-red-500">*</span>
              </label>
            </div>
            <span className="text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md">
              Field Callback
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-12 px-3 bg-sky-50 border border-sky-200 text-sky-900 font-mono text-sm flex items-center rounded-xl font-bold select-none shadow-xs">
              🇮🇳 +91
            </div>
            <input
              id="patient-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="10-digit mobile"
              className="flex-1 h-12 px-3.5 bg-slate-50 text-slate-900 font-mono text-sm font-semibold rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/20 transition-all tracking-wider placeholder:text-slate-400"
            />
          </div>
          {errors.phone ? (
            <p
              id="patient-phone-error"
              className="text-xs text-red-600 font-medium"
              role="alert"
              aria-live="polite"
            >
              {errors.phone}
            </p>
          ) : (
            <p className="text-xs text-slate-500">Used by the ANM and helpdesk to call back</p>
          )}
        </div>

        {/* Field 3: Maternal Age */}
        <MaternalAgeCard
          age={form.age}
          onChangeAge={(val) => update("age", val)}
          error={errors.age}
        />

        {/* Field 4: Village / HWC */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-indigo-500 space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-xs"
                aria-hidden="true"
              >
                4
              </span>
              <label htmlFor="patient-village" className="text-sm font-bold text-slate-800">
                Village / HWC <span className="text-red-500">*</span>
              </label>
            </div>
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
              Mapped HSC
            </span>
          </div>
          <div className="relative">
            <select
              id="patient-village"
              value={form.villageId}
              onChange={(e) => update("villageId", e.target.value)}
              className="w-full h-12 pl-3.5 pr-10 bg-slate-50 text-slate-900 text-sm font-semibold rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/20 appearance-none transition-all cursor-pointer"
            >
              <option value="">
                {villageOptions.length === 0 ? "Your facility" : "Select a village"}
              </option>
              {villageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 flex items-center">
              <ChevronDownIcon className="h-5 w-5" />
            </div>
          </div>
          {errors.villageId && (
            <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
              {errors.villageId}
            </p>
          )}
        </div>

        {/* Field 5: Last Menstrual Period (LMP) & Dynamic EDD */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[5px] border-l-violet-600 space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-xs"
                aria-hidden="true"
              >
                5
              </span>
              <label htmlFor="patient-lmp" className="text-sm font-bold text-slate-800">
                LMP (last menstrual period) <span className="text-red-500">*</span>
              </label>
            </div>
            <span className="text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-md">
              Live EDD
            </span>
          </div>
          <div className="relative">
            <input
              id="patient-lmp"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.lmp}
              onChange={(e) => update("lmp", e.target.value)}
              className="w-full h-12 px-3.5 bg-slate-50 text-slate-900 font-mono text-sm font-semibold rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:border-violet-600 focus:ring-3 focus:ring-violet-500/20 appearance-none transition-all cursor-pointer"
            />
          </div>
          {errors.lmp && (
            <p className="text-xs text-red-600 font-medium" role="alert" aria-live="polite">
              {errors.lmp}
            </p>
          )}

          {validLmp && edd && (
            <div
              className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-md shadow-teal-900/15"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] text-teal-100 font-bold uppercase tracking-wider">
                    Expected Delivery
                  </div>
                  <div className="text-base font-bold text-white tracking-tight">
                    EDD {format(edd, "d MMM yyyy")}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-teal-100 font-semibold uppercase">Gestation</div>
                <div className="text-xs font-bold bg-white text-teal-900 px-2.5 py-0.5 rounded-full inline-block shadow-xs">
                  Gestational age {gestationalAgeLabel(validLmp)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field 6: Multi-Select Complications */}
        <ComplicationsMultiSelect
          selected={form.complications}
          onToggle={toggleComplication}
          error={errors.complications}
        />

        {/* Hb Section: Dynamic single-line badge when Anemia is selected */}
        {isAnemiaSelected && (
          <AnemiaHbSection
            hb={form.hb}
            onChangeHb={(val) => {
              setForm((prev) => ({ ...prev, hb: val }));
              setErrors((prev) => ({ ...prev, hb: undefined }));
            }}
            error={errors.hb}
          />
        )}

        {/* Field 7: Referral Decision */}
        <ReferralSection
          referred={form.referred}
          referralFacilityType={form.referralFacilityType}
          onSetReferred={(ref) => update("referred", ref)}
          onSetFacilityType={(type) => update("referralFacilityType", type)}
        />

        {/* Action CTA Buttons */}
        <div className="pt-2 space-y-2.5">
          <button
            type="submit"
            className="w-full h-14 bg-gradient-to-r from-[#0d7a73] via-[#095751] to-[#044c48] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20 active:scale-[0.98] transition-all hover:brightness-105 disabled:opacity-50"
            disabled={createMutation.isPending}
          >
            <CheckIcon className="h-5 w-5" />
            <span className="text-base">
              {createMutation.isPending ? "Adding..." : "Add to HRP register"}
            </span>
            <ArrowRightIcon className="h-5 w-5 ml-1" />
          </button>
          <Link
            to="/"
            className="w-full h-12 bg-white text-slate-700 border border-slate-200/90 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors active:scale-[0.98] shadow-xs"
          >
            Cancel &amp; Return to Home
          </Link>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Search,
  Syringe,
  X,
} from "lucide-react";
import EmptyState from "@/components/shared/empty-state";
import { formatClinicDate } from "@/lib/clinic-date";
import type { PatientListRecord } from "@/modules/patients/schemas/patient-schema";
import type { TreatmentPlanInput } from "@/modules/treatments/schemas/treatment-plan-schema";
import useLiveRefresh from "@/hooks/use-live-refresh";
import Modal from "@/components/shared/modal";
import { bdtCurrency as money } from "@/lib/format";

const toothQuadrants = [
  { label: "Upper right", teeth: Array.from({ length: 8 }, (_, index) => String(18 - index)) },
  { label: "Upper left", teeth: Array.from({ length: 8 }, (_, index) => String(21 + index)) },
  { label: "Lower right", teeth: Array.from({ length: 8 }, (_, index) => String(48 - index)) },
  { label: "Lower left", teeth: Array.from({ length: 8 }, (_, index) => String(31 + index)) },
];

const statusLabels: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type TreatmentPlanRecord = {
  id: string;
  patientId: string;
  patient: { id: string; patientCode: string; name: string; phone: string };
  diagnosis: string;
  procedureName: string;
  toothNumbers: string[];
  estimatedCost: string;
  status: keyof typeof statusLabels;
  notes: string | null;
  completedAt: string | null;
  updatedAt: string;
  _count: { sessions: number };
  sessions: TreatmentSession[];
};

type TreatmentSession = {
  id: string;
  performedAt: string;
  notes: string;
  createdBy: { name: string } | null;
};

type PatientChoice = Pick<PatientListRecord, "id" | "patientCode" | "name" | "phone">;

const emptyForm = {
  patientId: "",
  diagnosis: "",
  procedureName: "",
  toothNumbers: [] as string[],
  estimatedCost: "",
  status: "PLANNED",
  notes: "",
};


async function readJson(response: Response) {
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Treatment request failed.");
  return result;
}

export default function TreatmentManagement() {
  const [plans, setPlans] = useState<TreatmentPlanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentPlanRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientChoice[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [sessionPlan, setSessionPlan] = useState<TreatmentPlanRecord | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useLiveRefresh(
    () => setRefreshKey((key) => key + 1),
    !formOpen && !sessionPlan && !saving && !sessionSaving,
    30_000,
    ["TreatmentPlan", "TreatmentSession", "Patient"],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
          status: statusFilter,
        });
        const response = await fetch(`/api/treatments?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await readJson(response) as { plans: TreatmentPlanRecord[]; total: number };
        setPlans(result.plans);
        setTotal(result.total);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load treatment plans.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, refreshKey, search, statusFilter]);

  useEffect(() => {
    if (!formOpen) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPatientLoading(true);
      setPatientError("");
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "10", search: patientSearch, fields: "picker" });
        const response = await fetch(`/api/patients?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await readJson(response) as { patients: PatientChoice[] };
        setPatientResults(result.patients);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPatientError(error instanceof Error ? error.message : "Unable to search patients.");
        }
      } finally {
        if (!controller.signal.aborted) setPatientLoading(false);
      }
    }, 120);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [formOpen, patientSearch]);

  const selectedPatient = useMemo(
    () => patientResults.find((patient) => patient.id === form.patientId),
    [form.patientId, patientResults],
  );
  const selectedPlanIds = useMemo(
    () => new Set(form.toothNumbers),
    [form.toothNumbers],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setPatientSearch("");
    setPatientResults([]);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(plan: TreatmentPlanRecord) {
    setPatientResults([plan.patient]);
    setEditing(plan);
    setForm({
      patientId: plan.patientId,
      diagnosis: plan.diagnosis,
      procedureName: plan.procedureName,
      toothNumbers: plan.toothNumbers,
      estimatedCost: plan.estimatedCost,
      status: plan.status,
      notes: plan.notes ?? "",
    });
    setPatientSearch(plan.patient.name);
    setFormError("");
    setFormOpen(true);
  }

  function toggleTooth(tooth: string) {
    setForm((current) => ({
      ...current,
      toothNumbers: current.toothNumbers.includes(tooth)
        ? current.toothNumbers.filter((item) => item !== tooth)
        : [...current.toothNumbers, tooth].sort(),
    }));
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const payload: TreatmentPlanInput = {
      ...form,
      estimatedCost: Number(form.estimatedCost),
      status: form.status as TreatmentPlanInput["status"],
    };
    try {
      const response = await fetch(
        editing ? `/api/treatments/${editing.id}` : "/api/treatments",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await readJson(response);
      setFormOpen(false);
      setPage(1);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save treatment plan.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(plan: TreatmentPlanRecord, status: string) {
    try {
      const response = await fetch(`/api/treatments/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await readJson(response);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to update treatment status.");
    }
  }

  async function addSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionPlan) return;
    setSessionSaving(true);
    setSessionError("");
    try {
      const response = await fetch(`/api/treatments/${sessionPlan.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: sessionNotes,
          performedAt: sessionDate ? new Date(sessionDate).toISOString() : undefined,
        }),
      });
      await readJson(response);
      setSessionPlan(null);
      setSessionNotes("");
      setSessionDate("");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Unable to save treatment session.");
    } finally {
      setSessionSaving(false);
    }
  }

  return (
    <section className="treatment-management">
      <div className="treatment-toolbar">
        <label className="treatment-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search patient, diagnosis or procedure"
            aria-label="Search treatment plans"
          />
        </label>
        <label className="treatment-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}>
            <option value="ALL">All plans</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="button-primary" onClick={openCreate}>
          <Plus size={16} /> New treatment plan
        </button>
      </div>

      <div className="treatment-summary">
        <div className="treatment-summary-icon"><Syringe size={18} /></div>
        <div><strong>{total}</strong><span> {statusFilter === "ALL" ? "treatment plans" : `${statusLabels[statusFilter]} plans`}</span></div>
      </div>

      {loadError ? (
        <div className="patient-load-error" role="alert">
          {loadError}
          <button type="button" className="button-secondary" onClick={() => {
            setLoadError("");
            setRefreshKey((key) => key + 1);
          }}>Retry</button>
        </div>
      ) : loading ? (
        <div className="panel-card loading-state" role="status">Loading treatment plans…</div>
      ) : !plans.length ? (
        <div className="panel-card treatment-empty">
          <EmptyState
            icon={<ClipboardList size={18} />}
            message={search || statusFilter !== "ALL"
              ? "No treatment plans match these filters."
              : "No treatment plans recorded yet. Start by adding a patient diagnosis and care plan."}
          />
        </div>
      ) : (
        <div className="treatment-plan-list">
          {plans.map((plan) => (
            <article className="panel-card treatment-plan-card" key={plan.id}>
              <div className="treatment-plan-heading">
                <div className="treatment-plan-patient">
                  <span className="patient-avatar">{plan.patient.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <div>
                    <h2>{plan.patient.name}</h2>
                    <span>{plan.patient.patientCode} · {plan.patient.phone}</span>
                  </div>
                </div>
                <span className={`treatment-status treatment-status-${plan.status.toLowerCase().replace("_", "-")}`}>
                  {statusLabels[plan.status]}
                </span>
              </div>

              <div className="treatment-plan-details">
                <div>
                  <span className="treatment-detail-label">Diagnosis</span>
                  <strong>{plan.diagnosis}</strong>
                </div>
                <div>
                  <span className="treatment-detail-label">Procedure</span>
                  <strong>{plan.procedureName}</strong>
                </div>
                <div>
                  <span className="treatment-detail-label">Estimated cost</span>
                  <strong>{money.format(Number(plan.estimatedCost))}</strong>
                </div>
                <div>
                  <span className="treatment-detail-label">Sessions</span>
                  <strong>{plan._count.sessions} recorded</strong>
                </div>
              </div>

              {plan.toothNumbers.length > 0 && (
                <div className="treatment-tooth-summary">
                  <span>FDI teeth</span>
                  {plan.toothNumbers.map((tooth) => <span className="treatment-tooth-chip" key={tooth}>{tooth}</span>)}
                </div>
              )}
              {plan.notes && <p className="treatment-plan-notes">{plan.notes}</p>}

              {plan.sessions.length > 0 && (
                <details className="treatment-session-history">
                  <summary><Activity size={15} /> Recent clinical sessions <ChevronDown size={14} /></summary>
                  <div className="treatment-session-list">
                    {plan.sessions.map((session) => (
                      <div className="treatment-session-entry" key={session.id}>
                        <time>{formatClinicDate(session.performedAt)}</time>
                        <p>{session.notes}</p>
                        <span>{session.createdBy?.name ?? "Clinic staff"}</span>
                      </div>
                    ))}
                    {plan._count.sessions > plan.sessions.length && <span className="treatment-more-sessions">Showing 3 most recent of {plan._count.sessions} sessions.</span>}
                  </div>
                </details>
              )}

              <div className="treatment-plan-actions">
                <label>
                  <span className="sr-only">Update plan status</span>
                  <select
                    className="treatment-status-select"
                    value={plan.status}
                    onChange={(event) => void changeStatus(plan, event.target.value)}
                    disabled={plan.status === "COMPLETED" || plan.status === "CANCELLED"}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <button type="button" className="button-secondary" onClick={() => openEdit(plan)} disabled={plan.status === "COMPLETED" || plan.status === "CANCELLED"}>
                  Edit plan
                </button>
                <button type="button" className="button-primary" onClick={() => {
                  setSessionPlan(plan);
                  setSessionError("");
                }} disabled={plan.status === "COMPLETED" || plan.status === "CANCELLED"}>
                  <Plus size={14} /> Record session
                </button>
              </div>
            </article>
          ))}
          <div className="patient-pagination treatment-pagination">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div>
              <button type="button" className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" className="icon-button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <Modal className="treatment-modal" labelledBy="treatment-form-title" onRequestClose={() => { if (!saving) setFormOpen(false); }}>
            <div className="modal-heading">
              <div>
                <h2 id="treatment-form-title">{editing ? "Edit treatment plan" : "New treatment plan"}</h2>
                <p>Record the clinical diagnosis, planned procedure, and estimated fee.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setFormOpen(false)} disabled={saving} aria-label="Close treatment form"><X size={16} /></button>
            </div>
            <form className="modal-form treatment-form" onSubmit={(event) => void savePlan(event)} aria-describedby={formError ? "treatment-form-error" : undefined}>
              <div className="form-field">
                <label htmlFor="treatment-patient-search">Patient *</label>
                <input
                  id="treatment-patient-search"
                  value={selectedPatient ? `${selectedPatient.name} · ${selectedPatient.patientCode}` : patientSearch}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, patientId: "" }));
                    setPatientSearch(event.target.value);
                  }}
                  placeholder="Search patient name, phone or ID"
                  aria-invalid={patientError ? true : undefined}
                  aria-describedby={patientError ? "treatment-patient-error" : undefined}
                  required={!form.patientId}
                />
                {patientLoading && <span className="treatment-field-hint">Searching patients…</span>}
                {patientError && <span className="form-error" id="treatment-patient-error" role="alert">{patientError}</span>}
                {!patientLoading && patientSearch.trim() && !form.patientId && patientResults.length > 0 && (
                  <div className="treatment-patient-results">
                    {patientResults.map((patient) => (
                      <button type="button" key={patient.id} onClick={() => {
                        setForm((current) => ({ ...current, patientId: patient.id }));
                        setPatientSearch(patient.name);
                      }}>
                        <strong>{patient.name}</strong><span>{patient.patientCode} · {patient.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!patientLoading && patientSearch.trim() && !patientError && patientResults.length === 0 && !form.patientId && (
                  <span className="treatment-field-hint">No matching patients. Register the patient first.</span>
                )}
                {form.patientId && selectedPatient && (
                  <button type="button" className="treatment-clear-patient" onClick={() => {
                    setForm((current) => ({ ...current, patientId: "" }));
                    setPatientSearch("");
                  }}>Change patient</button>
                )}
              </div>
              <div className="form-grid">
                <TreatmentField label="Diagnosis *" name="diagnosis" value={form.diagnosis} required onChange={(value) => setForm((current) => ({ ...current, diagnosis: value }))} />
                <TreatmentField label="Planned procedure *" name="procedureName" value={form.procedureName} required onChange={(value) => setForm((current) => ({ ...current, procedureName: value }))} />
                <TreatmentField label="Estimated cost (BDT) *" name="estimatedCost" type="number" value={form.estimatedCost} required onChange={(value) => setForm((current) => ({ ...current, estimatedCost: value }))} />
                {editing && (
                  <div className="form-field">
                    <label htmlFor="treatment-status">Plan status</label>
                    <select id="treatment-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <fieldset className="fdi-tooth-selector">
                <legend>FDI tooth chart <span>Select all teeth involved, if applicable</span></legend>
                {toothQuadrants.map((quadrant) => (
                  <div className="fdi-quadrant" key={quadrant.label}>
                    <span>{quadrant.label}</span>
                    <div>
                      {quadrant.teeth.map((tooth) => (
                        <button
                          type="button"
                          className={selectedPlanIds.has(tooth) ? "selected" : ""}
                          key={tooth}
                          onClick={() => toggleTooth(tooth)}
                          aria-pressed={selectedPlanIds.has(tooth)}
                          aria-label={`Tooth ${tooth}`}
                        >{tooth}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="fdi-selected-count">{form.toothNumbers.length} {form.toothNumbers.length === 1 ? "tooth" : "teeth"} selected</div>
              </fieldset>
              <div className="form-field">
                <label htmlFor="treatment-notes">Clinical notes</label>
                <textarea id="treatment-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={5000} />
              </div>
              {formError && <div className="form-error" id="treatment-form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="button-primary" disabled={saving || !form.patientId}>{saving ? "Saving…" : editing ? "Save plan" : "Create treatment plan"}</button>
              </div>
            </form>
          </Modal>
      )}

      {sessionPlan && (
        <Modal className="treatment-session-modal" labelledBy="treatment-session-title" onRequestClose={() => { if (!sessionSaving) setSessionPlan(null); }}>
            <div className="modal-heading">
              <div>
                <h2 id="treatment-session-title">Record treatment session</h2>
                <p>{sessionPlan.patient.name} · {sessionPlan.procedureName}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSessionPlan(null)} disabled={sessionSaving} aria-label="Close session form"><X size={16} /></button>
            </div>
            <form className="modal-form" onSubmit={(event) => void addSession(event)} aria-describedby={sessionError ? "treatment-session-error" : undefined}>
              <div className="form-field">
                <label htmlFor="treatment-session-date">Session date and time</label>
                <input id="treatment-session-date" type="datetime-local" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="treatment-session-notes">Clinical session notes *</label>
                <textarea id="treatment-session-notes" value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} maxLength={5000} required />
              </div>
              {sessionError && <div className="form-error" id="treatment-session-error" role="alert">{sessionError}</div>}
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setSessionPlan(null)} disabled={sessionSaving}>Cancel</button>
                <button type="submit" className="button-primary" disabled={sessionSaving}>{sessionSaving ? "Saving…" : "Save clinical session"}</button>
              </div>
            </form>
          </Modal>
      )}
    </section>
  );
}

function TreatmentField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="form-field">
      <label htmlFor={`treatment-${name}`}>{label}</label>
      <input
        id={`treatment-${name}`}
        name={name}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        required={required}
        min={type === "number" ? 0 : undefined}
        max={type === "number" ? 9999999999 : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { AlertCircle, ClipboardList, Plus, Printer, Save, Search, Trash2, UserRound } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import PatientSelect from "@/components/shared/patient-select";
import { PrescriptionPrintSheet } from "@/modules/clinic/components/print-sheets";
import { emptyPrescriptionForm, prescriptionFormSchema, type PrescriptionFormValues } from "@/modules/clinic/schemas/prescription-schema";
import { emptyMedication, requestJson, type PatientChoice, type PatientClinicalContext, type PrescriptionRecord } from "./clinic-types";
import { useSectionLoader, useDebouncedValue, usePrintJob, type SectionProps } from "./section-shared";

export default function PrescriptionsSection({ onNotice }: SectionProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [patients, setPatients] = useState<PatientChoice[]>([]);
  const [patientContext, setPatientContext] = useState<PatientClinicalContext | null>(null);
  const [patientContextLoading, setPatientContextLoading] = useState(false);
  const [patientContextError, setPatientContextError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  // The form follows the same schema the API uses (prescription-schema.ts): problems show beside
  // each field once it has been left, and submitting focuses the first one.
  const { register, handleSubmit, control, reset, setValue, getValues, formState: { errors } } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: emptyPrescriptionForm(),
    mode: "onTouched",
  });
  const medications = useFieldArray({ control, name: "medications" });
  const patientId = useWatch({ control, name: "patientId" });
  const [printJob, setPrintJob] = usePrintJob();
  const [prescriptionCursor, setPrescriptionCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const result = await requestJson<{ patient: PatientClinicalContext }>(
          await fetch(`/api/patients/${patientId}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        );
        if (!controller.signal.aborted) setPatientContext(result.patient);
      } catch (contextError) {
        if (!controller.signal.aborted) {
          setPatientContextError(
            contextError instanceof Error ? contextError.message : "Unable to load patient history.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setPatientContextLoading(false);
      }
    })();

    return () => controller.abort();
  }, [patientId]);

  const load = useCallback(async (needChoices: boolean) => {
    const [prescriptionResult, patientResult] = await Promise.all([
      requestJson<{ prescriptions: PrescriptionRecord[]; nextCursor: string | null }>(await fetch(`/api/prescriptions?search=${encodeURIComponent(debouncedSearch)}`, { cache: "no-store" })),
      needChoices
        ? requestJson<{ patients: PatientChoice[] }>(await fetch("/api/patients?page=1&pageSize=100&status=ACTIVE&fields=picker", { cache: "no-store" }))
        : Promise.resolve(null),
    ]);
    setPrescriptions(prescriptionResult.prescriptions);
    setPrescriptionCursor(prescriptionResult.nextCursor);
    if (patientResult) setPatients(patientResult.patients);
  }, [debouncedSearch]);

  const { gate, reload } = useSectionLoader({ section: "prescriptions", load, shouldPauseLive: () => saving });

  async function loadMore() {
    const cursor = prescriptionCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const query = `search=${encodeURIComponent(debouncedSearch)}&cursor=${encodeURIComponent(cursor)}`;
      const result = await requestJson<{ prescriptions: PrescriptionRecord[]; nextCursor: string | null }>(await fetch(`/api/prescriptions?${query}`, { cache: "no-store" }));
      setPrescriptions((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.prescriptions.filter((item) => !known.has(item.id))];
      });
      setPrescriptionCursor(result.nextCursor);
    } catch (loadError) {
      onNotice(loadError instanceof Error ? loadError.message : "Unable to load more records.", true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function createPrescription(values: PrescriptionFormValues) {
    setSaving(true);
    try {
      await requestJson(await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          instructions: values.instructions || null,
          followUpDate: values.followUpDate || null,
          medications: values.medications.map((medication) => ({
            ...medication, instructions: medication.instructions || null,
          })),
        }),
      }));
      reset(emptyPrescriptionForm());
      setPatientContext(null);
      setPatientContextError("");
      reload();
      onNotice("Prescription saved to the patient record.", false);
    } catch (saveError) {
      onNotice(saveError instanceof Error ? saveError.message : "Unable to save prescription.", true);
    } finally { setSaving(false); }
  }

  if (gate) return gate;

  return (
    <div className="prescription-page">
      {printJob?.kind === "prescription" && <PrescriptionPrintSheet prescription={printJob.prescription} />}
      <div className="prescription-compose-grid">
        <section className="panel-card prescription-context-card">
          <header className="prescription-section-heading">
            <h2>1. Select Patient &amp; Context</h2>
          </header>
          <div className="prescription-context-content">
            <label className="form-field" htmlFor="prescription-patient">Patient</label>
            <PatientSelect
              id="prescription-patient"
              className="prescription-patient-select"
              required
              value={patientId}
              choices={patients}
              status="ACTIVE"
              placeholder="Select patient"
              onChange={(nextPatientId) => {
                setPatientContext(null);
                setPatientContextError("");
                setPatientContextLoading(Boolean(nextPatientId));
                setValue("patientId", nextPatientId, { shouldValidate: true });
              }}
            />
            {errors.patientId && <small className="field-error" role="alert">{errors.patientId.message}</small>}
            {patientContextLoading ? (
              <p className="prescription-context-message" role="status">Loading patient history…</p>
            ) : patientContextError ? (
              <p className="prescription-context-error" role="alert"><AlertCircle size={14} /> {patientContextError}</p>
            ) : patientContext ? (
              <div className="prescription-patient-summary">
                <span className="prescription-patient-avatar">{patientContext.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                <span>
                  <strong>{patientContext.name}</strong>
                  <small>{patientContext.patientCode} · {patientContext.phone}</small>
                </span>
              </div>
            ) : (
              <div className="prescription-context-placeholder">
                <UserRound size={17} /> Select a patient to review their clinical context.
              </div>
            )}
            {patientContext && (
              <section className="prescription-history-context">
                <h3>Recent vitals &amp; history</h3>
                <strong>History</strong>
                <ul>
                  <li>{patientContext.allergies ? `Allergies: ${patientContext.allergies}` : "No allergies recorded"}</li>
                  {patientContext.medicalHistory && <li>Medical history: {patientContext.medicalHistory}</li>}
                  {patientContext.dentalHistory && <li>Dental history: {patientContext.dentalHistory}</li>}
                  <li>
                    {patientContext.latestAppointment
                      ? `Previous visit: ${patientContext.latestAppointment.service} · ${formatClinicDate(patientContext.latestAppointment.dateTime)}`
                      : "No previous appointments"}
                  </li>
                </ul>
                <span>{patientContext.appointmentCount} appointment{patientContext.appointmentCount === 1 ? "" : "s"} on record</span>
              </section>
            )}
          </div>
        </section>

        <section className="panel-card prescription-compose-card">
          <header className="prescription-section-heading">
            <h2>2. Prescribe Medications &amp; Instructions</h2>
          </header>
          <form className="prescription-form" noValidate onSubmit={handleSubmit(createPrescription)}>
            <label className="form-field">
              Diagnosis
              <input maxLength={500} aria-invalid={errors.diagnosis ? true : undefined} {...register("diagnosis")} />
              {errors.diagnosis && <small className="field-error" role="alert">{errors.diagnosis.message}</small>}
            </label>
            <div className="prescription-medications">
              <strong className="prescription-field-heading">Medications</strong>
              <div className="prescription-medication-list">
                {medications.fields.map((medication, index) => (
                  <fieldset className="clinic-medication prescription-medication-card" key={medication.id}>
                    <legend>Medication {index + 1}</legend>
                    <div className="prescription-medication-fields">
                      {(["name", "dosage", "frequency", "duration", "instructions"] as const).map((field) => (
                        <label className={`form-field prescription-medication-${field}`} key={field}>
                          {field === "name" ? "Name" : field[0].toUpperCase() + field.slice(1)}
                          <input
                            maxLength={field === "instructions" ? 500 : 120}
                            aria-invalid={errors.medications?.[index]?.[field] ? true : undefined}
                            {...register(`medications.${index}.${field}`)}
                          />
                          {errors.medications?.[index]?.[field] && <small className="field-error" role="alert">{errors.medications[index]?.[field]?.message}</small>}
                        </label>
                      ))}
                    </div>
                    {medications.fields.length > 1 && (
                      <button
                        className="prescription-remove-medication"
                        type="button"
                        onClick={() => medications.remove(index)}
                        aria-label={`Remove medication ${index + 1}`}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </fieldset>
                ))}
              </div>
              <button className="prescription-add-medication" type="button" onClick={() => medications.append({ ...emptyMedication })} disabled={medications.fields.length >= 30}>
                <Plus size={15} /> Add Medication
              </button>
            </div>
            <div className="prescription-followup-grid">
              <label className="form-field">
                Follow-up date
                <input type="date" aria-invalid={errors.followUpDate ? true : undefined} {...register("followUpDate")} />
                {errors.followUpDate && <small className="field-error" role="alert">{errors.followUpDate.message}</small>}
              </label>
              <label className="form-field">
                Care instructions
                <textarea maxLength={3000} aria-invalid={errors.instructions ? true : undefined} {...register("instructions")} />
                {errors.instructions && <small className="field-error" role="alert">{errors.instructions.message}</small>}
              </label>
            </div>
            <div className="prescription-form-actions">
              <button className="button-primary" disabled={saving || !patients.length}>
                <Save size={14} /> {saving ? "Saving…" : "Save Prescription"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  const prescriptionForm = getValues();
                  const patient = patients.find((item) => item.id === patientId);
                  setPrintJob({
                    kind: "prescription",
                    prescription: {
                      code: "Draft (not saved)",
                      createdAt: new Date().toISOString(),
                      patient: { name: patient?.name ?? "—", patientCode: patient?.patientCode ?? "—" },
                      diagnosis: prescriptionForm.diagnosis,
                      instructions: prescriptionForm.instructions || null,
                      followUpDate: prescriptionForm.followUpDate || null,
                      prescribedBy: null,
                      medications: prescriptionForm.medications.map((medication) => ({
                        name: medication.name,
                        dosage: medication.dosage,
                        frequency: medication.frequency,
                        duration: medication.duration,
                        instructions: medication.instructions || null,
                      })),
                    },
                  });
                }}
              >
                <Printer size={14} /> Preview / Print
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel-card prescription-history-card">
        <header className="prescription-history-heading">
          <div>
            <h2>Prescription History</h2>
            <p>Most recent {prescriptions.length === 100 ? "100 prescriptions" : `${prescriptions.length} prescriptions`}</p>
          </div>
          <label className="prescription-history-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient or diagnosis" aria-label="Search prescription history" />
          </label>
        </header>
        {prescriptions.length ? (
          <div className="table-scroll">
            <table className="data-table prescription-history-table">
              <thead>
                <tr><th>Prescription ID</th><th>Patient</th><th>Diagnosis</th><th>Prescribing Doctor</th><th>Medications</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {prescriptions.map((prescription) => (
                  <tr key={prescription.id}>
                    <td><span className="request-id">RX-{prescription.id.slice(-8).toUpperCase()}</span></td>
                    <td>
                      <span className="prescription-history-patient">
                        <span className="prescription-patient-avatar">{prescription.patient.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                        <span>{prescription.patient.name}<small>{prescription.patient.patientCode}</small></span>
                      </span>
                    </td>
                    <td>{prescription.diagnosis}</td>
                    <td>{prescription.prescribedBy?.name ?? "Clinic doctor"}</td>
                    <td>{prescription.medications.map((medication) => `${medication.name} (${medication.duration})`).join(", ")}</td>
                    <td>{formatClinicDate(prescription.createdAt)}</td>
                    <td><span className="prescription-saved-status">Saved</span></td>
                    <td><button type="button" className="prescription-print-button" onClick={() => setPrintJob({
                      kind: "prescription",
                      prescription: {
                        code: `RX-${prescription.id.slice(-8).toUpperCase()}`,
                        createdAt: prescription.createdAt,
                        patient: prescription.patient,
                        diagnosis: prescription.diagnosis,
                        instructions: prescription.instructions,
                        followUpDate: prescription.followUpDate,
                        prescribedBy: prescription.prescribedBy?.name ?? null,
                        medications: prescription.medications.map((medication) => ({ ...medication, instructions: medication.instructions || null })),
                      },
                    })} aria-label={`Print prescription for ${prescription.patient.name}`}><Printer size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="prescription-history-empty">
            <ClipboardList size={19} />
            <span>No prescriptions match this search.</span>
          </div>
        )}
        {prescriptionCursor && (
          <div className="appointment-load-more">
            <button type="button" className="button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "Loading prescriptions…" : `Load older prescriptions (${prescriptions.length} shown)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import { requestJson } from "@/modules/clinic/components/clinic-types";

type Examination = {
  id: string;
  examinedAt: string;
  chiefComplaint: string;
  findings: string | null;
  diagnosis: string;
  notes: string | null;
  followUpDate: string | null;
  examinedBy: { id: string; name: string } | null;
};
type Page = { examinations: Examination[]; nextCursor: string | null };

const emptyForm = { chiefComplaint: "", findings: "", diagnosis: "", notes: "", followUpDate: "" };
const followUpLabel = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export default function VisitRecords({ patientId, onNotice }: { patientId: string; onNotice: (message: string, error: boolean) => void }) {
  const [loaded, setLoaded] = useState<{ patientId: string; page: Page; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const page = await requestJson<Page>(await fetch(`/api/examinations?patientId=${patientId}`, { cache: "no-store", signal: controller.signal }));
        if (!controller.signal.aborted) setLoaded({ patientId, page, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setLoaded({ patientId, page: { examinations: [], nextCursor: null }, error: error instanceof Error ? error.message : "Unable to load visit records." });
      }
    })();
    return () => controller.abort();
  }, [patientId, version]);

  const current = loaded?.patientId === patientId ? loaded : null;

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      await requestJson(await fetch("/api/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chiefComplaint: form.chiefComplaint,
          findings: form.findings || null,
          diagnosis: form.diagnosis,
          notes: form.notes || null,
          followUpDate: form.followUpDate || null,
        }),
      }));
      setForm(emptyForm);
      setVersion((value) => value + 1);
      onNotice("Visit record saved.", false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save the visit record.");
    } finally {
      setSaving(false);
    }
  }, [form, onNotice, patientId, saving]);

  async function loadMore() {
    if (!current?.page.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await requestJson<Page>(await fetch(`/api/examinations?patientId=${patientId}&cursor=${encodeURIComponent(current.page.nextCursor)}`, { cache: "no-store" }));
      setLoaded({ patientId, error: "", page: { examinations: [...current.page.examinations, ...more.examinations], nextCursor: more.nextCursor } });
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to load more visits.", true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="visit-layout">
      <form className="modal-form clinic-module-form visit-form" onSubmit={submit}>
        <h3 className="clinic-subheading">Record a visit</h3>
        <label className="form-field">Chief complaint *<textarea required minLength={2} maxLength={2000} value={form.chiefComplaint} onChange={(event) => setForm({ ...form, chiefComplaint: event.target.value })} placeholder="What the patient reports" /></label>
        <label className="form-field">Examination findings<textarea maxLength={4000} value={form.findings} onChange={(event) => setForm({ ...form, findings: event.target.value })} placeholder="Clinical and radiographic findings" /></label>
        <label className="form-field">Diagnosis *<input required minLength={2} maxLength={500} value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></label>
        <label className="form-field">Notes<textarea maxLength={4000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Advice given, next steps" /></label>
        <label className="form-field">Follow-up date<input type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} /></label>
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <button className="button-primary" disabled={saving}><Plus size={14} />{saving ? "Saving…" : "Save visit record"}</button>
      </form>

      <div className="visit-list" aria-live="polite">
        {!current && <div className="loading-state" role="status">Loading visit records…</div>}
        {current?.error && <div className="form-error" role="alert">{current.error}</div>}
        {current && !current.error && !current.page.examinations.length && <p className="clinic-empty">No visit records yet. Record the first one on the left.</p>}
        {current?.page.examinations.map((visit) => (
          <article className="clinic-record visit-record" key={visit.id}>
            <div className="clinic-record-heading"><strong>{visit.diagnosis}</strong><span>{formatClinicDate(visit.examinedAt)}</span></div>
            <dl className="visit-details">
              <div><dt>Complaint</dt><dd>{visit.chiefComplaint}</dd></div>
              {visit.findings && <div><dt>Findings</dt><dd>{visit.findings}</dd></div>}
              {visit.notes && <div><dt>Notes</dt><dd>{visit.notes}</dd></div>}
              {visit.followUpDate && <div><dt>Follow-up</dt><dd>{followUpLabel(visit.followUpDate)}</dd></div>}
            </dl>
            {visit.examinedBy && <p className="cell-secondary">Recorded by {visit.examinedBy.name}</p>}
          </article>
        ))}
        {current?.page.nextCursor && <div className="appointment-load-more"><button type="button" className="button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load older visits"}</button></div>}
      </div>
    </div>
  );
}

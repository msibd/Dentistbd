"use client";

import { BellRing, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";

type Reminder = { id: string; patientName: string; patientPhone: string; service: string; dateTime: string; status: string };
type FollowUp = { followUpDate: string; patient: { id: string; name: string; phone: string; patientCode: string } };

const whatsappLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

// Upcoming appointments and follow-up dates, each with one-tap call and WhatsApp links.
export default function AppointmentReminders() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(2);
  // One result per look-ahead setting; "loading" is simply "no result for the current setting yet".
  const [result, setResult] = useState<{ days: number; reminders: Reminder[]; followUps: FollowUp[]; error: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/appointments/reminders?days=${days}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/follow-ups?days=${days + 5}`, { cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([appointmentResponse, followUpResponse]) => {
        const appointmentBody = await appointmentResponse.json() as { reminders?: Reminder[]; error?: string };
        if (!appointmentResponse.ok) throw new Error(appointmentBody.error ?? "Unable to load reminders.");
        // Follow-ups are optional extras; a failure there never hides the appointment reminders.
        const followUpBody = followUpResponse.ok ? await followUpResponse.json() as { followUps?: FollowUp[] } : {};
        setResult({ days, reminders: appointmentBody.reminders ?? [], followUps: followUpBody.followUps ?? [], error: "" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setResult({ days, reminders: [], followUps: [], error: reason instanceof Error ? reason.message : "Unable to load reminders." });
      });
    return () => controller.abort();
  }, [open, days]);

  const current = result?.days === days ? result : null;
  const loading = open && !current;
  const reminders = current?.reminders ?? [];
  const followUps = current?.followUps ?? [];
  const error = current?.error ?? "";

  return (
    <section className="panel-card appointment-reminders">
      <header className="panel-header">
        <div>
          <h2 className="panel-title"><BellRing size={15} /> Reminders</h2>
          <p className="panel-description">Call or message patients before their visit, and patients due for a follow-up.</p>
        </div>
        <button type="button" className="button-secondary" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? "Hide" : "Show reminders"}
        </button>
      </header>
      {open && (
        <div className="reminder-body">
          <label className="form-field reminder-days">Look ahead
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>Today and tomorrow</option>
              <option value={2}>Next 2 days</option>
              <option value={7}>Next 7 days</option>
            </select>
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {loading ? <p className="reminder-empty">Loading…</p> : (
            <>
              <h3 className="reminder-heading">Upcoming appointments ({reminders.length})</h3>
              {!reminders.length && <p className="reminder-empty">No upcoming appointments in this period.</p>}
              <ul className="reminder-list">
                {reminders.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.patientName}</strong>
                      <span className="cell-secondary">{formatClinicDate(item.dateTime)} · {formatClinicTime(item.dateTime)} · {item.service}{item.status === "PENDING" ? " · not confirmed" : ""}</span>
                    </div>
                    <div className="reminder-actions">
                      <a className="button-secondary" href={`tel:${item.patientPhone}`}><Phone size={13} /> Call</a>
                      <a className="button-secondary" href={whatsappLink(item.patientPhone, `Dear ${item.patientName}, this is a reminder of your ${item.service} appointment on ${formatClinicDate(item.dateTime)} at ${formatClinicTime(item.dateTime)}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  </li>
                ))}
              </ul>
              <h3 className="reminder-heading">Follow-ups due ({followUps.length})</h3>
              {!followUps.length && <p className="reminder-empty">No follow-ups due in this period.</p>}
              <ul className="reminder-list">
                {followUps.map((item) => (
                  <li key={`${item.patient.id}:${item.followUpDate}`}>
                    <div>
                      <strong>{item.patient.name}</strong>
                      <span className="cell-secondary">{item.patient.patientCode} · follow-up on {formatClinicDate(`${item.followUpDate}T12:00:00+06:00`)}</span>
                    </div>
                    <div className="reminder-actions">
                      <a className="button-secondary" href={`tel:${item.patient.phone}`}><Phone size={13} /> Call</a>
                      <a className="button-secondary" href={whatsappLink(item.patient.phone, `Dear ${item.patient.name}, you are due for a follow-up visit on ${formatClinicDate(`${item.followUpDate}T12:00:00+06:00`)}. Please contact us to book a time.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

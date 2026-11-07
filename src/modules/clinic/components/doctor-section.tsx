"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { days, requestJson, type DoctorRecord } from "./clinic-types";
import { useSectionLoader, type SectionProps } from "./section-shared";

export default function DoctorSection({ onNotice }: SectionProps) {
  const [doctor, setDoctor] = useState<DoctorRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const savedDoctorSnapshot = useRef<string | null>(null);

  const load = useCallback(async () => {
    const result = await requestJson<{ doctor: DoctorRecord | null }>(await fetch("/api/doctor", { cache: "no-store" }));
    const scheduleMap = new Map((result.doctor?.schedules ?? []).map((item) => [item.dayOfWeek, item]));
    const nextDoctor = result.doctor ? {
      ...result.doctor,
      schedules: days.map((_, dayOfWeek) => scheduleMap.get(dayOfWeek) ?? {
        dayOfWeek, startTime: "09:00", endTime: "17:00", isWorking: false,
      }),
    } : null;
    savedDoctorSnapshot.current = nextDoctor ? JSON.stringify(nextDoctor) : null;
    setDoctor(nextDoctor);
  }, []);

  // Live updates must not overwrite unsaved edits.
  const { gate } = useSectionLoader({
    section: "doctors",
    load,
    shouldPauseLive: () => saving || Boolean(doctor && JSON.stringify(doctor) !== savedDoctorSnapshot.current),
  });

  async function saveDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doctor) return;
    setSaving(true);
    try {
      await requestJson(await fetch("/api/doctor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...doctor,
          consultationFee: Number(doctor.consultationFee),
          schedules: doctor.schedules,
        }),
      }));
      savedDoctorSnapshot.current = JSON.stringify(doctor);
      onNotice("Doctor profile and availability saved.", false);
    } catch (saveError) {
      onNotice(saveError instanceof Error ? saveError.message : "Unable to save doctor profile.", true);
    } finally { setSaving(false); }
  }

  if (gate) return gate;

  return doctor ? (
    <section className="panel-card clinic-module-card">
      <header className="panel-header"><div><h2 className="panel-title">Doctor profile</h2><p className="panel-description">This clinic is configured for one doctor. Set accurate registration and working hours here.</p></div></header>
      <form className="modal-form clinic-module-form" onSubmit={saveDoctor}>
        <div className="form-grid">
          <label className="form-field">Full name<input required maxLength={120} value={doctor.name} onChange={(event) => setDoctor({ ...doctor, name: event.target.value })} /></label>
          <label className="form-field">Specialization<input required maxLength={120} value={doctor.specialization} onChange={(event) => setDoctor({ ...doctor, specialization: event.target.value })} /></label>
          <label className="form-field">Qualifications<input maxLength={500} value={doctor.qualifications} onChange={(event) => setDoctor({ ...doctor, qualifications: event.target.value })} /></label>
          <label className="form-field">BMDC / registration number<input maxLength={80} value={doctor.registrationNumber ?? ""} onChange={(event) => setDoctor({ ...doctor, registrationNumber: event.target.value || null })} /></label>
          <label className="form-field">Consultation fee (BDT)<input type="number" inputMode="decimal" min="0" step="0.01" value={doctor.consultationFee} onChange={(event) => setDoctor({ ...doctor, consultationFee: event.target.value })} /></label>
          <label className="form-field">Phone<input type="tel" autoComplete="tel" maxLength={30} value={doctor.phone ?? ""} onChange={(event) => setDoctor({ ...doctor, phone: event.target.value || null })} /></label>
          <label className="form-field">Email<input type="email" value={doctor.email ?? ""} onChange={(event) => setDoctor({ ...doctor, email: event.target.value || null })} /></label>
          <label className="form-field">Address<input maxLength={1000} value={doctor.address ?? ""} onChange={(event) => setDoctor({ ...doctor, address: event.target.value || null })} /></label>
        </div>
        <label className="form-field">Professional bio<textarea maxLength={3000} value={doctor.bio ?? ""} onChange={(event) => setDoctor({ ...doctor, bio: event.target.value || null })} /></label>
        <h3 className="clinic-subheading">Weekly availability · Asia/Dhaka</h3>
        <div className="clinic-schedule">
          {doctor.schedules.map((schedule) => (
            <div className="clinic-schedule-row" key={schedule.dayOfWeek}>
              <label><input type="checkbox" checked={schedule.isWorking} onChange={(event) => setDoctor({ ...doctor, schedules: doctor.schedules.map((item) => item.dayOfWeek === schedule.dayOfWeek ? { ...item, isWorking: event.target.checked } : item) })} />{days[schedule.dayOfWeek]}</label>
              <input aria-label={`${days[schedule.dayOfWeek]} start time`} type="time" value={schedule.startTime} disabled={!schedule.isWorking} onChange={(event) => setDoctor({ ...doctor, schedules: doctor.schedules.map((item) => item.dayOfWeek === schedule.dayOfWeek ? { ...item, startTime: event.target.value } : item) })} />
              <span>to</span>
              <input aria-label={`${days[schedule.dayOfWeek]} end time`} type="time" value={schedule.endTime} disabled={!schedule.isWorking} onChange={(event) => setDoctor({ ...doctor, schedules: doctor.schedules.map((item) => item.dayOfWeek === schedule.dayOfWeek ? { ...item, endTime: event.target.value } : item) })} />
            </div>
          ))}
        </div>
        <button className="button-primary" disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save profile and schedule"}</button>
      </form>
    </section>
  ) : null;
}

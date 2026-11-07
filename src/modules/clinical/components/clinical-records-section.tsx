"use client";

import { useCallback, useState } from "react";
import { ClipboardList, Smile } from "lucide-react";
import PatientSelect from "@/components/shared/patient-select";
import { requestJson, type PatientChoice } from "@/modules/clinic/components/clinic-types";
import { useSectionLoader } from "@/modules/clinic/components/section-shared";
import DentalChart from "./dental-chart";
import VisitRecords from "./visit-records";

type Tab = "chart" | "visits";

// Per-patient clinical records: the dental chart and dated visit (examination) records.
export default function ClinicalRecordsSection({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [patients, setPatients] = useState<PatientChoice[]>([]);
  const [patientId, setPatientId] = useState("");
  const [tab, setTab] = useState<Tab>("chart");

  const load = useCallback(async () => {
    const result = await requestJson<{ patients: PatientChoice[] }>(await fetch("/api/patients?page=1&pageSize=100&status=ALL&fields=picker", { cache: "no-store" }));
    setPatients(result.patients);
  }, []);
  const { gate } = useSectionLoader({ section: "clinical", load, shouldPauseLive: () => true, softReload: true });
  if (gate) return gate;

  const selected = patients.find((patient) => patient.id === patientId);

  return (
    <div className="clinic-module-grid module-stack">
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Patient</h2><p className="panel-description">Choose a patient to view or update their dental chart and visit records.</p></div></header>
        <div className="clinical-patient-picker">
          <label className="form-field" htmlFor="clinical-patient">Patient</label>
          <PatientSelect id="clinical-patient" value={patientId} onChange={setPatientId} choices={patients} status="ALL" placeholder="Select patient" />
        </div>
      </section>

      {patientId ? (
        <section className="panel-card clinic-module-card">
          <header className="panel-header"><div><h2 className="panel-title">{selected ? `${selected.name} · ${selected.patientCode}` : "Clinical records"}</h2></div></header>
          <div className="record-tabs" role="tablist" aria-label="Clinical records">
            <button type="button" role="tab" id="tab-chart" aria-selected={tab === "chart"} aria-controls="panel-chart" className={tab === "chart" ? "is-active" : undefined} onClick={() => setTab("chart")}><Smile size={15} /> Dental chart</button>
            <button type="button" role="tab" id="tab-visits" aria-selected={tab === "visits"} aria-controls="panel-visits" className={tab === "visits" ? "is-active" : undefined} onClick={() => setTab("visits")}><ClipboardList size={15} /> Visit records</button>
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "chart" ? <DentalChart key={patientId} patientId={patientId} onNotice={onNotice} /> : <VisitRecords key={patientId} patientId={patientId} onNotice={onNotice} />}
          </div>
        </section>
      ) : (
        <section className="panel-card clinic-module-card"><div className="empty-state"><p>Select a patient above to see their dental chart and previous visits.</p></div></section>
      )}
    </div>
  );
}

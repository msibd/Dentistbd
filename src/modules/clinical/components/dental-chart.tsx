"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import { requestJson } from "@/modules/clinic/components/clinic-types";

export const toothConditions = {
  HEALTHY: { label: "Healthy", short: "H" },
  CARIES: { label: "Caries (decay)", short: "Ca" },
  FILLED: { label: "Filled", short: "F" },
  CROWN: { label: "Crown", short: "Cr" },
  ROOT_CANAL: { label: "Root canal", short: "RC" },
  IMPLANT: { label: "Implant", short: "Im" },
  FRACTURED: { label: "Fractured", short: "Fx" },
  MISSING: { label: "Missing", short: "M" },
  EXTRACTED: { label: "Extracted", short: "Ex" },
  OTHER: { label: "Other", short: "•" },
} as const;
type Condition = keyof typeof toothConditions;

type ChartEntry = { toothNumber: string; condition: Condition; notes: string | null; updatedAt: string; updatedBy: { id: string; name: string } | null };

// FDI two-digit notation: first digit = quadrant, second = tooth from the midline outwards.
// Permanent teeth: quadrants 1-4, teeth 1-8. Primary teeth: quadrants 5-8, teeth 1-5.
const arch = (quadrants: [number, number], teeth: number, reverseFirst = true) => {
  const first = Array.from({ length: teeth }, (_, index) => `${quadrants[0]}${index + 1}`);
  const second = Array.from({ length: teeth }, (_, index) => `${quadrants[1]}${index + 1}`);
  return { left: reverseFirst ? first.reverse() : first, right: second };
};
const permanentUpper = arch([1, 2], 8);
const permanentLower = arch([4, 3], 8);
const primaryUpper = arch([5, 6], 5);
const primaryLower = arch([8, 7], 5);

function ToothRow({ row, chart, selected, onSelect }: { row: { left: string[]; right: string[] }; chart: Map<string, ChartEntry>; selected: string; onSelect: (tooth: string) => void }) {
  const button = (tooth: string) => {
    const entry = chart.get(tooth);
    const condition = entry?.condition;
    return (
      <button
        key={tooth}
        type="button"
        className={`tooth${condition ? ` tooth-${condition.toLowerCase().replaceAll("_", "-")}` : " tooth-unrecorded"}${selected === tooth ? " is-selected" : ""}`}
        onClick={() => onSelect(tooth)}
        aria-pressed={selected === tooth}
        aria-label={`Tooth ${tooth}: ${condition ? toothConditions[condition].label : "no record"}`}
        title={`Tooth ${tooth}: ${condition ? toothConditions[condition].label : "no record"}`}
      >
        <span className="tooth-number">{tooth}</span>
        <span className="tooth-state" aria-hidden="true">{condition ? toothConditions[condition].short : ""}</span>
      </button>
    );
  };
  return <div className="tooth-row"><div className="tooth-quadrant">{row.left.map(button)}</div><div className="tooth-midline" aria-hidden="true" /><div className="tooth-quadrant">{row.right.map(button)}</div></div>;
}

export default function DentalChart({ patientId, onNotice }: { patientId: string; onNotice: (message: string, error: boolean) => void }) {
  const [loaded, setLoaded] = useState<{ patientId: string; entries: ChartEntry[]; error: string } | null>(null);
  const [selected, setSelected] = useState("");
  const [condition, setCondition] = useState<Condition>("HEALTHY");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPrimary, setShowPrimary] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await requestJson<{ chart: ChartEntry[] }>(await fetch(`/api/patients/${patientId}/dental-chart`, { cache: "no-store", signal: controller.signal }));
        if (!controller.signal.aborted) setLoaded({ patientId, entries: result.chart, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setLoaded({ patientId, entries: [], error: error instanceof Error ? error.message : "Unable to load the dental chart." });
      }
    })();
    return () => controller.abort();
  }, [patientId]);

  const current = loaded?.patientId === patientId ? loaded : null;
  const chart = useMemo(() => new Map((current?.entries ?? []).map((entry) => [entry.toothNumber, entry])), [current]);
  const counts = useMemo(() => {
    const result = new Map<Condition, number>();
    for (const entry of chart.values()) result.set(entry.condition, (result.get(entry.condition) ?? 0) + 1);
    return result;
  }, [chart]);

  function select(tooth: string) {
    const entry = chart.get(tooth);
    setSelected(tooth);
    setCondition(entry?.condition ?? "HEALTHY");
    setNotes(entry?.notes ?? "");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    try {
      const result = await requestJson<{ chart: ChartEntry[] }>(await fetch(`/api/patients/${patientId}/dental-chart`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [{ toothNumber: selected, condition, notes: notes.trim() || null }] }),
      }));
      setLoaded({ patientId, entries: result.chart, error: "" });
      onNotice(`Tooth ${selected} updated.`, false);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to save the tooth.", true);
    } finally {
      setSaving(false);
    }
  }

  if (!current) return <div className="loading-state" role="status">Loading dental chart…</div>;
  if (current.error) return <div className="form-error" role="alert">{current.error}</div>;
  const selectedEntry = selected ? chart.get(selected) : undefined;

  return (
    <div className="dental-chart-layout">
      <div>
        <div className="dental-chart" role="group" aria-label="Dental chart, FDI numbering. Patient's right is on the left of the chart.">
          <div className="arch-label">Upper jaw</div>
          <ToothRow row={permanentUpper} chart={chart} selected={selected} onSelect={select} />
          {showPrimary && <ToothRow row={primaryUpper} chart={chart} selected={selected} onSelect={select} />}
          {showPrimary && <ToothRow row={primaryLower} chart={chart} selected={selected} onSelect={select} />}
          <ToothRow row={permanentLower} chart={chart} selected={selected} onSelect={select} />
          <div className="arch-label">Lower jaw</div>
        </div>
        <label className="chart-toggle"><input type="checkbox" checked={showPrimary} onChange={(event) => setShowPrimary(event.target.checked)} /> Show primary (baby) teeth</label>
        <ul className="chart-legend" aria-label="Legend">
          {(Object.keys(toothConditions) as Condition[]).map((key) => (
            <li key={key}><span className={`legend-swatch tooth-${key.toLowerCase().replaceAll("_", "-")}`} aria-hidden="true">{toothConditions[key].short}</span>{toothConditions[key].label}<small>{counts.get(key) ?? 0}</small></li>
          ))}
          <li><span className="legend-swatch tooth-unrecorded" aria-hidden="true" />No record</li>
        </ul>
      </div>

      <form className="tooth-editor" onSubmit={save}>
        {selected ? (
          <>
            <h3>Tooth {selected}</h3>
            <p className="panel-description">{selectedEntry ? `${toothConditions[selectedEntry.condition].label} · updated ${formatClinicDate(selectedEntry.updatedAt)}${selectedEntry.updatedBy ? ` by ${selectedEntry.updatedBy.name}` : ""}` : "No record yet for this tooth."}</p>
            <label className="form-field">Condition<select value={condition} onChange={(event) => setCondition(event.target.value as Condition)}>{(Object.keys(toothConditions) as Condition[]).map((key) => <option key={key} value={key}>{toothConditions[key].label}</option>)}</select></label>
            <label className="form-field">Notes<textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Surfaces involved, material, findings…" /></label>
            <button className="button-primary" disabled={saving}><Save size={14} />{saving ? "Saving…" : `Save tooth ${selected}`}</button>
          </>
        ) : (
          <p className="panel-description">Select a tooth on the chart to record or change its condition.</p>
        )}
      </form>
    </div>
  );
}

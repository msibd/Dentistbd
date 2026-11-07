"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { bdtCurrency as currency } from "@/lib/format";
import { emptyService, requestJson, serviceFormToPayload, serviceToForm, type ServiceRecord } from "./clinic-types";
import { useSectionLoader, type SectionProps } from "./section-shared";

export default function ServicesSection({ onNotice, onBookService }: SectionProps & { onBookService?: (service: string) => void }) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await requestJson<{ services: ServiceRecord[] }>(await fetch("/api/services?includeInactive=true", { cache: "no-store" }));
    setServices(result.services);
  }, []);

  const { gate, reload } = useSectionLoader({ section: "services", load, shouldPauseLive: () => saving });

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const highest = serviceForm.feeMax.trim();
    if (highest !== "" && Number(highest) < Number(serviceForm.standardPrice)) {
      onNotice("The highest fee must be at least the standard price.", true);
      return;
    }
    setSaving(true);
    try {
      await requestJson(await fetch(editingService ? `/api/services/${editingService.id}` : "/api/services", {
        method: editingService ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceFormToPayload(serviceForm, editingService?.isActive ?? true)),
      }));
      setEditingService(null);
      setServiceForm(emptyService);
      reload();
      onNotice("Service saved.", false);
    } catch (saveError) {
      onNotice(saveError instanceof Error ? saveError.message : "Unable to save service.", true);
    } finally { setSaving(false); }
  }

  if (gate) return gate;

  return (
    <div className="clinic-module-grid">
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">{editingService ? "Edit service" : "Add clinic service"}</h2><p className="panel-description">Service pricing and duration are used for appointments and invoices.</p></div></header>
        <form className="modal-form clinic-module-form" onSubmit={submitService}>
          <div className="form-grid">
            <label className="form-field">Service code<input required maxLength={30} value={serviceForm.code} onChange={(event) => setServiceForm({ ...serviceForm, code: event.target.value })} /></label>
            <label className="form-field">Name<input required maxLength={120} value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} /></label>
            <label className="form-field">Name (বাংলা)<input maxLength={120} lang="bn" placeholder="ঐচ্ছিক, বাংলা সাইটে দেখায়" value={serviceForm.nameBn} onChange={(event) => setServiceForm({ ...serviceForm, nameBn: event.target.value })} /></label>
            <label className="form-field">Category<input required maxLength={80} value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} /></label>
            <label className="form-field">Price (BDT)<input required type="number" inputMode="decimal" min="0" step="0.01" value={serviceForm.standardPrice} onChange={(event) => setServiceForm({ ...serviceForm, standardPrice: event.target.value })} /></label>
            <label className="form-field">Duration (minutes)<input required type="number" inputMode="numeric" min="5" max="600" value={serviceForm.durationMinutes} onChange={(event) => setServiceForm({ ...serviceForm, durationMinutes: event.target.value })} /></label>
          </div>
          <label className="form-field">Description<textarea maxLength={1000} value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></label>
          <label className="form-field">Description (বাংলা)<textarea maxLength={1000} lang="bn" placeholder="ঐচ্ছিক, বাংলা সাইটে দেখায়" value={serviceForm.descriptionBn} onChange={(event) => setServiceForm({ ...serviceForm, descriptionBn: event.target.value })} /></label>
          <details className="service-public-details">
            <summary>Public website details <small>optional · shown on the website service card and details window</small></summary>
            <div className="form-grid">
              <label className="form-field">Icon
                <select value={serviceForm.iconKey} onChange={(event) => setServiceForm({ ...serviceForm, iconKey: event.target.value })}>
                  <option value="">Automatic (from category)</option>
                  <option value="general">General care</option>
                  <option value="smile">Smile</option>
                  <option value="cosmetic">Cosmetic</option>
                  <option value="endodontics">Root canal</option>
                  <option value="surgery">Surgery and implant</option>
                  <option value="preventive">Preventive</option>
                  <option value="xray">X-ray and diagnostics</option>
                </select>
              </label>
              <label className="form-field">Category (বাংলা)<input maxLength={80} lang="bn" value={serviceForm.categoryBn} onChange={(event) => setServiceForm({ ...serviceForm, categoryBn: event.target.value })} /></label>
              <label className="form-field">Badge · English<input maxLength={80} placeholder="e.g. Same-day treatment" value={serviceForm.badgeEn} onChange={(event) => setServiceForm({ ...serviceForm, badgeEn: event.target.value })} /></label>
              <label className="form-field">Badge · বাংলা<input maxLength={80} lang="bn" value={serviceForm.badgeBn} onChange={(event) => setServiceForm({ ...serviceForm, badgeBn: event.target.value })} /></label>
              <label className="form-field">Time · English<input maxLength={80} placeholder="e.g. 45–60 minutes, or 2 sessions" value={serviceForm.timeTextEn} onChange={(event) => setServiceForm({ ...serviceForm, timeTextEn: event.target.value })} /></label>
              <label className="form-field">Time · বাংলা<input maxLength={80} lang="bn" value={serviceForm.timeTextBn} onChange={(event) => setServiceForm({ ...serviceForm, timeTextBn: event.target.value })} /></label>
              <label className="form-field">Comfort level · English<input maxLength={80} placeholder="e.g. Local anaesthesia" value={serviceForm.painTextEn} onChange={(event) => setServiceForm({ ...serviceForm, painTextEn: event.target.value })} /></label>
              <label className="form-field">Comfort level · বাংলা<input maxLength={80} lang="bn" value={serviceForm.painTextBn} onChange={(event) => setServiceForm({ ...serviceForm, painTextBn: event.target.value })} /></label>
              <label className="form-field">Highest fee (BDT)<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Leave empty to show one price" value={serviceForm.feeMax} onChange={(event) => setServiceForm({ ...serviceForm, feeMax: event.target.value })} /></label>
            </div>
            <div className="form-grid">
              <label className="form-field">Details · English<textarea rows={4} maxLength={3000} value={serviceForm.detailsEn} onChange={(event) => setServiceForm({ ...serviceForm, detailsEn: event.target.value })} /></label>
              <label className="form-field">Details · বাংলা<textarea rows={4} maxLength={3000} lang="bn" value={serviceForm.detailsBn} onChange={(event) => setServiceForm({ ...serviceForm, detailsBn: event.target.value })} /></label>
              <label className="form-field">Treatment steps · English <small>one per line, up to 12</small><textarea rows={5} value={serviceForm.stepsEn} onChange={(event) => setServiceForm({ ...serviceForm, stepsEn: event.target.value })} /></label>
              <label className="form-field">Treatment steps · বাংলা <small>প্রতি লাইনে একটি</small><textarea rows={5} lang="bn" value={serviceForm.stepsBn} onChange={(event) => setServiceForm({ ...serviceForm, stepsBn: event.target.value })} /></label>
            </div>
          </details>
          <div className="modal-actions">
            {editingService && <button className="button-secondary" type="button" onClick={() => { setEditingService(null); setServiceForm(emptyService); }}>Cancel edit</button>}
            <button className="button-primary" disabled={saving}><Plus size={14} />{saving ? "Saving…" : editingService ? "Save service" : "Add service"}</button>
          </div>
        </form>
      </section>
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Service catalog</h2><p className="panel-description">{services.length} configured services</p></div></header>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Service</th><th>Price</th><th>Duration</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {services.map((service) => <tr key={service.id}><td><strong>{service.name}</strong><div className="cell-secondary">{service.code} · {service.category}</div></td><td>{currency.format(Number(service.standardPrice))}</td><td>{service.durationMinutes} min</td><td>{service.isActive ? "Active" : "Inactive"}</td><td>{service.isActive && onBookService && <button className="request-action" onClick={() => onBookService(service.name)}>Book</button>}<button className="request-action" onClick={() => { setEditingService(service); setServiceForm(serviceToForm(service)); }}>Edit</button><button className="request-action" onClick={async () => { try { await requestJson(await fetch(`/api/services/${service.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...service, standardPrice: Number(service.standardPrice), isActive: !service.isActive }) })); reload(); } catch (toggleError) { onNotice(toggleError instanceof Error ? toggleError.message : "Unable to change service status.", true); } }}>{service.isActive ? "Disable" : "Enable"}</button></td></tr>)}
          {!services.length && <tr><td colSpan={5}>No services yet. Add the clinic’s verified service prices above.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}

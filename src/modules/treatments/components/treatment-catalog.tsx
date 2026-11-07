"use client";

import { ArrowRight, BriefcaseMedical } from "lucide-react";
import Button from "@/components/ui/button";
import type { TreatmentCatalogItem } from "@/modules/treatments/schemas/treatment-schema";

export default function TreatmentCatalog({
  onBook,
  treatments,
}: {
  onBook: (service: string) => void;
  treatments: TreatmentCatalogItem[];
}) {
  return (
    <div className="service-grid">
      {treatments.map((treatment) => (
        <article className="panel-card service-card" key={treatment.name}>
          <div className="stat-icon"><BriefcaseMedical size={16} /></div>
          <h2 className="panel-title" style={{ marginTop: 15 }}>{treatment.name}</h2>
          <div className="panel-description" style={{ minHeight: 30 }}>{treatment.detail}</div>
          <div className="service-card-footer">
            <span>{treatment.fee}</span>
            <Button variant="secondary" style={{ minHeight: 30, padding: "0 9px" }} onClick={() => onBook(treatment.name)}>
              Book <ArrowRight size={12} />
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

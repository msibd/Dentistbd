"use client";

import type { DashboardSection } from "@/modules/dashboard/components/admin-dashboard";
import BillingSection from "./billing-section";
import DoctorSection from "./doctor-section";
import PrescriptionsSection from "./prescriptions-section";
import ReportsSection from "./reports-section";
import SecuritySection from "./security-section";
import ServicesSection from "./services-section";
import type { ClinicSection } from "./section-shared";

// Dispatches to the section component for the current dashboard route; each section owns its
// own data loading, forms and live updates (see section-shared.tsx).
export default function ClinicOperations({
  section,
  onNotice,
  onBookService,
}: {
  section: Extract<DashboardSection, ClinicSection>;
  onNotice: (message: string, error: boolean) => void;
  onBookService?: (service: string) => void;
}) {
  switch (section) {
    case "doctors": return <DoctorSection onNotice={onNotice} />;
    case "services": return <ServicesSection onNotice={onNotice} onBookService={onBookService} />;
    case "prescriptions": return <PrescriptionsSection onNotice={onNotice} />;
    case "billing": return <BillingSection onNotice={onNotice} />;
    case "reports": return <ReportsSection />;
    case "security": return <SecuritySection onNotice={onNotice} />;
  }
}

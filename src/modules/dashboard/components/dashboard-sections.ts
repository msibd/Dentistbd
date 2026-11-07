// Static facts about each dashboard section: its address and its page heading. Kept apart from
// the dashboard component so adding a section is a data change, not an edit to an 800-line file.

export type DashboardSection =
  | "overview"
  | "appointments"
  | "patients"
  | "doctors"
  | "treatments"
  | "prescriptions"
  | "billing"
  | "reports"
  | "services"
  | "reviews"
  | "gallery"
  | "website"
  | "security"
  | "expenses"
  | "inventory"
  | "access"
  | "email"
  | "sms"
  | "clinical";

export const sectionPaths: Record<DashboardSection, string> = {
  overview: "/dashboard",
  appointments: "/appointments",
  patients: "/patients",
  doctors: "/doctors",
  treatments: "/treatments",
  prescriptions: "/prescriptions",
  billing: "/billing",
  reports: "/reports",
  services: "/services",
  reviews: "/reviews",
  gallery: "/gallery",
  website: "/website",
  security: "/security",
  expenses: "/expenses",
  inventory: "/inventory",
  access: "/access",
  email: "/email-settings",
  sms: "/sms-settings",
  clinical: "/dental-chart",
};

export const pageTitles: Record<DashboardSection, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description: "Here’s what’s happening at your clinic today.",
  },
  appointments: {
    title: "Appointments",
    description: "Review requests and keep the clinic schedule up to date.",
  },
  patients: {
    title: "Patients",
    description: "Register patients and manage their clinic profiles.",
  },
  doctors: {
    title: "Doctors",
    description: "Manage practitioner profiles and clinic availability.",
  },
  treatments: {
    title: "Treatments",
    description: "Organize treatment records and clinical procedures.",
  },
  prescriptions: {
    title: "Prescriptions",
    description: "Manage prescriptions connected to patient visits.",
  },
  billing: {
    title: "Billing",
    description: "Review invoices, payments, and outstanding balances.",
  },
  reports: {
    title: "Reports",
    description: "Review clinic activity and operational summaries.",
  },
  services: {
    title: "Clinic services",
    description: "Treatments listed on Dr Ovi’s Dental Care website.",
  },
  reviews: {
    title: "Patient reviews",
    description: "Review and publish feedback submitted from your clinic website.",
  },
  website: {
    title: "Website content",
    description: "Edit the text and photos shown on your public website, in English and Bangla.",
  },
  gallery: {
    title: "Clinic gallery",
    description: "Manage website gallery images using public image URLs.",
  },
  security: {
    title: "Security",
    description: "Update your administrator password.",
  },
  expenses: {
    title: "Finance & expenses",
    description: "Record clinic costs, see each day's income and expenses, and close the cash drawer.",
  },
  sms: {
    title: "SMS Settings",
    description: "Connect the BulkSMSBD account so patients get an SMS when an appointment is booked.",
  },
  email: {
    title: "Email & SMTP Settings",
    description: "Connect the clinic's mail account so the system can send password recovery codes.",
  },
  access: {
    title: "Users & roles",
    description: "Add staff, choose what each role can see and do, and deactivate accounts.",
  },
  inventory: {
    title: "Inventory",
    description: "Medicines and dental supplies: stock, purchases, suppliers, low-stock and expiry alerts.",
  },
  clinical: {
    title: "Dental chart & visits",
    description: "Each patient's tooth-by-tooth chart and dated visit records.",
  },
};

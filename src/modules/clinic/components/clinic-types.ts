export type ServiceRecord = {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  category: string;
  description: string | null;
  descriptionBn: string | null;
  categoryBn: string | null;
  iconKey: string | null;
  badgeEn: string | null;
  badgeBn: string | null;
  timeTextEn: string | null;
  timeTextBn: string | null;
  painTextEn: string | null;
  painTextBn: string | null;
  feeMax: string | null;
  detailsEn: string;
  detailsBn: string;
  stepsEn: string[];
  stepsBn: string[];
  standardPrice: string;
  durationMinutes: number;
  isActive: boolean;
};

export type PatientChoice = { id: string; patientCode: string; name: string; phone: string };
export type PatientClinicalContext = PatientChoice & {
  allergies: string | null;
  medicalHistory: string | null;
  dentalHistory: string | null;
  appointmentCount: number;
  latestAppointment: { dateTime: string; service: string } | null;
};
export type Medication = { name: string; dosage: string; frequency: string; duration: string; instructions: string };
export type PrescriptionRecord = {
  id: string;
  diagnosis: string;
  instructions: string | null;
  followUpDate: string | null;
  createdAt: string;
  patient: PatientChoice;
  prescribedBy: { name: string } | null;
  medications: Medication[];
};
export type InvoiceRecord = {
  id: string;
  invoiceCode: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  issuedAt: string;
  patient: PatientChoice;
  items: { id: string; description: string; quantity: number; unitPrice: string; amount: string }[];
  payments: { id: string; amount: string; method: string; status: string; receivedAt: string }[];
};
export type ReportRecord = {
  patientRegistrations: number;
  appointments: { total: number; byStatus: Record<string, number> };
  treatments: { status: string; count: number }[];
  revenue: string;
  outstanding: string;
  paymentTransactions: number;
  dailyAppointments: { date: string; count: number }[];
  dailyRevenue: { date: string; amount: string }[];
  revenueByMethod: { method: string; amount: string; count: number }[];
  expenses: { total: string; byCategory: { category: string; amount: string }[] };
  netIncome: string;
  noShows: { count: number; ratePercent: number; patients: { name: string; phone: string; count: number }[] };
};
export type DoctorRecord = {
  name: string;
  qualifications: string;
  specialization: string;
  registrationNumber: string | null;
  consultationFee: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bio: string | null;
  schedules: { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean }[];
};

export const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const emptyService = {
  code: "",
  name: "",
  nameBn: "",
  category: "General",
  description: "",
  descriptionBn: "",
  categoryBn: "",
  iconKey: "",
  badgeEn: "",
  badgeBn: "",
  timeTextEn: "",
  timeTextBn: "",
  painTextEn: "",
  painTextBn: "",
  feeMax: "",
  detailsEn: "",
  detailsBn: "",
  stepsEn: "",
  stepsBn: "",
  standardPrice: "0",
  durationMinutes: "30",
};
const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const blankToNull = (value: string) => value.trim() || null;

export type ServiceForm = typeof emptyService;

/** Turns the edit form (all text) into the API body: blanks become null, step lists become arrays. */
export function serviceFormToPayload(form: ServiceForm, isActive: boolean) {
  return {
    code: form.code,
    name: form.name,
    category: form.category,
    description: blankToNull(form.description),
    standardPrice: Number(form.standardPrice),
    durationMinutes: Number(form.durationMinutes),
    nameBn: blankToNull(form.nameBn),
    descriptionBn: blankToNull(form.descriptionBn),
    categoryBn: blankToNull(form.categoryBn),
    iconKey: blankToNull(form.iconKey),
    badgeEn: blankToNull(form.badgeEn),
    badgeBn: blankToNull(form.badgeBn),
    timeTextEn: blankToNull(form.timeTextEn),
    timeTextBn: blankToNull(form.timeTextBn),
    painTextEn: blankToNull(form.painTextEn),
    painTextBn: blankToNull(form.painTextBn),
    feeMax: form.feeMax.trim() === "" ? null : Number(form.feeMax),
    detailsEn: form.detailsEn.trim(),
    detailsBn: form.detailsBn.trim(),
    stepsEn: splitLines(form.stepsEn),
    stepsBn: splitLines(form.stepsBn),
    isActive,
  };
}

export function serviceToForm(service: ServiceRecord): ServiceForm {
  return {
    code: service.code,
    name: service.name,
    nameBn: service.nameBn ?? "",
    category: service.category,
    categoryBn: service.categoryBn ?? "",
    description: service.description ?? "",
    descriptionBn: service.descriptionBn ?? "",
    iconKey: service.iconKey ?? "",
    badgeEn: service.badgeEn ?? "",
    badgeBn: service.badgeBn ?? "",
    timeTextEn: service.timeTextEn ?? "",
    timeTextBn: service.timeTextBn ?? "",
    painTextEn: service.painTextEn ?? "",
    painTextBn: service.painTextBn ?? "",
    feeMax: service.feeMax ?? "",
    detailsEn: service.detailsEn,
    detailsBn: service.detailsBn,
    stepsEn: service.stepsEn.join("\n"),
    stepsBn: service.stepsBn.join("\n"),
    standardPrice: service.standardPrice,
    durationMinutes: String(service.durationMinutes),
  };
}

export const emptyMedication: Medication = { name: "", dosage: "", frequency: "", duration: "", instructions: "" };

export async function requestJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: { error?: string } & Record<string, unknown>;
  try {
    result = text ? JSON.parse(text) as { error?: string } & Record<string, unknown> : {};
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(result.error ?? `Request failed (HTTP ${response.status}).`);
  return result as T;
}

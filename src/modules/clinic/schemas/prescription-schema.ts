import { z } from "zod";

// One definition of a prescription for both the API and the form, so they always agree.

const required = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this to ${max} characters or fewer.`);

const medication = {
  name: required(120, "Enter the medicine name."),
  dosage: required(120, "Enter the dosage."),
  frequency: required(120, "Enter how often."),
  duration: required(120, "Enter for how long."),
};

const MAX_MEDICATIONS = 30;

/** What the API accepts (blank optional text arrives as null). */
export const prescriptionInputSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  diagnosis: required(500, "Enter the diagnosis."),
  instructions: z.string().trim().max(3000).nullable(),
  followUpDate: z.union([z.iso.date(), z.literal(""), z.null()]).transform((value) => value || null),
  medications: z.array(z.object({ ...medication, instructions: z.string().trim().max(500).nullable() }))
    .min(1, "Add at least one medication.").max(MAX_MEDICATIONS),
});

/** The browser form, where every field is text. */
export const prescriptionFormSchema = z.object({
  patientId: z.string().min(1, "Select a patient."),
  diagnosis: required(500, "Enter the diagnosis."),
  instructions: z.string().trim().max(3000, "Keep this to 3000 characters or fewer."),
  followUpDate: z.union([z.iso.date({ error: "Choose a valid date." }), z.literal("")]),
  medications: z.array(z.object({ ...medication, instructions: z.string().trim().max(500, "Keep this to 500 characters or fewer.") }))
    .min(1, "Add at least one medication.").max(MAX_MEDICATIONS, `Up to ${MAX_MEDICATIONS} medications.`),
});
export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;

export const emptyPrescriptionForm = (): PrescriptionFormValues => ({
  patientId: "",
  diagnosis: "",
  instructions: "",
  followUpDate: "",
  medications: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }],
});

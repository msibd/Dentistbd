import { z } from "zod";
import { ToothCondition } from "@/generated/prisma/client";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((value) => value || null);

const isoDate = z.iso.date();

export const examinationInputSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).nullable().optional().transform((value) => value ?? null),
  examinedAt: z.iso.datetime({ offset: true }).optional(),
  chiefComplaint: z.string().trim().min(2, "Describe the patient's complaint.").max(2000),
  findings: optionalText(4000),
  diagnosis: z.string().trim().min(2, "A diagnosis is required.").max(500),
  notes: optionalText(4000),
  followUpDate: isoDate.nullable().optional().transform((value) => value ?? null),
});
export type ExaminationInput = z.infer<typeof examinationInputSchema>;

// The patient and appointment link cannot be changed after the record is created.
export const examinationUpdateSchema = examinationInputSchema.omit({ patientId: true, appointmentId: true });
export type ExaminationUpdate = z.infer<typeof examinationUpdateSchema>;

// FDI two-digit notation: permanent teeth 11-48, primary teeth 51-85.
const toothNumber = z.string().regex(/^([1-4][1-8]|[5-8][1-5])$/, "Tooth numbers use FDI notation, for example 16 or 75.");

export const dentalChartUpdateSchema = z.object({
  entries: z.array(z.object({
    toothNumber,
    condition: z.nativeEnum(ToothCondition),
    notes: optionalText(1000),
  })).min(1, "Provide at least one tooth.").max(52)
    .refine((entries) => new Set(entries.map((entry) => entry.toothNumber)).size === entries.length, "Each tooth can appear only once."),
});
export type DentalChartUpdate = z.infer<typeof dentalChartUpdateSchema>;

import { z } from "zod";
import { TreatmentPlanStatus } from "@/generated/prisma/client";

const fdiToothSchema = z.string().regex(
  /^(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])$/,
  "Enter a valid FDI tooth number.",
);

const optionalNotesSchema = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.string().trim().max(5000).nullable(),
);

export const treatmentPlanInputSchema = z.object({
  patientId: z.string().trim().min(1).max(100),
  diagnosis: z.string().trim().min(1).max(500),
  procedureName: z.string().trim().min(1).max(200),
  toothNumbers: z.array(fdiToothSchema).max(32).default([]),
  estimatedCost: z.coerce.number().finite().min(0).max(9999999999),
  status: z.nativeEnum(TreatmentPlanStatus).default("PLANNED"),
  notes: optionalNotesSchema,
}).superRefine((value, context) => {
  if (new Set(value.toothNumbers).size !== value.toothNumbers.length) {
    context.addIssue({
      code: "custom",
      path: ["toothNumbers"],
      message: "Each tooth may only be selected once.",
    });
  }
});

export const treatmentSessionInputSchema = z.object({
  notes: z.string().trim().min(1).max(5000),
  performedAt: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.iso.datetime({ offset: true }).optional(),
  ),
});

export const treatmentPlanStatusSchema = z.nativeEnum(TreatmentPlanStatus);

export const treatmentListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.union([treatmentPlanStatusSchema, z.literal("ALL")]).default("ALL"),
});

export type TreatmentPlanInput = z.infer<typeof treatmentPlanInputSchema>;

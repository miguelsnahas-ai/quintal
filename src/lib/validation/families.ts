import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

export const familyInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da família."),
  notes: optionalText,
});

export type FamilyInput = z.infer<typeof familyInputSchema>;

export const caregiverInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cuidador."),
  role: optionalText,
  // Number as sent/received via WhatsApp (E.164), e.g. +5511999999999.
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Use o formato internacional, ex: +5511999999999."),
  is_primary_contact: z.boolean(),
});

export type CaregiverInput = z.infer<typeof caregiverInputSchema>;

export const childInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da criança."),
  birth_date: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.iso.date().optional(),
  ),
  sex: optionalText,
  notes: optionalText,
});

export type ChildInput = z.infer<typeof childInputSchema>;

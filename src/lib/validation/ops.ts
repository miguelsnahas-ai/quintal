import { z } from "zod";
import { leadStatuses } from "@/lib/ops/leads";
import { libraryStatuses } from "@/lib/ops/library";

// "Converter em Família" pedido explicitamente nesta fase — nunca cria
// texto livre, só o status/observações que a equipe já vê na tela.
export const leadStatusInputSchema = z.object({
  lead_id: z.uuid("Interessado inválido."),
  status: z.enum(leadStatuses),
  notes: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    }),
});

export type LeadStatusInput = z.infer<typeof leadStatusInputSchema>;

function csvToArray(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function emptyToNullNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

// Biblioteca (/ops/library) — um título, uma categoria (já existente no
// banco, nunca inventada — ver getLibraryCategories), o conteúdo em
// texto "Rótulo: valor" por linha (mesmo formato da planilha original) e
// o mínimo de metadados que o produto já usa para filtrar por idade.
export const libraryItemInputSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  category: z.string().trim().min(1, "Selecione a categoria."),
  content: z.string().trim().min(1, "Informe o conteúdo."),
  tags: z.string().optional().transform(csvToArray),
  age_min_months: z.string().optional().transform(emptyToNullNumber),
  age_max_months: z.string().optional().transform(emptyToNullNumber),
  image_url: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.url().safeParse(value).success, {
      message: "Informe uma URL válida para a imagem.",
    }),
  status: z.enum(libraryStatuses),
});

export type LibraryItemInput = z.infer<typeof libraryItemInputSchema>;

import { libraryStatuses, libraryStatusLabels, type LibraryStatus } from "@/lib/ops/library";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";

// Campos compartilhados entre criar e editar (refatoração do /ops) — só
// os campos que a fase pede: título, categoria (as já existentes no
// banco, nunca uma lista inventada), conteúdo em texto "Rótulo: valor"
// por linha (mesmo formato da planilha original — parseContentFields em
// src/lib/activity.ts), tags, faixa etária e status. Sem workflow de
// aprovação, sem versionamento — pedido explícito de não virar um CMS.
export default function LibraryItemFields({
  categories,
  defaults,
}: {
  categories: string[];
  defaults?: {
    title: string;
    category: string;
    content: string;
    tags: string[];
    ageMinMonths: number | null;
    ageMaxMonths: number | null;
    imageUrl: string | null;
    status: LibraryStatus;
  };
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaults?.title ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="category">Categoria</Label>
          <Select id="category" name="category" required defaultValue={defaults?.category ?? ""}>
            <option value="" disabled>
              Selecione...
            </option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" required defaultValue={defaults?.status ?? "draft"}>
            {libraryStatuses.map((value) => (
              <option key={value} value={value}>
                {libraryStatusLabels[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="content">
          Conteúdo <span className="font-normal text-ink-muted">(um &quot;Rótulo: valor&quot; por linha)</span>
        </Label>
        <Textarea
          id="content"
          name="content"
          required
          rows={10}
          defaultValue={defaults?.content ?? ""}
          placeholder={"Como funciona: ...\nPara quem costuma funcionar: ...\nObservação: ..."}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tags">
            Tags <span className="font-normal text-ink-muted">(separadas por vírgula)</span>
          </Label>
          <Input id="tags" name="tags" defaultValue={defaults?.tags.join(", ") ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="image_url">Imagem (URL, opcional)</Label>
          <Input id="image_url" name="image_url" type="url" defaultValue={defaults?.imageUrl ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="age_min_months">Idade mín. (meses)</Label>
          <Input
            id="age_min_months"
            name="age_min_months"
            type="number"
            min={0}
            defaultValue={defaults?.ageMinMonths ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="age_max_months">Idade máx. (meses)</Label>
          <Input
            id="age_max_months"
            name="age_max_months"
            type="number"
            min={0}
            defaultValue={defaults?.ageMaxMonths ?? ""}
          />
        </div>
      </div>
    </>
  );
}

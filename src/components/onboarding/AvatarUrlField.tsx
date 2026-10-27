import { Input, Label } from "@/components/ui/Field";

// Campo "Foto (opcional)" — colar uma URL, com prévia em círculo. Mesmo
// padrão já usado em Configurações (ex.: criancas/[id]) para toda foto
// do produto: não há infraestrutura de upload, só URL colada (ver
// updateChildProfile em familyContext.ts). O mockup de referência mostra
// um seletor de "tocar para enviar foto" — aqui vira este campo, a forma
// real que o produto já tem de guardar uma foto.
export function AvatarUrlField({
  name,
  label = "Foto (opcional)",
  defaultValue,
  fallbackInitial,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
  fallbackInitial: string;
}) {
  return (
    <div className="flex items-center gap-4">
      {defaultValue ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
        <img src={defaultValue} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
          {fallbackInitial || "?"}
        </span>
      )}
      <div className="flex-1 space-y-1">
        <Label htmlFor={name}>{label}</Label>
        <Input id={name} name={name} type="url" placeholder="https://..." defaultValue={defaultValue ?? ""} />
      </div>
    </div>
  );
}

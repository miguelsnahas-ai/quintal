"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/Field";
import { AvatarAiGenerator } from "@/components/avatar/AvatarAiGenerator";
import type { AvatarAttributes } from "@/lib/validation/avatar";

// Mesmo visual de AvatarUrlField (preview + colar URL) — mas específico
// de criança: aqui, abaixo do campo manual, entra o gerador de avatar
// por IA (AvatarAiGenerator), que preenche este mesmo input ao gerar
// (childId null -> onboarding, só preenche o campo; childId presente ->
// Configurações, a ação já persiste direto, o preview local só evita
// esperar o reload). AvatarUrlField continua sendo usado por
// família/cuidador, que não têm esse gerador.
export function ChildAvatarField({
  name = "avatar_url",
  label = "Foto (opcional)",
  defaultValue,
  fallbackInitial,
  childId,
  aiEnabled,
  initialAiAttributes,
}: {
  name?: string;
  label?: string;
  defaultValue?: string | null;
  fallbackInitial: string;
  childId: string | null;
  aiEnabled: boolean;
  initialAiAttributes?: AvatarAttributes | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externa (colada ou gerada por IA), não um asset do projeto.
          <img src={value} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
            {fallbackInitial || "?"}
          </span>
        )}
        <div className="flex-1 space-y-1">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            name={name}
            type="url"
            placeholder="https://..."
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      </div>
      <AvatarAiGenerator
        childId={childId}
        enabled={aiEnabled}
        initialAttributes={initialAiAttributes}
        onGenerated={(url) => setValue(url)}
      />
    </div>
  );
}

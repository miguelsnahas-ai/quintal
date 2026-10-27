"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { chipClassName } from "@/components/ui/Chip";
import {
  avatarSkinTones,
  avatarSkinToneLabels,
  avatarHairColors,
  avatarHairColorLabels,
  avatarHairStyles,
  avatarHairStyleLabels,
  avatarEyeColors,
  avatarEyeColorLabels,
  avatarVibes,
  avatarVibeLabels,
  DEFAULT_AVATAR_ATTRIBUTES,
  type AvatarAttributes,
} from "@/lib/validation/avatar";
import { generateChildAvatarAction } from "@/app/quintal/configuracoes/criancas/actions";

// Seletor de atributos (chips, sem necessidade de JS de formulário —
// este componente já é "use client" por inteiro) + botão que chama
// generateChildAvatarAction direto (useTransition, mesmo padrão de
// LogActivityOutcome.tsx), nunca via <form action>: o resultado precisa
// voltar para o componente pai preencher o campo avatar_url (onboarding)
// ou atualizar o preview (Configurações), não redirecionar a página.
function AttributeGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={chipClassName(value === option, "px-2.5 py-1 text-xs")}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarAiGenerator({
  childId,
  enabled,
  initialAttributes,
  onGenerated,
}: {
  // null durante o onboarding (a criança ainda não existe) — ver
  // generateChildAvatarAction.
  childId: string | null;
  enabled: boolean;
  initialAttributes?: AvatarAttributes | null;
  onGenerated: (url: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attributes, setAttributes] = useState<AvatarAttributes>(initialAttributes ?? DEFAULT_AVATAR_ATTRIBUTES);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof AvatarAttributes>(key: K, value: AvatarAttributes[K]) {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await generateChildAvatarAction({ childId, attributes });
        onGenerated(url);
        // Com childId (Configurações), a ação já persistiu direto em
        // children.avatar_url — refresh traz o resto da página (ex.: o
        // defaultValue do campo manual) para o mesmo estado.
        if (childId) router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível gerar o avatar. Tente de novo.");
      }
    });
  }

  if (!enabled) {
    return (
      <p className="text-xs text-ink-muted">Geração de avatar por IA ainda não está disponível nesta instalação.</p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {open ? "Fechar gerador de avatar com IA" : "Gerar avatar com IA"}
      </button>

      {open && (
        <div className="space-y-3 rounded-lg border-[1.5px] border-neutral p-3">
          <AttributeGroup
            label="Tom de pele"
            options={avatarSkinTones}
            labels={avatarSkinToneLabels}
            value={attributes.skinTone}
            onChange={(v) => set("skinTone", v)}
            disabled={isPending}
          />
          <AttributeGroup
            label="Cor do cabelo"
            options={avatarHairColors}
            labels={avatarHairColorLabels}
            value={attributes.hairColor}
            onChange={(v) => set("hairColor", v)}
            disabled={isPending}
          />
          <AttributeGroup
            label="Tipo de cabelo"
            options={avatarHairStyles}
            labels={avatarHairStyleLabels}
            value={attributes.hairStyle}
            onChange={(v) => set("hairStyle", v)}
            disabled={isPending}
          />
          <AttributeGroup
            label="Cor dos olhos"
            options={avatarEyeColors}
            labels={avatarEyeColorLabels}
            value={attributes.eyeColor}
            onChange={(v) => set("eyeColor", v)}
            disabled={isPending}
          />
          <AttributeGroup
            label="Expressão"
            options={avatarVibes}
            labels={avatarVibeLabels}
            value={attributes.vibe}
            onChange={(v) => set("vibe", v)}
            disabled={isPending}
          />

          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handleGenerate}
            className="w-full justify-center text-xs"
          >
            {isPending ? "Gerando…" : "Gerar ilustração"}
          </Button>
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-ink-muted">
            Gera uma ilustração a partir dos atributos escolhidos (não é uma foto real) — até 5 gerações por dia.
          </p>
        </div>
      )}
    </div>
  );
}

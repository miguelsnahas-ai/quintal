import { MapPin, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineIcon } from "@/lib/timeline";
import { QuintalIcon, type QuintalIconSize } from "@/components/icon/QuintalIcon";
import type { QuintalIconName } from "@/components/icon/quintalIconPaths";
import type { QuintalIconTheme } from "@/components/icon/quintalIconTheme";

// Mapa ícone-por-tipo compartilhado entre /quintal/timeline (a timeline
// completa) e o resumo compacto da Home — nasceu duplicado (cada tela
// com o próprio ICONS local) e convergiu aqui na refatoração da Home.
//
// Integração com a linguagem de ícones do Quintal (traço de giz — ver
// docs/design-system.md #Quintal Iconography): 6 dos 8 tipos mapeiam
// limpo para um dos seis temas. "outing" (passeio) e "observation"
// (observação livre) não pertencem a nenhum dos seis domínios — forçar
// um tema aqui seria inventar uma classificação que não existe — e por
// isso continuam com o ícone Lucide genérico de antes, no mesmo selo
// amarelo neutro.
const QUINTAL_MAP: Partial<Record<TimelineIcon, { name: QuintalIconName; theme: QuintalIconTheme }>> = {
  sleep: { name: "moon", theme: "sleep" },
  wake: { name: "sun", theme: "sleep" },
  meal: { name: "plate", theme: "meal" },
  play: { name: "ball", theme: "play" },
  routine: { name: "cycle", theme: "routine" },
  development: { name: "sprout", theme: "growth" },
  hygiene: { name: "drop", theme: "hygiene" },
};

const LEGACY_ICONS: Partial<Record<TimelineIcon, LucideIcon>> = {
  outing: MapPin,
  observation: Eye,
};

export function TimelineEventIcon({ type, size = "sm" }: { type: TimelineIcon; size?: QuintalIconSize }) {
  const quintal = QUINTAL_MAP[type];
  if (quintal) {
    return <QuintalIcon name={quintal.name} theme={quintal.theme} size={size} background="light" />;
  }

  const Legacy = LEGACY_ICONS[type]!;
  const px = typeof size === "number" ? size : { sm: 16, md: 24, lg: 40 }[size];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent"
      style={{ width: px * 1.56, height: px * 1.56 }}
    >
      <Legacy className="h-4 w-4 text-ink" aria-hidden />
    </span>
  );
}

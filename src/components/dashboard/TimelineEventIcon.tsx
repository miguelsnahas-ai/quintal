import { Moon, Sun, Utensils, Blocks, MapPin, ListChecks, Sparkles, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineIcon } from "@/lib/timeline";

// Mapa ícone-por-tipo compartilhado entre /quintal/timeline (a timeline
// completa) e o resumo compacto da Home — nasceu duplicado (cada tela
// com o próprio ICONS local) e convergiu aqui nesta refatoração da Home,
// que passou a precisar do mesmo mapeamento.
const ICONS: Record<TimelineIcon, LucideIcon> = {
  sleep: Moon,
  wake: Sun,
  meal: Utensils,
  play: Blocks,
  outing: MapPin,
  routine: ListChecks,
  development: Sparkles,
  observation: Eye,
};

export function TimelineEventIcon({ type, className }: { type: TimelineIcon; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} aria-hidden />;
}

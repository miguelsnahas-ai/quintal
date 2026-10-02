import { FilterChips } from "@/components/ui/FilterChips";

// As quatro seções pedidas para o módulo Higiene (diferente de Sono:
// aqui "Registrar troca" é uma das quatro abas, não só um botão CTA —
// pedido explícito da fase, "no máximo 1–2 toques a partir da aba
// Higiene" já fica satisfeito por esta própria navegação).
const SECTIONS = [
  { value: "/quintal/higiene", label: "Visão geral" },
  { value: "/quintal/higiene/registrar", label: "Registrar troca" },
  { value: "/quintal/higiene/fraldas", label: "Fraldas" },
  { value: "/quintal/higiene/historico", label: "Histórico" },
];

export function HygieneModuleNav({ active }: { active: string }) {
  return (
    <FilterChips
      activeValue={active}
      options={SECTIONS.map((section) => ({ value: section.value, label: section.label, href: section.value }))}
    />
  );
}

import { FilterChips } from "@/components/ui/FilterChips";

const SECTIONS = [
  { value: "/quintal/sono", label: "Visão geral" },
  { value: "/quintal/sono/historico", label: "Histórico" },
  { value: "/quintal/sono/analises", label: "Análises" },
  { value: "/quintal/sono/orientacoes", label: "Orientações" },
];

// As quatro telas do módulo Sono (a quinta, Registro, é alcançada pelo
// botão "Registrar sono" — uma ação, não uma seção para navegar de
// volta). Reaproveita FilterChips (mesmo componente de filtro da
// Timeline) só porque o visual de "pill selecionado" é o mesmo — aqui
// cada opção é uma rota de verdade, não um filtro.
export function SleepModuleNav({ active }: { active: string }) {
  return (
    <FilterChips
      activeValue={active}
      options={SECTIONS.map((section) => ({ value: section.value, label: section.label, href: section.value }))}
    />
  );
}

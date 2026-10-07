import { Chip } from "./Chip";

export type FilterChipOption = { value: string; label: string; href: string };

// Uma fileira de filtros por link+GET (sem estado de cliente) — o que a
// Timeline já fazia com seu próprio FilterChip local. `activeValue` nulo
// não marca nenhuma opção como selecionada (ex.: "Todos" implícito).
export function FilterChips({
  options,
  activeValue,
  className = "",
}: {
  options: FilterChipOption[];
  activeValue: string | null;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => (
        <Chip key={option.value} href={option.href} selected={option.value === activeValue}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

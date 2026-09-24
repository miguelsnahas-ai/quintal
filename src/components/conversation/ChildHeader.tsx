// Purely presentational — every value it renders comes straight from the
// database (name, computed age, a real event count). No copy here should
// ever imply information that wasn't actually passed in.
export default function ChildHeader({
  childName,
  ageLabel,
  eventCount,
}: {
  childName: string | null;
  ageLabel: string | null;
  eventCount: number;
}) {
  return (
    <div className="mb-4 space-y-1">
      <h1 className="text-lg font-bold text-ink">
        Quintal {childName ? `de ${childName}` : ""}
      </h1>
      {childName ? (
        <p className="text-sm text-ink-muted">
          {ageLabel ?? "Idade não informada"}
          {eventCount > 0 &&
            ` · ${eventCount} registro${eventCount === 1 ? "" : "s"} no histórico`}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Cadastre uma criança para começar a conversar sobre ela.
        </p>
      )}
    </div>
  );
}

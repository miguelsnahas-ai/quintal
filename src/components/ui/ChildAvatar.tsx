function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// Avatar de criança — foto real quando existe (avatar_url, configurável
// em Configurações > Crianças), ou um círculo com as iniciais, o mesmo
// fallback que a edição de perfil já desenhava à mão. Usado no cabeçalho
// global (ChildSwitcher) e onde mais precisar identificar visualmente
// uma criança.
export function ChildAvatar({
  name,
  avatarUrl,
  size = 40,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-ink"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}

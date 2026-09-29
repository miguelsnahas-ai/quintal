import { type HTMLAttributes } from "react";

// A coluna única de toda tela de família — `mx-auto w-full max-w-lg
// space-y-N px-4 py-6` reescrito à mão em cada página de /quintal (sono,
// alimentação, brincadeiras, timeline, materiais...) antes desta troca.
// `space` escolhe o espaçamento vertical entre as duas variações que já
// existiam (a maioria usa 8, a timeline usa 6).
export function PageContainer({
  space = 8,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { space?: 6 | 8 }) {
  const spaceClassName = space === 6 ? "space-y-6" : "space-y-8";
  return <div className={`mx-auto w-full max-w-lg ${spaceClassName} px-4 py-6 ${className}`} {...props} />;
}

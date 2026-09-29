import BottomNav from "@/components/navigation/BottomNav";

// Aplica a navegação persistente a toda a experiência de família
// (/quintal e tudo abaixo dela) num só lugar, sem tocar em cada página.
// Não verifica sessão aqui de propósito: cada página já resolve sua
// própria sessão e chama redirect() quando não há uma — o redirect()
// do Next.js aborta o render da árvore inteira (layout incluído) antes
// de qualquer HTML chegar ao navegador, então esta barra nunca aparece
// "sozinha" numa tela que devia redirecionar.
export default function QuintalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

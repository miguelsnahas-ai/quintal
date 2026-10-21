import { Skeleton } from "@/components/ui/Skeleton";

// Next.js mostra isto automaticamente enquanto qualquer página de
// /quintal/* (Server Component assíncrono) ainda está buscando dados —
// o estado de "loading" pedido explicitamente nesta refatoração, sem
// precisar de lógica de loading manual em cada página. O esqueleto
// segue as dimensões aproximadas da Home (a tela mais visitada), mas
// serve como placeholder razoável para qualquer módulo.
export default function QuintalLoading() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6 sm:max-w-2xl lg:max-w-3xl" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

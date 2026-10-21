import { redirect } from "next/navigation";

// Fase 17: o conteúdo desta página (essenciais da criança + preferências
// da família) se mudou para a área de Configurações — perfil/preferências
// da criança agora vivem em /quintal/configuracoes/criancas/[id], e
// preferências da família em /quintal/configuracoes/familia. Este
// redirect existe só para links/favoritos antigos continuarem
// funcionando, sem quebrar nada que já apontava pra cá.
export default function PerfilRedirectPage() {
  redirect("/quintal/configuracoes");
}

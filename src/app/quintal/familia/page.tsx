import { redirect } from "next/navigation";

// Fase 17: o conteúdo desta página (crianças, cuidadores, convites) se
// mudou para a área de Configurações — a lista de crianças agora vive em
// /quintal/configuracoes/criancas, e cuidadores/convites em
// /quintal/configuracoes/cuidadores. Este redirect existe só para
// links/favoritos antigos continuarem funcionando.
export default function FamiliaRedirectPage() {
  redirect("/quintal/configuracoes");
}

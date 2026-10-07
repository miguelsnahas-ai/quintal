import type { Metadata } from "next";
import Link from "next/link";
import { getInvitationByToken } from "@/lib/invitations";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { acceptInvitationAction } from "./actions";

export const metadata: Metadata = {
  title: "Convite — Quintal",
  robots: { index: false, follow: false },
};

// Aceitar convite (Fase 16) — página pública, sem sessão (mesmo tier de
// /comecar): quem abre o link ainda não tem conta no Quintal, ou tem uma
// conta de OUTRA família (o caso recusado explicitamente em
// acceptInvitation). Fluxo: nome + WhatsApp, sem senha — mesmo modelo de
// "conta" que /comecar já usa.
export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <ConviteShell>
        <p className="text-sm text-ink-muted">
          Esse link de convite não é válido. Peça pra quem te convidou mandar um novo.
        </p>
      </ConviteShell>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <ConviteShell>
        <p className="text-sm text-ink-muted">Esse convite já foi aceito.</p>
        <Link href="/comecar" className="text-sm font-medium text-ink underline underline-offset-2">
          Já tenho conta — entrar
        </Link>
      </ConviteShell>
    );
  }

  if (invitation.status === "revoked") {
    return (
      <ConviteShell>
        <p className="text-sm text-ink-muted">Esse convite foi cancelado por quem administra a família.</p>
      </ConviteShell>
    );
  }

  if (invitation.status === "expired" || invitation.isExpired) {
    return (
      <ConviteShell>
        <p className="text-sm text-ink-muted">Esse convite expirou. Peça pra quem te convidou gerar um novo link.</p>
      </ConviteShell>
    );
  }

  return (
    <ConviteShell>
      <p className="text-sm text-ink-muted">
        {invitation.invitedByName ? `${invitation.invitedByName} te convidou` : "Você foi convidado(a)"} para
        participar da família <span className="font-semibold text-ink">{invitation.familyName}</span> no Quintal.
      </p>

      <FieldError>{error}</FieldError>

      <form action={acceptInvitationAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone_number">Seu WhatsApp</Label>
          <Input id="phone_number" name="phone_number" placeholder="(11) 91234-5678" required />
        </div>
        <Button type="submit" className="w-full">
          Aceitar convite
        </Button>
      </form>
    </ConviteShell>
  );
}

function ConviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-lg font-bold text-ink">Convite para o Quintal</h1>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

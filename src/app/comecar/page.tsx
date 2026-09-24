import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { TEST_ACCESS_COOKIE } from "@/lib/testAccess";
import { startFamily } from "./actions";

export const metadata: Metadata = {
  title: "Comece a testar o Quintal",
  robots: { index: false, follow: false },
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const rememberedCaregiverId = cookieStore.get(TEST_ACCESS_COOKIE)?.value;

  if (rememberedCaregiverId) {
    const supabase = createServiceClient();
    const { data: caregiver } = await supabase
      .from("caregivers")
      .select("id")
      .eq("id", rememberedCaregiverId)
      .maybeSingle();

    if (caregiver) {
      redirect(`/test/${caregiver.id}`);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-lg font-bold text-ink">Bem-vindo(a) ao Quintal</h1>
        <p className="text-sm text-ink-muted">
          Conte um pouco sobre você para começar a conversar — leva menos de
          um minuto, e a conversa continua de onde parou da próxima vez que
          você abrir este link neste aparelho.
        </p>
      </div>

      <FieldError>{error}</FieldError>

      <form action={startFamily} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="parent_name">Seu nome</Label>
          <Input id="parent_name" name="parent_name" required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone_number">Seu WhatsApp</Label>
          <Input
            id="phone_number"
            name="phone_number"
            placeholder="(11) 91234-5678"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="child_name">Nome do seu filho(a) (opcional)</Label>
          <Input id="child_name" name="child_name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="child_birth_date">Data de nascimento (opcional)</Label>
          <Input id="child_birth_date" name="child_birth_date" type="date" />
        </div>
        <Button type="submit" className="w-full">
          Começar a conversar
        </Button>
      </form>
    </div>
  );
}

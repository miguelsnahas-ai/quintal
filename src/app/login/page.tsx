import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-[100dvh] flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <Sprout className="mx-auto h-8 w-8 text-tertiary" aria-hidden />
          <h1 className="text-xl font-bold text-ink">Quintal — operação</h1>
          <p className="text-sm text-ink-muted">Acesso restrito à equipe do Quintal.</p>
        </div>

        <Card className="p-6">
          <form action={signIn} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <FieldError>{error}</FieldError>

            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

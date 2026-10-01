import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { CrayonDefs, CrayonMark } from "@/components/marks/CrayonMark";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Tudo pronto! — Quintal",
  robots: { index: false, follow: false },
};

export default async function OnboardingDonePage() {
  const existingCaregiverId = await getFamilySessionCaregiverId();
  if (!existingCaregiverId) {
    redirect("/comecar");
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <CrayonDefs />
      <CrayonMark mark="heart" scale={0.9} />
      <div className="mt-6 space-y-2">
        <h1 className="text-2xl font-bold text-ink">Tudo pronto!</h1>
        <p className="text-sm text-ink-muted">
          O Quintal já está configurado e pronto para essa jornada com vocês.
        </p>
      </div>
      <Link href="/quintal" className={`${buttonClassName("primary", "w-full justify-center")} mt-8`}>
        Ir para a Home
      </Link>
    </div>
  );
}

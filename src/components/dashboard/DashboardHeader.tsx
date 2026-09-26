import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";

// The dashboard's own header — distinct from ConversationChat's
// ChildHeader (which stays exactly as-is for the chat page: no date, no
// profile/chat affordances, just name/age/event count above the message
// list). This one carries what the brief asks the *entry point* header to
// carry: child identification, today's date, a way into the (still
// minimal) profile view, and a way into the chat — always one tap away,
// never removed.
export default function DashboardHeader({
  childName,
  ageLabel,
  dateLabel,
}: {
  childName: string | null;
  ageLabel: string | null;
  dateLabel: string;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <Link href="/quintal/perfil" className="group flex min-w-0 items-center gap-1">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">
            Quintal {childName ? `de ${childName}` : ""}
          </h1>
          <p className="text-sm text-ink-muted">
            {dateLabel}
            {ageLabel ? ` · ${ageLabel}` : ""}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
      <Link
        href="/quintal/chat"
        aria-label="Conversar com o Quintal"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:brightness-95"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}

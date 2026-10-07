"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/Button";

// O Quintal nunca envia o convite sozinho — a família sempre copia o
// link e manda por fora (hoje, WhatsApp). Antes deste componente, o link
// aparecia como texto inerte e truncado, com um ícone de "copiar"
// puramente decorativo (nenhum onClick, nenhuma chamada ao clipboard) —
// por isso não dava pra copiar nada. Aqui: um botão de copiar de verdade
// (com fallback para contextos sem Clipboard API, ex. http local) e um
// atalho que já abre o WhatsApp com o link preenchido.
export function CopyInviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Falha silenciosa — o link continua visível e selecionável à mão.
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Você foi convidado(a) para acompanhar a rotina no Quintal. Entre pelo link: ${link}`,
  )}`;

  return (
    <div className="space-y-2">
      <p className="break-all rounded-sm bg-surface px-3 py-2 text-xs text-ink">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={handleCopy} className="px-3 py-1.5 text-xs">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClassName("secondary", "px-3 py-1.5 text-xs")}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}

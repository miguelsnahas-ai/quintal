import PlaygroundChat from "./PlaygroundChat";

export default function PlaygroundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Chat de teste</h1>
        <p className="text-sm text-ink-muted">
          Uma conversa simulada, sem gravar nada no banco — só para testar e
          refinar como o modelo responde. Feche a página para descartar.
        </p>
      </div>

      <PlaygroundChat />
    </div>
  );
}

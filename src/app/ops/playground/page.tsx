import PlaygroundChat from "./PlaygroundChat";

export default function PlaygroundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Chat de teste
        </h1>
        <p className="text-sm text-neutral-600">
          Uma conversa simulada, sem gravar nada no banco — só para testar e
          refinar como o modelo responde. Feche a página para descartar.
        </p>
      </div>

      <PlaygroundChat />
    </div>
  );
}

import { describe, it, expect } from "vitest";
import { resolveActiveChild, type AccessibleChild } from "./activeChild";

const laura: AccessibleChild = { id: "laura", name: "Laura", birthDate: "2025-01-01" };
const pedro: AccessibleChild = { id: "pedro", name: "Pedro", birthDate: "2022-01-01" };

describe("resolveActiveChild", () => {
  it("returns null when the caregiver has no accessible children", () => {
    expect(resolveActiveChild([], undefined)).toBeNull();
  });

  it("falls back to the first (oldest) child when there is no cookie", () => {
    expect(resolveActiveChild([laura, pedro], undefined)).toBe(laura);
  });

  it("honors the cookie when it matches an accessible child", () => {
    expect(resolveActiveChild([laura, pedro], "pedro")).toBe(pedro);
  });

  it("falls back to the first child when the cookie points at a child not in the list (tampered, stale, or access revoked)", () => {
    expect(resolveActiveChild([laura, pedro], "some-other-childs-id")).toBe(laura);
  });

  it("falls back to the only child when there is exactly one, regardless of the cookie", () => {
    expect(resolveActiveChild([pedro], "laura")).toBe(pedro);
  });

  // Revisão da área de Configurações — cenários de teste pedidos
  // explicitamente:
  //   5. "Cuidador recebe acesso somente à criança selecionada."
  //   6. "Cuidador não consegue acessar outra criança."
  // `children` aqui já chega filtrada pelo caller (getAccessibleChildren,
  // via caregiver_child no banco) — o que esta função garante é que a
  // criança ATIVA nunca escapa desse conjunto, mesmo com um cookie
  // adulterado ou copiado de outra sessão/família.
  it("cenário 5/6: um cuidador com acesso a uma única criança só pode ter essa criança como ativa", () => {
    const active = resolveActiveChild([laura], undefined);
    expect(active).toBe(laura);
    expect(active?.id).not.toBe(pedro.id);
  });

  it("cenário 6: um cookie apontando para uma criança fora da lista acessível deste cuidador nunca vira a criança ativa", () => {
    // "pedro" não está na lista — simula um cuidador com acesso só à Laura
    // tentando (via cookie adulterado/antigo) ativar uma criança de outro
    // acesso.
    const active = resolveActiveChild([laura], pedro.id);
    expect(active).toBe(laura);
    expect(active?.id).not.toBe(pedro.id);
  });
});

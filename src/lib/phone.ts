// Best-effort normalizer for numbers typed by parents in the public signup
// form (e.g. "(11) 94122-5288") into the E.164 format the rest of the app
// expects (matches caregiverInputSchema's phone_number regex). Assumes
// Brazil: a local number (DDD + number) is 10-11 digits; with the country
// code it's 12-13 — checked by length, not by a "55" prefix, since DDD 55
// (Rio Grande do Sul) would otherwise be mistaken for an already-present
// country code.
export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let withCountryCode: string;
  if (digits.length === 12 || digits.length === 13) {
    withCountryCode = digits;
  } else if (digits.length === 10 || digits.length === 11) {
    withCountryCode = `55${digits}`;
  } else {
    return null;
  }

  const e164 = `+${withCountryCode}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

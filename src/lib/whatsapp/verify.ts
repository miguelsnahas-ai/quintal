import crypto from "node:crypto";

// Meta signs the raw webhook body with the app secret and sends it as
// `X-Hub-Signature-256: sha256=<hex>`. Must run over the exact bytes
// received — re-serializing the parsed JSON would produce a different
// signature and reject every legitimate request.
export function isValidWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const [scheme, signature] = signatureHeader.split("=");
  if (scheme !== "sha256" || !signature) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

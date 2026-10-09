import { getVercelOidcToken } from "@vercel/oidc";

export type AiAuth = {
  token: string;
  gateway: boolean;
  endpoint: string;
  model: string;
  provider: "openai-direct" | "vercel-gateway-key" | "vercel-gateway-oidc";
};

/** Use the project's configured key if present, otherwise the Vercel Gateway OIDC identity.
 * Secrets remain server-side; never send tokens in API response bodies or console logs.
 */
export async function getExperimentAiAuth(): Promise<AiAuth | null> {
  const direct = process.env.OPENAI_API_KEY?.trim();
  if (direct) {
    return {
      token: direct,
      gateway: false,
      endpoint: "https://api.openai.com/v1/responses",
      model: process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-5.6",
      provider: "openai-direct",
    };
  }
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gateway) {
    return {
      token: gateway,
      gateway: true,
      endpoint: "https://ai-gateway.vercel.sh/v1/responses",
      model: process.env.EXPERIMENT_GATEWAY_MODEL?.trim() || "openai/gpt-5.6-sol",
      provider: "vercel-gateway-key",
    };
  }
  try {
    const token = await getVercelOidcToken();
    if (token) {
      return {
        token,
        gateway: true,
        endpoint: "https://ai-gateway.vercel.sh/v1/responses",
        model: process.env.EXPERIMENT_GATEWAY_MODEL?.trim() || "openai/gpt-5.6-sol",
        provider: "vercel-gateway-oidc",
      };
    }
  } catch {
    // Local development may not have Vercel's OIDC identity, unlike deployed Vercel functions.
  }
  return null;
}

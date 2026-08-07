import type { ServiceDefinition, ServiceId } from "./types";

export const SERVICES: readonly ServiceDefinition[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    shortName: "CG",
    homeUrl: "https://chatgpt.com/",
    trustedHosts: ["chatgpt.com", "openai.com"]
  },
  {
    id: "claude",
    name: "Claude",
    shortName: "CL",
    homeUrl: "https://claude.ai/",
    trustedHosts: ["claude.ai", "anthropic.com"]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    shortName: "PX",
    homeUrl: "https://www.perplexity.ai/",
    trustedHosts: ["perplexity.ai"]
  },
  {
    id: "gemini",
    name: "Gemini",
    shortName: "GE",
    homeUrl: "https://gemini.google.com/",
    trustedHosts: ["gemini.google.com"]
  },
  {
    id: "zai",
    name: "Z.AI",
    shortName: "ZA",
    homeUrl: "https://chat.z.ai/",
    trustedHosts: ["z.ai"]
  },
  {
    id: "deepseek",
    name: "DeepSeek Chat",
    shortName: "DS",
    homeUrl: "https://chat.deepseek.com/",
    trustedHosts: ["deepseek.com"]
  },
  {
    id: "kimi",
    name: "Kimi Chat",
    shortName: "KI",
    homeUrl: "https://www.kimi.com/",
    trustedHosts: ["kimi.com"]
  },
  {
    id: "mistral",
    name: "Mistral Vibe",
    shortName: "MV",
    homeUrl: "https://chat.mistral.ai/chat",
    trustedHosts: ["mistral.ai"]
  }
] as const;

export const SERVICE_BY_ID = new Map<ServiceId, ServiceDefinition>(
  SERVICES.map((service) => [service.id, service])
);

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICES.some((service) => service.id === value);
}

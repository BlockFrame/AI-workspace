import type { BroadcastMode, ServiceId } from "./types";

export const RESEARCH_PROJECT_VERSION = 1 as const;
export const MAX_RESEARCH_RESPONSE_LENGTH = 100_000;
export const MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH = 120_000;

export interface ResearchResponse {
  accountId: string;
  accountLabel: string;
  serviceId: ServiceId;
  content: string;
  notes: string;
  includeInOptimization: boolean;
  capturedAt?: string;
}

export interface ResearchRound {
  id: string;
  parentRoundId?: string;
  question: string;
  accountIds: string[];
  mode: BroadcastMode;
  responses: ResearchResponse[];
  optimizationPrompt: string;
  optimizedAnswer: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProject {
  version: typeof RESEARCH_PROJECT_VERSION;
  id: string;
  title: string;
  rounds: ResearchRound[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateResearchProjectInput {
  title: string;
  question: string;
  accountIds: string[];
  mode: BroadcastMode;
}

export interface AddResearchRoundInput {
  parentRoundId: string;
  question: string;
  accountIds: string[];
  mode: BroadcastMode;
}

export interface ResearchResponseUpdate {
  accountId: string;
  content: string;
  notes: string;
  includeInOptimization: boolean;
}

export interface UpdateResearchRoundInput {
  responses: ResearchResponseUpdate[];
  optimizationPrompt: string;
  optimizedAnswer: string;
}

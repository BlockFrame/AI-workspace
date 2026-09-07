import type { BroadcastMode, ServiceId } from "./types";

export const GEO_STUDY_VERSION = 1 as const;
export const MAX_GEO_QUESTIONS = 100;
export const MAX_GEO_QUESTION_LENGTH = 4_000;
export const MAX_GEO_RESPONSE_LENGTH = 100_000;

export type GeoStudyStatus = "draft" | "running" | "paused" | "completed";
export type GeoResultStatus =
  | "pending"
  | "sending"
  | "waiting"
  | "captured"
  | "needs-review"
  | "blocked"
  | "failed"
  | "skipped";
export type GeoCaptureMethod = "automatic" | "manual";

export interface GeoQuestion {
  id: string;
  text: string;
  category?: string;
  order: number;
}

export interface GeoCitation {
  label: string;
  url: string;
}

export interface GeoResult {
  id: string;
  questionId: string;
  accountId: string;
  accountLabel: string;
  serviceId: ServiceId;
  status: GeoResultStatus;
  response: string;
  citations: GeoCitation[];
  captureMethod?: GeoCaptureMethod;
  conversationUrl?: string;
  error?: string;
  capturedAt?: string;
  verified: boolean;
  updatedAt: string;
}

export interface GeoStudy {
  version: typeof GEO_STUDY_VERSION;
  id: string;
  title: string;
  brandName: string;
  domain?: string;
  mode: BroadcastMode;
  allowSensitiveData: boolean;
  accountIds: string[];
  questions: GeoQuestion[];
  results: GeoResult[];
  status: GeoStudyStatus;
  pauseReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ImportedGeoQuestion {
  text: string;
  category?: string;
}

export interface CreateGeoStudyInput {
  title: string;
  brandName: string;
  domain?: string;
  mode: BroadcastMode;
  allowSensitiveData?: boolean;
  accountIds: string[];
  questions: ImportedGeoQuestion[];
}

export interface UpdateGeoResultInput {
  response: string;
  verified: boolean;
}

export interface GeoCaptureSnapshot {
  captureToken: string;
  responseCount: number;
  lastResponseText: string;
}

export interface GeoCapturedResponse {
  status: "captured" | "blocked" | "timeout" | "cancelled" | "failed";
  response: string;
  citations: GeoCitation[];
  conversationUrl: string;
  message: string;
}

export interface GeoStudyProgressEvent {
  studyId: string;
  status: GeoStudyStatus;
  updatedAt: string;
  pauseReason?: string;
  startedAt?: string;
  completedAt?: string;
  result?: GeoResult;
}

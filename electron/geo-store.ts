import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isServiceId } from "../src/shared/services";
import {
  GEO_STUDY_VERSION,
  MAX_GEO_QUESTIONS,
  MAX_GEO_QUESTION_LENGTH,
  MAX_GEO_RESPONSE_LENGTH
} from "../src/shared/geo-types";
import type {
  CreateGeoStudyInput,
  GeoCitation,
  GeoResult,
  GeoResultStatus,
  GeoStudy,
  ImportedGeoQuestion,
  UpdateGeoResultInput
} from "../src/shared/geo-types";
import type { AccountProfile, BroadcastMode } from "../src/shared/types";

const MAX_GEO_STUDIES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isBroadcastMode(value: unknown): value is BroadcastMode {
  return value === "standard" || value === "deep-research";
}

function isGeoResultStatus(value: unknown): value is GeoResultStatus {
  return [
    "pending",
    "sending",
    "waiting",
    "captured",
    "needs-review",
    "blocked",
    "failed",
    "skipped"
  ].includes(String(value));
}

function isGeoCitation(value: unknown): value is GeoCitation {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.url === "string"
  );
}

function isGeoResult(value: unknown): value is GeoResult {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isUuid(value.questionId) &&
    typeof value.accountId === "string" &&
    typeof value.accountLabel === "string" &&
    isServiceId(value.serviceId) &&
    isGeoResultStatus(value.status) &&
    typeof value.response === "string" &&
    value.response.length <= MAX_GEO_RESPONSE_LENGTH &&
    Array.isArray(value.citations) &&
    value.citations.every(isGeoCitation) &&
    (value.captureMethod === undefined ||
      value.captureMethod === "automatic" ||
      value.captureMethod === "manual") &&
    (value.conversationUrl === undefined ||
      typeof value.conversationUrl === "string") &&
    (value.error === undefined || typeof value.error === "string") &&
    (value.capturedAt === undefined || isIsoDate(value.capturedAt)) &&
    typeof value.verified === "boolean" &&
    isIsoDate(value.updatedAt)
  );
}

function isGeoStudy(value: unknown): value is GeoStudy {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.version === GEO_STUDY_VERSION &&
    isUuid(value.id) &&
    typeof value.title === "string" &&
    typeof value.brandName === "string" &&
    (value.domain === undefined || typeof value.domain === "string") &&
    isBroadcastMode(value.mode) &&
    typeof value.allowSensitiveData === "boolean" &&
    Array.isArray(value.accountIds) &&
    value.accountIds.every((id) => typeof id === "string") &&
    Array.isArray(value.questions) &&
    value.questions.length >= 1 &&
    value.questions.length <= MAX_GEO_QUESTIONS &&
    value.questions.every(
      (question) =>
        isRecord(question) &&
        isUuid(question.id) &&
        typeof question.text === "string" &&
        question.text.length <= MAX_GEO_QUESTION_LENGTH &&
        (question.category === undefined || typeof question.category === "string") &&
        typeof question.order === "number"
    ) &&
    Array.isArray(value.results) &&
    value.results.every(isGeoResult) &&
    ["draft", "running", "paused", "completed"].includes(String(value.status)) &&
    (value.pauseReason === undefined || typeof value.pauseReason === "string") &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt) &&
    (value.startedAt === undefined || isIsoDate(value.startedAt)) &&
    (value.completedAt === undefined || isIsoDate(value.completedAt))
  );
}

function copyStudy(study: GeoStudy): GeoStudy {
  return {
    ...study,
    accountIds: [...study.accountIds],
    questions: study.questions.map((question) => ({ ...question })),
    results: study.results.map((result) => ({
      ...result,
      citations: result.citations.map((citation) => ({ ...citation }))
    }))
  };
}

function normalizeQuestions(value: unknown): ImportedGeoQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_GEO_QUESTIONS) {
    return null;
  }
  const normalized: ImportedGeoQuestion[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > MAX_GEO_QUESTION_LENGTH ||
      (item.category !== undefined && typeof item.category !== "string")
    ) {
      return null;
    }
    const text = item.text.trim();
    const key = text.normalize("NFKC").toLocaleLowerCase();
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);
    normalized.push({
      text,
      ...(item.category?.trim()
        ? { category: item.category.trim().slice(0, 120) }
        : {})
    });
  }
  return normalized;
}

export function normalizeCreateGeoStudyInput(
  value: unknown
): CreateGeoStudyInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const questions = normalizeQuestions(value.questions);
  const accountIds = Array.isArray(value.accountIds)
    ? [...new Set(value.accountIds)]
    : [];
  const domain =
    typeof value.domain === "string" && value.domain.trim()
      ? value.domain.trim()
      : undefined;
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 120 ||
    typeof value.brandName !== "string" ||
    !value.brandName.trim() ||
    value.brandName.length > 120 ||
    (domain !== undefined && domain.length > 253) ||
    !isBroadcastMode(value.mode) ||
    (value.allowSensitiveData !== undefined &&
      typeof value.allowSensitiveData !== "boolean") ||
    accountIds.length < 1 ||
    accountIds.length > 8 ||
    !accountIds.every((id) => typeof id === "string") ||
    !questions
  ) {
    return null;
  }
  return {
    title: value.title.trim(),
    brandName: value.brandName.trim(),
    ...(domain ? { domain } : {}),
    mode: value.mode,
    allowSensitiveData: value.allowSensitiveData === true,
    accountIds,
    questions
  };
}

export function normalizeUpdateGeoResultInput(
  value: unknown
): UpdateGeoResultInput | null {
  if (
    !isRecord(value) ||
    typeof value.response !== "string" ||
    value.response.length > MAX_GEO_RESPONSE_LENGTH ||
    typeof value.verified !== "boolean"
  ) {
    return null;
  }
  return { response: value.response, verified: value.verified };
}

export class GeoStudyStore {
  private studies: GeoStudy[] = [];
  private saveQueue: Promise<void> = Promise.resolve();
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "geo-studies.json");
  }

  async load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.studies = Array.isArray(parsed)
        ? parsed.filter(isGeoStudy).slice(0, MAX_GEO_STUDIES)
        : [];
      let changed = false;
      for (const study of this.studies) {
        if (study.status === "running") {
          study.status = "paused";
          study.pauseReason = "The previous batch was interrupted when AI Workspace stopped.";
          study.updatedAt = new Date().toISOString();
          changed = true;
        }
        for (const result of study.results) {
          if (result.status === "sending" || result.status === "waiting") {
            result.status = "pending";
            result.response = "";
            result.citations = [];
            result.captureMethod = undefined;
            result.conversationUrl = undefined;
            result.capturedAt = undefined;
            result.verified = false;
            result.error = undefined;
            result.updatedAt = study.updatedAt;
            changed = true;
          }
        }
      }
      if (changed) {
        await this.save();
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        this.studies = [];
        return;
      }
      throw error;
    }
  }

  list(): GeoStudy[] {
    return this.studies
      .map(copyStudy)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(studyId: string): GeoStudy | undefined {
    return this.studies.find((study) => study.id === studyId);
  }

  async create(
    input: CreateGeoStudyInput,
    accounts: AccountProfile[]
  ): Promise<GeoStudy> {
    if (this.studies.length >= MAX_GEO_STUDIES) {
      throw new Error(`AI Workspace supports up to ${MAX_GEO_STUDIES} GEO studies.`);
    }
    const selectedAccounts = input.accountIds.map((accountId) => {
      const account = accounts.find((candidate) => candidate.id === accountId);
      if (!account) {
        throw new Error("One or more selected GEO accounts no longer exist.");
      }
      return account;
    });
    const now = new Date().toISOString();
    const questions = input.questions.map((question, order) => ({
      id: randomUUID(),
      text: question.text,
      ...(question.category ? { category: question.category } : {}),
      order
    }));
    const results = questions.flatMap((question) =>
      selectedAccounts.map((account) => ({
        id: randomUUID(),
        questionId: question.id,
        accountId: account.id,
        accountLabel: account.label,
        serviceId: account.serviceId,
        status: "pending" as const,
        response: "",
        citations: [],
        verified: false,
        updatedAt: now
      }))
    );
    const study: GeoStudy = {
      version: GEO_STUDY_VERSION,
      id: randomUUID(),
      title: input.title,
      brandName: input.brandName,
      ...(input.domain ? { domain: input.domain } : {}),
      mode: input.mode,
      allowSensitiveData: input.allowSensitiveData === true,
      accountIds: [...input.accountIds],
      questions,
      results,
      status: "draft",
      createdAt: now,
      updatedAt: now
    };
    this.studies.unshift(study);
    await this.save();
    return copyStudy(study);
  }

  async updateResultStatus(
    studyId: string,
    resultId: string,
    status: GeoResultStatus,
    patch: Partial<
      Pick<
        GeoResult,
        | "response"
        | "citations"
        | "captureMethod"
        | "conversationUrl"
        | "error"
        | "capturedAt"
        | "verified"
      >
    > = {}
  ): Promise<GeoStudy> {
    const study = this.requireStudy(studyId);
    const result = study.results.find((candidate) => candidate.id === resultId);
    if (!result) {
      throw new Error("GEO result not found.");
    }
    Object.assign(result, patch, { status, updatedAt: new Date().toISOString() });
    study.updatedAt = result.updatedAt;
    await this.save();
    return copyStudy(study);
  }

  async updateManualResult(
    studyId: string,
    resultId: string,
    input: UpdateGeoResultInput
  ): Promise<GeoStudy> {
    return this.updateResultStatus(
      studyId,
      resultId,
      input.response.trim() ? "captured" : "pending",
      {
        response: input.response,
        citations: [],
        captureMethod: "manual",
        conversationUrl: undefined,
        capturedAt: input.response.trim() ? new Date().toISOString() : undefined,
        verified: input.verified,
        error: undefined
      }
    );
  }

  async setStatus(
    studyId: string,
    status: GeoStudy["status"],
    pauseReason?: string
  ): Promise<GeoStudy> {
    const study = this.requireStudy(studyId);
    const now = new Date().toISOString();
    study.status = status;
    study.updatedAt = now;
    study.pauseReason = pauseReason;
    if (status === "running" && !study.startedAt) {
      study.startedAt = now;
    }
    if (status === "completed") {
      study.completedAt = now;
    } else {
      study.completedAt = undefined;
    }
    await this.save();
    return copyStudy(study);
  }

  async resetFailed(studyId: string): Promise<GeoStudy> {
    const study = this.requireStudy(studyId);
    const now = new Date().toISOString();
    for (const result of study.results) {
      if (
        result.status === "failed" ||
        result.status === "blocked" ||
        result.status === "needs-review"
      ) {
        result.status = "pending";
        result.response = "";
        result.citations = [];
        result.captureMethod = undefined;
        result.conversationUrl = undefined;
        result.capturedAt = undefined;
        result.verified = false;
        result.error = undefined;
        result.updatedAt = now;
      }
    }
    study.updatedAt = now;
    await this.save();
    return copyStudy(study);
  }

  async delete(studyId: string): Promise<void> {
    const next = this.studies.filter((study) => study.id !== studyId);
    if (next.length === this.studies.length) {
      throw new Error("GEO study not found.");
    }
    this.studies = next;
    await this.save();
  }

  waitForPendingSaves(): Promise<void> {
    return this.saveQueue;
  }

  private requireStudy(studyId: string): GeoStudy {
    const study = this.get(studyId);
    if (!study) {
      throw new Error("GEO study not found.");
    }
    return study;
  }

  private save(): Promise<void> {
    const write = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(this.studies, null, 2), {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.rename(temporaryPath, this.filePath);
    };
    this.saveQueue = this.saveQueue.then(write, write);
    return this.saveQueue;
  }
}

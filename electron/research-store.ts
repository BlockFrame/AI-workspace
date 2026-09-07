import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AccountProfile, BroadcastMode } from "../src/shared/types";
import { isServiceId } from "../src/shared/services";
import {
  MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH,
  MAX_RESEARCH_RESPONSE_LENGTH,
  RESEARCH_PROJECT_VERSION
} from "../src/shared/research-types";
import type {
  AddResearchRoundInput,
  CreateResearchProjectInput,
  ResearchProject,
  ResearchResponse,
  ResearchResponseUpdate,
  ResearchRound,
  UpdateResearchRoundInput
} from "../src/shared/research-types";

const MAX_PROJECTS = 100;
const MAX_ROUNDS_PER_PROJECT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isBroadcastMode(value: unknown): value is BroadcastMode {
  return value === "standard" || value === "deep-research";
}

function isResearchResponse(value: unknown): value is ResearchResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.accountId === "string" &&
    typeof value.accountLabel === "string" &&
    isServiceId(value.serviceId) &&
    typeof value.content === "string" &&
    value.content.length <= MAX_RESEARCH_RESPONSE_LENGTH &&
    typeof value.notes === "string" &&
    value.notes.length <= 4_000 &&
    typeof value.includeInOptimization === "boolean" &&
    (value.capturedAt === undefined || isIsoDate(value.capturedAt))
  );
}

function isResearchResponseUpdate(value: unknown): value is ResearchResponseUpdate {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.accountId === "string" &&
    typeof value.content === "string" &&
    value.content.length <= MAX_RESEARCH_RESPONSE_LENGTH &&
    typeof value.notes === "string" &&
    value.notes.length <= 4_000 &&
    typeof value.includeInOptimization === "boolean"
  );
}

function isResearchRound(value: unknown): value is ResearchRound {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isUuid(value.id) &&
    (value.parentRoundId === undefined || isUuid(value.parentRoundId)) &&
    typeof value.question === "string" &&
    value.question.trim().length > 0 &&
    value.question.length <= 12_000 &&
    Array.isArray(value.accountIds) &&
    value.accountIds.length > 0 &&
    value.accountIds.length <= 8 &&
    value.accountIds.every((accountId) => typeof accountId === "string") &&
    isBroadcastMode(value.mode) &&
    Array.isArray(value.responses) &&
    value.responses.length <= 8 &&
    value.responses.every(isResearchResponse) &&
    typeof value.optimizationPrompt === "string" &&
    value.optimizationPrompt.length <= MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH &&
    typeof value.optimizedAnswer === "string" &&
    value.optimizedAnswer.length <= MAX_RESEARCH_RESPONSE_LENGTH &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt)
  );
}

function isResearchProject(value: unknown): value is ResearchProject {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.version === RESEARCH_PROJECT_VERSION &&
    isUuid(value.id) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 120 &&
    Array.isArray(value.rounds) &&
    value.rounds.length > 0 &&
    value.rounds.length <= MAX_ROUNDS_PER_PROJECT &&
    value.rounds.every(isResearchRound) &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt)
  );
}

function copyResponse(response: ResearchResponse): ResearchResponse {
  return { ...response };
}

function copyRound(round: ResearchRound): ResearchRound {
  return {
    ...round,
    accountIds: [...round.accountIds],
    responses: round.responses.map(copyResponse)
  };
}

function copyProject(project: ResearchProject): ResearchProject {
  return { ...project, rounds: project.rounds.map(copyRound) };
}

function normalizeAccountIds(accountIds: string[]): string[] {
  return [...new Set(accountIds)];
}

function validateRoundFields(
  question: string,
  accountIds: string[],
  mode: BroadcastMode
): void {
  const uniqueAccountIds = normalizeAccountIds(accountIds);
  if (
    !question.trim() ||
    question.length > 12_000 ||
    uniqueAccountIds.length < 1 ||
    uniqueAccountIds.length > 8 ||
    !isBroadcastMode(mode)
  ) {
    throw new Error("A research round requires a prompt and 1-8 connected accounts.");
  }
}

function normalizeAccountIdList(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((accountId) => typeof accountId === "string")
  ) {
    return null;
  }
  const accountIds = normalizeAccountIds(value);
  return accountIds.length >= 1 && accountIds.length <= 8 ? accountIds : null;
}

export function normalizeCreateResearchProjectInput(
  value: unknown
): CreateResearchProjectInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const accountIds = normalizeAccountIdList(value.accountIds);
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 120 ||
    typeof value.question !== "string" ||
    !value.question.trim() ||
    value.question.length > 12_000 ||
    !accountIds ||
    !isBroadcastMode(value.mode)
  ) {
    return null;
  }
  return {
    title: value.title.trim(),
    question: value.question,
    accountIds,
    mode: value.mode
  };
}

export function normalizeAddResearchRoundInput(
  value: unknown
): AddResearchRoundInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const accountIds = normalizeAccountIdList(value.accountIds);
  if (
    !isUuid(value.parentRoundId) ||
    typeof value.question !== "string" ||
    !value.question.trim() ||
    value.question.length > 12_000 ||
    !accountIds ||
    !isBroadcastMode(value.mode)
  ) {
    return null;
  }
  return {
    parentRoundId: value.parentRoundId,
    question: value.question,
    accountIds,
    mode: value.mode
  };
}

export function normalizeUpdateResearchRoundInput(
  value: unknown
): UpdateResearchRoundInput | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.responses) ||
    !value.responses.every(isResearchResponseUpdate) ||
    typeof value.optimizationPrompt !== "string" ||
    value.optimizationPrompt.length > MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH ||
    typeof value.optimizedAnswer !== "string" ||
    value.optimizedAnswer.length > MAX_RESEARCH_RESPONSE_LENGTH
  ) {
    return null;
  }
  return {
    responses: value.responses.map((response) => ({ ...response })),
    optimizationPrompt: value.optimizationPrompt,
    optimizedAnswer: value.optimizedAnswer
  };
}

function responsesForAccounts(
  accountIds: string[],
  accounts: AccountProfile[]
): ResearchResponse[] {
  return accountIds.map((accountId) => {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) {
      throw new Error("One or more selected research accounts no longer exist.");
    }
    return {
      accountId: account.id,
      accountLabel: account.label,
      serviceId: account.serviceId,
      content: "",
      notes: "",
      includeInOptimization: true
    };
  });
}

function createRound(
  question: string,
  accountIds: string[],
  mode: BroadcastMode,
  accounts: AccountProfile[],
  parentRoundId?: string
): ResearchRound {
  validateRoundFields(question, accountIds, mode);
  const now = new Date().toISOString();
  const uniqueAccountIds = normalizeAccountIds(accountIds);
  return {
    id: randomUUID(),
    ...(parentRoundId ? { parentRoundId } : {}),
    question,
    accountIds: uniqueAccountIds,
    mode,
    responses: responsesForAccounts(uniqueAccountIds, accounts),
    optimizationPrompt: "",
    optimizedAnswer: "",
    createdAt: now,
    updatedAt: now
  };
}

export class ResearchStore {
  private projects: ResearchProject[] = [];
  private saveQueue: Promise<void> = Promise.resolve();
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "research-projects.json");
  }

  async load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      this.projects = Array.isArray(parsed)
        ? parsed.filter(isResearchProject).slice(0, MAX_PROJECTS)
        : [];
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        this.projects = [];
        return;
      }
      throw error;
    }
  }

  list(): ResearchProject[] {
    return this.projects
      .map(copyProject)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(
    input: CreateResearchProjectInput,
    accounts: AccountProfile[]
  ): Promise<ResearchProject> {
    if (!input.title.trim() || input.title.length > 120) {
      throw new Error("Research project title must be between 1 and 120 characters.");
    }
    if (this.projects.length >= MAX_PROJECTS) {
      throw new Error(`AI Workspace supports up to ${MAX_PROJECTS} local research projects.`);
    }
    const firstRound = createRound(
      input.question,
      input.accountIds,
      input.mode,
      accounts
    );
    const project: ResearchProject = {
      version: RESEARCH_PROJECT_VERSION,
      id: randomUUID(),
      title: input.title.trim(),
      rounds: [firstRound],
      createdAt: firstRound.createdAt,
      updatedAt: firstRound.updatedAt
    };
    this.projects.unshift(project);
    await this.save();
    return copyProject(project);
  }

  async addRound(
    projectId: string,
    input: AddResearchRoundInput,
    accounts: AccountProfile[]
  ): Promise<ResearchProject> {
    const project = this.getProject(projectId);
    if (project.rounds.length >= MAX_ROUNDS_PER_PROJECT) {
      throw new Error(`A research project supports up to ${MAX_ROUNDS_PER_PROJECT} rounds.`);
    }
    if (!project.rounds.some((round) => round.id === input.parentRoundId)) {
      throw new Error("Parent research round not found.");
    }
    const round = createRound(
      input.question,
      input.accountIds,
      input.mode,
      accounts,
      input.parentRoundId
    );
    project.rounds.push(round);
    project.updatedAt = round.updatedAt;
    await this.save();
    return copyProject(project);
  }

  async updateRound(
    projectId: string,
    roundId: string,
    input: UpdateResearchRoundInput
  ): Promise<ResearchProject> {
    const project = this.getProject(projectId);
    const round = project.rounds.find((candidate) => candidate.id === roundId);
    if (!round) {
      throw new Error("Research round not found.");
    }
    if (
      input.responses.length !== round.responses.length ||
      input.optimizationPrompt.length > MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH ||
      input.optimizedAnswer.length > MAX_RESEARCH_RESPONSE_LENGTH ||
      !input.responses.every(isResearchResponseUpdate)
    ) {
      throw new Error("Invalid research response or optimization content.");
    }
    const expectedAccounts = new Set(round.responses.map((response) => response.accountId));
    if (
      input.responses.some((response) => !expectedAccounts.has(response.accountId)) ||
      new Set(input.responses.map((response) => response.accountId)).size !==
        expectedAccounts.size
    ) {
      throw new Error("Research responses do not match the accounts in this round.");
    }
    const now = new Date().toISOString();
    const updateByAccountId = new Map(
      input.responses.map((response) => [response.accountId, response])
    );
    round.responses = round.responses.map((response) => {
      const update = updateByAccountId.get(response.accountId);
      if (!update) {
        throw new Error("Missing research response update.");
      }
      return {
        ...response,
        content: update.content,
        notes: update.notes,
        includeInOptimization: update.includeInOptimization,
        ...(update.content.trim()
          ? { capturedAt: response.capturedAt ?? now }
          : { capturedAt: undefined })
      };
    });
    round.optimizationPrompt = input.optimizationPrompt;
    round.optimizedAnswer = input.optimizedAnswer;
    round.updatedAt = now;
    project.updatedAt = now;
    await this.save();
    return copyProject(project);
  }

  async delete(projectId: string): Promise<void> {
    const next = this.projects.filter((project) => project.id !== projectId);
    if (next.length === this.projects.length) {
      throw new Error("Research project not found.");
    }
    this.projects = next;
    await this.save();
  }

  waitForPendingSaves(): Promise<void> {
    return this.saveQueue;
  }

  private getProject(projectId: string): ResearchProject {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error("Research project not found.");
    }
    return project;
  }

  private save(): Promise<void> {
    const write = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(this.projects, null, 2), {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.rename(temporaryPath, this.filePath);
    };
    this.saveQueue = this.saveQueue.then(write, write);
    return this.saveQueue;
  }
}

import { useEffect, useMemo, useState } from "react";
import { SERVICE_BY_ID } from "../shared/services";
import type {
  AccountProfile,
  BroadcastDeliveryResult,
  BroadcastMode
} from "../shared/types";
import {
  MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH,
  MAX_RESEARCH_RESPONSE_LENGTH
} from "../shared/research-types";
import type {
  ResearchProject,
  ResearchResponse,
  ResearchResponseUpdate,
  ResearchRound
} from "../shared/research-types";

const MAX_TARGETS = 8;

interface ResearchWorkspaceProps {
  accounts: AccountProfile[];
  onRegisterCloseHandler(handler: (() => Promise<boolean>) | null): void;
  onClose(): void;
  onOpenAccount(accountId: string): void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildOptimizationPrompt(project: ResearchProject, round: ResearchRound): string {
  const sources = round.responses
    .filter((response) => response.includeInOptimization && response.content.trim())
    .map(
      (response, index) =>
        `SOURCE ${index + 1}: ${SERVICE_BY_ID.get(response.serviceId)?.name ?? response.serviceId} / ${response.accountLabel}\n` +
        `${response.content.trim()}` +
        (response.notes.trim() ? `\n\nREVIEW NOTES\n${response.notes.trim()}` : "")
    );

  return `You are improving the results of a multi-provider research process.

PROJECT
${project.title}

ORIGINAL REQUEST
${round.question.trim()}

COLLECTED RESPONSES

${sources.join("\n\n---\n\n")}

TASK
Do not merely summarize the responses. Create an optimized answer that:
- preserves the strongest and most useful information from every source;
- compares claims, evidence, assumptions, and approaches;
- identifies contradictions instead of hiding them;
- resolves contradictions only when the available evidence supports doing so;
- distinguishes facts, estimates, opinions, and unverified claims;
- removes duplication and weak or irrelevant material;
- fills important gaps when you can do so reliably;
- improves precision, depth, clarity, and practical usefulness;
- attributes important claims to their source when provenance matters;
- clearly lists anything that still requires verification.

OUTPUT
1. Optimized answer
2. Important agreements across sources
3. Contradictions and how they were handled
4. Remaining gaps or uncertainties
5. Recommended next questions or actions

The final result must be more accurate, complete, and actionable than any individual response.`;
}

function replaceProject(
  projects: ResearchProject[],
  project: ResearchProject
): ResearchProject[] {
  return [project, ...projects.filter((candidate) => candidate.id !== project.id)].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt)
  );
}

function responseUpdates(round: ResearchRound): ResearchResponseUpdate[] {
  return round.responses.map((response) => ({
    accountId: response.accountId,
    content: response.content,
    notes: response.notes,
    includeInOptimization: response.includeInOptimization
  }));
}

export function ResearchWorkspace({
  accounts,
  onRegisterCloseHandler,
  onClose,
  onOpenAccount
}: ResearchWorkspaceProps) {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<BroadcastMode>("standard");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [deliveryResults, setDeliveryResults] = useState<BroadcastDeliveryResult[]>([]);
  const [optimizerAccountId, setOptimizerAccountId] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followUpAccountIds, setFollowUpAccountIds] = useState<string[]>([]);
  const [includeOptimizedAnswer, setIncludeOptimizedAnswer] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [allowSensitiveData, setAllowSensitiveData] = useState(false);
  const [dirtyRoundIds, setDirtyRoundIds] = useState<Set<string>>(() => new Set());

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedRound =
    selectedProject?.rounds.find((round) => round.id === selectedRoundId) ??
    selectedProject?.rounds.at(-1);
  const targetLimitReached = targetIds.length >= MAX_TARGETS;

  useEffect(() => {
    let disposed = false;
    void window.desktop
      .listResearchProjects()
      .then((storedProjects) => {
        if (disposed) {
          return;
        }
        setProjects(storedProjects);
        const firstProject = storedProjects[0];
        if (firstProject) {
          setSelectedProjectId(firstProject.id);
          setSelectedRoundId(firstProject.rounds.at(-1)?.id ?? "");
        } else {
          setIsCreating(true);
        }
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load local research projects."
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (targetIds.length === 0 && accounts.length > 0) {
      setTargetIds(accounts.slice(0, MAX_TARGETS).map((account) => account.id));
    }
    if (!optimizerAccountId && accounts[0]) {
      setOptimizerAccountId(accounts[0].id);
    }
    if (followUpAccountIds.length === 0 && accounts.length > 0) {
      setFollowUpAccountIds(accounts.slice(0, MAX_TARGETS).map((account) => account.id));
    }
  }, [accounts, followUpAccountIds.length, optimizerAccountId, targetIds.length]);

  const updateSelectedRound = (
    update: (round: ResearchRound) => ResearchRound
  ): void => {
    if (!selectedProject || !selectedRound) {
      return;
    }
    const updatedRound = update(selectedRound);
    setDirtyRoundIds((current) => new Set(current).add(updatedRound.id));
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              rounds: project.rounds.map((round) =>
                round.id === updatedRound.id ? updatedRound : round
              )
            }
          : project
      )
    );
  };

  const updateResponse = (
    accountId: string,
    update: Partial<ResearchResponse>
  ): void => {
    updateSelectedRound((round) => ({
      ...round,
      responses: round.responses.map((response) => {
        if (response.accountId !== accountId) {
          return response;
        }
        const next = { ...response, ...update };
        if (update.content !== undefined) {
          if (update.content.trim()) {
            next.capturedAt = response.capturedAt ?? new Date().toISOString();
          } else {
            delete next.capturedAt;
          }
        }
        return next;
      })
    }));
  };

  const saveRound = async (): Promise<ResearchProject | null> => {
    if (!selectedProject || !selectedRound) {
      return null;
    }
    if (!dirtyRoundIds.has(selectedRound.id)) {
      return selectedProject;
    }
    setIsWorking(true);
    setError(null);
    try {
      const saved = await window.desktop.updateResearchRound(
        selectedProject.id,
        selectedRound.id,
        {
          responses: responseUpdates(selectedRound),
          optimizationPrompt: selectedRound.optimizationPrompt,
          optimizedAnswer: selectedRound.optimizedAnswer
        }
      );
      setProjects((current) => replaceProject(current, saved));
      setDirtyRoundIds((current) => {
        const next = new Set(current);
        next.delete(selectedRound.id);
        return next;
      });
      setMessage("Research round saved locally.");
      return saved;
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save this research round."
      );
      return null;
    } finally {
      setIsWorking(false);
    }
  };

  const createProject = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsWorking(true);
    try {
      const project = await window.desktop.createResearchProject({
        title,
        question,
        accountIds: targetIds,
        mode
      });
      setProjects((current) => replaceProject(current, project));
      setSelectedProjectId(project.id);
      setSelectedRoundId(project.rounds[0]?.id ?? "");
      setIsCreating(false);
      setTitle("");
      setQuestion("");
      const result = await window.desktop.broadcastResearchPrompt({
        accountIds: targetIds,
        prompt: question,
        mode,
        allowSensitiveData
      });
      setDeliveryResults(result.deliveries);
      setMessage(
        "Prompt delivered. Open each provider, then paste its final response into the matching card."
      );
      setAllowSensitiveData(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create or broadcast this research."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const generateOptimizationPrompt = (): void => {
    if (!selectedProject || !selectedRound) {
      return;
    }
    if (
      !selectedRound.responses.some(
        (response) => response.includeInOptimization && response.content.trim()
      )
    ) {
      setError("Add and include at least one provider response before optimizing.");
      return;
    }
    const prompt = buildOptimizationPrompt(selectedProject, selectedRound);
    if (prompt.length > MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH) {
      setError(
        "The selected responses exceed the optimization prompt limit. Shorten or exclude some material."
      );
      return;
    }
    updateSelectedRound((round) => ({ ...round, optimizationPrompt: prompt }));
    setAllowSensitiveData(false);
    setError(null);
    setMessage("Optimization prompt generated locally. Review it before sending.");
  };

  const sendOptimization = async (): Promise<void> => {
    if (!selectedProject || !selectedRound || !selectedRound.optimizationPrompt.trim()) {
      setError("Generate or enter an optimization prompt first.");
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      await window.desktop.updateResearchRound(selectedProject.id, selectedRound.id, {
        responses: responseUpdates(selectedRound),
        optimizationPrompt: selectedRound.optimizationPrompt,
        optimizedAnswer: selectedRound.optimizedAnswer
      });
      setDirtyRoundIds((current) => {
        const next = new Set(current);
        next.delete(selectedRound.id);
        return next;
      });
      const result = await window.desktop.broadcastResearchPrompt({
        accountIds: [optimizerAccountId],
        prompt: selectedRound.optimizationPrompt,
        mode: "standard",
        allowSensitiveData
      });
      setDeliveryResults(result.deliveries);
      setMessage(
        "Optimization sent. When the provider finishes, paste the optimized answer below."
      );
      setAllowSensitiveData(false);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Unable to send the optimization prompt."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const continueResearch = async (): Promise<void> => {
    if (!selectedProject || !selectedRound || !followUp.trim()) {
      setError("Describe the next question or improvement to continue the research.");
      return;
    }
    const nextQuestion = includeOptimizedAnswer && selectedRound.optimizedAnswer.trim()
      ? `[Current optimized result]\n${selectedRound.optimizedAnswer.trim()}\n\n[Next task]\n${followUp.trim()}`
      : followUp.trim();
    if (nextQuestion.length > 12_000) {
      setError(
        "The optimized result plus the next task exceeds the 12,000-character delivery limit. Shorten the result or continue without embedding it."
      );
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      await window.desktop.updateResearchRound(selectedProject.id, selectedRound.id, {
        responses: responseUpdates(selectedRound),
        optimizationPrompt: selectedRound.optimizationPrompt,
        optimizedAnswer: selectedRound.optimizedAnswer
      });
      setDirtyRoundIds((current) => {
        const next = new Set(current);
        next.delete(selectedRound.id);
        return next;
      });
      const project = await window.desktop.addResearchRound(selectedProject.id, {
        parentRoundId: selectedRound.id,
        question: nextQuestion,
        accountIds: followUpAccountIds,
        mode
      });
      setProjects((current) => replaceProject(current, project));
      const nextRound = project.rounds.at(-1);
      setSelectedRoundId(nextRound?.id ?? "");
      setFollowUp("");
      const result = await window.desktop.broadcastResearchPrompt({
        accountIds: followUpAccountIds,
        prompt: nextQuestion,
        mode,
        allowSensitiveData
      });
      setDeliveryResults(result.deliveries);
      setMessage("The next linked round was created and delivered.");
      setAllowSensitiveData(false);
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : "Unable to create the next research round."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const deleteProject = async (): Promise<void> => {
    if (!selectedProject) {
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const deleted = await window.desktop.deleteResearchProject(selectedProject.id);
      if (!deleted) {
        return;
      }
      const remaining = projects.filter((project) => project.id !== selectedProject.id);
      setProjects(remaining);
      const next = remaining[0];
      setSelectedProjectId(next?.id ?? "");
      setSelectedRoundId(next?.rounds.at(-1)?.id ?? "");
      setIsCreating(remaining.length === 0);
      setMessage("Research project deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this research project."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const openProvider = async (accountId: string): Promise<void> => {
    const saved = await saveRound();
    if (saved) {
      onOpenAccount(accountId);
    }
  };

  const requestClose = async (): Promise<void> => {
    if (await prepareToClose()) {
      onClose();
    }
  };

  const prepareToClose = async (): Promise<boolean> => {
    if (isWorking) {
      return false;
    }
    if (title.trim() || question.trim()) {
      if (
        !window.confirm(
          "Discard this new research draft? It has not been created or saved yet."
        )
      ) {
        return false;
      }
    }
    if (!isCreating && selectedProject && selectedRound) {
      return (await saveRound()) !== null;
    }
    return true;
  };

  const startNewResearch = async (): Promise<void> => {
    if (!isCreating && dirtyRoundIds.has(selectedRound?.id ?? "")) {
      const saved = await saveRound();
      if (!saved) {
        return;
      }
    }
    setIsCreating(true);
    setMode("standard");
    setError(null);
    setMessage(null);
  };

  const selectResearchProject = async (project: ResearchProject): Promise<void> => {
    if (dirtyRoundIds.has(selectedRound?.id ?? "")) {
      const saved = await saveRound();
      if (!saved) {
        return;
      }
    }
    const latestRound = project.rounds.at(-1);
    setSelectedProjectId(project.id);
    setSelectedRoundId(latestRound?.id ?? "");
    setMode(latestRound?.mode ?? "standard");
    setIsCreating(false);
    setError(null);
    setMessage(null);
  };

  const selectResearchRound = async (round: ResearchRound): Promise<void> => {
    if (round.id === selectedRound?.id) {
      return;
    }
    if (dirtyRoundIds.has(selectedRound?.id ?? "")) {
      const saved = await saveRound();
      if (!saved) {
        return;
      }
    }
    setSelectedRoundId(round.id);
    setMode(round.mode);
  };

  const broadcastCurrentRound = async (): Promise<void> => {
    if (!selectedRound) {
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const result = await window.desktop.broadcastResearchPrompt({
        accountIds: selectedRound.accountIds.filter((accountId) =>
          accounts.some((account) => account.id === accountId)
        ),
        prompt: selectedRound.question,
        mode: selectedRound.mode,
        allowSensitiveData
      });
      setDeliveryResults(result.deliveries);
      setMessage("This round was delivered again.");
      setAllowSensitiveData(false);
    } catch (broadcastError) {
      setError(
        broadcastError instanceof Error
          ? broadcastError.message
          : "Unable to broadcast this research round."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const selectedSourceCount = useMemo(
    () =>
      selectedRound?.responses.filter(
        (response) => response.includeInOptimization && response.content.trim()
      ).length ?? 0,
    [selectedRound]
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void requestClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });

  useEffect(() => {
    onRegisterCloseHandler(prepareToClose);
    return () => onRegisterCloseHandler(null);
  });

  return (
    <div className="modal-backdrop research-backdrop" role="presentation">
      <section
        aria-labelledby="research-title"
        aria-modal="true"
        className="research-dialog"
        role="dialog"
      >
        <header className="research-header">
          <div>
            <span>Multi-provider workspace</span>
            <h2 id="research-title">Research Lab</h2>
            <p>Collect, compare, optimize, and continue without losing earlier evidence.</p>
          </div>
          <button
            aria-label="Close Research Lab"
            disabled={isWorking}
            onClick={() => void requestClose()}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="research-layout">
          <aside className="research-projects">
            <button
              className="research-new"
              disabled={isWorking}
              onClick={() => void startNewResearch()}
              type="button"
            >
              + New research
            </button>
            {projects.map((project) => (
              <button
                className={project.id === selectedProjectId && !isCreating ? "is-active" : ""}
                disabled={isWorking}
                key={project.id}
                onClick={() => void selectResearchProject(project)}
                type="button"
              >
                <strong>{project.title}</strong>
                <small>{project.rounds.length} round{project.rounds.length === 1 ? "" : "s"}</small>
              </button>
            ))}
          </aside>

          <main className="research-content">
            {error ? <div className="research-alert is-error" role="alert">{error}</div> : null}
            {message ? <div className="research-alert" role="status">{message}</div> : null}

            {isCreating ? (
              <form className="research-create" onSubmit={(event) => void createProject(event)}>
                <div>
                  <span className="research-step">New project</span>
                  <h3>Start with the same question across providers</h3>
                  <p>The original prompt and every later round remain linked locally.</p>
                </div>
                <label>
                  Project title
                  <input
                    maxLength={120}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Italian CRM market research"
                    required
                    value={title}
                  />
                </label>
                <label>
                  Initial question
                  <textarea
                    maxLength={12_000}
                    onChange={(event) => {
                      setQuestion(event.target.value);
                      setAllowSensitiveData(false);
                    }}
                    placeholder="Ask the complete question you want every provider to answer..."
                    required
                    rows={7}
                    value={question}
                  />
                </label>
                <div className="research-mode-row">
                  <label>
                    Provider mode
                    <select
                      onChange={(event) => {
                        setMode(event.target.value as BroadcastMode);
                        setAllowSensitiveData(false);
                      }}
                      value={mode}
                    >
                      <option value="standard">Standard</option>
                      <option value="deep-research">Deep Research</option>
                    </select>
                  </label>
                  <label className="research-consent">
                    <input
                      checked={allowSensitiveData}
                      onChange={(event) => setAllowSensitiveData(event.target.checked)}
                      type="checkbox"
                    />
                    I reviewed the prompt and allow delivery if local protection detects sensitive data.
                  </label>
                </div>
                <fieldset className="research-targets">
                  <legend>Connected accounts ({targetIds.length}/8)</legend>
                  <div>
                    {accounts.map((account) => {
                      const checked = targetIds.includes(account.id);
                      return (
                        <label className={checked ? "is-selected" : ""} key={account.id}>
                          <input
                            checked={checked}
                            disabled={!checked && targetLimitReached}
                            onChange={() => {
                              setTargetIds((current) =>
                                current.includes(account.id)
                                  ? current.filter((id) => id !== account.id)
                                  : [...current, account.id]
                              );
                              setAllowSensitiveData(false);
                            }}
                            type="checkbox"
                          />
                          <strong>{account.label}</strong>
                          <small>{SERVICE_BY_ID.get(account.serviceId)?.name}</small>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <button
                  className="research-primary"
                  disabled={
                    isWorking ||
                    !title.trim() ||
                    !question.trim() ||
                    targetIds.length === 0
                  }
                  type="submit"
                >
                  {isWorking ? "Starting..." : "Start and broadcast"}
                </button>
              </form>
            ) : selectedProject && selectedRound ? (
              <>
                <div className="research-project-heading">
                  <div>
                    <span className="research-step">Active project</span>
                    <h3>{selectedProject.title}</h3>
                    <p>Updated {formatDateTime(selectedProject.updatedAt)}</p>
                  </div>
                  <button
                    className="research-danger"
                    disabled={isWorking}
                    onClick={() => void deleteProject()}
                    type="button"
                  >
                    Delete project
                  </button>
                </div>

                <fieldset
                  className="research-workspace-fields"
                  disabled={isWorking}
                >
                <nav className="research-rounds" aria-label="Research rounds">
                  {selectedProject.rounds.map((round, index) => (
                    <button
                      className={round.id === selectedRound.id ? "is-active" : ""}
                      key={round.id}
                      onClick={() => void selectResearchRound(round)}
                      type="button"
                    >
                      Round {index + 1}
                    </button>
                  ))}
                </nav>

                <section className="research-question">
                  <div>
                    <span>Question for this round</span>
                    <button
                      disabled={isWorking}
                      onClick={() => void broadcastCurrentRound()}
                      type="button"
                    >
                      Broadcast again
                    </button>
                  </div>
                  <p>{selectedRound.question}</p>
                </section>

                {deliveryResults.length > 0 ? (
                  <div className="research-deliveries">
                    {deliveryResults.map((delivery) => (
                      <span className={`is-${delivery.status}`} key={delivery.accountId}>
                        {SERVICE_BY_ID.get(delivery.serviceId)?.name}: {delivery.status}
                      </span>
                    ))}
                  </div>
                ) : null}
                <label className="research-consent research-active-consent">
                  <input
                    checked={allowSensitiveData}
                    onChange={(event) => setAllowSensitiveData(event.target.checked)}
                    type="checkbox"
                  />
                  Allow the next delivery only after reviewing its complete prompt if local
                  protection reports sensitive data. This consent resets after every send or edit.
                </label>

                <section className="research-section">
                  <header>
                    <div>
                      <span className="research-step">1. Collect and compare</span>
                      <h4>Provider responses</h4>
                      <p>Paste the final responses here. Raw content remains editable and local.</p>
                    </div>
                    <button
                      className="research-secondary"
                      disabled={isWorking}
                      onClick={() => void saveRound()}
                      type="button"
                    >
                      Save responses
                    </button>
                  </header>
                  <div className="research-response-grid">
                    {selectedRound.responses.map((response) => (
                      <article key={response.accountId}>
                        <header>
                          <div>
                            <strong>{response.accountLabel}</strong>
                            <small>{SERVICE_BY_ID.get(response.serviceId)?.name}</small>
                          </div>
                          <button
                            disabled={isWorking}
                            onClick={() => void openProvider(response.accountId)}
                            type="button"
                          >
                            Open provider
                          </button>
                        </header>
                        <textarea
                          maxLength={MAX_RESEARCH_RESPONSE_LENGTH}
                          onChange={(event) =>
                            updateResponse(response.accountId, { content: event.target.value })
                          }
                          placeholder="Paste this provider's complete response..."
                          rows={12}
                          value={response.content}
                        />
                        <label className="research-notes">
                          Review notes
                          <textarea
                            maxLength={4_000}
                            onChange={(event) =>
                              updateResponse(response.accountId, { notes: event.target.value })
                            }
                            placeholder="Strengths, weaknesses, claims to verify..."
                            rows={3}
                            value={response.notes}
                          />
                        </label>
                        <label className="research-include">
                          <input
                            checked={response.includeInOptimization}
                            onChange={(event) =>
                              updateResponse(response.accountId, {
                                includeInOptimization: event.target.checked
                              })
                            }
                            type="checkbox"
                          />
                          Include in optimized result
                        </label>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="research-section">
                  <header>
                    <div>
                      <span className="research-step">2. Optimize</span>
                      <h4>Create a better result</h4>
                      <p>
                        Build a transparent prompt from {selectedSourceCount} selected response
                        {selectedSourceCount === 1 ? "" : "s"}.
                      </p>
                    </div>
                    <button
                      className="research-secondary"
                      onClick={generateOptimizationPrompt}
                      type="button"
                    >
                      Generate optimization prompt
                    </button>
                  </header>
                  <textarea
                    className="research-optimization-prompt"
                    maxLength={MAX_RESEARCH_OPTIMIZATION_PROMPT_LENGTH}
                    onChange={(event) =>
                      {
                        updateSelectedRound((round) => ({
                          ...round,
                          optimizationPrompt: event.target.value
                        }));
                        setAllowSensitiveData(false);
                      }
                    }
                    placeholder="The generated optimization prompt will appear here and remain fully editable."
                    rows={14}
                    value={selectedRound.optimizationPrompt}
                  />
                  <div className="research-send-row">
                    <label>
                      Optimize with
                      <select
                        onChange={(event) => {
                          setOptimizerAccountId(event.target.value);
                          setAllowSensitiveData(false);
                        }}
                        value={optimizerAccountId}
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.label} · {SERVICE_BY_ID.get(account.serviceId)?.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="research-primary"
                      disabled={
                        isWorking ||
                        !optimizerAccountId ||
                        !selectedRound.optimizationPrompt.trim()
                      }
                      onClick={() => void sendOptimization()}
                      type="button"
                    >
                      Send optimization
                    </button>
                  </div>
                  <label className="research-optimized-answer">
                    Optimized answer
                    <textarea
                      maxLength={MAX_RESEARCH_RESPONSE_LENGTH}
                      onChange={(event) =>
                        {
                          updateSelectedRound((round) => ({
                            ...round,
                            optimizedAnswer: event.target.value
                          }));
                          setAllowSensitiveData(false);
                        }
                      }
                      placeholder="Paste the optimized answer returned by the selected provider..."
                      rows={10}
                      value={selectedRound.optimizedAnswer}
                    />
                  </label>
                </section>

                <section className="research-section">
                  <header>
                    <div>
                      <span className="research-step">3. Continue</span>
                      <h4>Create the next linked round</h4>
                      <p>Use what you learned to ask a deeper or more precise question.</p>
                    </div>
                  </header>
                  <textarea
                    maxLength={12_000}
                    onChange={(event) => {
                      setFollowUp(event.target.value);
                      setAllowSensitiveData(false);
                    }}
                    placeholder="What should the providers investigate, verify, or improve next?"
                    rows={5}
                    value={followUp}
                  />
                  <label className="research-consent">
                    <input
                      checked={includeOptimizedAnswer}
                      onChange={(event) => {
                        setIncludeOptimizedAnswer(event.target.checked);
                        setAllowSensitiveData(false);
                      }}
                      type="checkbox"
                    />
                    Include the current optimized answer as context for the next round.
                  </label>
                  <fieldset className="research-follow-up-targets">
                    <legend>Send next round to</legend>
                    <div>
                      {accounts.map((account) => {
                        const checked = followUpAccountIds.includes(account.id);
                        return (
                          <label className={checked ? "is-selected" : ""} key={account.id}>
                            <input
                              checked={checked}
                              disabled={!checked && followUpAccountIds.length >= MAX_TARGETS}
                              onChange={() => {
                                setFollowUpAccountIds((current) =>
                                  current.includes(account.id)
                                    ? current.filter((id) => id !== account.id)
                                    : [...current, account.id]
                                );
                                setAllowSensitiveData(false);
                              }}
                              type="checkbox"
                            />
                            {account.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <button
                    className="research-primary"
                    disabled={
                      isWorking || !followUp.trim() || followUpAccountIds.length === 0
                    }
                    onClick={() => void continueResearch()}
                    type="button"
                  >
                    {isWorking ? "Creating round..." : "Create and broadcast next round"}
                  </button>
                </section>
                </fieldset>
              </>
            ) : (
              <p className="research-empty">Create a research project to begin.</p>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { parseGeoQuestionFile } from "../shared/geo-import";
import { SERVICE_BY_ID } from "../shared/services";
import type {
  GeoResult,
  GeoStudy,
  ImportedGeoQuestion,
  UpdateGeoResultInput
} from "../shared/geo-types";
import type { AccountProfile, BroadcastMode } from "../shared/types";

interface UseCasesWorkspaceProps {
  accounts: AccountProfile[];
  onClose(): void;
  onOpenAccount(accountId: string): void;
  onRegisterCloseHandler(handler: (() => Promise<boolean>) | null): void;
}

function replaceStudy(studies: GeoStudy[], study: GeoStudy): GeoStudy[] {
  return [study, ...studies.filter((candidate) => candidate.id !== study.id)].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt)
  );
}

function statusLabel(status: GeoResult["status"]): string {
  const labels: Record<GeoResult["status"], string> = {
    pending: "Pending",
    sending: "Sending",
    waiting: "Waiting",
    captured: "Captured",
    "needs-review": "Review",
    blocked: "Blocked",
    failed: "Failed",
    skipped: "Skipped"
  };
  return labels[status];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function UseCasesWorkspace({
  accounts,
  onClose,
  onOpenAccount,
  onRegisterCloseHandler
}: UseCasesWorkspaceProps) {
  const [studies, setStudies] = useState<GeoStudy[]>([]);
  const [activeUseCase, setActiveUseCase] = useState<"catalog" | "geo">("catalog");
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<BroadcastMode>("standard");
  const [allowSensitiveData, setAllowSensitiveData] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ImportedGeoQuestion[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<
    Record<string, UpdateGeoResultInput>
  >({});
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedStudy = studies.find((study) => study.id === selectedStudyId);
  const selectedQuestion =
    selectedStudy?.questions.find((question) => question.id === selectedQuestionId) ??
    selectedStudy?.questions[0];
  const selectedResults =
    selectedStudy?.results.filter(
      (result) => result.questionId === selectedQuestion?.id
    ) ?? [];

  useEffect(() => {
    let disposed = false;
    void window.desktop
      .listGeoStudies()
      .then((storedStudies) => {
        if (disposed) {
          return;
        }
        setStudies(storedStudies);
        const first = storedStudies[0];
        if (first) {
          setSelectedStudyId(first.id);
          setSelectedQuestionId(first.questions[0]?.id ?? "");
        } else {
          setIsCreating(true);
        }
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load GEO studies."
          );
        }
      });
    const unsubscribe = window.desktop.onGeoStudyProgress((progress) => {
      setStudies((current) =>
        current.map((study) =>
          study.id !== progress.studyId
            ? study
            : {
                ...study,
                status: progress.status,
                updatedAt: progress.updatedAt,
                pauseReason: progress.pauseReason,
                startedAt: progress.startedAt,
                completedAt: progress.completedAt,
                results: progress.result
                  ? study.results.map((result) =>
                      result.id === progress.result?.id ? progress.result : result
                    )
                  : study.results
              }
        )
      );
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accountIds.length === 0 && accounts.length > 0) {
      setAccountIds(accounts.slice(0, 3).map((account) => account.id));
    }
  }, [accountIds.length, accounts]);

  const saveDraftResults = async (): Promise<boolean> => {
    if (!selectedStudy || Object.keys(resultDrafts).length === 0) {
      return true;
    }
    setIsWorking(true);
    setError(null);
    try {
      let latest = selectedStudy;
      for (const [resultId, input] of Object.entries(resultDrafts)) {
        latest = await window.desktop.updateGeoResult(
          selectedStudy.id,
          resultId,
          input
        );
      }
      setStudies((current) => replaceStudy(current, latest));
      setResultDrafts({});
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save GEO result edits."
      );
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  const hasCreateDraft =
    title.trim().length > 0 ||
    brandName.trim().length > 0 ||
    domain.trim().length > 0 ||
    questions.length > 0 ||
    questionText.trim().length > 0;

  const prepareToClose = async (): Promise<boolean> => {
    if (isWorking) {
      return false;
    }
    if (selectedStudy?.status === "running") {
      try {
        await window.desktop.pauseGeoStudy(selectedStudy.id);
      } catch (pauseError) {
        setError(
          pauseError instanceof Error
            ? pauseError.message
            : "Unable to pause the active GEO batch."
        );
        return false;
      }
    }
    if (!(await saveDraftResults())) {
      return false;
    }
    if (
      hasCreateDraft &&
      !window.confirm("Discard the new GEO study draft? It has not been created yet.")
    ) {
      return false;
    }
    return true;
  };

  useEffect(() => {
    onRegisterCloseHandler(prepareToClose);
    return () => onRegisterCloseHandler(null);
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void prepareToClose().then((canClose) => {
          if (canClose) {
            onClose();
          }
        });
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });

  const importFile = async (file: File): Promise<void> => {
    setError(null);
    try {
      const result = parseGeoQuestionFile(await file.text(), file.name);
      setQuestions(result.questions);
      setQuestionText("");
      setImportMessage(
        `${result.questions.length} questions imported${
          result.duplicateCount > 0
            ? `; ${result.duplicateCount} duplicates removed`
            : ""
        }.`
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import this question file."
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const usePastedQuestions = (): void => {
    try {
      const result = parseGeoQuestionFile(questionText, "questions.txt");
      setQuestions(result.questions);
      setImportMessage(
        `${result.questions.length} questions added${
          result.duplicateCount > 0
            ? `; ${result.duplicateCount} duplicates removed`
            : ""
        }.`
      );
      setError(null);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Unable to parse the question list."
      );
    }
  };

  const createStudy = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setIsWorking(true);
    setError(null);
    try {
      const study = await window.desktop.createGeoStudy({
        title,
        brandName,
        ...(domain.trim() ? { domain: domain.trim() } : {}),
        mode,
        allowSensitiveData,
        accountIds,
        questions
      });
      setStudies((current) => replaceStudy(current, study));
      setSelectedStudyId(study.id);
      setSelectedQuestionId(study.questions[0]?.id ?? "");
      setIsCreating(false);
      setTitle("");
      setBrandName("");
      setDomain("");
      setQuestions([]);
      setQuestionText("");
      setAllowSensitiveData(false);
      setImportMessage(null);
      setMessage(
        "GEO study created. Start the supervised batch when every selected account is signed in."
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the GEO study."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const startStudy = async (): Promise<void> => {
    if (!selectedStudy) {
      return;
    }
    if (!(await saveDraftResults())) {
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const study = await window.desktop.startGeoStudy(selectedStudy.id);
      setStudies((current) => replaceStudy(current, study));
      setMessage(
        "Supervised batch started. Keep AI Workspace open; it will pause on CAPTCHA, rate limits, or capture uncertainty."
      );
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start the GEO batch."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const pauseStudy = async (): Promise<void> => {
    if (!selectedStudy) {
      return;
    }
    setIsWorking(true);
    try {
      const study = await window.desktop.pauseGeoStudy(selectedStudy.id);
      setStudies((current) => replaceStudy(current, study));
      setMessage("Pause requested. The current capture will stop safely.");
    } catch (pauseError) {
      setError(
        pauseError instanceof Error ? pauseError.message : "Unable to pause the GEO batch."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const retryFailures = async (): Promise<void> => {
    if (!selectedStudy) {
      return;
    }
    setIsWorking(true);
    try {
      const study = await window.desktop.retryGeoStudyFailures(selectedStudy.id);
      setStudies((current) => replaceStudy(current, study));
      setMessage("Failed, blocked, and uncertain captures were queued again.");
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Unable to queue failed GEO results."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const deleteStudy = async (): Promise<void> => {
    if (!selectedStudy) {
      return;
    }
    setIsWorking(true);
    try {
      const deleted = await window.desktop.deleteGeoStudy(selectedStudy.id);
      if (!deleted) {
        return;
      }
      const remaining = studies.filter((study) => study.id !== selectedStudy.id);
      setStudies(remaining);
      setSelectedStudyId(remaining[0]?.id ?? "");
      setSelectedQuestionId(remaining[0]?.questions[0]?.id ?? "");
      setIsCreating(remaining.length === 0);
      setMessage("GEO study deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the GEO study."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const chooseStudy = async (study: GeoStudy): Promise<void> => {
    if (!(await saveDraftResults())) {
      return;
    }
    if (
      hasCreateDraft &&
      !window.confirm("Discard the current new GEO study draft?")
    ) {
      return;
    }
    setTitle("");
    setBrandName("");
    setDomain("");
    setQuestions([]);
    setQuestionText("");
    setImportMessage(null);
    setSelectedStudyId(study.id);
    setSelectedQuestionId(study.questions[0]?.id ?? "");
    setResultDrafts({});
    setIsCreating(false);
    setError(null);
    setMessage(null);
  };

  const startCreatingStudy = async (): Promise<void> => {
    if (!(await saveDraftResults())) {
      return;
    }
    setResultDrafts({});
    setIsCreating(true);
    setError(null);
    setMessage(null);
  };

  const chooseQuestion = async (questionId: string): Promise<void> => {
    if (!(await saveDraftResults())) {
      return;
    }
    setSelectedQuestionId(questionId);
    setResultDrafts({});
  };

  const openProvider = async (accountId: string): Promise<void> => {
    if (selectedStudy?.status === "running") {
      setError("Pause the GEO batch before opening a provider.");
      return;
    }
    if (await saveDraftResults()) {
      onOpenAccount(accountId);
    }
  };

  const progress = useMemo(() => {
    if (!selectedStudy) {
      return { completed: 0, total: 0 };
    }
    return {
      completed: selectedStudy.results.filter((result) =>
        ["captured", "needs-review", "failed", "blocked", "skipped"].includes(
          result.status
        )
      ).length,
      total: selectedStudy.results.length
    };
  }, [selectedStudy]);

  const providerSummaries = useMemo(() => {
    if (!selectedStudy) {
      return [];
    }
    const brandKey = selectedStudy.brandName.normalize("NFKC").toLocaleLowerCase();
    const domainKey = selectedStudy.domain
      ?.replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.toLocaleLowerCase();
    return selectedStudy.accountIds.map((accountId) => {
      const results = selectedStudy.results.filter(
        (result) => result.accountId === accountId
      );
      const completed = results.filter(
        (result) =>
          (result.status === "captured" || result.status === "needs-review") &&
          result.response.trim()
      );
      return {
        accountId,
        accountLabel: results[0]?.accountLabel ?? "Account",
        serviceId: results[0]?.serviceId,
        captured: completed.length,
        mentions: completed.filter((result) =>
          result.response.normalize("NFKC").toLocaleLowerCase().includes(brandKey)
        ).length,
        cited: domainKey
          ? completed.filter((result) =>
              result.citations.some((citation) => {
                try {
                  const host = new URL(citation.url).hostname
                    .replace(/^www\./i, "")
                    .toLocaleLowerCase();
                  return host === domainKey || host.endsWith(`.${domainKey}`);
                } catch {
                  return false;
                }
              })
            ).length
          : 0,
        verified: completed.filter((result) => result.verified).length
      };
    });
  }, [selectedStudy]);

  return (
    <div className="modal-backdrop use-cases-backdrop" role="presentation">
      <section
        aria-labelledby="use-cases-title"
        aria-modal="true"
        className="use-cases-dialog"
        role="dialog"
      >
        <header className="use-cases-header">
          <div>
            <span>Repeatable workflows</span>
            <h2 id="use-cases-title">
              {activeUseCase === "catalog" ? "Use Cases" : "GEO visibility"}
            </h2>
            <p>
              {activeUseCase === "catalog"
                ? "Choose a purpose-built workflow for your connected AI subscriptions."
                : "Run and review supervised visibility studies across AI providers."}
            </p>
          </div>
          <button
            aria-label="Close Use Cases"
            disabled={isWorking || selectedStudy?.status === "running"}
            onClick={() =>
              void prepareToClose().then((canClose) => {
                if (canClose) {
                  onClose();
                }
              })
            }
            type="button"
          >
            ×
          </button>
        </header>

        <div className={`use-cases-layout ${activeUseCase === "catalog" ? "is-catalog" : ""}`}>
          {activeUseCase === "catalog" ? (
            <main className="use-cases-home">
              <div className="use-cases-home-heading">
                <span className="geo-kicker">Workflow library</span>
                <h3>What do you want to accomplish?</h3>
                <p>
                  Each use case provides a dedicated workflow, data model and result view.
                </p>
              </div>
              <div className="use-case-grid">
                <button
                  className="use-case-tile is-available"
                  onClick={() => setActiveUseCase("geo")}
                  type="button"
                >
                  <span className="use-case-tile-icon" aria-hidden="true">G</span>
                  <span className="use-case-tile-copy">
                    <span>Available now</span>
                    <strong>GEO visibility study</strong>
                    <p>
                      Broadcast question sets, collect provider answers and inspect citations in
                      one supervised workspace.
                    </p>
                    <small>Open workflow →</small>
                  </span>
                </button>
                <article className="use-case-tile is-coming">
                  <span className="use-case-tile-icon" aria-hidden="true">+</span>
                  <span className="use-case-tile-copy">
                    <span>Designed to grow</span>
                    <strong>More use cases can live here</strong>
                    <p>
                      Future specialized workflows will appear in this library without crowding
                      the main navigation.
                    </p>
                    <small>Coming later</small>
                  </span>
                </article>
              </div>
              <section className="use-cases-account-note">
                <div>
                  <strong>{accounts.length} connected account{accounts.length === 1 ? "" : "s"}</strong>
                  <span>
                    GEO needs at least one connected account. Accounts can be managed from the
                    compact account menu in the main sidebar.
                  </span>
                </div>
              </section>
            </main>
          ) : (
            <>
          <aside className="use-case-catalog">
            <button
              className="use-cases-back"
              disabled={isWorking || selectedStudy?.status === "running"}
              onClick={() => setActiveUseCase("catalog")}
              type="button"
            >
              ← All use cases
            </button>
            <div className="use-case-card is-active">
              <span>Active workflow</span>
              <strong>GEO visibility study</strong>
              <p>Broadcast question sets and collect provider answers automatically.</p>
            </div>
            <button
              className="geo-new-study"
              disabled={isWorking || selectedStudy?.status === "running"}
              onClick={() => void startCreatingStudy()}
              type="button"
            >
              + New GEO study
            </button>
            <nav className="geo-study-list" aria-label="GEO studies">
              {studies.map((study) => (
                <button
                  className={!isCreating && study.id === selectedStudyId ? "is-active" : ""}
                  disabled={isWorking || selectedStudy?.status === "running"}
                  key={study.id}
                  onClick={() => void chooseStudy(study)}
                  type="button"
                >
                  <strong>{study.title}</strong>
                  <small>
                    {study.questions.length} questions · {study.status}
                  </small>
                </button>
              ))}
            </nav>
          </aside>

          <main className="geo-workspace">
            {error ? <div className="geo-alert is-error" role="alert">{error}</div> : null}
            {message ? <div className="geo-alert" role="status">{message}</div> : null}

            {isCreating ? (
              <form className="geo-create-form" onSubmit={(event) => void createStudy(event)}>
                <div>
                  <span className="geo-kicker">GEO setup</span>
                  <h3>Create a visibility study</h3>
                  <p>
                    Import the questions people use to discover or compare your brand, then run
                    them across selected providers.
                  </p>
                </div>
                <div className="geo-form-grid">
                  <label>
                    Study title
                    <input
                      maxLength={120}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Q4 brand visibility benchmark"
                      required
                      value={title}
                    />
                  </label>
                  <label>
                    Brand or entity
                    <input
                      maxLength={120}
                      onChange={(event) => setBrandName(event.target.value)}
                      placeholder="Contoso"
                      required
                      value={brandName}
                    />
                  </label>
                  <label>
                    Domain (optional)
                    <input
                      maxLength={253}
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="contoso.com"
                      value={domain}
                    />
                  </label>
                  <label>
                    Provider mode
                    <select
                      onChange={(event) => setMode(event.target.value as BroadcastMode)}
                      value={mode}
                    >
                      <option value="standard">Standard</option>
                      <option value="deep-research">Deep Research</option>
                    </select>
                  </label>
                </div>

                <fieldset className="geo-account-picker">
                  <legend>Providers ({accountIds.length}/8)</legend>
                  <div>
                    {accounts.map((account) => {
                      const checked = accountIds.includes(account.id);
                      return (
                        <label className={checked ? "is-selected" : ""} key={account.id}>
                          <input
                            checked={checked}
                            disabled={!checked && accountIds.length >= 8}
                            onChange={() =>
                              setAccountIds((current) =>
                                current.includes(account.id)
                                  ? current.filter((id) => id !== account.id)
                                  : [...current, account.id]
                              )
                            }
                            type="checkbox"
                          />
                          <strong>{account.label}</strong>
                          <small>{SERVICE_BY_ID.get(account.serviceId)?.name}</small>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <section className="geo-import">
                  <header>
                    <div>
                      <strong>Question list</strong>
                      <span>
                        CSV: use a <code>question</code> or <code>domanda</code> column and an
                        optional <code>category</code>. TXT: one question per line.
                      </span>
                    </div>
                    <button
                      className="geo-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Upload CSV or TXT
                    </button>
                    <input
                      accept=".csv,.txt,text/csv,text/plain"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void importFile(file);
                        }
                      }}
                      ref={fileInputRef}
                      type="file"
                    />
                  </header>
                  <textarea
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder={"Or paste one question per line:\nWhat are the best tools for ...?\nWhich brands are recommended for ...?"}
                    rows={7}
                    value={questionText}
                  />
                  <div className="geo-import-actions">
                    <span>{importMessage ?? `${questions.length} questions ready`}</span>
                    <button
                      className="geo-secondary"
                      disabled={!questionText.trim()}
                      onClick={usePastedQuestions}
                      type="button"
                    >
                      Use pasted questions
                    </button>
                  </div>
                  {questions.length > 0 ? (
                    <ol className="geo-question-preview">
                      {questions.slice(0, 10).map((question, index) => (
                        <li key={`${question.text}-${index}`}>
                          {question.category ? <span>{question.category}</span> : null}
                          {question.text}
                        </li>
                      ))}
                      {questions.length > 10 ? (
                        <li>+ {questions.length - 10} more questions</li>
                      ) : null}
                    </ol>
                  ) : null}
                </section>

                <div className="geo-disclaimer">
                  <strong>Supervised subscription workflow</strong>
                  <span>
                    Questions run one at a time. Keep the app open and respect each provider’s
                    terms and usage limits. The batch pauses on CAPTCHA, rate-limit signals, or
                    uncertain capture; official APIs are recommended for large volumes.
                  </span>
                </div>
                <label className="geo-sensitive-consent">
                  <input
                    checked={allowSensitiveData}
                    onChange={(event) => setAllowSensitiveData(event.target.checked)}
                    type="checkbox"
                  />
                  I reviewed the imported questions and allow sending if local protection detects
                  potentially sensitive data.
                </label>
                <button
                  className="geo-primary"
                  disabled={
                    isWorking ||
                    !title.trim() ||
                    !brandName.trim() ||
                    accountIds.length === 0 ||
                    questions.length === 0
                  }
                  type="submit"
                >
                  {isWorking ? "Creating..." : "Create GEO study"}
                </button>
              </form>
            ) : selectedStudy ? (
              <>
                <div className="geo-study-heading">
                  <div>
                    <span className="geo-kicker">GEO visibility</span>
                    <h3>{selectedStudy.title}</h3>
                    <p>
                      {selectedStudy.brandName}
                      {selectedStudy.domain ? ` · ${selectedStudy.domain}` : ""} · Updated{" "}
                      {formatDateTime(selectedStudy.updatedAt)}
                    </p>
                  </div>
                  <div className="geo-study-actions">
                    {selectedStudy.status === "running" ? (
                      <button
                        className="geo-secondary"
                        disabled={isWorking}
                        onClick={() => void pauseStudy()}
                        type="button"
                      >
                        Pause batch
                      </button>
                    ) : (
                      <button
                        className="geo-primary"
                        disabled={
                          isWorking ||
                          !selectedStudy.results.some((result) => result.status === "pending")
                        }
                        onClick={() => void startStudy()}
                        type="button"
                      >
                        {selectedStudy.startedAt ? "Resume batch" : "Start batch"}
                      </button>
                    )}
                    <button
                      className="geo-secondary"
                      disabled={isWorking || selectedStudy.status === "running"}
                      onClick={() => void retryFailures()}
                      type="button"
                    >
                      Retry issues
                    </button>
                    <button
                      className="geo-danger"
                      disabled={isWorking || selectedStudy.status === "running"}
                      onClick={() => void deleteStudy()}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <section className="geo-progress">
                  <div>
                    <strong>{progress.completed} / {progress.total}</strong>
                    <span>provider answers processed</span>
                  </div>
                  <progress max={Math.max(progress.total, 1)} value={progress.completed} />
                  <span className={`geo-study-status is-${selectedStudy.status}`}>
                    {selectedStudy.status}
                  </span>
                </section>
                {selectedStudy.pauseReason ? (
                  <div className="geo-pause-reason" role="status">
                    {selectedStudy.pauseReason}
                  </div>
                ) : null}

                <section className="geo-provider-summary">
                  {providerSummaries.map((summary) => (
                    <article key={summary.accountId}>
                      <strong>{summary.accountLabel}</strong>
                      <span>{summary.captured} answers</span>
                      <dl>
                        <div>
                          <dt>Brand mentioned</dt>
                          <dd>{summary.mentions}</dd>
                        </div>
                        <div>
                          <dt>Domain cited</dt>
                          <dd>{selectedStudy.domain ? summary.cited : "—"}</dd>
                        </div>
                        <div>
                          <dt>Verified</dt>
                          <dd>{summary.verified}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </section>

                <section className="geo-matrix-section">
                  <header>
                    <div>
                      <span className="geo-kicker">Questions and results</span>
                      <h4>Response matrix</h4>
                    </div>
                    <span>Select a row to inspect raw answers and citations.</span>
                  </header>
                  <div
                    className="geo-matrix"
                    style={{
                      "--geo-columns": selectedStudy.accountIds.length
                    } as React.CSSProperties}
                  >
                    <div className="geo-matrix-header">
                      <span>Question</span>
                      {selectedStudy.accountIds.map((accountId) => {
                        const result = selectedStudy.results.find(
                          (candidate) => candidate.accountId === accountId
                        );
                        return <span key={accountId}>{result?.accountLabel ?? "Account"}</span>;
                      })}
                    </div>
                    {selectedStudy.questions.map((question) => (
                      <button
                        className={question.id === selectedQuestion?.id ? "is-active" : ""}
                        disabled={isWorking}
                        key={question.id}
                        onClick={() => void chooseQuestion(question.id)}
                        type="button"
                      >
                        <span className="geo-question-cell">
                          {question.category ? <small>{question.category}</small> : null}
                          <strong>{question.text}</strong>
                        </span>
                        {selectedStudy.accountIds.map((accountId) => {
                          const result = selectedStudy.results.find(
                            (candidate) =>
                              candidate.questionId === question.id &&
                              candidate.accountId === accountId
                          );
                          return (
                            <span
                              className={`geo-result-status is-${result?.status ?? "pending"}`}
                              key={accountId}
                            >
                              {statusLabel(result?.status ?? "pending")}
                            </span>
                          );
                        })}
                      </button>
                    ))}
                  </div>
                </section>

                {selectedQuestion ? (
                  <section className="geo-result-detail">
                    <header>
                      <div>
                        <span className="geo-kicker">Selected question</span>
                        <h4>{selectedQuestion.text}</h4>
                      </div>
                    </header>
                    <div className="geo-result-grid">
                      {selectedResults.map((result) => {
                        const draft = resultDrafts[result.id] ?? {
                          response: result.response,
                          verified: result.verified
                        };
                        return (
                          <article key={result.id}>
                            <header>
                              <div>
                                <strong>{result.accountLabel}</strong>
                                <small>{SERVICE_BY_ID.get(result.serviceId)?.name}</small>
                              </div>
                              <span className={`geo-result-status is-${result.status}`}>
                                {statusLabel(result.status)}
                              </span>
                            </header>
                            {result.error ? (
                              <div className="geo-result-error">{result.error}</div>
                            ) : null}
                            <textarea
                              disabled={isWorking || selectedStudy.status === "running"}
                              onChange={(event) =>
                                setResultDrafts((current) => ({
                                  ...current,
                                  [result.id]: {
                                    response: event.target.value,
                                    verified: draft.verified
                                  }
                                }))
                              }
                              placeholder="The automatic capture will appear here. You can correct or paste the response manually when the batch is paused."
                              rows={12}
                              value={draft.response}
                            />
                            {result.citations.length > 0 ? (
                              <details>
                                <summary>{result.citations.length} captured citations</summary>
                                <ul>
                                  {result.citations.map((citation) => (
                                    <li key={citation.url}>
                                      <span>{citation.label || citation.url}</span>
                                      <small>{citation.url}</small>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            <footer>
                              <label>
                                <input
                                  checked={draft.verified}
                                  disabled={isWorking || selectedStudy.status === "running"}
                                  onChange={(event) =>
                                    setResultDrafts((current) => ({
                                      ...current,
                                      [result.id]: {
                                        response: draft.response,
                                        verified: event.target.checked
                                      }
                                    }))
                                  }
                                  type="checkbox"
                                />
                                Human verified
                              </label>
                              <button
                                disabled={isWorking}
                                onClick={() => void openProvider(result.accountId)}
                                type="button"
                              >
                                Open provider
                              </button>
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                    <button
                      className="geo-secondary geo-save-results"
                      disabled={isWorking || Object.keys(resultDrafts).length === 0}
                      onClick={() => void saveDraftResults()}
                      type="button"
                    >
                      Save result corrections
                    </button>
                  </section>
                ) : null}
              </>
            ) : (
              <p className="geo-empty">Create a GEO study to begin.</p>
            )}
          </main>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

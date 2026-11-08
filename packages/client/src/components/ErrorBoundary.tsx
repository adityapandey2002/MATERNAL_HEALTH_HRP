import { Component, type ErrorInfo, type ReactNode } from "react";
import { buildLabel } from "../lib/version";
import { AlertTriangleIcon } from "./ui/Icons";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Where the failure happened, shown in the panel and the console log. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence for a render crash.
 *
 * React unmounts the whole tree when a component throws during render, which
 * on a phone looks like a completely blank white screen with no way back and
 * no clue what happened. This boundary keeps a readable panel on screen with
 * the message, the build and a reload button, so a field report can name the
 * actual fault.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the first argument a literal: semgrep flags interpolated console
    // format strings because a value can forge the message.
    console.error("[ui] screen crashed", {
      label: this.props.label ?? "screen",
      error,
      componentStack: info.componentStack,
    });
  }

  private reload = (): void => {
    window.location.reload();
  };

  private copyDetails = (): void => {
    const { error } = this.state;
    const details = [
      `Matru Suraksha ${buildLabel()}`,
      `Screen: ${this.props.label ?? "unknown"}`,
      `Error: ${error?.name ?? "Error"}: ${error?.message ?? "unknown"}`,
      error?.stack ?? "",
    ].join("\n");

    void navigator.clipboard?.writeText(details).catch(() => {
      // Clipboard permission is not worth another failure path; the panel
      // already shows the message on screen.
    });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-triage-red-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-triage-red-bg text-triage-red"
            >
              <AlertTriangleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-ink">This screen stopped responding</h1>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                The app hit an unexpected error. Records already saved on this device are safe.
              </p>
            </div>
          </div>

          <p className="mt-4 break-words rounded border border-line-soft bg-canvas px-3 py-2 text-xs text-ink-muted">
            {error.message || error.name}
          </p>

          <p className="mt-2 text-2xs uppercase tracking-wide text-ink-subtle">
            Build {buildLabel()}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={this.reload}>
              Reload the app
            </button>
            <button type="button" className="btn btn-secondary" onClick={this.copyDetails}>
              Copy details
            </button>
          </div>
        </div>
      </div>
    );
  }
}

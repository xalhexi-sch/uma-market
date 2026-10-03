// =============================================================================
// UMA Market — independent-step cleanup runner (browser regression specs)
//
// Pure helper: no environment, no network. Lives apart from harness.ts (which
// loads credentials at import time) so its contract is deterministically
// testable by scripts/verify-safety-guards.ts.
//
// CONTRACT
//   1. Every step runs, in order, regardless of earlier failures.
//   2. A failing step is never silently ignored: its name and message are
//      returned to the caller, which must report them.
//   3. A step failure never prevents later steps (e.g. deleting synthetic Clerk
//      users) from running.
// =============================================================================

export interface CleanupStep {
  /** Human-readable label used in the failure report. */
  name: string;
  run: () => Promise<void>;
}

/** Runs every step independently and returns one message per failed step. */
export async function runCleanupSteps(steps: CleanupStep[]): Promise<string[]> {
  const failures: string[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${step.name}: ${message}`);
    }
  }
  return failures;
}

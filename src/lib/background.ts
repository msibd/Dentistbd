import { after } from "next/server";
import { logger } from "@/lib/logger";

// Work started outside a Next.js request (scripts, tests), so callers can wait for it to finish.
const pending = new Set<Promise<unknown>>();

/**
 * Runs work after the response has been sent (an SMS, for example), so the person is not kept
 * waiting and a slow or failing provider never affects the request. Outside a Next.js request
 * (scripts, tests) it simply starts the work. Errors are logged, never thrown.
 */
export function runAfterResponse(task: () => Promise<unknown>) {
  const guarded = () => task().catch((error: unknown) => logger.error("Background task failed.", { error }));
  try {
    after(guarded);
  } catch {
    const running = guarded();
    pending.add(running);
    void running.finally(() => pending.delete(running));
  }
}

/** Waits for background work started outside a request (used by tests and scripts). */
export async function settleBackgroundTasks() {
  while (pending.size) await Promise.all([...pending]);
}

import type { ExpenseSplitterApi } from "./api";
import { MockExpenseSplitterApi } from "./mockApi";

/**
 * Single entry point for every backend call in the app.
 * Swap this for a real implementation of ExpenseSplitterApi later —
 * no screen imports a data source directly.
 */
export const api: ExpenseSplitterApi = new MockExpenseSplitterApi({ persist: true });

export type { ExpenseSplitterApi, EventDetail, InvitePreview } from "./api";

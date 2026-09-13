import type { ExpenseSplitterApi } from "./api";
import { HttpExpenseSplitterApi } from "./httpApi";

/**
 * Single entry point for every backend call in the app.
 * No screen imports a data source directly, so the app can use the real
 * backend while keeping the service contract stable.
 */
export const api: ExpenseSplitterApi = new HttpExpenseSplitterApi();

export type { ExpenseSplitterApi, EventDetail, InvitePreview } from "./api";

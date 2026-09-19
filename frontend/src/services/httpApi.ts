import type {
  CreateEventInput,
  EventRecord,
  EventStatus,
  EventSummary,
  ExpenseInput,
  ExpenseView,
  MemberStatus,
  MemberView,
  Settlement,
  User,
} from "@/domain/types";
import type { EventDetail, ExpenseSplitterApi, InvitePreview } from "./api";

const TOKEN_KEY = "split-table:auth-token";

function initialToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/** HTTP implementation of the frontend service contract. */
export class HttpExpenseSplitterApi implements ExpenseSplitterApi {
  private token = initialToken();
  private readonly baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private setToken(token: string | null): void {
    this.token = token;
    if (typeof window === "undefined") return;
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
    if (response.status === 401) this.setToken(null);
    if (!response.ok) {
      let message = `Request failed (${response.status}).`;
      try {
        const error = (await response.json()) as { detail?: string; message?: string };
        message = error.message ?? error.detail ?? message;
      } catch {
        // Keep the status-based message when the server has no JSON error body.
      }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async signIn(path: string, body?: unknown): Promise<User> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      let message = `Request failed (${response.status}).`;
      try {
        const error = (await response.json()) as {
          detail?: string | { msg?: string }[];
          message?: string;
        };
        if (typeof error.message === "string") message = error.message;
        else if (typeof error.detail === "string") message = error.detail;
        else if (Array.isArray(error.detail))
          message =
            error.detail
              .map((item) => item.msg)
              .filter(Boolean)
              .join(" ") || message;
      } catch {
        // Keep the status-based message when the server has no JSON error body.
      }
      throw new Error(message);
    }
    const token = response.headers.get("X-Auth-Token");
    if (!token) throw new Error("Sign-in response did not include an auth token.");
    this.setToken(token);
    return (await response.json()) as User;
  }

  getCurrentUser(): Promise<User | null> {
    return this.request<User | null>("/auth/me");
  }

  register(input: { displayName: string; email: string; password: string }): Promise<User> {
    return this.signIn("/auth/register", input);
  }

  signInWithPassword(input: { email: string; password: string }): Promise<User> {
    return this.signIn("/auth/login", input);
  }

  signInWithGoogle(): Promise<User> {
    return this.signIn("/auth/google");
  }

  signInAs(userId: string): Promise<User> {
    return this.signIn("/auth/demo", { userId });
  }

  async signOut(): Promise<void> {
    try {
      await this.request<void>("/auth/signout", { method: "POST" });
    } finally {
      this.setToken(null);
    }
  }

  listDemoAccounts(): Promise<User[]> {
    return this.request<User[]>("/auth/demo/accounts");
  }

  listEvents(): Promise<EventSummary[]> {
    return this.request<EventSummary[]>("/events");
  }

  createEvent(input: CreateEventInput): Promise<EventRecord> {
    return this.request<EventRecord>("/events", { method: "POST", body: JSON.stringify(input) });
  }

  getEvent(eventId: string): Promise<EventDetail> {
    return this.request<EventDetail>(`/events/${encodeURIComponent(eventId)}`);
  }

  setEventStatus(eventId: string, status: EventStatus): Promise<EventRecord> {
    return this.request<EventRecord>(`/events/${encodeURIComponent(eventId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  previewInvite(code: string): Promise<InvitePreview> {
    return this.request<InvitePreview>(`/invites/${encodeURIComponent(code)}`);
  }

  joinEvent(code: string): Promise<EventRecord> {
    return this.request<EventRecord>(`/invites/${encodeURIComponent(code)}`, { method: "POST" });
  }

  setMemberStatus(eventId: string, userId: string, status: MemberStatus): Promise<MemberView> {
    return this.request<MemberView>(
      `/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
  }

  getExpense(eventId: string, expenseId: string): Promise<ExpenseView> {
    return this.request<ExpenseView>(
      `/events/${encodeURIComponent(eventId)}/expenses/${encodeURIComponent(expenseId)}`,
    );
  }

  createExpense(eventId: string, input: ExpenseInput): Promise<ExpenseView> {
    return this.request<ExpenseView>(`/events/${encodeURIComponent(eventId)}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateExpense(eventId: string, expenseId: string, input: ExpenseInput): Promise<ExpenseView> {
    return this.request<ExpenseView>(
      `/events/${encodeURIComponent(eventId)}/expenses/${encodeURIComponent(expenseId)}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  }

  deleteExpense(eventId: string, expenseId: string): Promise<void> {
    return this.request<void>(
      `/events/${encodeURIComponent(eventId)}/expenses/${encodeURIComponent(expenseId)}`,
      { method: "DELETE" },
    );
  }

  getSettlement(eventId: string): Promise<Settlement> {
    return this.request<Settlement>(`/events/${encodeURIComponent(eventId)}/settlement`);
  }
}

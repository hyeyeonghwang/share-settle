/** Core domain entities. All monetary values are integers in the currency's minor unit. */

export type CurrencyCode = "KRW" | "USD" | "JPY" | "EUR";

export type EventStatus = "ACTIVE" | "COMPLETED";
export type MemberStatus = "ACTIVE" | "INACTIVE";
export type SplitType = "EQUAL" | "FIXED_PLUS_EQUAL";
export type SplitMode = "FIXED" | "AUTO";

export interface User {
  id: string;
  displayName: string;
  email: string;
  authProvider: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  name: string;
  createdBy: string;
  currency: CurrencyCode;
  status: EventStatus;
  inviteCode: string;
  createdAt: string;
  completedAt: string | null;
}

export interface EventMember {
  id: string;
  eventId: string;
  userId: string;
  status: MemberStatus;
  joinedAt: string;
  deactivatedAt: string | null;
}

export interface Expense {
  id: string;
  eventId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  createdBy: string;
  splitType: SplitType;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  id: string;
  expenseId: string;
  name: string;
  amount: number;
  sortOrder: number;
}

export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  userId: string;
  mode: SplitMode;
  fixedAmount: number | null;
}

/* ---------- view models returned by the service layer ---------- */

export interface MemberView extends EventMember {
  user: User;
  isCreator: boolean;
}

export interface ExpenseView {
  expense: Expense;
  items: ExpenseItem[];
  participants: ExpenseParticipant[];
  payer: User;
  creator: User;
  /** userId -> final amount owed for this expense */
  shares: Record<string, number>;
  canEdit: boolean;
}

export interface EventSummary {
  event: EventRecord;
  memberCount: number;
  expenseCount: number;
  totalSpent: number;
  isCreator: boolean;
}

export interface Balance {
  user: User;
  paid: number;
  owed: number;
  balance: number;
}

export interface Transfer {
  from: User;
  to: User;
  amount: number;
}

export interface Settlement {
  balances: Balance[];
  transfers: Transfer[];
}

/* ---------- inputs ---------- */

export interface ExpenseItemInput {
  name: string;
  amount: number;
}

export interface ExpenseParticipantInput {
  userId: string;
  mode: SplitMode;
  fixedAmount: number | null;
}

export interface ExpenseInput {
  title: string;
  totalAmount: number;
  payerId: string;
  splitType: SplitType;
  items: ExpenseItemInput[];
  participants: ExpenseParticipantInput[];
}

export interface CreateEventInput {
  name: string;
  currency: CurrencyCode;
}

export class ServiceError extends Error {}

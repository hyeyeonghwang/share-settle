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

export interface EventDetail {
  event: EventRecord;
  members: MemberView[];
  expenses: ExpenseView[];
  totalSpent: number;
  isCreator: boolean;
  currentUserId: string;
}

export interface InvitePreview {
  event: EventRecord;
  memberCount: number;
  alreadyMember: boolean;
}

/**
 * Every backend call in the app goes through this interface.
 * The app ships with a mock implementation so it runs with no real backend.
 */
export interface ExpenseSplitterApi {
  /* auth */
  getCurrentUser(): Promise<User | null>;
  signInWithGoogle(): Promise<User>;
  signInAs(userId: string): Promise<User>;
  signOut(): Promise<void>;
  listDemoAccounts(): Promise<User[]>;

  /* events */
  listEvents(): Promise<EventSummary[]>;
  createEvent(input: CreateEventInput): Promise<EventRecord>;
  getEvent(eventId: string): Promise<EventDetail>;
  setEventStatus(eventId: string, status: EventStatus): Promise<EventRecord>;

  /* invitations */
  previewInvite(code: string): Promise<InvitePreview>;
  joinEvent(code: string): Promise<EventRecord>;

  /* members */
  setMemberStatus(
    eventId: string,
    userId: string,
    status: MemberStatus,
  ): Promise<MemberView>;

  /* expenses */
  getExpense(eventId: string, expenseId: string): Promise<ExpenseView>;
  createExpense(eventId: string, input: ExpenseInput): Promise<ExpenseView>;
  updateExpense(
    eventId: string,
    expenseId: string,
    input: ExpenseInput,
  ): Promise<ExpenseView>;
  deleteExpense(eventId: string, expenseId: string): Promise<void>;

  /* settlement */
  getSettlement(eventId: string): Promise<Settlement>;
}

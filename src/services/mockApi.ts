import { computeShares, computeTransfers, validateExpense } from "@/domain/split";
import type {
  Balance,
  CreateEventInput,
  EventMember,
  EventRecord,
  EventStatus,
  EventSummary,
  Expense,
  ExpenseInput,
  ExpenseItem,
  ExpenseParticipant,
  ExpenseView,
  MemberStatus,
  MemberView,
  Settlement,
  User,
} from "@/domain/types";
import { ServiceError } from "@/domain/types";
import type { EventDetail, ExpenseSplitterApi, InvitePreview } from "./api";

interface Database {
  users: User[];
  events: EventRecord[];
  members: EventMember[];
  expenses: Expense[];
  items: ExpenseItem[];
  participants: ExpenseParticipant[];
  currentUserId: string | null;
}

const STORAGE_KEY = "split-table:db:v1";

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function now(): string {
  return new Date().toISOString();
}

export function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1)
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function user(
  uid: string,
  displayName: string,
  email: string,
  createdAt: string,
): User {
  return { id: uid, displayName, email, authProvider: "google", createdAt };
}

export function seedDatabase(): Database {
  const base = "2026-03-01T09:00:00.000Z";
  const users: User[] = [
    user("u_younghee", "Younghee", "younghee@example.com", base),
    user("u_chulsoo", "Chulsoo", "chulsoo@example.com", base),
    user("u_jihoon", "Jihoon", "jihoon@example.com", base),
    user("u_hana", "Hana", "hana@example.com", base),
  ];

  const event: EventRecord = {
    id: "e_jeju",
    name: "Jeju Trip",
    createdBy: "u_younghee",
    currency: "KRW",
    status: "ACTIVE",
    inviteCode: "JEJU24",
    createdAt: base,
    completedAt: null,
  };

  const members: EventMember[] = [
    {
      id: "m1",
      eventId: event.id,
      userId: "u_younghee",
      status: "ACTIVE",
      joinedAt: base,
      deactivatedAt: null,
    },
    {
      id: "m2",
      eventId: event.id,
      userId: "u_chulsoo",
      status: "ACTIVE",
      joinedAt: base,
      deactivatedAt: null,
    },
    {
      id: "m3",
      eventId: event.id,
      userId: "u_jihoon",
      status: "ACTIVE",
      joinedAt: base,
      deactivatedAt: null,
    },
    {
      id: "m4",
      eventId: event.id,
      userId: "u_hana",
      status: "INACTIVE",
      joinedAt: base,
      deactivatedAt: "2026-03-05T09:00:00.000Z",
    },
  ];

  const expenses: Expense[] = [
    {
      id: "x_dinner",
      eventId: event.id,
      title: "Sunset Dinner",
      totalAmount: 90000,
      payerId: "u_younghee",
      createdBy: "u_younghee",
      splitType: "EQUAL",
      createdAt: "2026-03-12T11:00:00.000Z",
      updatedAt: "2026-03-12T11:00:00.000Z",
    },
    {
      id: "x_stay",
      eventId: event.id,
      title: "Sea View Stay",
      totalAmount: 300000,
      payerId: "u_chulsoo",
      createdBy: "u_chulsoo",
      splitType: "EQUAL",
      createdAt: "2026-03-11T11:00:00.000Z",
      updatedAt: "2026-03-11T11:00:00.000Z",
    },
    {
      id: "x_car",
      eventId: event.id,
      title: "Car Rental",
      totalAmount: 140000,
      payerId: "u_jihoon",
      createdBy: "u_jihoon",
      splitType: "FIXED_PLUS_EQUAL",
      createdAt: "2026-03-10T11:00:00.000Z",
      updatedAt: "2026-03-10T11:00:00.000Z",
    },
  ];

  const items: ExpenseItem[] = [
    { id: "i1", expenseId: "x_dinner", name: "Pork", amount: 60000, sortOrder: 0 },
    { id: "i2", expenseId: "x_dinner", name: "Alcohol", amount: 20000, sortOrder: 1 },
  ];

  const participants: ExpenseParticipant[] = [
    { id: "p1", expenseId: "x_dinner", userId: "u_younghee", mode: "AUTO", fixedAmount: null },
    { id: "p2", expenseId: "x_dinner", userId: "u_chulsoo", mode: "AUTO", fixedAmount: null },
    { id: "p3", expenseId: "x_dinner", userId: "u_jihoon", mode: "AUTO", fixedAmount: null },
    { id: "p4", expenseId: "x_stay", userId: "u_younghee", mode: "AUTO", fixedAmount: null },
    { id: "p5", expenseId: "x_stay", userId: "u_chulsoo", mode: "AUTO", fixedAmount: null },
    { id: "p6", expenseId: "x_stay", userId: "u_jihoon", mode: "AUTO", fixedAmount: null },
    { id: "p7", expenseId: "x_car", userId: "u_younghee", mode: "FIXED", fixedAmount: 60000 },
    { id: "p8", expenseId: "x_car", userId: "u_chulsoo", mode: "AUTO", fixedAmount: null },
    { id: "p9", expenseId: "x_car", userId: "u_jihoon", mode: "AUTO", fixedAmount: null },
  ];

  return {
    users,
    events: [event],
    members,
    expenses,
    items,
    participants,
    currentUserId: null,
  };
}

/** In-memory mock backend; persists to localStorage in the browser. */
export class MockExpenseSplitterApi implements ExpenseSplitterApi {
  private db: Database;
  private readonly persist: boolean;

  constructor(options: { persist?: boolean; db?: Database } = {}) {
    this.persist = options.persist ?? false;
    this.db = options.db ?? this.load();
  }

  private load(): Database {
    if (this.persist && typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          return JSON.parse(raw) as Database;
        } catch {
          /* fall through to a fresh seed */
        }
      }
    }
    return seedDatabase();
  }

  private save(): void {
    if (this.persist && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    }
  }

  /** Test/debug helper — resets to the seeded dataset. */
  reset(): void {
    this.db = seedDatabase();
    this.save();
  }

  /* ---------------- internals ---------------- */

  private requireUser(): User {
    const found = this.db.users.find((u) => u.id === this.db.currentUserId);
    if (!found) throw new ServiceError("You must be signed in.");
    return found;
  }

  private requireEvent(eventId: string): EventRecord {
    const found = this.db.events.find((e) => e.id === eventId);
    if (!found) throw new ServiceError("Event not found.");
    return found;
  }

  private requireMembership(eventId: string, userId: string): EventMember {
    const found = this.db.members.find(
      (m) => m.eventId === eventId && m.userId === userId,
    );
    if (!found) throw new ServiceError("You are not a member of this event.");
    return found;
  }

  private memberOrder(eventId: string): string[] {
    return this.db.members
      .filter((m) => m.eventId === eventId)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id))
      .map((m) => m.userId);
  }

  private userById(userId: string): User {
    const found = this.db.users.find((u) => u.id === userId);
    if (!found) throw new ServiceError("User not found.");
    return found;
  }

  private buildExpenseView(expense: Expense, viewerId: string): ExpenseView {
    const event = this.requireEvent(expense.eventId);
    const participants = this.db.participants.filter(
      (p) => p.expenseId === expense.id,
    );
    const items = this.db.items
      .filter((i) => i.expenseId === expense.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const shares = computeShares(
      expense.totalAmount,
      participants.map((p) => ({
        userId: p.userId,
        mode: expense.splitType === "EQUAL" ? "AUTO" : p.mode,
        fixedAmount: expense.splitType === "EQUAL" ? null : p.fixedAmount,
      })),
      this.memberOrder(expense.eventId),
    );
    const canEdit =
      event.status === "ACTIVE" &&
      (expense.createdBy === viewerId || event.createdBy === viewerId);

    return {
      expense,
      items,
      participants,
      payer: this.userById(expense.payerId),
      creator: this.userById(expense.createdBy),
      shares,
      canEdit,
    };
  }

  private writeExpenseRelations(expenseId: string, input: ExpenseInput): void {
    this.db.items = this.db.items.filter((i) => i.expenseId !== expenseId);
    this.db.participants = this.db.participants.filter(
      (p) => p.expenseId !== expenseId,
    );
    input.items.forEach((item, index) => {
      this.db.items.push({
        id: id("i"),
        expenseId,
        name: item.name,
        amount: item.amount,
        sortOrder: index,
      });
    });
    input.participants.forEach((participant) => {
      this.db.participants.push({
        id: id("p"),
        expenseId,
        userId: participant.userId,
        mode: input.splitType === "EQUAL" ? "AUTO" : participant.mode,
        fixedAmount:
          input.splitType === "EQUAL" || participant.mode !== "FIXED"
            ? null
            : participant.fixedAmount,
      });
    });
  }

  /* ---------------- auth ---------------- */

  async getCurrentUser(): Promise<User | null> {
    return this.db.users.find((u) => u.id === this.db.currentUserId) ?? null;
  }

  async signInWithGoogle(): Promise<User> {
    return this.signInAs("u_younghee");
  }

  async signInAs(userId: string): Promise<User> {
    const found = this.db.users.find((u) => u.id === userId);
    if (!found) throw new ServiceError("Unknown account.");
    this.db.currentUserId = found.id;
    this.save();
    return found;
  }

  async signOut(): Promise<void> {
    this.db.currentUserId = null;
    this.save();
  }

  async listDemoAccounts(): Promise<User[]> {
    return [...this.db.users];
  }

  /* ---------------- events ---------------- */

  async listEvents(): Promise<EventSummary[]> {
    const me = this.requireUser();
    const myEventIds = this.db.members
      .filter((m) => m.userId === me.id)
      .map((m) => m.eventId);
    return this.db.events
      .filter((e) => myEventIds.includes(e.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((event) => {
        const expenses = this.db.expenses.filter((x) => x.eventId === event.id);
        return {
          event,
          memberCount: this.db.members.filter((m) => m.eventId === event.id).length,
          expenseCount: expenses.length,
          totalSpent: expenses.reduce((a, x) => a + x.totalAmount, 0),
          isCreator: event.createdBy === me.id,
        };
      });
  }

  async createEvent(input: CreateEventInput): Promise<EventRecord> {
    const me = this.requireUser();
    if (!input.name.trim()) throw new ServiceError("Event name is required.");
    let inviteCode = makeInviteCode();
    while (this.db.events.some((e) => e.inviteCode === inviteCode))
      inviteCode = makeInviteCode();

    const event: EventRecord = {
      id: id("e"),
      name: input.name.trim(),
      createdBy: me.id,
      currency: input.currency,
      status: "ACTIVE",
      inviteCode,
      createdAt: now(),
      completedAt: null,
    };
    this.db.events.push(event);
    this.db.members.push({
      id: id("m"),
      eventId: event.id,
      userId: me.id,
      status: "ACTIVE",
      joinedAt: now(),
      deactivatedAt: null,
    });
    this.save();
    return event;
  }

  async getEvent(eventId: string): Promise<EventDetail> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    this.requireMembership(eventId, me.id);

    const order = this.memberOrder(eventId);
    const members: MemberView[] = this.db.members
      .filter((m) => m.eventId === eventId)
      .sort((a, b) => order.indexOf(a.userId) - order.indexOf(b.userId))
      .map((m) => ({
        ...m,
        user: this.userById(m.userId),
        isCreator: event.createdBy === m.userId,
      }));

    const expenses = this.db.expenses
      .filter((x) => x.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((x) => this.buildExpenseView(x, me.id));

    return {
      event,
      members,
      expenses,
      totalSpent: expenses.reduce((a, x) => a + x.expense.totalAmount, 0),
      isCreator: event.createdBy === me.id,
      currentUserId: me.id,
    };
  }

  async setEventStatus(eventId: string, status: EventStatus): Promise<EventRecord> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    if (event.createdBy !== me.id)
      throw new ServiceError("Only the event creator can change the event status.");
    event.status = status;
    event.completedAt = status === "COMPLETED" ? now() : null;
    this.save();
    return event;
  }

  /* ---------------- invitations ---------------- */

  private eventByCode(code: string): EventRecord {
    const normalized = code.trim().toUpperCase();
    const found = this.db.events.find((e) => e.inviteCode === normalized);
    if (!found) throw new ServiceError("That invite code doesn't match any event.");
    return found;
  }

  async previewInvite(code: string): Promise<InvitePreview> {
    const me = this.requireUser();
    const event = this.eventByCode(code);
    return {
      event,
      memberCount: this.db.members.filter((m) => m.eventId === event.id).length,
      alreadyMember: this.db.members.some(
        (m) => m.eventId === event.id && m.userId === me.id,
      ),
    };
  }

  async joinEvent(code: string): Promise<EventRecord> {
    const me = this.requireUser();
    const event = this.eventByCode(code);
    const existing = this.db.members.find(
      (m) => m.eventId === event.id && m.userId === me.id,
    );
    if (existing) {
      if (existing.status === "INACTIVE") {
        existing.status = "ACTIVE";
        existing.deactivatedAt = null;
        this.save();
      }
      return event;
    }
    this.db.members.push({
      id: id("m"),
      eventId: event.id,
      userId: me.id,
      status: "ACTIVE",
      joinedAt: now(),
      deactivatedAt: null,
    });
    this.save();
    return event;
  }

  /* ---------------- members ---------------- */

  async setMemberStatus(
    eventId: string,
    userId: string,
    status: MemberStatus,
  ): Promise<MemberView> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    if (event.createdBy !== me.id)
      throw new ServiceError("Only the event creator can manage participants.");
    const member = this.requireMembership(eventId, userId);
    member.status = status;
    member.deactivatedAt = status === "INACTIVE" ? now() : null;
    this.save();
    return {
      ...member,
      user: this.userById(userId),
      isCreator: event.createdBy === userId,
    };
  }

  /* ---------------- expenses ---------------- */

  async getExpense(eventId: string, expenseId: string): Promise<ExpenseView> {
    const me = this.requireUser();
    this.requireMembership(eventId, me.id);
    const expense = this.db.expenses.find(
      (x) => x.id === expenseId && x.eventId === eventId,
    );
    if (!expense) throw new ServiceError("Expense not found.");
    return this.buildExpenseView(expense, me.id);
  }

  async createExpense(eventId: string, input: ExpenseInput): Promise<ExpenseView> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    this.requireMembership(eventId, me.id);
    if (event.status === "COMPLETED")
      throw new ServiceError("This event is completed and locked.");

    const errors = validateExpense(input, this.memberOrder(eventId));
    if (errors.length > 0) throw new ServiceError(errors[0]);

    const expense: Expense = {
      id: id("x"),
      eventId,
      title: input.title.trim(),
      totalAmount: input.totalAmount,
      payerId: input.payerId,
      createdBy: me.id,
      splitType: input.splitType,
      createdAt: now(),
      updatedAt: now(),
    };
    this.db.expenses.push(expense);
    this.writeExpenseRelations(expense.id, input);
    this.save();
    return this.buildExpenseView(expense, me.id);
  }

  async updateExpense(
    eventId: string,
    expenseId: string,
    input: ExpenseInput,
  ): Promise<ExpenseView> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    this.requireMembership(eventId, me.id);
    if (event.status === "COMPLETED")
      throw new ServiceError("This event is completed and locked.");

    const expense = this.db.expenses.find(
      (x) => x.id === expenseId && x.eventId === eventId,
    );
    if (!expense) throw new ServiceError("This expense no longer exists.");
    if (expense.createdBy !== me.id && event.createdBy !== me.id)
      throw new ServiceError("You can only edit expenses you added.");

    const errors = validateExpense(input, this.memberOrder(eventId));
    if (errors.length > 0) throw new ServiceError(errors[0]);

    expense.title = input.title.trim();
    expense.totalAmount = input.totalAmount;
    expense.payerId = input.payerId;
    expense.splitType = input.splitType;
    expense.updatedAt = now();
    this.writeExpenseRelations(expense.id, input);
    this.save();
    return this.buildExpenseView(expense, me.id);
  }

  async deleteExpense(eventId: string, expenseId: string): Promise<void> {
    const me = this.requireUser();
    const event = this.requireEvent(eventId);
    this.requireMembership(eventId, me.id);
    if (event.status === "COMPLETED")
      throw new ServiceError("This event is completed and locked.");
    const expense = this.db.expenses.find(
      (x) => x.id === expenseId && x.eventId === eventId,
    );
    if (!expense) throw new ServiceError("This expense no longer exists.");
    if (expense.createdBy !== me.id && event.createdBy !== me.id)
      throw new ServiceError("You can only delete expenses you added.");

    this.db.expenses = this.db.expenses.filter((x) => x.id !== expenseId);
    this.db.items = this.db.items.filter((i) => i.expenseId !== expenseId);
    this.db.participants = this.db.participants.filter(
      (p) => p.expenseId !== expenseId,
    );
    this.save();
  }

  /* ---------------- settlement ---------------- */

  async getSettlement(eventId: string): Promise<Settlement> {
    const me = this.requireUser();
    this.requireEvent(eventId);
    this.requireMembership(eventId, me.id);

    const order = this.memberOrder(eventId);
    const paid = new Map<string, number>();
    const owed = new Map<string, number>();
    for (const userId of order) {
      paid.set(userId, 0);
      owed.set(userId, 0);
    }

    for (const expense of this.db.expenses.filter((x) => x.eventId === eventId)) {
      const view = this.buildExpenseView(expense, me.id);
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.totalAmount);
      for (const [userId, amount] of Object.entries(view.shares)) {
        owed.set(userId, (owed.get(userId) ?? 0) + amount);
      }
    }

    const balances: Balance[] = order.map((userId) => {
      const p = paid.get(userId) ?? 0;
      const o = owed.get(userId) ?? 0;
      return { user: this.userById(userId), paid: p, owed: o, balance: p - o };
    });

    return { balances, transfers: computeTransfers(balances) };
  }
}

# Share & Settle

Create a system design expense splitter application.

# Expense Splitter App — Product Specification

## 1. Product Overview

### 1.1 Purpose

Build a lightweight expense-splitting app for situations where multiple people share costs during trips, gatherings, dinners, or other group activities.

The app should allow each user to log in, participate in multiple events, enter their own expenses, and see the final settlement showing who should pay whom.

The core goals are:

- A user can participate in multiple Events.

- Every participant has their own account and logs in individually.

- Participants can add expenses within an Event.

- Each expense records both the payer and the users responsible for the cost.

- The app supports equal splitting.

- The app also supports assigning fixed amounts to some users, then splitting the remaining amount equally among the remaining users.

- At the end of an Event, the app calculates each user's net balance and the final transfer plan.

- The MVP should remain lightweight and avoid unnecessary feature complexity.

---

## 2. MVP Scope

### 2.1 Included Features

1. User sign-up and login

2. Create an Event

3. View a list of Events

4. Generate Event invitation links

5. Generate Event invitation codes

6. Join an Event using either a link or a code

7. Manage Event participants

8. Manage participant status as Active or Inactive

9. Add expenses

10. Edit or delete expenses

11. Select the payer

12. Enter the total amount

13. Enter descriptive line items

14. Select participants responsible for the expense

15. Equal split

16. Partial fixed amount + equal split of the remainder

17. Calculate total paid and total owed per user

18. Calculate net balance per user

19. Calculate the final transfer plan

20. Mark an Event as completed

21. Lock completed Events

22. Allow the Event creator to reopen a completed Event

### 2.2 Excluded from the MVP

The following features are intentionally excluded from the initial version:

- Friend search

- Friend lists

- Chat

- Receipt OCR

- Credit card or bank account integration

- Automatic money transfer

- Automatic currency conversion

- Multi-currency settlement

- Notification system

- Recurring expenses

- Advanced analytics dashboards

- Social features

---

## 3. User Model

Every participant must have an account.

### 3.1 User

Required fields:

```text

User

- id

- display_name

- email

- auth_provider

- created_at

```

### 3.2 Authentication

The authentication flow should remain simple for the MVP.

Recommended approach:

- Prefer Google OAuth

- Optionally support Email + Password later

If native email/password authentication is implemented, additional requirements include:

- Password hashing

- Password reset

- Email verification

- Session or token management

For the MVP, external OAuth is preferred because it reduces authentication complexity.

---

## 4. Event Model

An Event is the top-level unit for expense sharing and settlement.

Examples:

- Jeju Trip

- Lab Dinner

- Camping

- Busan Business Trip

### 4.1 Event

```text

Event

- id

- name

- created_by

- currency

- status

- invite_code

- created_at

- completed_at

```

### 4.2 Event Status

```text

ACTIVE

COMPLETED

```

#### ACTIVE

- New expenses can be added

- Existing expenses can be edited

- Participants can be managed

- Settlement values are recalculated dynamically

#### COMPLETED

- The Event is locked

- New expenses cannot be added

- Existing expenses cannot be edited or deleted

- Settlement results are treated as final

Only the Event creator can reopen a completed Event by changing:

```text

COMPLETED

→ ACTIVE

```

---

## 5. Event Invitation

Both invitation methods are supported.

### 5.1 Invitation Link

Example:

```text

https://expense.app/join/ABCD12

```

User flow:

```text

Click invitation link

→ Log in

→ Review Event information

→ Join Event

```

### 5.2 Invitation Code

Example:

```text

ABCD12

```

User flow:

```text

Open app

→ Select "Join Event"

→ Enter invitation code

→ Review Event information

→ Join Event

```

The invitation link and invitation code may use the same underlying identifier.

---

## 6. Event Membership

### 6.1 EventMember

```text

EventMember

- id

- event_id

- user_id

- status

- joined_at

- deactivated_at

```

Available states:

```text

ACTIVE

INACTIVE

```

### 6.2 Active Member

An Active member:

- Can use the Event normally

- Is included as a default candidate for new expense splits

- Can be selected as a payer

- Can view Event information

### 6.3 Inactive Member

Users do not permanently leave an Event. Instead, they become Inactive.

An Inactive member:

- Keeps all historical expense records

- Keeps all historical settlement records

- Is excluded from the default participant list for new expenses

- Is excluded from the default payer list for new expenses

- Can be reactivated by the Event creator

Historical EventMember records should never be deleted because doing so could break past settlement data.

---

## 7. Roles and Permissions

### 7.1 Event Creator

The Event creator has administrative permissions.

The Event creator can:

- Edit Event information

- Edit any expense

- Delete any expense

- Deactivate participants

- Reactivate participants

- Mark the Event as completed

- Reopen a completed Event

### 7.2 General Member

A regular participant can:

- Add an expense

- Edit an expense they created

- Delete an expense they created

- View expenses created by other users

A regular participant cannot edit or delete expenses created by other participants.

---

## 8. Expense Model

### 8.1 Expense

```text

Expense

- id

- event_id

- title

- total_amount

- payer_id

- created_by

- split_type

- created_at

- updated_at

```

The payer and the user who entered the expense must be stored separately.

For example:

```text

Created by: User B

Paid by: User A

```

Therefore:

```text

payer_id != created_by

```

must be allowed.

---

## 9. Expense Detail Items

Detail items are descriptive only.

They are not used as separate split units.

Example:

```text

Dinner

Total amount: 90,000 KRW

Detail items

- Pork: 60,000 KRW

- Alcohol: 20,000 KRW

- Soft drinks: 10,000 KRW

```

Users cannot assign different responsible participants to individual detail items.

### 9.1 ExpenseItem

```text

ExpenseItem

- id

- expense_id

- name

- amount

- sort_order

```

Recommended validation:

```text

sum(item.amount) <= expense.total_amount

```

The detail item total does not have to exactly match the full expense amount.

Reason:

- Users may only want to describe some of the items.

- Unspecified amounts can remain as "Other" or "Uncategorized".

The UI may optionally display:

```text

Detail items total: 80,000 KRW

Other / Uncategorized: 10,000 KRW

Total amount: 90,000 KRW

```

---

## 10. Expense Participants

When a new expense is created, all Active Event members are selected by default as participants responsible for the cost.

The user can manually exclude participants.

Example:

```text

Responsible participants

[x] A

[x] B

[x] C

[ ] D

```

---

## 11. Split Modes

The MVP supports only two split modes.

### 11.1 Equal Split

The total amount is divided equally among all selected participants.

Example:

```text

Total amount: 120,000 KRW

Participants:

A

B

C

D

```

Result:

```text

A: 30,000

B: 30,000

C: 30,000

D: 30,000

```

---

### 11.2 Partial Fixed Amount + Equal Remainder

The user can manually assign fixed amounts to some participants.

The remaining amount is then divided equally among all remaining participants.

Example:

```text

Total amount:

120,000 KRW

A: 50,000 KRW

B: 20,000 KRW

C: Auto

D: Auto

```

Calculation:

```text

Fixed total

= 50,000 + 20,000

= 70,000

Remaining amount

= 120,000 - 70,000

= 50,000

Remaining participants

= C, D

Equal remainder

= 25,000

```

Final result:

```text

A: 50,000

B: 20,000

C: 25,000

D: 25,000

```

---

## 12. Split Data Model

Recommended structure:

### ExpenseParticipant

```text

ExpenseParticipant

- id

- expense_id

- user_id

- split_mode

- fixed_amount

- final_amount

```

Example:

```text

A | FIXED | 50000 | 50000

B | FIXED | 20000 | 20000

C | AUTO  | null  | 25000

D | AUTO  | null  | 25000

```

For the MVP, it is preferable to store the source split configuration and calculate final amounts dynamically rather than treating calculated values as permanent source data.

---

## 13. Split Calculation Rules

### 13.1 Equal Split

Use integer arithmetic.

```text

base = total_amount // number_of_members

remainder = total_amount % number_of_members

```

Any remainder should be distributed using a deterministic rule.

Recommended approach:

- Use a stable EventMember ordering

- Or sort by user_id

Example:

```text

10,000 KRW / 3 users

base = 3,333

remainder = 1

A = 3,334

B = 3,333

C = 3,333

```

The following invariant must always hold:

```text

sum(final_amounts) == total_amount

```

---

### 13.2 Partial Fixed Split

```text

fixed_total = sum(fixed_amount)

remaining_amount = total_amount - fixed_total

remaining_members = selected_members - fixed_members

```

Then divide:

```text

remaining_amount

```

equally among the remaining participants.

---

## 14. Validation Rules

Before an expense is saved, validate the following.

### Required Validation

- `title` must exist

- `total_amount > 0`

- A payer must be selected

- At least one responsible participant must be selected

- The payer must be a valid member of the Event

- Every responsible participant must belong to the Event

### Partial Fixed Split Validation

The following condition must hold:

```text

sum(fixed_amounts) <= total_amount

```

Invalid:

```text

fixed_total > total_amount

```

Also, if:

```text

remaining_amount > 0

```

and:

```text

remaining_members == 0

```

the expense cannot be saved.

If every participant has a manually entered fixed amount, then:

```text

sum(fixed_amounts) == total_amount

```

must be true.

---

## 15. Event Currency

The MVP supports one currency per Event.

Examples:

```text

KRW

USD

JPY

EUR

```

The currency is selected when the Event is created.

All expenses inside that Event use the same currency.

Multi-currency support and exchange-rate conversion are excluded from the MVP.

---

## 16. Settlement Calculation

For each user, calculate three values.

### Paid

The total amount actually paid by the user:

```text

paid[user]

```

### Owed

The total amount the user is responsible for:

```text

owed[user]

```

### Net Balance

```text

balance[user] = paid[user] - owed[user]

```

Interpretation:

```text

balance > 0

→ The user should receive money

balance < 0

→ The user should pay money

balance == 0

→ The user is fully settled

```

Example:

```text

A

paid: 180,000

owed: 110,000

balance: +70,000

B

paid: 50,000

owed: 100,000

balance: -50,000

C

paid: 70,000

owed: 90,000

balance: -20,000

```

---

## 17. Transfer Calculation

The app should calculate the final payment relationships.

Example:

```text

B → A: 50,000 KRW

C → A: 20,000 KRW

```

### Recommended Algorithm

Create two groups:

```text

creditors = users where balance > 0

debtors = users where balance < 0

```

Sort them by remaining balance and apply greedy matching.

Pseudo logic:

```text

while creditors and debtors:

    creditor = user with largest remaining credit

    debtor = user with largest remaining debt

    transfer =

        min(

            creditor.remaining_credit,

            debtor.remaining_debt

        )

    create transfer

    reduce both balances

```

The goal is to produce a practical transfer plan with as few transfers as reasonably possible.

Note:

A greedy settlement algorithm is appropriate for the MVP, but it should not be described as mathematically guaranteeing the globally minimum possible number of transactions in all cases.

---

## 18. MVP Screens

### 18.1 Login

```text

Expense Splitter

[ Continue with Google ]

```

---

### 18.2 Event List

```text

My Events

Active

- Jeju Trip

- Lab Dinner

Completed

- Busan Trip

- Camping

[ + Create Event ]

[ Enter Invite Code ]

```

---

### 18.3 Event Detail

```text

Jeju Trip

4 participants

Total spent

₩530,000

Recent expenses

Dinner

₩90,000

Paid by: A

Accommodation

₩300,000

Paid by: B

[ + Add Expense ]

[ View Settlement ]

[ Participants ]

```

---

### 18.4 Add Expense

```text

Expense title

[ Dinner ]

Total amount

[ 90000 ]

Paid by

[ A ▼ ]

Detail items

Pork        60000

Alcohol     20000

Soft drinks 10000

[ + Add Item ]

Responsible participants

[x] A

[x] B

[x] C

[x] D

Split method

( ) Equal split

(x) Partial fixed amount

A [ 50000 ]

B [ 20000 ]

C [ Auto ]

D [ Auto ]

Remaining amount

20,000 KRW

C / D

10,000 KRW each

[ Save ]

```

---

### 18.5 Settlement

```text

Settlement

A

Paid 180,000

Owes 110,000

+70,000

B

Paid 50,000

Owes 100,000

-50,000

C

Paid 70,000

Owes 90,000

-20,000

Transfers

B → A

50,000 KRW

C → A

20,000 KRW

```

---

### 18.6 Participants

```text

Participants

A   Active

B   Active

C   Active

D   Inactive

```

Only the Event creator should see controls such as:

```text

[ Deactivate ]

[ Reactivate ]

```

---

## 19. Recommended Navigation

Avoid unnecessary global tabs.

Keep the app Event-centered.

```text

Login

  ↓

Event List

  ↓

Event Detail

 ├── Expense Detail

 ├── Add Expense

 ├── Participants

 └── Settlement

```

This keeps the application structure simple and lightweight.

---

## 20. Core Database Entities

Minimum required entities:

```text

User

Event

EventMember

Expense

ExpenseItem

ExpenseParticipant

```

Relationships:

```text

User

  │

  └── EventMember

          │

          └── Event

                │

                └── Expense

                     ├── ExpenseItem

                     └── ExpenseParticipant

```

---

## 21. Suggested Relational Schema

### users

```text

id

email

display_name

auth_provider

created_at

```

### events

```text

id

name

created_by

currency

status

invite_code

created_at

completed_at

```

### event_members

```text

id

event_id

user_id

status

joined_at

deactivated_at

```

Unique constraint:

```text

(event_id, user_id)

```

### expenses

```text

id

event_id

title

total_amount

payer_id

created_by

split_type

created_at

updated_at

```

### expense_items

```text

id

expense_id

name

amount

sort_order

```

### expense_participants

```text

id

expense_id

user_id

mode

fixed_amount

```

Unique constraint:

```text

(expense_id, user_id)

```

---

## 22. Monetary Data Handling

Do not use floating-point values for money.

Avoid:

```text

float

double

```

Use:

```text

integer

```

For KRW, store amounts in whole won.

For currencies with decimal units, store amounts in the smallest monetary unit.

Example:

```text

$12.34

→ 1234 cents

```

This avoids floating-point rounding errors.

---

## 23. Concurrency Considerations

Multiple users may edit the same Event.

At minimum, the system should ensure:

- Expense creation is handled as an independent transaction

- `updated_at` can be used for conflict detection

- Deleted expenses cannot be edited

- Completed Events reject new write operations

Real-time collaborative editing is not required for the MVP.

---

## 24. Audit Information

Because multiple users contribute to the same Event, each expense must record:

```text

created_by

created_at

updated_at

```

The UI may display:

```text

Entered by: Younghee

Paid by: Chulsoo

Created: 2026-09-10

```

This keeps shared entries traceable.

---

## 25. Important Edge Cases

### 25.1 Payer Becomes Inactive

Existing expenses remain unchanged.

The payer remains part of historical settlement calculations.

---

### 25.2 Responsible Participant Becomes Inactive

Existing expense responsibilities remain unchanged.

The participant is excluded only from the default participant list for future expenses.

---

### 25.3 Editing a Completed Event

The Event creator must reopen the Event:

```text

COMPLETED

→ ACTIVE

```

After reopening:

- Expenses can be edited again

- Settlement results are recalculated

---

### 25.4 User Opens the Same Invitation Multiple Times

If the user is already an Event member:

- Do not create a duplicate EventMember record

- Redirect the user to the existing Event

---

### 25.5 Detail Item Total Does Not Match Expense Total

Allow this.

Show the difference in the UI if useful.

---

### 25.6 Split Amount Integrity

The following invariant must always hold:

```text

sum(member burden) == expense.total_amount

```

---

## 26. Recommended UX Principles

### Fast Expense Entry

Adding an expense is the most frequent user action, so the default flow should require as few inputs as possible.

Default values:

- `payer = current logged-in user`

- `split participants = all Active members`

- `split mode = Equal`

A common expense should be savable using only:

```text

Expense title

Amount

Save

```

Advanced split controls should appear only when needed.

---

## 27. Product Principles

### Keep the App Event-Centric

The main relationship is between users and Events, not between users and friends.

### Keep Expense Entry Fast

If expense entry becomes tedious, actual usage will drop quickly.

### Preserve Historical Data

Use Inactive status instead of permanently deleting members.

### Make Calculations Deterministic

The same inputs must always produce the same settlement result.

### Avoid Feature Creep

The MVP should focus on:

```text

Record

→ Split

→ Settle

```

---

## 28. MVP Acceptance Criteria

The MVP is considered complete when all of the following scenarios work.

### Scenario 1

User A logs in and creates an Event.

### Scenario 2

User A sends an invitation link to User B, and User B logs in and joins the Event.

### Scenario 3

User C joins the same Event using an invitation code.

### Scenario 4

User A creates a 90,000 KRW expense.

```text

payer = A

participants = A, B, C

split = equal

```

Expected result:

```text

30,000 KRW per person

```

### Scenario 5

User B creates a 120,000 KRW expense.

```text

payer = B

A = 50,000 fixed

B = 20,000 fixed

C = auto

D = auto

```

Expected result:

```text

A = 50,000

B = 20,000

C = 25,000

D = 25,000

```

### Scenario 6

User B edits an expense that User B created.

### Scenario 7

User A, as the Event creator, edits an expense created by User B.

### Scenario 8

The settlement screen correctly shows each user's:

```text

paid

owed

balance

```

### Scenario 9

The app produces a final transfer plan such as:

```text

B → A: X KRW

C → A: Y KRW

```

### Scenario 10

User A marks the Event as completed.

After completion, regular members cannot modify expenses.

### Scenario 11

If a correction is needed, User A reopens the Event.

### Scenario 12

Deactivating a user does not break historical expenses or settlement results.

---

## 29. Future Enhancements

Consider these only after the MVP is stable.

### Priority 1

- Expense search

- Expense categories

- Expense date

- Simple Event statistics

- Settlement completion check

### Priority 2

- Receipt image attachment

- Receipt OCR

- Push notifications

- Expense edit history

### Priority 3

- Multi-currency support

- Exchange rates

- Bank or card integration

- Payment service integration

---

## 30. Final MVP Definition

The Expense Splitter MVP can be summarized as:

> An Event-based shared expense app where authenticated users join Events, enter expenses collaboratively, split costs using either equal sharing or partial fixed amounts plus equal remainder distribution, and receive a final settlement showing who should pay whom.

Core user flow:

```text

Login

→ Create or Join Event

→ Add Expense

→ Split Cost

→ Review Settlement

→ Complete Event

```

Centralize every backend call in one services layer, and create a mock implementation of it so the whole app runs without a real backend.

add tests.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/72fff616-b436-466f-a58e-2ec6f961031f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

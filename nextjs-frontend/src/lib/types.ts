// API types — mirror docs/spec.md §4.2 exactly (camelCase on the wire).
// Money is integer fils (1 AED = 100 fils). Dates "YYYY-MM-DD", months "YYYY-MM",
// timestamps UTC ISO-8601 strings.

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // UTC ISO-8601
export type Month = string; // YYYY-MM

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/* ---------------- Auth / household ---------------- */

export type Role = "owner" | "member";

export interface User {
  id: ID;
  name: string;
  email: string;
  /** Sign-in name; null for accounts that sign in with their email. */
  username: string | null;
  role: Role;
  /** DiceBear style id (see lib/avatars.ts) and seed; always set by the API. */
  avatarStyle: string;
  avatarSeed: string;
}

export type Member = User;

export interface Household {
  id: ID;
  name: string;
  baseCurrency: string;
  members: Member[];
}

export interface MeResponse {
  user: User;
  household: Household;
}

export interface AuthUserResponse {
  user: User;
}

export interface AuthStatus {
  registrationOpen: boolean;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  householdName: string;
}

export interface JoinRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  inviteCode: string;
}

export interface LoginRequest {
  /** Username or email address. */
  username: string;
  password: string;
}

export interface ProfileUpdate {
  name?: string;
  avatarStyle?: string;
  avatarSeed?: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface HouseholdUpdate {
  name: string;
}

export interface Invite {
  code: string;
  expiresAt: ISODateTime;
}

/** Outstanding invite (GET /household/invites, owner only). The code itself is never returned. */
export interface InviteSummary {
  id: ID;
  createdBy: ID;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

/* ---------------- Accounts ---------------- */

export type AccountType =
  "bank" | "savings" | "credit_card" | "cash" | "loan" | "investment";

export interface Account {
  id: ID;
  householdId?: ID;
  name: string;
  institution?: string | null;
  type: AccountType;
  currency: string;
  openingBalanceFils: number;
  balanceFils: number;
  last4?: string | null;
  color?: string | null;
  archived: boolean;
  purpose?: AccountPurpose;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface AccountCreate {
  name: string;
  institution?: string | null;
  type: AccountType;
  currency?: string;
  openingBalanceFils: number;
  last4?: string | null;
  color?: string | null;
  purpose?: AccountPurpose;
}

export type AccountUpdate = Partial<AccountCreate>;

/* ---------------- Categories ---------------- */

export type CategoryKind = "income" | "expense";
export type CategoryGroup =
  "essentials" | "lifestyle" | "debt" | "savings" | "income" | "other";

export interface Category {
  id: ID;
  householdId?: ID;
  name: string;
  kind: CategoryKind;
  group: CategoryGroup;
  icon?: string | null;
  color?: string | null;
  archived: boolean;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface CategoryCreate {
  name: string;
  kind: CategoryKind;
  group: CategoryGroup;
  icon?: string | null;
  color?: string | null;
}

export type CategoryUpdate = Partial<CategoryCreate>;

/* ---------------- Transactions ---------------- */

export type TransactionType = "income" | "expense" | "transfer";
export type TransactionSource = "manual" | "import";

export interface TxnItem {
  name: string;
  amountFils?: number | null;
  quantity?: number | null;
}

/** "business" accounts (e.g. Sessions DXB) are kept out of household totals. */
export type AccountPurpose = "household" | "business";

export interface Transaction {
  id: ID;
  householdId?: ID;
  accountId: ID;
  date: ISODate;
  amountFils: number;
  type: TransactionType;
  categoryId?: ID | null;
  toAccountId?: ID | null;
  merchant?: string | null;
  note?: string | null;
  createdBy: ID;
  createdByName?: string | null;
  source: TransactionSource;
  items?: TxnItem[];
  /** Flagged for a person to check, e.g. a bank row with no merchant/payee name. */
  needsReview?: boolean;
  reviewReason?: string | null;
  sourceRef?: string | null;
  importBatch?: string | null;
  billId?: ID | null;
  deletedAt?: ISODateTime | null;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface TransactionCreate {
  accountId: ID;
  date: ISODate;
  amountFils: number;
  type: TransactionType;
  categoryId?: ID | null;
  toAccountId?: ID | null;
  merchant?: string | null;
  note?: string | null;
  items?: TxnItem[];
}

export type TransactionUpdate = Partial<TransactionCreate> & {
  needsReview?: boolean;
};

export type TransactionSort = "date" | "-date" | "amount" | "-amount";

export interface TransactionQuery {
  from?: ISODate;
  to?: ISODate;
  accountId?: ID;
  categoryId?: ID;
  type?: TransactionType;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: TransactionSort;
  /** true = only rows flagged for review; false = only unflagged. */
  needsReview?: boolean;
}

/* ---------------- Budgets ---------------- */

export interface BudgetLine {
  categoryId: ID;
  categoryName: string;
  group: CategoryGroup;
  limitFils: number;
  spentFils: number;
  remainingFils: number;
}

export interface Budget {
  month: Month;
  lines: BudgetLine[];
  totalLimitFils: number;
  totalSpentFils: number;
  incomeFils: number;
  unbudgetedSpentFils: number;
  note?: string | null;
  /** Zero-based plan (budget endpoint only; null on the dashboard's budget). */
  plan?: ZeroBasedPlan | null;
}

export interface BudgetLineInput {
  categoryId: ID;
  limitFils: number;
}

export interface BudgetPut {
  lines: BudgetLineInput[];
  note?: string | null;
}

/* ---------------- Debts ---------------- */

export type DebtKind =
  "credit_card" | "personal_loan" | "car_loan" | "mortgage" | "bnpl" | "other";

export interface Debt {
  id: ID;
  householdId?: ID;
  name: string;
  kind: DebtKind;
  balanceFils: number;
  aprBps: number;
  minPaymentFils: number;
  dueDay: number;
  accountId?: ID | null;
  /** Current balance of the linked account (e.g. the credit card), when accountId is set. */
  linkedAccountBalanceFils?: number | null;
  archived: boolean;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface DebtCreate {
  name: string;
  kind: DebtKind;
  balanceFils: number;
  aprBps: number;
  minPaymentFils: number;
  dueDay: number;
  accountId?: ID | null;
}

export type DebtUpdate = Partial<DebtCreate>;

export interface DebtPayment {
  amountFils: number;
  date: ISODate;
  accountId: ID;
}

/* ---------------- Goals ---------------- */

export interface Goal {
  id: ID;
  householdId?: ID;
  name: string;
  targetFils: number;
  savedFils: number;
  targetDate?: ISODate | null;
  priority: number;
  accountId?: ID | null;
  archived: boolean;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface GoalCreate {
  name: string;
  targetFils: number;
  savedFils?: number;
  targetDate?: ISODate | null;
  priority: number;
  accountId?: ID | null;
}

export type GoalUpdate = Partial<GoalCreate>;

export interface GoalContribution {
  amountFils: number;
}

/* ---------------- Plan ---------------- */

export type Strategy = "avalanche" | "snowball";

export interface Plan {
  strategy: Strategy;
  monthlyDebtBudgetFils: number;
  monthlySavingsFils: number;
  emergencyFundMonths: number;
}

export type PlanPut = Plan;

export interface PayoffPayment {
  debtId: ID;
  paymentFils: number;
  interestFils: number;
  balanceFils: number;
}

export interface PayoffScheduleEntry {
  month: Month;
  payments: PayoffPayment[];
  totalBalanceFils: number;
}

export interface PayoffPerDebt {
  debtId: ID;
  payoffMonth: Month | null;
  interestFils: number;
}

export type PayoffInfeasibleReason =
  "budget_below_minimums" | "negative_amortization";

export interface PayoffResult {
  feasible: boolean;
  reason?: PayoffInfeasibleReason | string;
  shortfallFils?: number;
  strategy?: Strategy;
  months?: number;
  debtFreeMonth?: Month | null;
  totalInterestFils?: number;
  totalPaidFils?: number;
  order?: ID[];
  schedule?: PayoffScheduleEntry[];
  perDebt?: PayoffPerDebt[];
}

export interface CompareResult {
  avalanche: PayoffResult;
  snowball: PayoffResult;
  interestSavedFils?: number;
  monthsSaved?: number;
}

/* ---------------- Insights ---------------- */

export interface CategoryShare {
  categoryId: ID | null;
  expenseFils: number;
  share: number;
}

export interface MonthlySummary {
  month: Month;
  incomeFils: number;
  expenseFils: number;
  netFils: number;
  savingsRate: number | null;
  byCategory: CategoryShare[];
}

/** GET /insights/summary — monthly_summary + previous month deltas. */
export interface InsightsSummary extends MonthlySummary {
  previous?: MonthlySummary | null;
  deltas?: {
    incomeFils: number;
    expenseFils: number;
    netFils: number;
    savingsRate?: number | null;
  } | null;
}

export interface MonthlySeriesPoint {
  month: Month;
  incomeFils: number;
  expenseFils: number;
  netFils: number;
}

export type Trend = "up" | "down" | "flat";
export type Confidence = "low" | "medium" | "high";

export interface Forecast {
  month: Month;
  totalExpenseFils: number;
  totalIncomeFils: number;
  byCategory: { categoryId: ID | null; forecastFils: number; trend: Trend }[];
  confidence: Confidence;
}

export interface Anomaly {
  kind: "category_spike" | "large_transaction";
  categoryId: ID | null;
  transactionId?: ID | null;
  amountFils: number;
  baselineFils: number;
  message: string;
}

export interface FinancialHealth {
  score: number;
  savingsRate: number | null;
  emergencyFundMonths: number | null;
  debtToIncome: number | null;
  tips: string[];
}

/* ---------------- Dashboard ---------------- */

export interface UpcomingDebtPayment {
  debtId: ID;
  name: string;
  dueDate: ISODate;
  minPaymentFils: number;
}

export interface Dashboard {
  summary: InsightsSummary;
  health: FinancialHealth;
  budget: Budget;
  upcomingDebtPayments: UpcomingDebtPayment[];
  recentTransactions: Transaction[];
  accounts: Account[];
}

/** POST /receipts/read: fields read from a receipt's OCR text. Prefill only; nothing is saved. */
export interface ReceiptReading {
  merchant: string | null;
  amountFils: number | null;
  currency: string | null;
  date: ISODate | null;
  categoryId: ID | null;
  accountId: ID | null;
  cardLast4: string | null;
  vatFils: number | null;
  items: { name: string; amountFils: number | null }[];
  source: "ai" | "text";
  aiUnavailable: boolean;
}

/* ---------------- Insights explorer (/insights/explore) ---------------- */

export type ExploreGranularity = "day" | "week" | "month";
export type ExploreGroupBy =
  "category" | "group" | "account" | "member" | "merchant" | "weekday";
export type ExploreFlow = "expense" | "income";

export interface ExploreParams {
  from: ISODate;
  to: ISODate;
  flow: ExploreFlow;
  granularity?: ExploreGranularity;
  groupBy: ExploreGroupBy;
  categories?: ID[];
  accounts?: ID[];
  members?: ID[];
  merchant?: string;
  horizon?: number;
  /** Count business accounts as household money (default: kept out). */
  includeBusiness?: boolean;
}

export interface ExploreTotals {
  incomeFils: number;
  expenseFils: number;
  netFils: number;
  count: number;
  expenseCount: number;
  savingsRate: number | null;
  avgDailyExpenseFils: number;
  avgExpenseFils: number;
}

export interface ExplorePoint {
  period: string;
  start: ISODate;
  end: ISODate;
  incomeFils: number;
  expenseFils: number;
  netFils: number;
  count: number;
  cumulativeNetFils: number;
  prevIncomeFils: number | null;
  prevExpenseFils: number | null;
  partial: boolean;
}

export interface ExploreGroup {
  key: string;
  label: string;
  fils: number;
  count: number;
  share: number;
  avgFils: number;
}

export interface ExploreForecastPoint {
  period: string;
  expenseFils: number | null;
  expenseLowFils: number | null;
  expenseHighFils: number | null;
  incomeFils: number | null;
  incomeLowFils: number | null;
  incomeHighFils: number | null;
}

export interface ExploreResult {
  range: { from: ISODate; to: ISODate; days: number };
  previousRange: { from: ISODate; to: ISODate };
  granularity: ExploreGranularity;
  groupBy: ExploreGroupBy;
  flow: ExploreFlow;
  totals: ExploreTotals;
  previous: ExploreTotals;
  series: ExplorePoint[];
  breakdown: ExploreGroup[];
  stackKeys: { key: string; label: string }[];
  stacked: { period: string; values: Record<string, number> }[];
  weekday: {
    weekday: number;
    label: string;
    fils: number;
    count: number;
    avgFils: number;
  }[];
  daily: { date: ISODate; fils: number }[];
  topMerchants: { merchant: string; fils: number; count: number }[];
  largest: {
    id: ID;
    date: ISODate;
    fils: number;
    merchant: string | null;
    categoryId: ID | null;
  }[];
  forecast: {
    points: ExploreForecastPoint[];
    confidence: Confidence;
    basedOnPeriods: number;
    /** Nothing recorded in the latest complete period; the forecast rests on older history. */
    stale: boolean;
    lastDataPeriod: string | null;
  };
  pace: {
    period: string;
    spentFils: number;
    elapsedDays: number;
    totalDays: number;
    projectedFils: number;
    forecastFils: number | null;
  } | null;
}

/* ---------------- Bills and expected income (/bills, /income-streams) ---------------- */

export type BillKind =
  | "bill"
  | "subscription"
  | "loan"
  | "bnpl"
  | "debt_payment"
  | "savings"
  | "other";
export type BillCadence = "monthly" | "quarterly" | "yearly";
/** estimate: expect the average of the last 3 payments (amountFils until there are any). */
export type AmountMode = "fixed" | "estimate";

export interface Bill {
  id: ID;
  name: string;
  kind: BillKind;
  amountFils: number;
  amountMode: AmountMode;
  cadence: BillCadence;
  dueDayFrom: number;
  dueDayTo: number;
  accountId: ID | null;
  categoryId: ID | null;
  matchText: string[];
  amountTolerancePct: number;
  startMonth: Month;
  endMonth: Month | null;
  instalmentsTotal: number | null;
  instalmentsPaid: number;
  debtId: ID | null;
  purpose: AccountPurpose;
  active: boolean;
  notes: string | null;
  skippedMonths: Month[];
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** What to set aside each month (amount / months in the cadence). */
  monthlyFils: number;
  lastMonth: Month | null;
  instalmentsRemaining: number | null;
  remainingFils: number | null;
  completed: boolean;
}

export interface BillCreate {
  name: string;
  kind: BillKind;
  amountFils: number;
  amountMode?: AmountMode;
  cadence?: BillCadence;
  dueDayFrom: number;
  dueDayTo?: number | null;
  accountId?: ID | null;
  categoryId?: ID | null;
  matchText?: string[];
  amountTolerancePct?: number;
  startMonth: Month;
  endMonth?: Month | null;
  instalmentsTotal?: number | null;
  instalmentsPaid?: number;
  debtId?: ID | null;
  purpose?: AccountPurpose;
  active?: boolean;
  notes?: string | null;
}

export type BillUpdate = Partial<BillCreate>;

export type BillStatus =
  "paid" | "skipped" | "overdue" | "due_soon" | "upcoming";
export type IncomeStatus = "received" | "overdue" | "due_soon" | "upcoming";

export interface BillMatch {
  transactionId: ID;
  date: ISODate;
  amountFils: number;
  merchant: string | null;
  accountId: ID;
  /** linked: set by hand or stored earlier; high: rules within tolerance; medium: rules, amount off. */
  confidence: "linked" | "high" | "medium";
}

export interface BillMonthItem {
  billId: ID;
  name: string;
  kind: BillKind;
  purpose: AccountPurpose;
  cadence: BillCadence;
  accountId: ID | null;
  categoryId: ID | null;
  amountMode: AmountMode;
  dueFrom: ISODate;
  dueTo: ISODate;
  expectedFils: number;
  paidFils: number;
  differenceFils: number;
  status: BillStatus;
  priceChanged: boolean;
  needsConfirmation: boolean;
  instalmentNumber: number | null;
  instalmentsTotal: number | null;
  matches: BillMatch[];
}

export type IncomeKind = "salary" | "cash_deposit" | "transfer" | "other";

export interface IncomeMonthItem {
  streamId: ID;
  partId: string;
  streamName: string;
  memberId: ID | null;
  label: string;
  kind: IncomeKind;
  accountId: ID | null;
  dueFrom: ISODate;
  dueTo: ISODate;
  expectedFils: number;
  minFils: number | null;
  maxFils: number | null;
  receivedFils: number;
  status: IncomeStatus;
  needsConfirmation: boolean;
  matches: BillMatch[];
}

export interface BillsMonthTotals {
  billsExpectedFils: number;
  billsPaidFils: number;
  billsRemainingFils: number;
  billsCount: number;
  billsPaidCount: number;
  incomeExpectedFils: number;
  incomeReceivedFils: number;
  incomeWaitingFils: number;
}

export interface BillsMonth {
  month: Month;
  today: ISODate;
  items: BillMonthItem[];
  income: IncomeMonthItem[];
  totals: BillsMonthTotals;
}

export interface SafeToSpend {
  cashFils: number;
  billsDueFils: number;
  incomeExpectedFils: number;
  safeToSpendFils: number;
  until: ISODate;
  nextSalary: {
    streamName: string;
    label: string;
    dueFrom: ISODate;
    dueTo: ISODate;
  } | null;
  bills: { billId: ID; name: string; dueFrom: ISODate; amountFils: number }[];
  income: {
    streamName: string;
    label: string;
    dueFrom: ISODate;
    amountFils: number;
  }[];
  accounts: { accountId: ID; name: string; balanceFils: number }[];
}

export interface BillsOverview {
  month: Month;
  today: ISODate;
  safeToSpend: SafeToSpend;
  waitingFor: IncomeMonthItem[];
  upcomingBills: BillMonthItem[];
  totals: BillsMonthTotals;
  hasBills: boolean;
  hasIncome: boolean;
}

export interface BillSuggestion {
  key: string;
  name: string;
  kind: BillKind;
  amountFils: number;
  amountMode: AmountMode;
  dueDayFrom: number;
  dueDayTo: number;
  accountId: ID | null;
  categoryId: ID | null;
  matchText: string[];
  occurrences: number;
  months: number;
  lastDate: ISODate;
  lastAmountFils: number;
  confidence: "high" | "medium";
  transactionIds: ID[];
}

export interface IncomePart {
  id: string;
  label: string;
  kind: IncomeKind;
  amountFils: number;
  amountMinFils: number | null;
  amountMaxFils: number | null;
  dayFrom: number;
  dayTo: number;
  matchText: string[];
}

export interface IncomeStream {
  id: ID;
  name: string;
  memberId: ID | null;
  accountId: ID | null;
  parts: IncomePart[];
  active: boolean;
  notes: string | null;
  archived: boolean;
  monthlyFils: number;
}

/* ---------------- Statement import (/imports, /merchant-rules) ---------------- */

export type ImportRowStatus = "new" | "recorded" | "transfer" | "review";
export type ImportRowAction = "import" | "skip";
export type ImportStatus =
  "draft" | "committing" | "committed" | "rolling_back" | "rolled_back";

export interface ImportReconciliation {
  ok: boolean;
  arithmeticOk: boolean;
  runningBalanceOk: boolean;
  messages: string[];
}

export interface ImportCounts {
  total: number;
  new: number;
  recorded: number;
  transfer: number;
  review: number;
  toImport: number;
  skipped: number;
}

/** One bank account (statement section) inside an uploaded statement. */
export interface ImportSection {
  index: number;
  bank: string;
  product: string;
  accountType: string;
  last4: string | null;
  currency: string;
  periodFrom: ISODate | null;
  periodTo: ISODate | null;
  openingFils: number | null;
  closingFils: number | null;
  totalDebitFils: number;
  totalCreditFils: number;
  rowCount: number;
  /** null = no matching app account yet; the user picks or creates one. */
  accountId: ID | null;
  accountName: string | null;
  suggestedAccountName: string;
  reconciliation: ImportReconciliation;
  counts: ImportCounts;
}

export interface ImportRow {
  /** "<section>-<row>" */
  id: string;
  sectionIndex: number;
  date: ISODate;
  description: string;
  debitFils: number | null;
  creditFils: number | null;
  balanceFils: number | null;
  amountFils: number;
  direction: "in" | "out";
  ref: string | null;
  cardLast4: string | null;
  counterpartyLast4: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  sourceRef: string;
  status: ImportRowStatus;
  action: ImportRowAction;
  type: TransactionType;
  categoryId: ID | null;
  merchant: string | null;
  note: string | null;
  /** Transfers: the other own account (money goes to it on a debit, comes from it on a credit). */
  counterAccountId: ID | null;
  needsReview: boolean;
  reviewReason: string | null;
  matchedTransactionId: ID | null;
  pairedRowId: string | null;
  /** Human explanation of the proposal. */
  reason: string;
  edited: boolean;
}

export interface ImportAccountCheck {
  sectionIndex: number;
  accountId: ID;
  accountName: string;
  periodTo: ISODate | null;
  statementClosingFils: number | null;
  /** App balance counting transactions dated on or before the statement end. */
  appBalanceFils: number;
  differenceFils: number | null;
  currentBalanceFils: number;
}

export interface ImportCommitResult {
  createdCount: number;
  skippedCount: number;
  accounts: ImportAccountCheck[];
}

export interface ImportSummary {
  id: ID;
  filename: string;
  bank: string;
  format: string;
  status: ImportStatus;
  createdAt: ISODateTime;
  createdByName: string | null;
  committedAt: ISODateTime | null;
  rolledBackAt: ISODateTime | null;
  periodFrom: ISODate | null;
  periodTo: ISODate | null;
  sections: ImportSection[];
  counts: ImportCounts;
  issues: string[];
  commitResult: ImportCommitResult | null;
}

export interface StatementImport extends ImportSummary {
  rows: ImportRow[];
}

export interface ImportPatch {
  sections?: { index: number; accountId: ID | null }[];
  rematch?: boolean;
}

export interface ImportRowPatch {
  id: string;
  action?: ImportRowAction;
  type?: TransactionType;
  categoryId?: ID;
  merchant?: string;
  note?: string;
  counterAccountId?: ID;
  needsReview?: boolean;
}

export interface MerchantRule {
  id: ID;
  pattern: string;
  merchant: string | null;
  categoryId: ID | null;
  categoryName: string | null;
  kind: string | null;
  source: string;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface IncomePartInput {
  id?: string;
  label: string;
  kind: IncomeKind;
  amountFils: number;
  amountMinFils?: number | null;
  amountMaxFils?: number | null;
  dayFrom: number;
  dayTo?: number | null;
  matchText?: string[];
}

export interface IncomeStreamCreate {
  name: string;
  memberId?: ID | null;
  accountId?: ID | null;
  parts: IncomePartInput[];
  active?: boolean;
  notes?: string | null;
}

export type IncomeStreamUpdate = Partial<IncomeStreamCreate>;

/** Zero-based plan on GET/PUT /budgets/{month}: income - commitments - sinking funds - savings - flexible. */
export interface ZeroBasedPlan {
  month: Month;
  expectedIncomeFils: number;
  commitmentsFils: number;
  commitmentsByKind: { kind: BillKind; amountFils: number }[];
  sinkingFundsFils: number;
  sinkingFunds: {
    billId: ID;
    name: string;
    monthlyFils: number;
    amountFils: number;
    cadence: BillCadence;
    dueThisMonth: boolean;
  }[];
  savingsFils: number;
  flexibleFils: number;
  leftToAssignFils: number;
  committedShare: number | null;
  overlapCategoryIds: ID[];
  suggestedGoal: { id: ID; name: string } | null;
  hasBills: boolean;
  hasIncome: boolean;
}

export interface MerchantRuleCreate {
  pattern: string;
  categoryId: ID;
  merchant?: string | null;
}

export type MerchantRuleUpdate = Partial<MerchantRuleCreate>;

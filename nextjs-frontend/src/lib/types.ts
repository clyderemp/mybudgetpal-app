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

export type AccountType = "bank" | "savings" | "credit_card" | "cash" | "loan" | "investment";

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
export type CategoryGroup = "essentials" | "lifestyle" | "debt" | "savings" | "income" | "other";

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

export type TransactionUpdate = Partial<TransactionCreate> & { needsReview?: boolean };

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

export type DebtKind = "credit_card" | "personal_loan" | "car_loan" | "mortgage" | "bnpl" | "other";

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

export type PayoffInfeasibleReason = "budget_below_minimums" | "negative_amortization";

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
export type ExploreGroupBy = "category" | "group" | "account" | "member" | "merchant" | "weekday";
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
  weekday: { weekday: number; label: string; fils: number; count: number; avgFils: number }[];
  daily: { date: ISODate; fils: number }[];
  topMerchants: { merchant: string; fils: number; count: number }[];
  largest: { id: ID; date: ISODate; fils: number; merchant: string | null; categoryId: ID | null }[];
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

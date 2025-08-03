export const ACCOUNT_TYPES = [
  { label: "Joint Account", value: "joint" },
  { label: "Personal Account", value: "personal" },
  { label: "Savings Account", value: "savings" },
];

export const PAYMENT_METHODS = [
  { label: "Debit Card", value: "debit" },
  { label: "Credit Card", value: "credit" },
  { label: "Cash Payment", value: "cash" },
];

export const TRANSACTION_TYPES = [
  { label: "Expenses", value: "expenses" },
  { label: "Income", value: "income" },
  { label: "Savings", value: "savings" },
  { label: "Credit", value: "credit" },
];

export const TRANSACTION_CATEGORIES = {
  expenses: [
    //FIXED EXPENSES
    "Car Payments",
    "Credit Payments",
    "Insurance",
    "Internet Bill",
    "Loan Payments",
    "Memberships",
    "Phone Bill",
    "Rent",
    "Subscriptions",
    "Taxes",
    "Tuition",
    "Utilities",
    //VARIABLE EXPENSES
    "Appliances",
    "Car Maintenance",
    "Charge Fees",
    "Clothings",
    "Commute",
    "Dining Out",
    "Dining Out - Food",
    "Dining Out - Drinks",
    "Entertainment",
    "E-Purchases",
    "Gas",
    "Groceries",
    "Home Maintenance",
    "Investments",
    "Medical Care",
    "Others (Personal Spendings)",
    "Parking",
    "Recreation",
    "Taxes",
    "Travels",
    "Personal Care",
    "Gym Related",
    "Vitamins & Supplements",
    "Unknown",
  ],
  credit: ["Personal Loan", "Credit Card", "Student Loan", "Auto Loan"],
  savings: [
    "Short Term Savings",
    "Long Term Savings",
    "Emergency Funds",
    "Retirement Savings",
    "Investment Savings",
  ],
  income: [
    "Job Paycheque",
    "Tax Return",
    "Passive Income",
    "Loan Funds",
    "Others",
  ],
};

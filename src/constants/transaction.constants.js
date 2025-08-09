export const ACCOUNT_TYPES = [
  { label: "Joint Account", value: "joint" },
  { label: "Personal Account", value: "personal" },
  { label: "Savings Account", value: "savings" },
  { label: "Credit Card Account", value: "credit" },
];

export const PAYMENT_METHODS = [
  { label: "Debit Card", value: "debit" },
  { label: "Credit Card", value: "credit" },
  { label: "Cash Payment", value: "cash" },
  { label: "Installment 3rd-Party", value: "installment" },
];

export const TRANSACTION_TYPES = [
  { label: "Expenses", value: "expenses" },
  { label: "Income", value: "income" },
  { label: "Savings", value: "savings" },
  { label: "Credit", value: "credit" },
];

export const TRANSACTION_CATEGORIES = {
  expenses: [
    "Custom",
    // FIXED EXPENSES
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

    // VARIABLE EXPENSES
    "Appliances",
    "Car Maintenance",
    "Charge Fees",
    "Clothings",
    "Commute",
    "Dining Out",
    "Entertainment",
    "E-Purchases",
    "Gas",
    "Groceries",
    "Home Maintenance",
    "Investments",
    "Medical Care",
    "Parking",
    "Parking Tickets",
    "Recreation",
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

import React from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "@/views/components/layouts/main.layout";
import HomePage from "@/views/pages/main/home/home.page";
import AllTransactionsPage from "@/views/pages/main/transactions/all-transactions.page";
import ExpensesPage from "@/views/pages/main/transactions/expenses.page";
import IncomePage from "@/views/pages/main/transactions/income.page";
import SavingsPage from "@/views/pages/main/transactions/savings.page";
import CreditPage from "@/views/pages/main/transactions/credit.page";

const MainStack = () => (
  <Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/transactions/all" element={<AllTransactionsPage />} />
      <Route path="/transactions/expenses" element={<ExpensesPage />} />
      <Route path="/transactions/income" element={<IncomePage />} />
      <Route path="/transactions/savings" element={<SavingsPage />} />
      <Route path="/transactions/credit" element={<CreditPage />} />
      {/* Add other routes here as needed */}
    </Route>
  </Routes>
);

export default MainStack;

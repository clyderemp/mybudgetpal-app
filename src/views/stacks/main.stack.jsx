import React from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "@/views/components/layouts/main.layout";
import HomePage from "@/views/pages/main/home/home.page";
import AllTransactionsPage from "@/views/pages/main/transactions/all-transactions.page";
import ExpensesPage from "@/views/pages/main/transactions/expenses.page";
import IncomePage from "@/views/pages/main/transactions/income.page";
import SavingsPage from "@/views/pages/main/transactions/savings.page";
import CreditPage from "@/views/pages/main/transactions/credit.page";
import UsersPage from "@/views/pages/main/accounts/users.page";
import CardsPage from "@/views/pages/main/accounts/cards.page";
import UnderConstructionRedirect from "@/views/components/customs/customRedirect";
import SettingsPage from "@/views/pages/main/settings/settings.page";

const MainStack = () => (
  <Routes>
    <Route element={<MainLayout />}>
      {/* VALID PAGES */}
      <Route path="/" element={<HomePage />} />
      <Route path="/transactions/all" element={<AllTransactionsPage />} />
      <Route path="/transactions/expenses" element={<ExpensesPage />} />
      <Route path="/transactions/income" element={<IncomePage />} />
      <Route path="/transactions/savings" element={<SavingsPage />} />
      <Route path="/transactions/credit" element={<CreditPage />} />
      <Route path="/accounts/users" element={<UsersPage />} />
      <Route path="/accounts/cards" element={<CardsPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* Catch all unmatched routes, show toast, redirect */}
      <Route path="*" element={<UnderConstructionRedirect />} />
    </Route>
  </Routes>
);

export default MainStack;

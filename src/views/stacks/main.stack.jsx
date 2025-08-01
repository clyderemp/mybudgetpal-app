import React from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "@/views/components/layouts/main.layout";
import HomePage from "@/views/pages/main/home/home.page";
import WaitlistPage from "@/views/pages/main/accounts/waitlist/waitlist.page";
import AdminPage from "@/views/pages/main/accounts/admin/admin.page";
import UsersPage from "@/views/pages/main/accounts/users/users.page";
import BlogsPage from "@/views/pages/main/marketing/blogs.page";
import Reports from "@/views/pages/main/reports/reports.page";

const MainStack = () => (
  <Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/accounts/admin" element={<AdminPage />} />
      <Route path="/accounts/users" element={<UsersPage />} />
      <Route path="/accounts/waitlist" element={<WaitlistPage />} />
      <Route path="/marketing/blogs" element={<BlogsPage />} />
      <Route path="/reports" element={<Reports />} />
      {/* Add other routes here as needed */}
    </Route>
  </Routes>
);

export default MainStack;

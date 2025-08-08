import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

// import GuestOnly from "../views/components/auth/GuestOnly";
import AuthLayout from "../components/layouts/auth.layout";
import Login from "../pages/auth/login.page";

const AuthStack = () => (
  <Routes>
    {/* <Route element={<GuestOnly />}> */}
    <Route element={<AuthLayout />}>
      <Route path="/" element={<Login />} />
      {/* Catch all unmatched routes and redirect to "/" */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
    {/* </Route> */}
  </Routes>
);

export default AuthStack;

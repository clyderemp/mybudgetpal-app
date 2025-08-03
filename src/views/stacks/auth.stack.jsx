import React from "react";
import { Route, Routes } from "react-router-dom";

// import GuestOnly from "../views/components/auth/GuestOnly";
import AuthLayout from "../components/layouts/auth.layout";
import Login from "../pages/auth/login.page";

const AuthStack = () => (
  <Routes>
    {/* <Route element={<GuestOnly />}> */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={<Login />} />
      </Route>
    {/* </Route> */}
  </Routes>
);

export default AuthStack;

import React from "react";
import { Outlet } from "react-router-dom";
import CoinsBackground from "../../components/background/coins.background";

const AuthLayout = () => {
  return (
    <div
      className="relative flex justify-center items-center overflow-hidden"
      style={{ height: "95vh", width: "99vw", boxSizing: "border-box" }}
    >
      {/* Background blobs fixed behind */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <CoinsBackground />
      </div>

      {/* Content container */}
      <div
        className="flex relative justify-center items-center w-full h-full rounded-[8px] border-2 overflow-hidden bg-white"
        style={{
          maxWidth: "500px",
          maxHeight: "500px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          boxSizing: "border-box",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

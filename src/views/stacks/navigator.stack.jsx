import React from "react";
import { useAuth } from "@/context/auth.provider";
import AuthStack from "@/views/stacks/auth.stack";
import MainStack from "@/views/stacks/main.stack";
import Loader from "@/views/components/static/Loader";
import { useLoader } from "@/context/loader.provider";

const StackNavigator = () => {
  const { user, loading } = useAuth();
  const { showLoader } = useLoader();
  if (loading) {
    showLoader({ text: "Loading your data", type: "loading" });
  } else {
    return user ? <MainStack /> : <AuthStack />;
  }
};

export default StackNavigator;

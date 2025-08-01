import React from "react";
import { useAuth } from "@/context/auth.provider";
import AuthStack from "@/views/stacks/auth.stack";
import MainStack from "@/views/stacks/main.stack";
import Loader from "@/views/components/static/Loader";

const StackNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // You can show a loading spinner here while auth state resolves
    return <Loader/>;
  }

  return user ? <MainStack /> : <AuthStack />;
};

export default StackNavigator;

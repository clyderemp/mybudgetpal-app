import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ToastProvider } from "@/context/toast.provider";
import AuthProvider from "@/context/auth.provider";
import AuthInitializer from "@/context/auth.initializer";
import StackNavigator from "@/views/stacks/navigator.stack";
import { ModalProvider } from "@/context/modal.provider";

function App() {
  return (
    <React.StrictMode>
      <AuthProvider>
        <ModalProvider>
          <ToastProvider>
              <AuthInitializer>
                <Router>
                  <StackNavigator/>
                </Router>
              </AuthInitializer>
          </ToastProvider>
        </ModalProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

export default App;

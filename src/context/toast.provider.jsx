import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [activeToast, setActiveToast] = useState(null);
  const [toastType, setToastType] = useState("info");
  const [toastTimeoutId, setToastTimeoutId] = useState(null);

  const showToast = (message, type = "info") => {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    setActiveToast(message);
    setToastType(type);
    const timeout = setTimeout(() => {
      setActiveToast(null);
      setToastTimeoutId(null);
    }, 3000);
    setToastTimeoutId(timeout);
  };

  const closeToast = () => {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    setActiveToast(null);
    setToastTimeoutId(null);
  };

  const toastStyles = {
    success: "bg-green-100 border-green-500 text-green-800",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-800",
    error: "bg-red-100 border-red-500 text-red-800",
    info: "bg-white border-gray-300 text-gray-800",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className={`fixed bottom-4 left-4 right-4 sm:left-4 sm:right-auto z-50 px-6 py-4 rounded-xl shadow-md border flex items-center gap-3 w-full sm:w-auto ${toastStyles[toastType] || toastStyles.info}`}
          >
            <span className="text-sm sm:text-base">{activeToast}</span>
            <button
              onClick={closeToast}
              className="ml-auto text-gray-500 hover:text-black"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

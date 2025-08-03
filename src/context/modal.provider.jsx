import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [modalData, setModalData] = useState({ content: null, showClose: true });

  const openModal = (content, showClose = true) => {
    setModalData({ content, showClose });
  };

  const closeModal = () => {
    setModalData({ content: null, showClose: true });
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <AnimatePresence>
        {modalData.content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full"
            >
              {modalData.showClose && (
                <button
                  onClick={closeModal}
                  className="absolute top-3 right-3 text-gray-500 hover:text-black"
                >
                  <X size={20} />
                </button>
              )}
              {modalData.content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

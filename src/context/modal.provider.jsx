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
  const [modalData, setModalData] = useState({
    content: null,
    showClose: true,
  });

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
          // Backdrop fade in/out
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          >
            {/* Modal content: fade in on enter, slide down on exit */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 50 }} // slide down by 50px + fade out
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full"
            >
              {modalData.showClose && (
                <button
                  onClick={closeModal}
                  className="absolute top-3 right-3 text-gray-500 hover:text-black"
                  aria-label="Close modal"
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

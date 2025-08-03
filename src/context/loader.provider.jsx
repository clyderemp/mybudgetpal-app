import React, { createContext, useContext, useState, useCallback } from "react";
import Loader from "@/views/components/static/Loader";

const LoaderContext = createContext();

export const LoaderProvider = ({ children }) => {
  const [loader, setLoader] = useState({
    visible: false,
    text: "Loading",
    progress: null,
    type: "default",
  });

  const showLoader = useCallback(
    ({ text = "Loading", progress = null, type = "default" } = {}) => {
      setLoader({ visible: true, text, progress, type });
    },
    []
  );

  const closeLoader = useCallback(() => {
    setLoader((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <LoaderContext.Provider value={{ showLoader, closeLoader }}>
      {children}
      {loader.visible && (
        <Loader
          text={loader.text}
          progress={loader.progress}
          type={loader.type}
        />
      )}
    </LoaderContext.Provider>
  );
};

export const useLoader = () => useContext(LoaderContext);

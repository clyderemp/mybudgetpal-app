"use client";
import { ThemeProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "@/lib/query-client";
import { theme } from "@/lib/theme";
import { Toaster } from "@/components/ui/Toaster";

/** Client-side providers. AppRouterCacheProvider (emotion) wraps this in the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <QueryClientProvider client={queryClient}>
          <Tooltip.Provider delayDuration={300}>
            {children}
            <Toaster />
          </Tooltip.Provider>
        </QueryClientProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

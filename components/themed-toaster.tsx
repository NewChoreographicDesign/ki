"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-toggle";

/** Keeps sonner's own color scheme in sync with the app's light/dark toggle. */
export function ThemedToaster() {
  const theme = useTheme();
  return <Toaster theme={theme} position="top-center" richColors />;
}

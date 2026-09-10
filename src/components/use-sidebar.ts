"use client";
import { useCallback, useEffect, useState } from "react";

export type SidebarMode = "expanded" | "hover";

/** Persisted sidebar preference: full-width or hover-expand rail. */
export function useSidebar() {
  const [mode, setMode] = useState<SidebarMode>("hover");
  const [hoverOpen, setHoverOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nav-sidebar");
      if (saved === "expanded" || saved === "hover") setMode(saved);
    } catch { /* noop */ }
  }, []);

  const set = useCallback((m: SidebarMode) => {
    setMode(m);
    try {
      localStorage.setItem("nav-sidebar", m);
    } catch { /* noop */ }
  }, []);

  return { mode, setMode: set, hoverOpen, setHoverOpen, mobileOpen, setMobileOpen };
}

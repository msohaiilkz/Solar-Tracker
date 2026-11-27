/* The current dashboard page (id, label, icon, group), provided by Shell */
import { createContext, useContext } from "react";

export const PageCtx = createContext(null);
export const usePage = () => useContext(PageCtx);

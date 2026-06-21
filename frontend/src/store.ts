import { create } from "zustand";
import type { Account, Role } from "./types";

const TOKEN_KEY = "radguard_token";
const ACC_KEY = "radguard_account";

function loadAccount(): Account | null {
  try {
    const s = localStorage.getItem(ACC_KEY);
    return s ? (JSON.parse(s) as Account) : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

interface AuthState {
  token: string | null;
  account: Account | null;
  setAuth: (token: string, account: Account) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: getToken(),
  account: loadAccount(),
  setAuth: (token, account) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACC_KEY, JSON.stringify(account));
    set({ token, account });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACC_KEY);
    set({ token: null, account: null });
  },
}));

interface RoleState {
  role: Role;
  setRole: (r: Role) => void;
}

export const ROLE_LABELS: Record<Role, string> = {
  radiologist: "Radiology",
  emergency: "Emergency",
  cardiology: "Cardiology",
  surgery: "Surgery",
};

export const useRole = create<RoleState>((set) => ({
  role: "radiologist",
  setRole: (role) => set({ role }),
}));

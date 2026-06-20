import { create } from "zustand";
import type { Role } from "./types";

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

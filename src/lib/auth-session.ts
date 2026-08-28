import type { User } from "@/lib/types/user";

export const AUTH_USER_KEY = "auth-user";

export function saveAuthUser(user: User): void {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getAuthUser(): User | null {
  const raw = sessionStorage.getItem(AUTH_USER_KEY);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as User;
}

export function clearAuthUser(): void {
  sessionStorage.removeItem(AUTH_USER_KEY);
}

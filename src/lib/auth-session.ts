import type { User } from "@/lib/types/user";

export const AUTH_USER_KEY = "auth-user";

let cachedRaw: string | null | undefined;
let cachedUser: User | null = null;

function readAuthUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(AUTH_USER_KEY);

  if (raw === cachedRaw) {
    return cachedUser;
  }

  cachedRaw = raw;
  cachedUser = raw ? (JSON.parse(raw) as User) : null;
  return cachedUser;
}

export function saveAuthUser(user: User): void {
  const raw = JSON.stringify(user);
  sessionStorage.setItem(AUTH_USER_KEY, raw);
  cachedRaw = raw;
  cachedUser = user;
}

export function getAuthUser(): User | null {
  return readAuthUser();
}

export function clearAuthUser(): void {
  sessionStorage.removeItem(AUTH_USER_KEY);
  cachedRaw = null;
  cachedUser = null;
}

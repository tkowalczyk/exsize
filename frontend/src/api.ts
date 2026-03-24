let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
}

export function getToken() {
  return token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface UserResponse {
  id: number;
  email: string;
  role: "parent" | "child" | "admin";
  language: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function login(email: string, password: string) {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  email: string,
  password: string,
  role: "parent" | "child" | "admin",
) {
  return apiFetch<UserResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export function getMe() {
  return apiFetch<UserResponse>("/api/auth/me");
}

// --- Family ---

export interface FamilyMember {
  id: number;
  email: string;
  role: string;
}

export interface FamilyResponse {
  id: number;
  pin: string;
  members: FamilyMember[];
}

export interface FamilyCreateResponse {
  id: number;
  pin: string;
}

export function getFamily() {
  return apiFetch<FamilyResponse>("/api/family");
}

export function createFamily() {
  return apiFetch<FamilyCreateResponse>("/api/family", { method: "POST" });
}

export function joinFamily(pin: string) {
  return apiFetch<{ family_id: number }>("/api/family/join", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function removeFamilyMember(userId: number) {
  return apiFetch<{ detail: string }>(`/api/family/members/${userId}`, {
    method: "DELETE",
  });
}

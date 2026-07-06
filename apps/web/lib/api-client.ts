const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AuthSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("saas_token");
}

export function setSession(session: AuthSession) {
  localStorage.setItem("saas_token", session.token);
  localStorage.setItem("saas_session", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("saas_token");
  localStorage.removeItem("saas_session");
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("saas_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detailMsg = Array.isArray(data.details)
      ? data.details
          .map((d: { message?: string }) => d.message)
          .filter(Boolean)
          .join(" · ")
      : "";
    throw new ApiError(
      detailMsg || data.error || "Request failed",
      res.status,
      data.code
    );
  }

  return data as T;
}

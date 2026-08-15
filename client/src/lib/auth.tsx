"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Session persistence now lives entirely in httpOnly cookies the
    // browser sends automatically — there's no client-readable token to
    // check first. We just ask the server "who am I" on load; api()'s
    // built-in refresh-on-401 (see lib/api.ts) transparently renews the
    // access token via the refresh cookie if it had expired, so this
    // still succeeds across page reloads as long as the refresh token
    // (30 days) hasn't also expired.
    api<{ user: User }>("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { user } = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(user);
    router.push("/groups");
  }

  async function register(name: string, email: string, password: string) {
    const { user } = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUser(user);
    router.push("/groups");
  }

  async function logout() {
    // Best-effort: even if this fails (e.g. network hiccup), the cookies
    // are set to expire and the client-side user state is cleared
    // regardless, so the UI never gets stuck "logged in" locally.
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// frontend/src/context/AuthContext.js

/**
 * React context for managing authentication state on the frontend.
 * Stores the current user and token in memory.
 */

import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

/**
 * Hook for consuming auth context.
 *
 * @returns {{ user: object|null, token: string|null, login: Function, logout: Function }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Provides authentication state to child components.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns JSX.Element
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Optional: try to fetch current user on mount using cookie-based auth.
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("http://localhost:7005/auth/me", {
          method: "GET",
          credentials: "include", // send cookies
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    }

    fetchCurrentUser();
  }, []);

  /**
   * Stores login response in context.
   *
   * @param {{ user: object, token: string }} payload - Response from backend login/register.
   */
  function handleLogin(payload) {
    setUser(payload.user);
    setToken(payload.token || null);
  }

  /**
   * Clears authentication state.
   */
  function handleLogout() {
    setUser(null);
    setToken(null);
  }

  const value = {
    user,
    token,
    login: handleLogin,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

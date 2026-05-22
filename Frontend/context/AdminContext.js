"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiUrl } from "../constants";

const AdminContext = createContext();

export const useAdmin = () => {
  return useContext(AdminContext);
};

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrapAdmin = async () => {
      try {
        const response = await fetch(apiUrl("/api/auth/me"), {
          credentials: "include",
        });

        if (response.ok) {
          const profile = await response.json();
          if (profile.role === 'admin') {
            setAdmin(profile);
          } else {
            setAdmin(null);
          }
        } else {
          setAdmin(null);
        }
      } catch (error) {
        console.error("Failed to bootstrap admin auth", error);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAdmin();
  }, []);

  const adminLogin = async (email, password) => {
    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.role === 'admin') {
          // Cookie is set; store admin profile in-memory
          setAdmin(data);
          return { success: true };
        } else {
          return { success: false, message: "Access denied. Admin only." };
        }
      } else {
        return { success: false, message: data.message || "Login failed" };
      }
    } catch (error) {
      console.error(error);
      return { success: false, message: "Login failed" };
    }
  };

  const adminLogout = () => {
    // Clear cookie on backend
    fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    setAdmin(null);
    try { localStorage.removeItem("ruvia_admin"); } catch {}
  };

  const value = {
    admin,
    adminLogin,
    adminLogout,
    loading,
    isAuthenticated: !!admin
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

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
        const storedAdmin = localStorage.getItem("ruvia_admin");
        if (!storedAdmin) {
          setAdmin(null);
          setLoading(false);
          return;
        }

        const parsedAdmin = JSON.parse(storedAdmin);
        if (!parsedAdmin?.token || parsedAdmin.role !== 'admin') {
          localStorage.removeItem("ruvia_admin");
          setAdmin(null);
          setLoading(false);
          return;
        }

        // Verify admin status with backend
        const response = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${parsedAdmin.token}` }
        });

        if (response.ok) {
          const profile = await response.json();
          if (profile.role === 'admin') {
            setAdmin(parsedAdmin);
          } else {
            localStorage.removeItem("ruvia_admin");
            setAdmin(null);
          }
        } else {
          localStorage.removeItem("ruvia_admin");
          setAdmin(null);
        }
      } catch (error) {
        console.error("Failed to bootstrap admin auth", error);
        localStorage.removeItem("ruvia_admin");
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
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.role === 'admin') {
          setAdmin(data);
          localStorage.setItem("ruvia_admin", JSON.stringify(data));
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
    setAdmin(null);
    localStorage.removeItem("ruvia_admin");
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

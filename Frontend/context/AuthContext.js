"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { apiUrl } from "../constants";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  const normalizeUser = (data) => data ? {
    ...data,
  } : null;

  const normalizeAddress = (address = {}) => ({
    id: address._id || address.id || `${Date.now()}`,
    firstName: address.firstName || "",
    lastName: address.lastName || "",
    phone: address.phone || "",
    address: address.address || address.street || "",
    city: address.city || "",
    pin: address.pin || address.zipCode || "",
  });

  const loadProfile = async () => {
    const response = await fetch(apiUrl("/api/auth/me"));

    if (!response.ok) {
      throw new Error("Failed to load user profile");
    }

    return response.json();
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        // Try to fetch user profile from backend (cookie-based auth)
        const profile = await loadProfile();
        
        const nextUser = {
          _id: profile._id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          phone: profile.phone,
        };

        setUser(nextUser);
        setAddresses((profile.addresses || []).map(normalizeAddress));
      } catch (error) {
        console.error("Failed to bootstrap auth", error);
        setUser(null);
        setAddresses([]);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const saveAddresses = async (newAddresses) => {
    if (!user?.token) {
      setAddresses(newAddresses);
      return;
    }

    const response = await fetch(apiUrl("/api/auth/profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        phone: user.phone,
        addresses: newAddresses,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to save addresses");
    }

    const nextAddresses = (data.addresses || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    setUser((current) => current ? { ...current, ...data } : current);
    localStorage.setItem("ruvia_user", JSON.stringify({ ...user, ...data }));
    return nextAddresses;
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        setUser(normalizeUser(data));
        const profile = await loadProfile();
        setAddresses((profile.addresses || []).map(normalizeAddress));
        return true;
      } else {
        toast.error(data.message || "Login failed");
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (response.ok) {
        setUser(normalizeUser(data));
        const profile = await loadProfile();
        setAddresses((profile.addresses || []).map(normalizeAddress));
        return true;
      } else {
        toast.error(data.message || "Signup failed");
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    setAddresses([]);
  };

  const addAddress = async (addr) => {
    const response = await fetch(apiUrl("/api/auth/address"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: addr }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to add address");
    }

    const nextAddresses = (data || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    return nextAddresses;
  };

  const updateAddress = async (id, updated) => {
    const nextAddresses = addresses.map(a => a.id === id ? { ...a, ...updated, id } : a);
    return saveAddresses(nextAddresses);
  };

  const deleteAddress = async (id) => {
    const response = await fetch(apiUrl(`/api/auth/address/${id}`), {
      method: "DELETE",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to remove address");
    }

    const nextAddresses = (data || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    return nextAddresses;
  };

  const updateUser = async (updatedFields) => {
    const response = await fetch(apiUrl("/api/auth/profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: updatedFields.name,
        email: updatedFields.email,
        phone: updatedFields.phone || user.phone,
        addresses,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to update profile");
    }

    const nextUser = { ...user, ...data };
    setUser(nextUser);
    if (data.addresses) {
      setAddresses((data.addresses || []).map(normalizeAddress));
    }
    return true;
  };

  const value = {
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    addresses,
    addAddress,
    updateAddress,
    deleteAddress
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

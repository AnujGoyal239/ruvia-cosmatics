"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";
import { Button } from "../../components/ui/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const { adminLogin, isAuthenticated } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.push("/admin/dashboard");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await adminLogin(email, password);
    
    if (result.success) {
      router.push("/admin/dashboard");
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Admin Portal</h1>
          <p className="text-sm text-brand-dark/60">Ruvia Cosmetics Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
              placeholder="admin@ruvia.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full rounded-md"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-brand-dark/60 hover:text-brand-pink">
            ← Back to Website
          </Link>
        </div>
      </div>
    </div>
  );
}

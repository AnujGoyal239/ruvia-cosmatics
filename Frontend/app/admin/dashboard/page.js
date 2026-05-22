"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../../../context/AdminContext";
import { apiUrl } from "../../../constants";
import { Package, ShoppingCart, MessageSquare, TrendingUp } from "lucide-react";

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalReturns: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("ruvia_admin");
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${JSON.parse(token).token}`,
        'Content-Type': 'application/json'
      };

      // Fetch products count
      const productsRes = await fetch(apiUrl("/api/products"), { headers });
      const productsData = await productsRes.json();
      
      // Fetch orders count
      const ordersRes = await fetch(apiUrl("/api/orders/all"), { headers });
      const ordersData = await ordersRes.json();

      setStats({
        totalProducts: Array.isArray(productsData) ? productsData.length : 0,
        totalOrders: Array.isArray(ordersData) ? ordersData.length : 0,
        totalReturns: 0,
        totalReviews: 0,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    { title: "Total Products", value: stats.totalProducts, icon: Package, color: "bg-blue-500" },
    { title: "Total Orders", value: stats.totalOrders, icon: ShoppingCart, color: "bg-green-500" },
    { title: "Pending Returns", value: stats.totalReturns, icon: MessageSquare, color: "bg-orange-500" },
    { title: "Total Reviews", value: stats.totalReviews, icon: TrendingUp, color: "bg-purple-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-dark">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Dashboard</h1>
        <p className="text-brand-dark/60">Welcome back, {admin?.name || "Admin"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg shadow-sm border border-brand-dark/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                  <Icon size={24} className={stat.color.replace('bg-', 'text-')} />
                </div>
                <span className="text-2xl font-bold text-brand-dark">{stat.value}</span>
              </div>
              <h3 className="text-sm font-medium text-brand-dark/60">{stat.title}</h3>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-brand-dark/10 p-6">
        <h2 className="font-serif text-xl font-bold text-brand-dark mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/products"
            className="p-4 border border-brand-dark/10 rounded-lg hover:border-brand-pink hover:bg-brand-pink/5 transition-colors"
          >
            <Package className="text-brand-dark mb-2" size={24} />
            <h3 className="font-medium text-brand-dark">Manage Products</h3>
            <p className="text-sm text-brand-dark/60">Add, edit, or delete products</p>
          </a>
          <a
            href="/admin/orders"
            className="p-4 border border-brand-dark/10 rounded-lg hover:border-brand-pink hover:bg-brand-pink/5 transition-colors"
          >
            <ShoppingCart className="text-brand-dark mb-2" size={24} />
            <h3 className="font-medium text-brand-dark">View Orders</h3>
            <p className="text-sm text-brand-dark/60">Manage and track orders</p>
          </a>
          <a
            href="/admin/returns"
            className="p-4 border border-brand-dark/10 rounded-lg hover:border-brand-pink hover:bg-brand-pink/5 transition-colors"
          >
            <MessageSquare className="text-brand-dark mb-2" size={24} />
            <h3 className="font-medium text-brand-dark">Handle Returns</h3>
            <p className="text-sm text-brand-dark/60">Process return requests</p>
          </a>
        </div>
      </div>
    </div>
  );
}

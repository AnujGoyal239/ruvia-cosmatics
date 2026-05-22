"use client";

import Link from "next/link";
import { Search, ChevronDown, Package, RefreshCcw, Star, X, Truck, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { apiUrl } from "../../constants";

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { addToCart, closeCart } = useCart();
  const router = useRouter();

  // Functional States
  // Functional States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("orders"); // orders, buy_again, not_shipped, cancelled
  const [timeFilter, setTimeFilter] = useState("past 6 months");
  const [actionToast, setActionToast] = useState("");
  
  // Modals State
  const [returnModalOrderId, setReturnModalOrderId] = useState(null);
  const [trackingModalOrderId, setTrackingModalOrderId] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth?redirect=/orders");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) return;

      try {
        setOrdersLoading(true);
        const response = await fetch(apiUrl("/api/orders/myorders"), {
          credentials: "include",
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setOrders(data);
        }
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  // Live tracking (poll every 5s while modal is open)
  useEffect(() => {
    if (!trackingModalOrderId || !user) return;

    let cancelled = false;
    const fetchTracking = async () => {
      try {
        setTrackingLoading(true);
        setTrackingError("");
        const res = await fetch(apiUrl(`/api/orders/${trackingModalOrderId}/tracking`), {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to fetch tracking");
        if (!cancelled) setTrackingData(data);
      } catch (e) {
        console.error("Tracking fetch failed:", e);
        if (!cancelled) setTrackingError(e.message || "Failed to fetch tracking");
      } finally {
        if (!cancelled) setTrackingLoading(false);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackingModalOrderId, user]);

  const formatOrderId = (order) => order?._id ? `ORD-${order._id.slice(-6).toUpperCase()}` : "ORDER";
  const formatOrderDate = (order) => order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Recent";

  const allOrders = orders.map((order) => ({
    id: order._id,
    placedOn: formatOrderDate(order),
    total: `₹${Number(order.total || 0).toLocaleString('en-IN')}`,
    shipTo: order.shippingAddress?.firstName ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName || ""}`.trim() : user.name,
    status: order.status || "Processing",
    statusDesc: order.isPaid ? "Your order was paid successfully." : "Preparing for dispatch.",
    items: (order.items || []).map((item) => ({
      id: item.product || item.id,
      name: item.name,
      price: `₹${Number(item.price || 0).toLocaleString('en-IN')}`,
      qty: item.qty || 1,
      img: item.img || "/images/serum.png",
      isShipped: (order.status || "").toLowerCase() !== "processing",
      isCancelled: (order.status || "").toLowerCase() === "cancelled",
    })),
  }));

  // Filtering Logic
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // 1. Search Filter (by Order ID or Item Name)
      const matchesSearch = 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // 2. Tab Filter
      if (activeTab === "not_shipped") {
        return order.items.some(item => !item.isShipped && !item.isCancelled);
      }
      if (activeTab === "cancelled") {
        return order.items.some(item => item.isCancelled);
      }
      if (activeTab === "buy_again") {
        const status = (order.status || "").toLowerCase();
        return status === "delivered" || status === "shipped";
      }
      
      // "orders" tab shows everything
      return true;
    });
  }, [orders, searchQuery, activeTab]);

  const handleActionClick = (actionName) => {
    setActionToast(`Opening "${actionName}" portal...`);
    setTimeout(() => setActionToast(""), 3000);
  };

  const handleBuyAgain = (item) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      img: item.img
    });
    closeCart(); // Close the sidebar if it opens automatically
    router.push("/checkout");
  };

  const submitReturn = (e) => {
    e.preventDefault();
    setReturnModalOrderId(null);
    setReturnReason("");
    setActionToast("Return request submitted successfully. Check your email for instructions.");
    setTimeout(() => setActionToast(""), 5000);
  };

  const handleViewItem = (orderId) => {
    router.push(`/orders/${orderId}`);
  };

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#FDFBF7] font-sans selection:bg-brand-pink/30 relative">
      
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed top-24 right-4 bg-brand-dark text-white px-6 py-3 rounded-md shadow-2xl text-xs font-bold uppercase tracking-widest z-50 animate-fade-in border border-brand-pink/20">
          {actionToast}
        </div>
      )}

      {/* ══════ RETURN MODAL ══════ */}
      {returnModalOrderId && (
        <div className="fixed inset-0 z-300 flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-brand-dark/60 backdrop-blur-md animate-in fade-in duration-500" 
            onClick={() => setReturnModalOrderId(null)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in fade-in duration-500">
            <button 
              onClick={() => setReturnModalOrderId(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full border border-brand-dark/10 flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-all"
            >
              <X size={18} />
            </button>
            <h3 className="font-serif text-3xl font-bold text-brand-dark mb-2">Initiate <span className="text-brand-pink italic">Return.</span></h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 mb-8">Order #{returnModalOrderId}</p>
            
            <form onSubmit={submitReturn} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-brand-dark mb-3">Why are you returning this?</label>
                <select 
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-brand-beige/20 border border-brand-dark/10 rounded-xl px-4 py-3 outline-none focus:border-brand-pink text-sm font-medium text-brand-dark cursor-pointer"
                >
                  <option value="" disabled>Select a reason</option>
                  <option value="damaged">Item arrived damaged</option>
                  <option value="wrong_item">Wrong item was sent</option>
                  <option value="no_longer_needed">No longer needed</option>
                  <option value="allergic_reaction">Experienced allergic reaction</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full h-14 rounded-xl bg-brand-dark text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-brand-pink transition-all duration-300"
              >
                Confirm Return
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════ TRACKING MODAL ══════ */}
      {trackingModalOrderId && (
        <div className="fixed inset-0 z-300 flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-brand-dark/60 backdrop-blur-md animate-in fade-in duration-500" 
            onClick={() => { setTrackingModalOrderId(null); setTrackingData(null); setTrackingError(""); }}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in fade-in duration-500">
            <button 
              onClick={() => { setTrackingModalOrderId(null); setTrackingData(null); setTrackingError(""); }}
              className="absolute top-6 right-6 w-10 h-10 rounded-full border border-brand-dark/10 flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-all"
            >
              <X size={18} />
            </button>
            <h3 className="font-serif text-3xl font-bold text-brand-dark mb-2">Track <span className="text-brand-pink italic">Package.</span></h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40 mb-8">Order #{trackingModalOrderId}</p>

            {trackingError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
                {trackingError}
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-3.75 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-brand-pink before:via-brand-dark/20 before:to-transparent">
                {trackingLoading && !trackingData ? (
                  <div className="text-sm text-brand-dark/50">Loading tracking…</div>
                ) : (trackingData?.trackingEvents || []).length === 0 ? (
                  <div className="text-sm text-brand-dark/50">No tracking events yet.</div>
                ) : (
                  (trackingData?.trackingEvents || []).map((ev, idx) => {
                    const statusText = ev?.status || "Update";
                    const lower = statusText.toLowerCase();
                    const Icon =
                      lower.includes("deliver") ? CheckCircle2 :
                      lower.includes("out for") ? Truck :
                      lower.includes("ship") ? Package :
                      lower.includes("order") ? CheckCircle2 :
                      CheckCircle2;
                    const ts = ev?.timestamp ? new Date(ev.timestamp) : null;
                    const timeLabel = ts ? ts.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
                    const isLatest = idx === (trackingData.trackingEvents.length - 1);

                    return (
                      <div key={`${statusText}-${idx}`} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${isLatest ? "is-active" : ""}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${isLatest ? "bg-brand-pink text-white" : "bg-brand-dark/10 text-brand-dark/50"}`}>
                          <Icon size={14} />
                        </div>
                        <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-brand-dark/10 shadow-sm ${isLatest ? "" : "opacity-80"}`}>
                          <div className="flex items-center justify-between mb-1 gap-3">
                            <h4 className="font-bold text-brand-dark text-xs">{statusText}</h4>
                            <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark/30 whitespace-nowrap">
                              {timeLabel || "—"}
                            </span>
                          </div>
                          <p className="text-[10px] text-brand-dark/50">
                            {statusText === "Ordered" ? "Order successfully placed." : "Status updated."}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            <button 
              onClick={() => { setTrackingModalOrderId(null); setTrackingData(null); setTrackingError(""); }}
              className="mt-8 w-full h-14 rounded-xl bg-brand-dark text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-brand-pink transition-all duration-300"
            >
              Close Tracking
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb */}
        <div className="text-[10px] font-black tracking-widest uppercase text-brand-dark/50 mb-6 pt-4">
          <Link href="/profile" className="hover:text-brand-pink transition-colors">Your Account</Link> › <span className="text-brand-dark">Your Orders</span>
        </div>

        {/* Title and Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-brand-dark/10 pb-6">
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tighter text-brand-dark">Your Orders</h1>
          
          <div className="flex w-full md:w-auto gap-3 h-11.5">
            <div className="relative flex-1 md:w-80 h-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={16} className="text-brand-dark/40" />
              </div>
              <input 
                type="text" 
                placeholder="Search all orders" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full pl-11 pr-4 bg-white border border-brand-dark/10 rounded-md text-sm focus:outline-none focus:border-brand-dark focus:ring-1 focus:ring-brand-dark shadow-inner shadow-brand-dark/1 transition-all text-brand-dark font-medium m-0"
              />
            </div>
            <button className="h-full px-8 bg-brand-dark hover:bg-brand-pink text-white text-[11px] uppercase tracking-widest font-black rounded-md transition-colors shadow-sm flex items-center justify-center shrink-0">
              Search Orders
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 text-[11px] font-black tracking-widest uppercase overflow-x-auto custom-scrollbar mb-8">
          <span 
            onClick={() => setActiveTab("orders")}
            className={`pb-3 cursor-pointer whitespace-nowrap transition-all border-b-2 ${activeTab === 'orders' ? 'text-brand-dark border-brand-dark' : 'text-brand-dark/40 border-transparent hover:text-brand-pink'}`}
          >
            Orders
          </span>
          <span 
            onClick={() => setActiveTab("buy_again")}
            className={`pb-3 cursor-pointer whitespace-nowrap transition-all border-b-2 ${activeTab === 'buy_again' ? 'text-brand-dark border-brand-dark' : 'text-brand-dark/40 border-transparent hover:text-brand-pink'}`}
          >
            Buy Again
          </span>
          <span 
            onClick={() => setActiveTab("not_shipped")}
            className={`pb-3 cursor-pointer whitespace-nowrap transition-all border-b-2 ${activeTab === 'not_shipped' ? 'text-brand-dark border-brand-dark' : 'text-brand-dark/40 border-transparent hover:text-brand-pink'}`}
          >
            Not Yet Shipped
          </span>
          <span 
            onClick={() => setActiveTab("cancelled")}
            className={`pb-3 cursor-pointer whitespace-nowrap transition-all border-b-2 ${activeTab === 'cancelled' ? 'text-brand-dark border-brand-dark' : 'text-brand-dark/40 border-transparent hover:text-brand-pink'}`}
          >
            Cancelled Orders
          </span>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-sm font-bold text-brand-dark">{filteredOrders.length} orders</span>
          <span className="text-sm font-medium text-brand-dark/60">placed in</span>
          <div className="relative">
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none border border-brand-dark/10 rounded text-xs py-2 pl-4 pr-10 bg-white focus:outline-none focus:border-brand-pink font-bold text-brand-dark cursor-pointer shadow-sm transition-colors"
            >
              <option>past 3 months</option>
              <option>past 6 months</option>
              <option>2025</option>
              <option>2024</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/50 pointer-events-none" />
          </div>
        </div>

        {/* Order Cards */}
        <div className="space-y-8">
          {ordersLoading ? (
            <div className="py-12 text-center bg-white border border-brand-dark/5 rounded-xl shadow-sm">
              <p className="text-sm font-medium text-brand-dark/50">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center bg-white border border-brand-dark/5 rounded-xl shadow-sm">
              <p className="text-sm font-medium text-brand-dark/50">No orders found matching your filters.</p>
            </div>
          ) : (
            filteredOrders.map((order, i) => (
              <div key={order.id} className="bg-white border border-brand-dark/10 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
                
                {/* Card Header (Light Beige) */}
                <div className="bg-[#FDFBF7] border-b border-brand-dark/10 p-5 flex flex-col md:flex-row justify-between text-[10px] font-black tracking-widest uppercase text-brand-dark/50 gap-6">
                  <div className="flex flex-wrap md:flex-nowrap gap-8 md:gap-16">
                    <div className="flex flex-col gap-1.5">
                      <span>Order Placed</span>
                      <span className="text-brand-dark text-xs">{order.placedOn}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span>Total</span>
                      <span className="text-brand-dark text-xs">{order.total}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span>Ship To</span>
                      <span className="text-brand-pink hover:text-brand-dark cursor-pointer flex items-center gap-1 transition-colors text-xs">
                        {order.shipTo} <ChevronDown size={12} />
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-1.5">
                    <span>Order # {order.id}</span>
                    <div className="flex gap-3 text-xs">
                      <span onClick={() => handleViewItem(order.id)} className="text-brand-pink hover:text-brand-dark cursor-pointer transition-colors">View order details</span>
                      <span className="text-brand-dark/20">|</span>
                      <span onClick={() => handleActionClick("Download Invoice")} className="text-brand-pink hover:text-brand-dark cursor-pointer transition-colors">Invoice</span>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-8 flex flex-col md:flex-row justify-between gap-8">
                  
                  {/* Left: Status and Items */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-serif text-2xl font-bold text-brand-dark leading-tight">{order.status}</h3>
                    </div>
                    <p className="text-xs font-medium text-brand-dark/50 mb-8">{order.statusDesc}</p>
                    
                    <div className="space-y-6">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-brand-dark/5 last:border-0 last:pb-0 group">
                          <div className="flex gap-6 items-center">
                            <div className="w-20 h-20 bg-[#FDFBF7] border border-brand-dark/5 rounded-lg shrink-0 flex items-center justify-center p-2 relative overflow-hidden">
                              <img src={item.img} alt={item.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-110 transition-transform duration-700" onError={(e) => { e.target.src = '/images/serum.png' }} />
                            </div>
                            <div className="flex flex-col">
                              <Link href={`/orders/${order.id}`} className="font-serif text-lg font-bold text-brand-dark hover:text-brand-pink transition-colors line-clamp-1">
                                {item.name}
                              </Link>
                              <span className="text-[9px] font-black tracking-widest uppercase text-brand-dark/30 mt-1">
                                {item.isCancelled ? "Cancelled" : "Return window closed"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:items-end gap-1">
                            <span className="text-sm font-bold text-brand-dark">{item.price}</span>
                            <span className="text-[9px] font-black tracking-widest uppercase text-brand-dark/40">Quantity: {item.qty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="w-full md:w-64 shrink-0 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-brand-dark/10 pt-6 md:pt-0 md:pl-8">
                    <button 
                      onClick={() => setTrackingModalOrderId(order.id)} 
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#3E2E2C] hover:bg-brand-dark transition-colors text-white shadow-md"
                    >
                      <Package size={16} />
                      <span className="text-[10px] font-black tracking-[0.15em] uppercase">Track Package</span>
                    </button>
                    
                    <button 
                      onClick={() => setReturnModalOrderId(order.id)} 
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-dark/5 transition-colors text-[#3E2E2C]"
                    >
                      <RefreshCcw size={16} />
                      <span className="text-[10px] font-black tracking-[0.15em] uppercase">Return or Replace Items</span>
                    </button>

                    {order.items?.[0]?.id ? (
                      <Link 
                        href={`/shop/${order.items[0].id}?write_review=true`} 
                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-brand-dark/10 hover:bg-brand-dark/5 transition-colors text-[#3E2E2C]"
                      >
                        <Star size={16} />
                        <span className="text-[10px] font-black tracking-[0.15em] uppercase">Write a Product Review</span>
                      </Link>
                    ) : null}
                  </div>
                  
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

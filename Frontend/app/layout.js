import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import ClientLayout from "../components/layout/ClientLayout";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "../context/WishlistContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ruvia Cosmetics | Doctor-Led Premium Skincare",
  description: "Doctor-led premium skincare and cosmetics formulated for sensitive skin.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} antialiased font-sans bg-brand-beige text-brand-dark flex flex-col min-h-screen relative`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <ClientLayout>{children}</ClientLayout>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

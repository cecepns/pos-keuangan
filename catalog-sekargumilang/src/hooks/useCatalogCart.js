import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const CART_STORAGE_KEY = "catalog-cart";

export function useCatalogCart() {
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      toast.error("Stok produk habis");
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error("Tidak dapat memesan melebihi stok tersedia");
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
      toast.success(`Jumlah ${product.name} ditambah di keranjang`);
    } else {
      setCart((prev) => [...prev, { product, quantity: 1 }]);
      toast.success(`${product.name} dimasukkan ke keranjang`);
    }
  };

  const updateCartQuantity = (productId, quantity) => {
    const item = cart.find((i) => i.product.id === productId);
    if (item && quantity > item.product.stock) {
      toast.error(`Stok maksimal tersedia: ${item.product.stock}`);
      return;
    }
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId) => {
    const item = cart.find((i) => i.product.id === productId);
    if (item) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      toast.success(`${item.product.name} dihapus dari keranjang`);
    }
  };

  const clearCart = () => {
    setCart([]);
    toast.success("Keranjang belanja dikosongkan");
  };

  return {
    cart,
    cartCount,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  };
}

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Cart line: { offering_id, member_id?, batch_ids, planet_name, level_name,
//              class_setting, sessions_per_week, price_cents, location_name, batch_labels }
const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fvca_cart');
      if (stored) setItems(JSON.parse(stored));
    } catch { /* fresh cart */ }
  }, []);

  const persist = (next) => {
    setItems(next);
    localStorage.setItem('fvca_cart', JSON.stringify(next));
  };

  const addItem = (item) => persist([...items.filter(i => i.offering_id !== item.offering_id), item]);
  const removeItem = (offeringId) => persist(items.filter(i => i.offering_id !== offeringId));
  const setMember = (offeringId, memberId) =>
    persist(items.map(i => i.offering_id === offeringId ? { ...i, member_id: memberId } : i));
  const clear = () => persist([]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setMember, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

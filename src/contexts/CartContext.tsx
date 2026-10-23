
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the shape of a single cart item
export interface CartItem {
    productId: string;
    productName: string;
    varietyId: string;
    varietyName: string;
    price: number;
    image: string;
    quantity: number;
    userId: string; // Business owner's UID
}

// Define the shape of the context
interface CartContextType {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (varietyId: string) => void;
    updateQuantity: (varietyId: string, quantity: number) => void;
    clearCart: () => void;
    cartCount: number;
    subtotal: number;
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined);


// Create the provider component
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cart, setCart] = useState<CartItem[]>([]);

    // Load cart from localStorage on initial render
    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('shoppingCart');
            if (savedCart) {
                setCart(JSON.parse(savedCart));
            }
        } catch (error) {
            console.error("Failed to parse cart from localStorage", error);
        }
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('shoppingCart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (newItem: CartItem) => {
        setCart(prevCart => {
            const existingItemIndex = prevCart.findIndex(item => item.varietyId === newItem.varietyId);
            
            if (existingItemIndex > -1) {
                // Item already in cart, update quantity
                const updatedCart = [...prevCart];
                updatedCart[existingItemIndex].quantity += newItem.quantity;
                return updatedCart;
            } else {
                // Item not in cart, add it
                return [...prevCart, newItem];
            }
        });
    };

    const removeFromCart = (varietyId: string) => {
        setCart(prevCart => prevCart.filter(item => item.varietyId !== varietyId));
    };

    const updateQuantity = (varietyId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(varietyId);
            return;
        }
        setCart(prevCart => 
            prevCart.map(item => 
                item.varietyId === varietyId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, subtotal }}>
            {children}
        </CartContext.Provider>
    );
};

// Custom hook for using the cart context
export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

    
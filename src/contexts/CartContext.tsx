
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
    removeFromCart: (productId: string, varietyId: string) => void;
    updateQuantity: (productId: string, varietyId: string, quantity: number) => void;
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
            const existingItemIndex = prevCart.findIndex(item => item.productId === newItem.productId && item.varietyId === newItem.varietyId);
            
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

    const removeFromCart = (productId: string, varietyId: string) => {
        setCart(prevCart => prevCart.filter(item => !(item.productId === productId && item.varietyId === varietyId)));
    };

    const updateQuantity = (productId: string, varietyId: string, quantity: number) => {
        const nextQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
        setCart(prevCart => nextQuantity === 0
            ? prevCart.filter(item => !(item.productId === productId && item.varietyId === varietyId))
            : prevCart.map(item => item.productId === productId && item.varietyId === varietyId ? { ...item, quantity: nextQuantity } : item)
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

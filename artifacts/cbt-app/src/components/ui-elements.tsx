import React, { InputHTMLAttributes, SelectHTMLAttributes, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({ 
  className, variant = "primary", size = "default", isLoading, children, ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive", 
  size?: "sm" | "default" | "lg",
  isLoading?: boolean 
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95",
        size === "sm" && "px-3 py-1.5 text-sm rounded-lg",
        size === "default" && "px-5 py-2.5 rounded-xl",
        size === "lg" && "px-6 py-3 text-lg rounded-xl",
        variant === "primary" && "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 focus:ring-primary/20",
        variant === "secondary" && "bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/25 hover:shadow-xl hover:shadow-secondary/30 hover:-translate-y-0.5 focus:ring-secondary/20",
        variant === "destructive" && "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-xl hover:-translate-y-0.5 focus:ring-destructive/20",
        variant === "outline" && "border-2 border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-primary/5 focus:ring-primary/20",
        variant === "ghost" && "bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 focus:ring-black/5",
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-card rounded-2xl p-6 shadow-xl shadow-black/5 border border-border/50 transition-all duration-300",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground",
        "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground appearance-none cursor-pointer",
        "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-semibold mb-1.5 text-foreground", className)} {...props}>
      {children}
    </label>
  );
}

export function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default"|"success"|"destructive"|"warning", className?: string }) {
  return (
    <span className={cn(
      "px-2.5 py-1 text-xs font-bold rounded-full",
      variant === "default" && "bg-muted text-muted-foreground",
      variant === "success" && "bg-secondary/15 text-secondary",
      variant === "destructive" && "bg-destructive/15 text-destructive",
      variant === "warning" && "bg-accent/15 text-accent",
      className
    )}>
      {children}
    </span>
  );
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, size?: "md" | "lg" | "xl" }) {
  const maxW = size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`bg-card w-full ${maxW} rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10 border border-white/20`}
          >
            <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold font-display">{title}</h2>
              <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function CustomTabs({ tabs, activeTab, onChange }: { tabs: string[], activeTab: string, onChange: (t: string) => void }) {
  return (
    <div className="flex space-x-1 bg-muted/60 p-1.5 rounded-2xl w-max border border-border/50 shadow-inner">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 outline-none",
            activeTab === tab
              ? "bg-primary text-white shadow-md shadow-primary/30 scale-[1.02]"
              : "text-muted-foreground hover:text-foreground hover:bg-black/5"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

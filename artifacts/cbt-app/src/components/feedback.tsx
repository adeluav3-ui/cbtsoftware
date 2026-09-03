import React, { useState } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button, Input, cn } from "./ui-elements";

// ─── Toast ────────────────────────────────────────────────────────────────────

export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
  info: (message: string) => sonnerToast(message),
};

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      expand={false}
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-xl !shadow-black/8 !font-sans",
          title: "!text-sm !font-semibold !text-foreground",
          description: "!text-xs !text-muted-foreground",
          success:
            "!border-l-4 !border-l-secondary",
          error:
            "!border-l-4 !border-l-destructive",
          info:
            "!border-l-4 !border-l-primary",
          closeButton:
            "!bg-muted !text-muted-foreground hover:!text-foreground",
        },
      }}
    />
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogBaseProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

interface StandardConfirmProps extends ConfirmDialogBaseProps {
  variant: "standard";
}

interface TypeToConfirmProps extends ConfirmDialogBaseProps {
  variant: "type-to-confirm";
  confirmText: string;
}

type ConfirmDialogProps = StandardConfirmProps | TypeToConfirmProps;

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, onClose, onConfirm, title, description, confirmLabel = "Confirm", isLoading } = props;
  const [inputValue, setInputValue] = useState("");

  const isTypeToConfirm = props.variant === "type-to-confirm";
  const confirmText = isTypeToConfirm ? props.confirmText : "";
  const canConfirm = !isTypeToConfirm || inputValue === confirmText;

  function handleClose() {
    setInputValue("");
    onClose();
  }

  function handleConfirm() {
    if (!canConfirm) return;
    setInputValue("");
    onConfirm();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-6 pb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-foreground leading-snug">{title}</h3>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type-to-confirm input */}
            {isTypeToConfirm && (
              <div className="px-6 pb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm:
                </p>
                <Input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={confirmText}
                  className={cn(
                    inputValue && inputValue !== confirmText && "border-destructive focus:border-destructive focus:ring-destructive/10"
                  )}
                  autoFocus
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={!canConfirm || isLoading}
                isLoading={isLoading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

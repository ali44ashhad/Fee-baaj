import React, { createContext, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type DialogOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => Promise<void>;
  onCancel?: () => void;
  content?: React.ReactNode;
  loadingText?: string;
};

type DialogContextType = {
  show: (options: DialogOptions) => void;
  hide: () => void;
  setConfirming: (isLoading: boolean) => void;
};

const DialogContext = createContext<DialogContextType | null>(null);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};

export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({});
  const [confirming, setConfirming] = useState(false);

  const show = (dialogOptions: DialogOptions) => {
    setOptions(dialogOptions);
    setOpen(true);
  };

  const hide = () => {
    setOpen(false);
    setOptions({});
    setConfirming(false);
  };

  const handleConfirm = async () => {
    if (options.onConfirm) {
      try {
        setConfirming(true);
        await options.onConfirm();
      } finally {
        setConfirming(false);
        hide();
      }
    } else {
      hide();
    }
  };

  const handleCancel = () => {
    if (!confirming) {
      options.onCancel?.();
      hide();
    }
  };

  return (
    <DialogContext.Provider value={{ show, hide, setConfirming }}>
      {children}
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            <DialogDescription>{options.description}</DialogDescription>
          </DialogHeader>
          {options.content}
          <DialogFooter className="space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={confirming}
            >
              {options.cancelText || "Cancel"}
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirming
                ? options.loadingText || "Deleting..."
                : options.confirmText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
};

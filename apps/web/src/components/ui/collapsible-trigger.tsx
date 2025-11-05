'use client';

import * as React from 'react';

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(undefined);

interface CollapsibleProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Collapsible({ defaultOpen = false, open: controlledOpen, onOpenChange, children }: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;

  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  return <CollapsibleContext.Provider value={{ open, onOpenChange: setOpen }}>{children}</CollapsibleContext.Provider>;
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function CollapsibleTrigger({ children, ...props }: CollapsibleTriggerProps) {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error('CollapsibleTrigger must be used within a Collapsible');
  }

  return (
    <button type="button" aria-expanded={context.open} onClick={() => context.onOpenChange(!context.open)} {...props}>
      {children}
    </button>
  );
}

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CollapsibleContent({ children, className = '', ...props }: CollapsibleContentProps) {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error('CollapsibleContent must be used within a Collapsible');
  }

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        context.open ? 'max-h-screen' : 'max-h-0'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

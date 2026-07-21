import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'alert';

export interface ToastMessage {
  id: string;
  text: string;
  type?: ToastType;
}

interface ToastContextType {
  toast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            let icon = <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
            let borderColor = 'border-emerald-500';
            let bg = 'bg-[#F4FAF6]';
            let textColor = 'text-emerald-950';

            if (t.type === 'error') {
              icon = <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />;
              borderColor = 'border-rose-500';
              bg = 'bg-[#FFF5F5]';
              textColor = 'text-rose-950';
            } else if (t.type === 'info') {
              icon = <Info className="h-5 w-5 text-stone-600 shrink-0" />;
              borderColor = 'border-stone-800';
              bg = 'bg-[#FAF9F6]';
              textColor = 'text-stone-900';
            } else if (t.type === 'alert') {
              icon = <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />;
              borderColor = 'border-amber-500';
              bg = 'bg-[#FFFDF4]';
              textColor = 'text-amber-950';
            }

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border-2 ${borderColor} ${bg} ${textColor} shadow-[4px_4px_0px_0px_rgba(217,209,192,0.4)]`}
              >
                {icon}
                <div className="flex-1 text-xs font-mono font-bold leading-relaxed">
                  {t.text}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="p-0.5 rounded hover:bg-stone-200/50 transition shrink-0 cursor-pointer text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

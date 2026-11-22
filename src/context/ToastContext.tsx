import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastMap = useRef<Map<string, number>>(new Map());

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (!message) return;
    const now = Date.now();
    const lastTime = lastToastMap.current.get(message);
    // Deduplicate identical toasts within 2500ms
    if (lastTime && now - lastTime < 2500) {
      return;
    }
    lastToastMap.current.set(message, now);

    const id = `${now}_${Math.random().toString(36).substring(2, 6)}`;
    // Keep max 2 active toasts on screen to prevent viewport flooding
    setToasts((prev) => [...prev.slice(-1), { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Responsive Toast Container: centered top on mobile with safe-area, top-right on desktop */}
      <div
        className="fixed left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:top-12 sm:right-6 z-[9999] flex flex-col gap-2 pointer-events-none select-none max-w-[92vw] sm:max-w-md w-full px-2 sm:px-0 items-center sm:items-end"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#14141B] border border-[#272733] shadow-2xl text-xs font-medium text-[#F5F3FF] transition-all transform duration-200 animate-in fade-in slide-in-from-top-2"
          >
            {toast.type === 'success' && <CheckCircle2 size={16} className="text-[#A78BFA] shrink-0" />}
            {toast.type === 'warning' && <AlertCircle size={16} className="text-amber-400 shrink-0" />}
            {toast.type === 'info' && <Info size={16} className="text-sky-400 shrink-0" />}
            <span className="truncate max-w-[280px] sm:max-w-xs">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-[#71717A] hover:text-[#F5F3FF]"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: () => {} };
  }
  return context;
};

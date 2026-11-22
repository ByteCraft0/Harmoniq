import React from 'react';
import { useBackHandler } from '../MobileNavigationContext';
import { AlertCircle, X } from 'lucide-react';

interface MobileConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MobileConfirmDialog: React.FC<MobileConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  // Priority 1: Dialog consumes Android Back before any lower layers
  useBackHandler(
    1,
    () => {
      onCancel();
      return true;
    },
    isOpen
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-[#14141b] border border-[#272733] p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isDestructive
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-violet-600/10 text-violet-400 border border-violet-500/20'
              }`}
            >
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 active:scale-95 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all shadow-lg ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                : 'bg-violet-600 hover:bg-violet-500 shadow-violet-900/30'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

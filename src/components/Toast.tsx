import { useEffect } from 'react';
import { Check, X, Info } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const styles = {
    success: 'bg-indigo-500',
    error: 'bg-red-500',
    info: 'bg-zinc-700',
  };

  const icons = {
    success: <Check className="w-4 h-4 shrink-0" />,
    error: <X className="w-4 h-4 shrink-0" />,
    info: <Info className="w-4 h-4 shrink-0" />,
  };

  return (
    <div
      className={`${styles[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-down`}
      role="alert"
    >
      {icons[toast.type]}
      <span className="text-sm font-medium">{toast.text}</span>
    </div>
  );
}

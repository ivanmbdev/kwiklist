import { FormEvent } from 'react';
import { Plus, Check, LogOut, ClipboardList } from 'lucide-react';
import useEscapeKey from '../hooks/useEscapeKey';

interface AccountModalProps {
  isLoggedIn: boolean;
  userId: string;
  onLogin: (e: FormEvent) => void;
  onLogout: () => void;
  onClose: () => void;
}

export default function AccountModal({
  isLoggedIn,
  userId,
  onLogin,
  onLogout,
  onClose,
}: AccountModalProps) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isLoggedIn ? 'Mi cuenta' : 'Iniciar sesión'}
    >
      <div
        className="bg-white dark:bg-zinc-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          aria-label="Cerrar"
        >
          <Plus className="w-6 h-6 rotate-45" />
        </button>

        <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 relative">
          <ClipboardList className="w-8 h-8 text-white" />
          <div className="absolute -bottom-1 -right-1 bg-indigo-400 rounded-full p-0.5 border-2 border-white dark:border-zinc-800">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>

        {isLoggedIn ? (
          <>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
              Mi Cuenta
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              Sesión activa como invitado
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 mb-8">
              <p className="text-xs text-zinc-400 mb-1">Tu identificador</p>
              <p className="text-zinc-700 dark:text-zinc-300 font-mono text-sm break-all">
                {userId}
              </p>
            </div>

            <button
              onClick={onLogout}
              className="w-full py-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors duration-300"
            >
              <LogOut className="w-5 h-5" /> Cerrar Sesión
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
              Guarda tus listas
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">
              Inicia sesión o regístrate para sincronizar tus listas y no
              perderlas.
            </p>
            <form onSubmit={onLogin} className="space-y-3 mb-2">
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="Email"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="sr-only">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Contraseña"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-300"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 mt-2"
              >
                Iniciar Sesión / Registro
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

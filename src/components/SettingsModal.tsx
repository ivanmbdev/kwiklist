import { useState } from 'react';
import { Moon, Sun, Trash2, LogOut } from 'lucide-react';
import { ShoppingList } from '../types';
import { getMemberName } from '../api';
import useEscapeKey from '../hooks/useEscapeKey';

interface SettingsModalProps {
  list: ShoppingList;
  userId: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onDeleteList: () => void;
  onLeaveList: () => void;
  onClose: () => void;
}

export default function SettingsModal({
  list,
  userId,
  darkMode,
  onToggleDarkMode,
  onDeleteList,
  onLeaveList,
  onClose,
}: SettingsModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCreator = list.creatorId === userId;

  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes de la lista"
    >
      <div
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-6">
          Ajustes de la Lista
        </h2>

        {/* Apariencia */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-zinc-400 tracking-wider mb-3">
            APARIENCIA
          </h3>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-2 border border-zinc-100 dark:border-zinc-700/50">
            <div className="flex items-center justify-between p-3">
              <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                Modo Oscuro
              </span>
              <button
                onClick={onToggleDarkMode}
                className="text-zinc-500 hover:text-indigo-500 transition-colors duration-300"
                aria-label={
                  darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
                }
              >
                {darkMode ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Miembros */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-zinc-400 tracking-wider mb-3">
            MIEMBROS ({list.members?.length || 1})
          </h3>
          <div className="space-y-2">
            {list.members?.map((memberId) => (
              <div
                key={memberId}
                className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 flex items-center justify-between"
              >
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                  {getMemberName(memberId, userId)}
                </span>
                {memberId === list.creatorId ? (
                  <span className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded">
                    ADMIN
                  </span>
                ) : (
                  <span className="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 text-xs font-bold px-2 py-1 rounded">
                    MIEMBRO
                  </span>
                )}
              </div>
            ))}
            {(!list.members || list.members.length === 0) && (
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                  Tú
                </span>
                <span className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded">
                  ADMIN
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="space-y-3">
          {isCreator ? (
            confirmDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-red-500 text-center font-medium">
                  ¿Seguro que quieres eliminar esta lista?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onDeleteList}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors duration-300"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-4 rounded-2xl border border-red-200 dark:border-red-900/50 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-300"
              >
                <Trash2 className="w-5 h-5" /> Eliminar Lista
              </button>
            )
          ) : (
            <button
              onClick={onLeaveList}
              className="w-full py-4 rounded-2xl border border-orange-200 dark:border-orange-900/50 text-orange-500 font-bold flex items-center justify-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors duration-300"
            >
              <LogOut className="w-5 h-5" /> Salir de la Lista
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

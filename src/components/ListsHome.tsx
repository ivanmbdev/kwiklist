import { useState, FormEvent } from 'react';
import {
  Plus,
  ArrowLeft,
  UserPlus,
  Check,
  ClipboardList,
} from 'lucide-react';
import { ShoppingList, ToastMessage } from '../types';
import { listsApi } from '../api';

interface ListsHomeProps {
  lists: ShoppingList[];
  loading: boolean;
  userId: string;
  onOpenList: (list: ShoppingList) => void;
  onListCreated: (list: ShoppingList) => void;
  onListJoined: (list: ShoppingList) => void;
  showToast: (text: string, type?: ToastMessage['type']) => void;
}

export default function ListsHome({
  lists,
  loading,
  userId,
  onOpenList,
  onListCreated,
  onListJoined,
  showToast,
}: ListsHomeProps) {
  const [newListName, setNewListName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleCreateList = async (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const res = await listsApi.create(newListName, userId);
      setNewListName('');
      onListCreated(res.data);
      showToast('Lista creada correctamente', 'success');
    } catch {
      showToast('Error al crear la lista', 'error');
    }
  };

  const handleJoinList = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const res = await listsApi.getByCode(joinCode);
      const found = res.data;

      if ((found.members || []).includes(userId)) {
        showToast('Ya eres miembro de esta lista', 'info');
        onOpenList(found);
        setJoinCode('');
        return;
      }

      const joinRes = await listsApi.join(found.id, userId);
      onListJoined(joinRes.data);
      setJoinCode('');
      showToast('Te has unido a la lista', 'success');
    } catch {
      showToast('Lista no encontrada. Comprueba el código.', 'error');
    }
  };

  return (
    <div className="px-6 animate-slide-up">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-violet-600 rounded-3xl flex items-center justify-center shadow-lg mb-4 relative">
          <ClipboardList className="w-10 h-10 text-white" />
          <div className="absolute -bottom-2 -right-2 bg-indigo-400 rounded-full p-1 border-4 border-white dark:border-zinc-900 transition-colors duration-300">
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-white mb-2">
          KwikList
        </h1>
        <p className="text-zinc-500 text-sm">
          Compras colaborativas, sin complicaciones.
        </p>
      </div>

      {/* Crear lista */}
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-3xl p-5 mb-4 shadow-sm border border-zinc-100 dark:border-zinc-700/50 transition-colors duration-300">
        <div className="flex items-center gap-2 text-indigo-500 font-semibold mb-4">
          <Plus className="w-5 h-5" /> Nueva Lista
        </div>
        <form onSubmit={handleCreateList} className="flex gap-3">
          <label htmlFor="new-list-name" className="sr-only">
            Nombre de la lista
          </label>
          <input
            id="new-list-name"
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Ej. Compra semanal"
            className="flex-1 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all duration-300"
          />
          <button
            type="submit"
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Crear
          </button>
        </form>
      </div>

      {/* Unirse a lista */}
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-3xl p-5 mb-8 shadow-sm border border-zinc-100 dark:border-zinc-700/50 transition-colors duration-300">
        <div className="flex items-center gap-2 text-blue-500 font-semibold mb-4">
          <UserPlus className="w-5 h-5" /> Unirse a Lista
        </div>
        <form onSubmit={handleJoinList} className="flex gap-3">
          <label htmlFor="join-code" className="sr-only">
            Código de invitación
          </label>
          <input
            id="join-code"
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="CÓDIGO (EJ. X7B9WC)"
            className="flex-1 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 uppercase transition-all duration-300"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Unirse
          </button>
        </form>
      </div>

      {/* Mis listas */}
      <section>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-white mb-4">
          Mis Listas
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => {
              const completedCount =
                list.items?.filter((i) => i.isCompleted).length || 0;
              const totalCount = list.items?.length || 0;

              return (
                <button
                  key={list.id}
                  onClick={() => onOpenList(list)}
                  className="group w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-5 flex items-center justify-between border border-zinc-100 dark:border-zinc-700/50 hover:border-indigo-400 dark:hover:border-indigo-400 transition-all duration-300 text-left shadow-sm hover:shadow-md"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-800 dark:text-white group-hover:text-indigo-500 transition-colors duration-300">
                      {list.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {totalCount === 0
                        ? 'Vacía'
                        : `${completedCount}/${totalCount} comprados`}
                    </p>
                  </div>
                  <div className="text-zinc-400 group-hover:text-indigo-500 transition-colors duration-300">
                    <ArrowLeft className="w-5 h-5 rotate-180" />
                  </div>
                </button>
              );
            })}
            {lists.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-3xl">
                <p className="text-zinc-500">No tienes listas aún.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

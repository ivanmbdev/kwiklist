import { useState, useMemo, FormEvent, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, ArrowLeft, Share2, Settings, Pencil } from 'lucide-react';
import { ShoppingList, ShoppingItem, ToastMessage } from '../types';
import { listsApi, getMemberName } from '../api';
import { enqueue, isNetworkError } from '../offlineQueue';

interface ListDetailProps {
  list: ShoppingList;
  userId: string;
  onBack: () => void;
  onShowSettings: () => void;
  showToast: (text: string, type?: ToastMessage['type']) => void;
}

export default function ListDetail({
  list,
  userId,
  onBack,
  onShowSettings,
  showToast,
}: ListDetailProps) {
  const [newItemName, setNewItemName] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [listName, setListName] = useState(list.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const pendingItems = useMemo(
    () => list.items?.filter((i) => !i.isCompleted) || [],
    [list.items],
  );
  const completedItems = useMemo(
    () => list.items?.filter((i) => i.isCompleted) || [],
    [list.items],
  );
  const shortCode = list.id.substring(0, 8).toUpperCase();

  useEffect(() => {
    setListName(list.name);
  }, [list.name]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const handleSaveName = async () => {
    setEditingName(false);
    const trimmed = listName.trim();
    if (!trimmed || trimmed === list.name) {
      setListName(list.name);
      return;
    }
    try {
      await listsApi.updateName(list.id, trimmed);
      showToast('Nombre actualizado', 'success');
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('updateListName', { listId: list.id, name: trimmed });
        showToast('Se sincronizará al recuperar conexión', 'info');
      } else {
        setListName(list.name);
        showToast('Error al actualizar el nombre', 'error');
      }
    }
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      await listsApi.addItem(list.id, newItemName, userId);
      setNewItemName('');
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('addItem', { listId: list.id, name: newItemName, addedBy: userId });
        setNewItemName('');
        showToast('Guardado offline', 'info');
      } else {
        showToast('Error al añadir el producto', 'error');
      }
    }
  };

  const handleToggleItem = async (item: ShoppingItem) => {
    try {
      await listsApi.toggleItem(item);
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('toggleItem', { item });
        showToast('Guardado offline', 'info');
      } else {
        showToast('Error al actualizar el producto', 'error');
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await listsApi.deleteItem(itemId);
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('deleteItem', { itemId });
        showToast('Guardado offline', 'info');
      } else {
        showToast('Error al eliminar el producto', 'error');
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?join=${shortCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      showToast('Enlace copiado al portapapeles', 'success');
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  return (
    <>
      {/* Cabecera */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:text-indigo-500 transition-colors duration-300 shrink-0"
            aria-label="Volver a mis listas"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
                className="text-xl font-bold text-zinc-800 dark:text-white bg-transparent border-b-2 border-indigo-400 outline-none w-full"
                aria-label="Editar nombre de la lista"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-2 group text-left w-full"
                aria-label="Editar nombre de la lista"
              >
                <h1 className="text-xl font-bold text-zinc-800 dark:text-white truncate">
                  {list.name}
                </h1>
                <Pencil className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
            <p className="text-xs text-zinc-400">Código: {shortCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 shrink-0">
          <button
            onClick={handleShare}
            className="text-indigo-500 transition-colors"
            aria-label="Compartir lista"
          >
            {shareCopied ? (
              <Check className="w-5 h-5" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onShowSettings}
            className="hover:text-indigo-500 transition-colors duration-300"
            aria-label="Ajustes de la lista"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="p-6">
        {/* Formulario para añadir producto */}
        <form onSubmit={handleAddItem} className="flex gap-3 mb-8">
          <label htmlFor="new-item" className="sr-only">
            Añadir producto
          </label>
          <input
            id="new-item"
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Añadir producto..."
            className="flex-1 px-5 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm text-zinc-800 dark:text-white transition-all duration-300"
          />
          <button
            type="submit"
            className="bg-indigo-500 hover:bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
            aria-label="Añadir producto"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {/* Productos pendientes */}
        <section className="mb-8" aria-label="Productos pendientes">
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider mb-4">
            PENDIENTES ({pendingItems.length})
          </h3>
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggleItem(item)}
                    className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-500 flex items-center justify-center hover:border-indigo-400 dark:hover:border-indigo-400 transition-colors duration-300"
                    aria-label={`Marcar "${item.name}" como comprado`}
                  />
                  <div className="flex flex-col">
                    <span className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
                      {item.name}
                    </span>
                    {item.addedBy && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        Añadido por {getMemberName(item.addedBy, userId)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-red-400 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                  aria-label={`Eliminar "${item.name}"`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Productos comprados */}
        {completedItems.length > 0 && (
          <section className="animate-slide-up" aria-label="Productos comprados">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider mb-4">
              COMPRADOS ({completedItems.length})
            </h3>
            <div className="space-y-3">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/30 shadow-sm opacity-70 hover:opacity-100 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggleItem(item)}
                      className="w-6 h-6 rounded-full border-2 border-indigo-400 bg-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:border-indigo-500 transition-colors duration-300"
                      aria-label={`Desmarcar "${item.name}"`}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-lg font-medium text-zinc-400 dark:text-zinc-500 line-through">
                        {item.name}
                      </span>
                      {item.addedBy && (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          Añadido por {getMemberName(item.addedBy, userId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-400 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                    aria-label={`Eliminar "${item.name}"`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

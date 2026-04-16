import axios from 'axios';
import { ShoppingItem, ShoppingList } from './types';

const API_URL = '/api/lists';
export const WS_URL = '/ws';

export const listsApi = {
  getByUser: (userId: string) =>
    axios.get<ShoppingList[]>(`${API_URL}?userId=${userId}`),

  getByCode: (code: string) =>
    axios.get<ShoppingList>(`${API_URL}/code/${code}`),

  getById: (id: string) =>
    axios.get<ShoppingList>(`${API_URL}/${id}`),

  create: (name: string, creatorId: string) =>
    axios.post<ShoppingList>(API_URL, { name, creatorId, members: [creatorId] }),

  delete: (id: string) =>
    axios.delete(`${API_URL}/${id}`),

  updateName: (id: string, name: string) =>
    axios.put<ShoppingList>(`${API_URL}/${id}`, { name }),

  join: (listId: string, userId: string) =>
    axios.post<ShoppingList>(`${API_URL}/${listId}/join`, { userId }),

  leave: (listId: string, userId: string) =>
    axios.post<ShoppingList>(`${API_URL}/${listId}/leave`, { userId }),

  addItem: (listId: string, name: string, addedBy: string) =>
    axios.post<ShoppingItem>(`${API_URL}/${listId}/items`, { name, addedBy }),

  toggleItem: (item: ShoppingItem) =>
    axios.put<ShoppingItem>(`${API_URL}/items/${item.id}`, {
      ...item,
      isCompleted: !item.isCompleted,
    }),

  deleteItem: (itemId: string) =>
    axios.delete(`${API_URL}/items/${itemId}`),
};

export function getMemberName(memberId: string, currentUserId: string): string {
  if (memberId === currentUserId) return 'Tú';
  if (memberId.startsWith('ghost_'))
    return `Invitado (${memberId.substring(6, 10)})`;
  return memberId;
}

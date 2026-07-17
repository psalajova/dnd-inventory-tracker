export interface Character {
  id: string;
  name: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  category: string | null;
  notes: string | null;
  acquired_in_session: string | null;
  created_at?: string;
}

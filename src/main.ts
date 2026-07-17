import './style.css';
import { DND_CATEGORIES, populateCategorySelect } from './categories';
import { supabase } from './supabase';
import type { Character, InventoryItem } from './types';

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const authView = requireElement<HTMLElement>('auth-view');
const appView = requireElement<HTMLElement>('app-view');
const authForm = requireElement<HTMLFormElement>('auth-form');
const authMessage = requireElement<HTMLElement>('auth-message');
const appMessage = requireElement<HTMLElement>('app-message');
const logoutBtn = requireElement<HTMLButtonElement>('logout-btn');
const signupBtn = requireElement<HTMLButtonElement>('signup-btn');
const characterList = requireElement<HTMLElement>('character-list');
const inventoryPanel = requireElement<HTMLElement>('inventory-panel');
const activeCharacterName = requireElement<HTMLElement>('active-character-name');
const inventoryList = requireElement<HTMLUListElement>('inventory-list');
const filterCategorySelect = requireElement<HTMLSelectElement>('filter-category');
const filterSessionSelect = requireElement<HTMLSelectElement>('filter-session');
const sortInventorySelect = requireElement<HTMLSelectElement>('sort-inventory');
const addItemBtn = requireElement<HTMLButtonElement>('add-item-btn');
const addItemModal = requireElement<HTMLElement>('add-item-modal');
const addItemForm = requireElement<HTMLFormElement>('add-item-form');
const addItemCancelBtn = requireElement<HTMLButtonElement>('add-item-cancel');
const newCharacterBtn = requireElement<HTMLButtonElement>('new-character-btn');
const emailInput = requireElement<HTMLInputElement>('email');
const passwordInput = requireElement<HTMLInputElement>('password');
const itemNameInput = requireElement<HTMLInputElement>('item-name');
const itemQtyInput = requireElement<HTMLInputElement>('item-qty');
const itemCategoryInput = requireElement<HTMLSelectElement>('item-category');
const acquiredInSessionInput = requireElement<HTMLInputElement>('item-acquired-in-session');
const notesInput = requireElement<HTMLInputElement>('item-notes');
const editItemModal = requireElement<HTMLElement>('edit-item-modal');
const editItemForm = requireElement<HTMLFormElement>('edit-item-form');
const editItemCancelBtn = requireElement<HTMLButtonElement>('edit-item-cancel');
const editItemNameInput = requireElement<HTMLInputElement>('edit-item-name');
const editItemQtyInput = requireElement<HTMLInputElement>('edit-item-qty');
const editItemCategoryInput = requireElement<HTMLSelectElement>('edit-item-category');
const editItemAcquiredInSessionInput = requireElement<HTMLInputElement>('edit-item-acquired-in-session');
const editItemNotesInput = requireElement<HTMLInputElement>('edit-item-notes');

let activeCharacterId: string | null = null;
let editingItemId: string | null = null;
let inventoryItems: InventoryItem[] = [];
let categoryFilter = 'all';
let sessionFilter = 'all';
let sortOrder = 'name-asc';

type SortOrder = 'name-asc' | 'name-desc' | 'category' | 'session' | 'added';

function showMessage(el: HTMLElement, text: string, isError = false): void {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function showApp(isSignedIn: boolean): void {
  authView.classList.toggle('hidden', isSignedIn);
  appView.classList.toggle('hidden', !isSignedIn);
  logoutBtn.classList.toggle('hidden', !isSignedIn);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

async function loadCharacters(): Promise<void> {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name')
    .order('created_at', { ascending: true });

  if (error) throw error;

  characterList.innerHTML = '';

  if (!data.length) {
    characterList.innerHTML = '<p class="hint">No characters yet. Tap + New.</p>';
    inventoryPanel.classList.add('hidden');
    activeCharacterId = null;
    return;
  }

  for (const character of data as Character[]) {
    const row = document.createElement('div');
    row.className = 'character-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-btn';
    button.textContent = character.name;
    button.dataset.id = character.id;
    if (character.id === activeCharacterId) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => selectCharacter(character.id, character.name));

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'btn btn-ghost character-rename-btn';
    renameBtn.setAttribute('aria-label', `Rename ${character.name}`);
    renameBtn.textContent = '✎';
    renameBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      void renameCharacter(character.id, character.name);
    });
    if (character.id !== activeCharacterId) {
      renameBtn.classList.add('hidden');
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-ghost character-delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${character.name}`);
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      void deleteCharacter(character.id, character.name);
    });
    if (character.id !== activeCharacterId) {
      deleteBtn.classList.add('hidden');
    }

    row.append(button, renameBtn, deleteBtn);
    characterList.appendChild(row);
  }

  if (!activeCharacterId || !data.some((c) => c.id === activeCharacterId)) {
    await selectCharacter(data[0].id, data[0].name);
  }
}

async function selectCharacter(id: string, name: string): Promise<void> {
  activeCharacterId = id;
  activeCharacterName.textContent = `${name} — inventory`;
  inventoryPanel.classList.remove('hidden');
  resetInventoryFilters();

  for (const row of characterList.querySelectorAll<HTMLElement>('.character-row')) {
    const button = row.querySelector<HTMLButtonElement>('.character-btn');
    const renameBtn = row.querySelector<HTMLButtonElement>('.character-rename-btn');
    const deleteBtn = row.querySelector<HTMLButtonElement>('.character-delete-btn');
    if (!button || !renameBtn || !deleteBtn) continue;

    const isActive = button.dataset.id === id;
    button.classList.toggle('active', isActive);
    renameBtn.classList.toggle('hidden', !isActive);
    deleteBtn.classList.toggle('hidden', !isActive);
  }

  await loadInventory();
}

function resetInventoryFilters(): void {
  categoryFilter = 'all';
  sessionFilter = 'all';
  sortOrder = 'name-asc';
  filterCategorySelect.value = 'all';
  filterSessionSelect.value = 'all';
  sortInventorySelect.value = 'name-asc';
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function populateFilterOptions(items: InventoryItem[]): void {
  const sessions = uniqueSorted(items.map((item) => item.acquired_in_session));
  const prevCategory = categoryFilter;
  const prevSession = sessionFilter;

  filterCategorySelect.innerHTML = '<option value="all">All</option>';
  for (const category of DND_CATEGORIES) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filterCategorySelect.appendChild(option);
  }

  filterSessionSelect.innerHTML = '<option value="all">All</option>';
  for (const session of sessions) {
    const option = document.createElement('option');
    option.value = session;
    option.textContent = session;
    filterSessionSelect.appendChild(option);
  }

  categoryFilter =
    prevCategory === 'all' || (DND_CATEGORIES as readonly string[]).includes(prevCategory)
      ? prevCategory
      : 'all';
  sessionFilter = prevSession === 'all' || sessions.includes(prevSession) ? prevSession : 'all';
  filterCategorySelect.value = categoryFilter;
  filterSessionSelect.value = sessionFilter;
}

function filterItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => {
    if (categoryFilter !== 'all' && (item.category || '') !== categoryFilter) return false;
    if (sessionFilter !== 'all' && (item.acquired_in_session || '') !== sessionFilter) return false;
    return true;
  });
}

function compareNames(a: InventoryItem, b: InventoryItem): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sortItems(items: InventoryItem[]): InventoryItem[] {
  const sorted = [...items];

  switch (sortOrder as SortOrder) {
    case 'name-desc':
      return sorted.sort((a, b) => compareNames(b, a));
    case 'category':
      return sorted.sort((a, b) => {
        const categoryA = (a.category || '').toLowerCase();
        const categoryB = (b.category || '').toLowerCase();
        if (categoryA !== categoryB) {
          if (!categoryA) return 1;
          if (!categoryB) return -1;
          return categoryA.localeCompare(categoryB);
        }
        return compareNames(a, b);
      });
    case 'session':
      return sorted.sort((a, b) => {
        const sessionA = (a.acquired_in_session || '').toLowerCase();
        const sessionB = (b.acquired_in_session || '').toLowerCase();
        if (sessionA !== sessionB) {
          if (!sessionA) return 1;
          if (!sessionB) return -1;
          return sessionA.localeCompare(sessionB);
        }
        return compareNames(a, b);
      });
    case 'added':
      return sorted.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    case 'name-asc':
    default:
      return sorted.sort(compareNames);
  }
}

function renderInventory(): void {
  const visibleItems = sortItems(filterItems(inventoryItems));

  inventoryList.innerHTML = '';

  if (!inventoryItems.length) {
    inventoryList.innerHTML = '<li class="hint">No items yet.</li>';
    return;
  }

  if (!visibleItems.length) {
    inventoryList.innerHTML = '<li class="hint">No items match the current filters.</li>';
    return;
  }

  for (const item of visibleItems) {
    inventoryList.appendChild(renderInventoryItem(item));
  }
}

async function loadInventory(): Promise<void> {
  inventoryList.innerHTML = '<li class="hint">Loading…</li>';

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, quantity, category, acquired_in_session, notes, created_at')
    .eq('character_id', activeCharacterId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  inventoryItems = data as InventoryItem[];
  populateFilterOptions(inventoryItems);
  renderInventory();
}

function renderInventoryItem(item: InventoryItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'inventory-item';

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${escapeHtml(item.name)}</strong>
    ${item.category ? `<div class="meta">${escapeHtml(item.category)}</div>` : ''}
    ${item.notes ? `<div class="meta">${escapeHtml(item.notes)}</div>` : ''}
    ${item.acquired_in_session ? `<div class="meta">session: ${escapeHtml(item.acquired_in_session)}</div>` : ''}
  `;

  const qtyControls = document.createElement('div');
  qtyControls.className = 'qty-controls';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'btn btn-ghost';
  minus.textContent = '−';
  minus.addEventListener('click', () => updateQuantity(item, item.quantity - 1));

  const qty = document.createElement('span');
  qty.className = 'qty-value';
  qty.textContent = String(item.quantity);

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'btn btn-ghost';
  plus.textContent = '+';
  plus.addEventListener('click', () => updateQuantity(item, item.quantity + 1));

  qtyControls.append(minus, qty, plus);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteItem(item));

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn-ghost';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openEditModal(item));

  const itemActions = document.createElement('div');
  itemActions.className = 'item-actions';
  itemActions.append(remove, editBtn);

  li.append(info, qtyControls, itemActions);
  return li;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function updateQuantity(item: InventoryItem, nextQty: number): Promise<void> {
  if (nextQty < 0) return;

  const { error } = await supabase
    .from('inventory_items')
    .update({ quantity: nextQty })
    .eq('id', item.id);

  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  await loadInventory();
}

async function deleteItem(item: InventoryItem): Promise<void> {
  if (!window.confirm(`Delete "${item.name}"?`)) return;

  const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }
  await loadInventory();
}

function openEditModal(item: InventoryItem): void {
  editingItemId = item.id;

  editItemNameInput.value = item.name;
  editItemQtyInput.value = String(item.quantity);
  const category = item.category || '';
  editItemCategoryInput.value = (DND_CATEGORIES as readonly string[]).includes(category) ? category : '';
  editItemAcquiredInSessionInput.value = item.acquired_in_session || '';
  editItemNotesInput.value = item.notes || '';

  editItemModal.classList.remove('hidden');
  editItemNameInput.focus();
}

function closeEditModal(): void {
  editingItemId = null;
  editItemForm.reset();
  editItemModal.classList.add('hidden');
}

function openAddModal(): void {
  addItemForm.reset();
  itemQtyInput.value = '1';
  addItemModal.classList.remove('hidden');
  itemNameInput.focus();
}

function closeAddModal(): void {
  addItemForm.reset();
  itemQtyInput.value = '1';
  addItemModal.classList.add('hidden');
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(authMessage, 'Signing in…');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(authMessage, error.message, true);
    return;
  }

  showMessage(authMessage, '');
  await bootstrap();
});

signupBtn.addEventListener('click', async () => {
  showMessage(authMessage, 'Creating account…');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (password.length < 6) {
    showMessage(authMessage, 'Password must be at least 6 characters.', true);
    return;
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showMessage(authMessage, error.message, true);
    return;
  }

  showMessage(authMessage, 'Account created. Sign in when ready (check email if confirmation is on).');
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showApp(false);
  showMessage(appMessage, '');
});

newCharacterBtn.addEventListener('click', async () => {
  const name = window.prompt('Character name?');
  if (!name?.trim()) return;

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('characters')
    .insert({ name: name.trim(), user_id: userId })
    .select('id, name')
    .single();

  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  await selectCharacter(data.id, data.name);
  await loadCharacters();
});

async function renameCharacter(id: string, currentName: string): Promise<void> {
  const name = window.prompt('New character name?', currentName);
  if (!name?.trim()) return;

  const trimmed = name.trim();
  if (trimmed === currentName) return;

  const { error } = await supabase
    .from('characters')
    .update({ name: trimmed })
    .eq('id', id);

  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  if (activeCharacterId === id) {
    activeCharacterName.textContent = `${trimmed} — inventory`;
  }
  await loadCharacters();
}

async function deleteCharacter(id: string, name: string): Promise<void> {
  if (!window.confirm(`Delete "${name}" and all inventory?`)) return;

  const { error } = await supabase.from('characters').delete().eq('id', id);
  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  if (activeCharacterId === id) {
    activeCharacterId = null;
  }
  await loadCharacters();
}

addItemBtn.addEventListener('click', () => openAddModal());

filterCategorySelect.addEventListener('change', () => {
  categoryFilter = filterCategorySelect.value;
  renderInventory();
});

filterSessionSelect.addEventListener('change', () => {
  sessionFilter = filterSessionSelect.value;
  renderInventory();
});

sortInventorySelect.addEventListener('change', () => {
  sortOrder = sortInventorySelect.value;
  renderInventory();
});

addItemCancelBtn.addEventListener('click', () => closeAddModal());

addItemModal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeAddModal());

addItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeCharacterId) return;

  const name = itemNameInput.value.trim();
  const quantity = Number(itemQtyInput.value);
  const category = itemCategoryInput.value.trim();
  const acquired_in_session = acquiredInSessionInput.value.trim();
  const notes = notesInput.value.trim();

  const userId = await getUserId();
  const { error } = await supabase.from('inventory_items').insert({
    character_id: activeCharacterId,
    user_id: userId,
    name,
    quantity,
    category,
    acquired_in_session,
    notes,
  });
  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  closeAddModal();
  await loadInventory();
});

editItemCancelBtn.addEventListener('click', () => closeEditModal());

editItemModal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeEditModal());

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!editItemModal.classList.contains('hidden')) {
    closeEditModal();
  } else if (!addItemModal.classList.contains('hidden')) {
    closeAddModal();
  }
});

editItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingItemId) return;

  const name = editItemNameInput.value.trim();
  const quantity = Number(editItemQtyInput.value);
  const category = editItemCategoryInput.value.trim();
  const acquired_in_session = editItemAcquiredInSessionInput.value.trim();
  const notes = editItemNotesInput.value.trim();

  const { error } = await supabase.from('inventory_items').update({
    name,
    quantity,
    category,
    acquired_in_session,
    notes,
  }).eq('id', editingItemId);

  if (error) {
    showMessage(appMessage, error.message, true);
    return;
  }

  closeEditModal();
  await loadInventory();
});

async function bootstrap(): Promise<void> {
  showApp(true);
  showMessage(appMessage, '');
  try {
    await loadCharacters();
  } catch (error) {
    showMessage(appMessage, errorMessage(error), true);
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    void bootstrap();
  } else {
    showApp(false);
  }
});

async function init(): Promise<void> {
  populateCategorySelect(itemCategoryInput);
  populateCategorySelect(editItemCategoryInput);

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    await bootstrap();
  } else {
    showApp(false);
  }
}

void init();

/** Classic D&D 5e-style item categories — edit here to change the list. */
export const DND_CATEGORIES = [
  'Weapon',
  'Armor',
  'Shield',
  'Ammunition',
  'Potion',
  'Scroll',
  'Wand',
  'Rod',
  'Staff',
  'Ring',
  'Wondrous Item',
  'Tool',
  'Adventuring Gear',
  'Food & Drink',
  'Treasure',
  'Container',
  'Light Source',
  'Spell Component',
  'Miscellaneous',
  'Other',
] as const;

export type DndCategory = (typeof DND_CATEGORIES)[number];

export const UNCATEGORIZED_LABEL = '—';

export function populateCategorySelect(select: HTMLSelectElement, includeBlank = true): void {
  const current = select.value;
  select.innerHTML = '';

  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = UNCATEGORIZED_LABEL;
    select.appendChild(blank);
  }

  for (const category of DND_CATEGORIES) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }

  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

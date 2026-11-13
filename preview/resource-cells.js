import { pictogram } from './icons.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// One cell per capacity; heroic excess stays visible as additional outlined cells.
// Keep the wrapper inside .system-caption so deferred resolution meters swap atomically.
export function energyCells(value, capacity, t) {
  const label = t('tactical.energy_cells', { value, capacity });
  return `<span class="energy-value energy-cells" role="img" aria-label="${esc(label)}" title="${esc(label)}" data-energy="${value}" data-capacity="${capacity}">${Array.from({ length: Math.max(capacity, value) }, (_, i) => `<i aria-hidden="true" class="energy-cell ${i < value ? 'filled' : 'empty'}${i >= capacity ? ' excess' : ''}"></i>`).join('')}</span>`;
}

export function fuelRack(fuel, t) {
  const label = t('tactical.fuel_capsules', { count: fuel });
  return `<div class="fuel-rack" role="img" aria-label="${esc(label)}" title="${esc(label)}" data-fuel="${fuel}"><div class="fuel-slots" aria-hidden="true">${Array.from({ length: Math.max(3, fuel) }, (_, i) => `<span class="fuel-slot ${i < fuel ? 'filled' : 'empty'}">${i < fuel ? pictogram('fuel') : ''}</span>`).join('')}</div></div>`;
}

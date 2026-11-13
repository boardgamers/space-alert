import { energyCells, fuelRack } from './resource-cells.js';
import { translate } from './i18n.js';
import { pictogram } from './icons.js';
import { tutorialTextHtml } from './tutorial-text.js';

// Presentation only: these examples never read or mutate the engine or its history.
// Undamaged ship capacities: central reactor 5, side reactor 3, central shield 3.
// The shield example uses the central zone's reactor and shield.
export const ENERGY_DEMOS = [
  { id: 'shot', rows: [['reactor', 'central', 3, 2, 5], ['laser', 'shots', '+1']] },
  { id: 'refill', rows: [['reactor', 'central', 1, 5, 5], ['fuel', 'fuel', 3, 2]] },
  { id: 'shield', rows: [['reactor', 'zone', 1, 0, 5], ['shield', 'shield', 0, 1, 3], ['fuel', 'fuel', 3, 3]] },
  { id: 'side', rows: [['reactor', 'central', 2, 0, 5], ['reactor', 'side', 0, 2, 3], ['fuel', 'fuel', 3, 3]] },
];

export function energyDiscovery(index, locale) {
  const demo = ENERGY_DEMOS[index];
  const t = (key, params) => tutorialTextHtml(translate(locale, `energy.demo.${key}`, params), locale);
  const resource = (icon, value, capacity) => icon === 'fuel'
    ? fuelRack(value, (key, params) => translate(locale, key, params))
    : energyCells(value, capacity, (key, params) => translate(locale, key, params));
  return `<section class="energy-discovery" aria-label="${t('label')}">
    <div class="energy-demo-content" aria-live="polite" aria-atomic="true">
      <h2 tabindex="-1">${t(`${demo.id}.title`)}</h2>
      <p>${t(`${demo.id}.text`)}</p>
      <div class="energy-demo-diagram">${demo.rows.map(([icon, label, before, after, capacity]) => `<div>${pictogram(icon)}<span>${t(label)}</span>${after === undefined ? `<strong>${before}</strong>` : `<span class="resource-transition"><span role="group" aria-label="${t('before')}">${resource(icon, before, capacity)}</span><span aria-hidden="true">→</span><span role="group" aria-label="${t('after')}">${resource(icon, after, capacity)}</span></span>`}</div>`).join('')}</div>

    </div>
    <nav class="energy-demo-navigation" aria-label="${t('label')}">
      <button class="quiet icon-button" data-energy-demo="${index - 1}" aria-label="${t('back')}" ${index === 0 ? 'disabled' : ''}>${pictogram('left')}</button>
      <span class="energy-demo-dots">${ENERGY_DEMOS.map((_, i) => `<span class="${i === index ? 'active' : ''}" aria-hidden="true"></span>`).join('')}</span>
      <span>${index + 1} / ${ENERGY_DEMOS.length}</span>
      ${index < ENERGY_DEMOS.length - 1 ? `<button class="primary icon-label" data-energy-demo="${index + 1}"><span>${t('next')}</span>${pictogram('right')}</button>` : ''}
    </nav>
  </section>`;
}

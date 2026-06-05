import { YEARS } from './config.js';
import { COUNTRIES } from './data/countries.js';

const state = {
  selectedYear: YEARS[1],
  selectedCountry: COUNTRIES[0]?.code ?? '',
  activeCategory: 'Weight',
  activeDirection: 'Inbound',
  filters: {
    region: 'All regions',
    status: 'All',
    search: ''
  }
};

export function getState() {
  return state;
}

export function setSelectedYear(year) {
  state.selectedYear = year;
}

export function setSelectedCountry(code) {
  state.selectedCountry = code;
}

export function setActiveCategory(category) {
  state.activeCategory = category;
  if (category === 'Agreement' || category === 'Invoice') {
    state.activeDirection = 'Inbound';
  }
}

export function setActiveDirection(direction) {
  state.activeDirection = direction;
}

export function setFilter(name, value) {
  state.filters[name] = value;
}

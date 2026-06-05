export const FLOW_STATUSES = ['Not started', 'Under review', 'Final', 'Declined'];
export const AGREEMENT_STATUSES = ['Yes', 'No'];
export const CATEGORIES = ['Weight', 'IPK', 'Agreement', 'Invoice'];
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
export const DIRECTIONS = ['Inbound', 'Outbound'];

const currentYear = new Date().getFullYear();
export const YEARS = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];

export const CATEGORY_CONFIG = {
  Weight: { type: 'flow', key: 'weight', directions: true },
  IPK: { type: 'flow', key: 'ipk', directions: true },
  Agreement: { type: 'agreement', key: 'agreement', directions: false },
  Invoice: { type: 'invoice', key: 'invoice', directions: false }
};

export const STORAGE_KEY = 'postnl-letter-mail-tracker';

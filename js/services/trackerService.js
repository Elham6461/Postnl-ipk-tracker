import { COUNTRIES } from '../data/countries.js';
import { QUARTERS, STORAGE_KEY } from '../config.js';

let tracker = loadTracker();

function defaultFlow() {
  return {
    Q1: 'Not started',
    Q2: 'Not started',
    Q3: 'Not started',
    Q4: 'Not started'
  };
}

function defaultRecord() {
  return {
    weight: { inbound: defaultFlow(), outbound: defaultFlow() },
    ipk: { inbound: defaultFlow(), outbound: defaultFlow() },
    agreement: { kg: 'No', uvcn73: 'No', cn6: 'No' },
    invoice: { status: 'Not started', note: '' },
    meta: { updatedAt: '' }
  };
}

function touch(record) {
  record.meta.updatedAt = new Date().toISOString();
}

function loadTracker() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTracker() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
}

export function getRecord(year, code) {
  if (!tracker[year]) tracker[year] = {};
  if (!tracker[year][code]) tracker[year][code] = defaultRecord();
  return tracker[year][code];
}

export function updateQuarter(year, code, category, direction, quarter, value) {
  const record = getRecord(year, code);
  record[category][direction][quarter] = value;
  touch(record);
  saveTracker();
}

export function updateAgreement(year, code, key, value) {
  const record = getRecord(year, code);
  record.agreement[key] = value;
  touch(record);
  saveTracker();
}

export function updateInvoiceStatus(year, code, value) {
  const record = getRecord(year, code);
  record.invoice.status = value;
  touch(record);
  saveTracker();
}

export function updateInvoiceNote(year, code, value) {
  const record = getRecord(year, code);
  record.invoice.note = value;
  touch(record);
  saveTracker();
}

export function setAllQuarterStatuses(year, code, category, direction, value) {
  const record = getRecord(year, code);
  QUARTERS.forEach((quarter) => {
    record[category][direction][quarter] = value;
  });
  touch(record);
  saveTracker();
}

export function exportYearCSV(year, summarizeFlow, summarizeAgreement) {
  const rows = [[
    'Year',
    'Code',
    'Country',
    'Region',
    'Weight Inbound',
    'Weight Outbound',
    'IPK Inbound',
    'IPK Outbound',
    'Agreement',
    'Invoice',
    'Last Updated'
  ]];

  COUNTRIES.forEach((country) => {
    const record = getRecord(year, country.code);
    rows.push([
      year,
      country.code,
      country.name,
      country.region,
      summarizeFlow(record.weight.inbound),
      summarizeFlow(record.weight.outbound),
      summarizeFlow(record.ipk.inbound),
      summarizeFlow(record.ipk.outbound),
      summarizeAgreement(record.agreement),
      record.invoice.status,
      record.meta.updatedAt || ''
    ]);
  });

  return rows
    .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function exportTrackerJSON() {
  return JSON.stringify(tracker, null, 2);
}

export function importTrackerJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  tracker = parsed && typeof parsed === 'object' ? parsed : {};
  saveTracker();
}

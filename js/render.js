import {
  AGREEMENT_STATUSES,
  CATEGORIES,
  CATEGORY_CONFIG,
  DIRECTIONS,
  FLOW_STATUSES,
  QUARTERS,
  YEARS
} from './config.js';
import { COUNTRIES, REGIONS } from './data/countries.js';
import {
  getRecord,
  updateAgreement,
  updateInvoiceNote,
  updateInvoiceStatus,
  updateQuarter,
  setAllQuarterStatuses,
  exportTrackerJSON,
  exportYearCSV,
  importTrackerJSON
} from './services/trackerService.js';
import {
  getState,
  setActiveCategory,
  setActiveDirection,
  setFilter,
  setSelectedCountry,
  setSelectedYear
} from './state.js';

function toBadgeClass(status) {
  return `b-${status.toLowerCase().replace(/\s+/g, '-')}`;
}

function summarizeFlow(flow) {
  const values = Object.values(flow);
  if (values.every((value) => value === 'Not started')) return 'Not started';
  if (values.includes('Declined')) return 'Declined';
  if (values.includes('Under review')) return 'Under review';
  if (values.every((value) => value === 'Final')) return 'Final';
  return 'Under review';
}

function summarizeAgreement(agreement) {
  return Object.values(agreement).every((value) => value === 'Yes') ? 'Yes' : 'No';
}

function getContextStatus(record) {
  const { activeCategory, activeDirection } = getState();
  if (activeCategory === 'Weight') return summarizeFlow(record.weight[activeDirection.toLowerCase()]);
  if (activeCategory === 'IPK') return summarizeFlow(record.ipk[activeDirection.toLowerCase()]);
  if (activeCategory === 'Agreement') return summarizeAgreement(record.agreement);
  return record.invoice.status;
}

function filteredCountries() {
  const { selectedYear, filters } = getState();
  const query = filters.search.toLowerCase();

  return COUNTRIES.filter((country) => {
    if (query && !country.name.toLowerCase().includes(query) && !country.code.toLowerCase().includes(query)) {
      return false;
    }
    if (filters.region !== 'All regions' && country.region !== filters.region) {
      return false;
    }

    const status = getContextStatus(getRecord(selectedYear, country.code));
    if (filters.status !== 'All' && status !== filters.status) {
      return false;
    }

    return true;
  });
}

function getCompletionMetrics() {
  const { selectedYear } = getState();
  const records = COUNTRIES.map((country) => getRecord(selectedYear, country.code));
  const completed = records.filter((record) => getContextStatus(record) === 'Final' || getContextStatus(record) === 'Yes').length;
  const review = records.filter((record) => getContextStatus(record) === 'Under review').length;
  const declined = records.filter((record) => getContextStatus(record) === 'Declined' || getContextStatus(record) === 'No').length;
  const notStarted = records.length - completed - review - declined;
  const percentage = records.length ? Math.round((completed / records.length) * 100) : 0;

  return { completed, review, declined, notStarted, percentage };
}

function renderSummary() {
  const container = document.getElementById('sum-chips');
  const { activeCategory, selectedYear } = getState();
  const statusOptions = activeCategory === 'Agreement' ? AGREEMENT_STATUSES : FLOW_STATUSES;
  const counts = Object.fromEntries(statusOptions.map((status) => [status, 0]));

  COUNTRIES.forEach((country) => {
    const status = getContextStatus(getRecord(selectedYear, country.code));
    if (counts[status] !== undefined) counts[status] += 1;
  });

  container.innerHTML = statusOptions
    .filter((status) => counts[status] > 0)
    .map((status) => `<span class="chip">${status}: <strong>${counts[status]}</strong></span>`)
    .join('');
}

function renderSidebar() {
  const container = document.getElementById('sidebar-list');
  const state = getState();
  const list = filteredCountries();

  if (!list.some((country) => country.code === state.selectedCountry)) {
    setSelectedCountry(list[0]?.code ?? '');
  }

  container.innerHTML = list.length === 0
    ? '<div style="padding:12px" class="empty">No countries match the selected filters.</div>'
    : list.map((country) => {
        const status = getContextStatus(getRecord(state.selectedYear, country.code));
        return `
          <div class="country-row${country.code === getState().selectedCountry ? ' active' : ''}" data-country-code="${country.code}">
            <span class="c-code">${country.code}</span>
            <span class="c-name">${country.name}</span>
            <span class="badge ${toBadgeClass(status)}">${status}</span>
          </div>
          <div class="c-region">${country.region}</div>`;
      }).join('');
}

function renderCategoryTabs() {
  const { activeCategory } = getState();
  return `<div class="tabs">${CATEGORIES.map((category) => `
    <button class="tab${activeCategory === category ? ' active' : ''}" data-category="${category}">${category}</button>
  `).join('')}</div>`;
}

function renderDirectionTabs() {
  const { activeDirection } = getState();
  return `
    <div class="subtabs" style="margin-bottom:10px">
      ${DIRECTIONS.map((direction) => `
        <button class="subtab${activeDirection === direction ? ' active' : ''}" data-direction="${direction}">${direction}</button>
      `).join('')}
    </div>`;
}

function renderFlowSection(record, title, categoryKey) {
  const { activeDirection } = getState();
  const directionKey = activeDirection.toLowerCase();
  const flow = record[categoryKey][directionKey];

  return `
    <div class="section">
      <h2>${title}</h2>
      <div class="muted" style="margin-bottom:10px">Drill-down: Year → Country → ${title} → ${activeDirection} quarterly status</div>
      ${renderDirectionTabs()}
      <div class="toolbar-row" style="margin-bottom:10px">
        ${FLOW_STATUSES.map((status) => `<button class="btn" data-bulk-status="${status}" data-category-key="${categoryKey}" data-direction-key="${directionKey}">Set all to ${status}</button>`).join('')}
      </div>
      <div class="item">
        ${QUARTERS.map((quarter) => `
          <div class="kv">
            <strong>${quarter}</strong>
            <select class="sel" data-quarter="${quarter}" data-category-key="${categoryKey}" data-direction-key="${directionKey}">
              ${FLOW_STATUSES.map((status) => `<option value="${status}"${flow[quarter] === status ? ' selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderAgreementSection(record) {
  const items = [
    { key: 'kg', label: 'Agreement Kg' },
    { key: 'uvcn73', label: 'Agreement UV CN73' },
    { key: 'cn6', label: 'Agreement CN6' }
  ];

  return `
    <div class="section">
      <h2>Agreement</h2>
      <div class="muted" style="margin-bottom:10px">Yearly contract status (Yes/No)</div>
      <div class="item">
        ${items.map((item) => `
          <div class="kv">
            <span>${item.label}</span>
            <select class="sel" data-agreement-key="${item.key}">
              ${AGREEMENT_STATUSES.slice().reverse().map((status) => `<option value="${status}"${record.agreement[item.key] === status ? ' selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderInvoiceSection(record) {
  return `
    <div class="section">
      <h2>Invoice</h2>
      <div class="muted" style="margin-bottom:10px">One yearly invoice record per country</div>
      <div class="grid">
        <div class="item">
          <div class="item-title">Invoice status</div>
          <select class="sel" id="invoice-status">
            ${FLOW_STATUSES.map((status) => `<option value="${status}"${record.invoice.status === status ? ' selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
        <div class="item">
          <div class="item-title">Notes</div>
          <textarea class="area" id="invoice-note" style="width:100%;min-height:74px" placeholder="Optional invoice note...">${record.invoice.note || ''}</textarea>
        </div>
      </div>
    </div>`;
}

function renderDashboard() {
  const metrics = getCompletionMetrics();
  return `
    <div class="section">
      <h2>Overview</h2>
      <div class="dashboard">
        <div class="stat-card"><span class="muted">Completed</span><strong>${metrics.completed}</strong></div>
        <div class="stat-card"><span class="muted">Under review</span><strong>${metrics.review}</strong></div>
        <div class="stat-card"><span class="muted">Declined / No</span><strong>${metrics.declined}</strong></div>
        <div class="stat-card">
          <span class="muted">Completion</span>
          <strong>${metrics.percentage}%</strong>
          <div class="progress-bar"><div class="progress-fill" style="width:${metrics.percentage}%"></div></div>
        </div>
      </div>
    </div>`;
}

function downloadFile(filename, text, type) {
  const anchor = document.createElement('a');
  anchor.href = `data:${type};charset=utf-8,${encodeURIComponent(text)}`;
  anchor.download = filename;
  anchor.click();
}

function renderDetail() {
  const panel = document.getElementById('detail-panel');
  const state = getState();

  if (!state.selectedCountry) {
    panel.innerHTML = '<div class="section empty">No country selected for the current filters.</div>';
    return;
  }

  const country = COUNTRIES.find((entry) => entry.code === state.selectedCountry);
  const record = getRecord(state.selectedYear, state.selectedCountry);
  const categoryConfig = CATEGORY_CONFIG[state.activeCategory];
  const status = getContextStatus(record);

  let categorySection = '';
  if (categoryConfig.type === 'flow') {
    categorySection = renderFlowSection(record, state.activeCategory, categoryConfig.key);
  } else if (categoryConfig.type === 'agreement') {
    categorySection = renderAgreementSection(record);
  } else {
    categorySection = renderInvoiceSection(record);
  }

  panel.innerHTML = `
    ${renderDashboard()}
    <div class="section">
      <h2>${country.name}</h2>
      <div class="muted">${country.code}${country.note ? ` · ${country.note}` : ''} · ${country.region} · Year ${state.selectedYear}</div>
      <div class="muted" style="margin-top:6px">Last updated: ${record.meta.updatedAt ? new Date(record.meta.updatedAt).toLocaleString() : 'Not updated yet'}</div>
      <div style="margin-top:10px"><span class="badge ${toBadgeClass(status)}">${status}</span></div>
    </div>
    <div class="section">
      <h2>Category</h2>
      ${renderCategoryTabs()}
    </div>
    ${categorySection}
    <div class="section">
      <div class="toolbar-row">
        <button class="btn" id="export-csv-btn">Export year overview CSV</button>
        <button class="btn" id="export-json-btn">Export JSON backup</button>
        <button class="btn" id="import-json-btn">Import JSON backup</button>
        <input type="file" id="json-file-input" accept="application/json" hidden>
      </div>
    </div>`;

  const invoiceStatus = document.getElementById('invoice-status');
  if (invoiceStatus) {
    invoiceStatus.addEventListener('change', (event) => {
      updateInvoiceStatus(state.selectedYear, state.selectedCountry, event.target.value);
      rerenderAll();
    });
  }

  const invoiceNote = document.getElementById('invoice-note');
  if (invoiceNote) {
    invoiceNote.addEventListener('input', (event) => {
      updateInvoiceNote(state.selectedYear, state.selectedCountry, event.target.value);
      renderSidebar();
    });
  }

  document.getElementById('export-csv-btn').addEventListener('click', () => {
    const csv = exportYearCSV(state.selectedYear, summarizeFlow, summarizeAgreement);
    downloadFile(`PostNL_Letter_Mail_${state.selectedYear}.csv`, csv, 'text/csv');
  });

  document.getElementById('export-json-btn').addEventListener('click', () => {
    downloadFile(`PostNL_Letter_Mail_${state.selectedYear}.json`, exportTrackerJSON(), 'application/json');
  });

  const importButton = document.getElementById('import-json-btn');
  const input = document.getElementById('json-file-input');
  importButton.addEventListener('click', () => input.click());
  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importTrackerJSON(text);
    rerenderAll();
    input.value = '';
  });
}

function populateControls() {
  const state = getState();
  document.getElementById('year-sel').innerHTML = YEARS
    .map((year) => `<option value="${year}"${year === state.selectedYear ? ' selected' : ''}>${year}</option>`)
    .join('');

  document.getElementById('region-filter').innerHTML = REGIONS
    .map((region) => `<option value="${region}"${region === state.filters.region ? ' selected' : ''}>${region}</option>`)
    .join('');

  document.getElementById('status-filter').innerHTML = ['All', ...new Set([...FLOW_STATUSES, ...AGREEMENT_STATUSES])]
    .map((status) => `<option value="${status}"${status === state.filters.status ? ' selected' : ''}>${status}</option>`)
    .join('');
}

function debounce(fn, delay = 200) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function rerenderAll() {
  renderSummary();
  renderSidebar();
  renderDetail();
  attachDynamicEvents();
}

function attachDynamicEvents() {
  document.querySelectorAll('[data-country-code]').forEach((element) => {
    element.addEventListener('click', () => {
      setSelectedCountry(element.dataset.countryCode);
      renderDetail();
      renderSidebar();
      attachDynamicEvents();
    });
  });

  document.querySelectorAll('[data-category]').forEach((element) => {
    element.addEventListener('click', () => {
      setActiveCategory(element.dataset.category);
      rerenderAll();
    });
  });

  document.querySelectorAll('[data-direction]').forEach((element) => {
    element.addEventListener('click', () => {
      setActiveDirection(element.dataset.direction);
      rerenderAll();
    });
  });

  document.querySelectorAll('[data-quarter]').forEach((element) => {
    element.addEventListener('change', (event) => {
      const state = getState();
      updateQuarter(
        state.selectedYear,
        state.selectedCountry,
        element.dataset.categoryKey,
        element.dataset.directionKey,
        element.dataset.quarter,
        event.target.value
      );
      rerenderAll();
    });
  });

  document.querySelectorAll('[data-agreement-key]').forEach((element) => {
    element.addEventListener('change', (event) => {
      const state = getState();
      updateAgreement(state.selectedYear, state.selectedCountry, element.dataset.agreementKey, event.target.value);
      rerenderAll();
    });
  });

  document.querySelectorAll('[data-bulk-status]').forEach((element) => {
    element.addEventListener('click', () => {
      const state = getState();
      setAllQuarterStatuses(
        state.selectedYear,
        state.selectedCountry,
        element.dataset.categoryKey,
        element.dataset.directionKey,
        element.dataset.bulkStatus
      );
      rerenderAll();
    });
  });
}

export function initUI() {
  populateControls();

  document.getElementById('year-sel').addEventListener('change', (event) => {
    setSelectedYear(event.target.value);
    rerenderAll();
  });

  document.getElementById('region-filter').addEventListener('change', (event) => {
    setFilter('region', event.target.value);
    rerenderAll();
  });

  document.getElementById('status-filter').addEventListener('change', (event) => {
    setFilter('status', event.target.value);
    rerenderAll();
  });

  document.getElementById('search-box').addEventListener('input', debounce((event) => {
    setFilter('search', event.target.value);
    rerenderAll();
  }));

  rerenderAll();
}

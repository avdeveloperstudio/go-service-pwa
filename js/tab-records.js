import { state } from './state.js';
import { openEditModal } from './main.js';
import { sendData, fetchData } from './api.js';
import { renderCalendar, renderDailyRecords } from './tab-schedule.js';

let isSearchInitialized = false;
let isListListenerAttached = false;
let lastStateHash = '';

export function renderAllRecordsTab() {
    const list = document.getElementById('all-records-list');
    const searchInput = document.getElementById('search-all-records-input');

    // Элементы фильтров
    const filterPanel = document.getElementById('records-filters-panel');
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const filterCategory = document.getElementById('filter-category');
    const filterService = document.getElementById('filter-service');
    const filterStatus = document.getElementById('filter-status');
    const btnResetFilters = document.getElementById('btn-reset-filters');

    // Элементы нового кастомного фильтра клиентов
    const filterClientValue = document.getElementById('filter-client-value');
    const filterClientText = document.getElementById('filter-client-text');
    const filterClientTrigger = document.getElementById('filter-client-trigger');
    const filterClientDropdown = document.getElementById('filter-client-dropdown');
    const filterClientSearch = document.getElementById('filter-client-search');
    const filterClientOptions = document.getElementById('filter-client-options');

    if (!list) return;

    // 1. Инициализация поиска и интерфейса фильтров (1 раз)
    if (!isSearchInitialized && searchInput) {
        searchInput.addEventListener('input', () => renderAllRecordsTab());

        btnToggleFilters.addEventListener('click', () => {
            const isHidden = filterPanel.style.display === 'none';
            filterPanel.style.display = isHidden ? 'grid' : 'none';
            btnToggleFilters.innerHTML = isHidden ? '<i class="ph ph-faders"></i> Скрыть фильтр' : '<i class="ph ph-faders"></i> Фильтр';
            if (filterClientDropdown) filterClientDropdown.style.display = 'none';
        });

            [filterCategory, filterService, filterStatus].forEach(el => {
                el.addEventListener('change', () => renderAllRecordsTab());
            });

            // === ЛОГИКА КАСТОМНОГО ДРОПДАУНА КЛИЕНТА ===
            filterClientTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = filterClientDropdown.style.display === 'none';

                if (isHidden) {
                    filterClientDropdown.style.display = 'flex';
                    filterClientSearch.value = '';
                    renderFilterClientList(state.clients, filterClientOptions, filterClientValue, filterClientText, filterClientDropdown);
                    filterClientSearch.focus();
                } else {
                    filterClientDropdown.style.display = 'none';
                }
            });

            // Живой поиск внутри дропдауна
            filterClientSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const filtered = state.clients.filter(c => c.name.toLowerCase().includes(query));
                renderFilterClientList(filtered, filterClientOptions, filterClientValue, filterClientText, filterClientDropdown);
            });

            // Закрытие при клике вне окна
            document.addEventListener('click', (e) => {
                if (filterClientDropdown && filterClientTrigger) {
                    if (!e.target.closest('#filter-client-trigger') && !e.target.closest('#filter-client-dropdown')) {
                        filterClientDropdown.style.display = 'none';
                    }
                }
            });

            btnResetFilters.addEventListener('click', () => {
                filterCategory.value = 'all';
                filterService.value = 'all';
                filterStatus.value = 'all';

                // Сброс кастомного дропдауна
                filterClientValue.value = 'all';
                filterClientText.innerText = 'Все';

                searchInput.value = '';
                renderAllRecordsTab();
            });

            isSearchInitialized = true;
    }

    // 2. Умное авто-обновление списков фильтров (кроме клиента, он рендерится на лету)
    const currentStateHash = JSON.stringify(state.categories) + JSON.stringify(state.directoryMap);
    if (lastStateHash !== currentStateHash && state.records) {
        populateFilters(filterCategory, filterService, filterStatus);
        lastStateHash = currentStateHash;
    }

    // 3. Делегирование событий карточек (1 раз)
    if (!isListListenerAttached) {
        setupListEventDelegation(list);
        isListListenerAttached = true;
    }

    if (!state.records || state.records.length === 0) {
        list.innerHTML = '<p class="empty-state">Список записей пуст...</p>';
        return;
    }

    // --- ЛОГИКА ФИЛЬТРАЦИИ И ПОИСКА ---
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const catVal = filterCategory.value;
    const srvVal = filterService.value;
    const clientVal = filterClientValue ? filterClientValue.value : 'all'; // Берем из кастомного поля
    const statusVal = filterStatus.value;

    const isSearchingOrFiltering = query.length > 0 || catVal !== 'all' || srvVal !== 'all' || clientVal !== 'all' || statusVal !== 'all';

    let filteredRecords = state.records.filter(r => {
        let textMatch = true;
        if (query) {
            const searchStr = `
            ${r.client || ''} ${r.phone || ''} ${r.instagram || ''}
            ${r.category || ''} ${r.service || ''} ${r.comment || ''}
            ${r.date || ''} ${r.time || ''} ${r.price || ''} ${r.status || ''}
            `.toLowerCase();
            textMatch = searchStr.includes(query);
        }

        let catMatch = true;
        if (catVal === 'none') catMatch = !r.category || r.category.trim() === '';
        else if (catVal !== 'all') catMatch = r.category === catVal;

        let srvMatch = true;
        if (srvVal === 'none') srvMatch = !r.service || r.service.trim() === '';
        else if (srvVal !== 'all') srvMatch = r.service === srvVal;

        let clientMatch = true;
        if (clientVal !== 'all') clientMatch = r.client === clientVal;

        let statusMatch = true;
        if (statusVal !== 'all') statusMatch = r.status === statusVal;

        return textMatch && catMatch && srvMatch && clientMatch && statusMatch;
    });

    let finalHtml = '';

    // ПОКАЗЫВАЕМ СЧЕТЧИК, ЕСЛИ АКТИВЕН ПОИСК ИЛИ ФИЛЬТРЫ
    if (isSearchingOrFiltering) {
        finalHtml += `
        <div style="margin-bottom: 15px; padding: 0 5px; color: var(--text-muted); font-size: 0.95rem;">
        Всего найдено: <span style="color: var(--text-main); font-weight: bold; font-size: 1.05rem;">${filteredRecords.length}</span>
        </div>
        `;
    }

    if (filteredRecords.length === 0) {
        list.innerHTML = finalHtml + '<p class="empty-state">По вашим фильтрам ничего не найдено</p>';
        return;
    }

    filteredRecords.sort((a, b) => {
        const dateTimeA = `${a.date}T${a.time || '00:00'}`;
        const dateTimeB = `${b.date}T${b.time || '00:00'}`;
        return dateTimeB.localeCompare(dateTimeA);
    });

    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const weekRecords = [];
    const groupedByYearAndMonth = {};

    filteredRecords.forEach(r => {
        const [y, m, d] = r.date.split('-');
        const rDate = new Date(y, m - 1, d);
        const year = rDate.getFullYear();
        const monthNum = String(rDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${monthNum}`;

        if (!isSearchingOrFiltering && rDate >= startOfWeek && rDate <= endOfWeek) {
            weekRecords.push(r);
        }

        if (!groupedByYearAndMonth[year]) groupedByYearAndMonth[year] = {};
        if (!groupedByYearAndMonth[year][monthKey]) groupedByYearAndMonth[year][monthKey] = [];

        groupedByYearAndMonth[year][monthKey].push(r);
    });

    if (!isSearchingOrFiltering && weekRecords.length > 0) {
        const weekDone = weekRecords.filter(r => r.status === 'Исполнена').length;
        finalHtml += buildGroupHtml('На этой неделе', weekDone, weekRecords, true, 'week-header', isSearchingOrFiltering);
    }

    const monthNames = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const years = Object.keys(groupedByYearAndMonth).sort((a, b) => b - a);

    years.forEach(year => {
        const monthsObj = groupedByYearAndMonth[year];
        const months = Object.keys(monthsObj).sort((a, b) => b.localeCompare(a));

        let yearTotalDone = 0;
        let yearContentHtml = '';

        months.forEach(monthKey => {
            const recordsInMonth = monthsObj[monthKey];
            const doneInMonth = recordsInMonth.filter(r => r.status === 'Исполнена').length;
            yearTotalDone += doneInMonth;
            const monthName = monthNames[parseInt(monthKey.split('-')[1])];
            const isMonthOpen = isSearchingOrFiltering;

            yearContentHtml += buildGroupHtml(`${monthName} ${year}`, doneInMonth, recordsInMonth, isMonthOpen, '', isSearchingOrFiltering);
        });

        const isYearOpen = isSearchingOrFiltering || parseInt(year) === now.getFullYear();

        finalHtml += `
        <div class="accordion-group">
        <div class="group-header year-header ${isYearOpen ? 'open' : ''}">
        <div class="group-title">${year}</div>
        <div class="group-count">Исполнено: ${yearTotalDone} <i class="ph ph-caret-down" style="margin-left: 5px;"></i></div>
        </div>
        <div class="group-content ${isYearOpen ? 'open' : ''}">
        ${yearContentHtml}
        </div>
        </div>
        `;
    });

    list.innerHTML = finalHtml;
}

// Рендер элементов списка клиентов внутри дропдауна
function renderFilterClientList(clients, optionsEl, valueEl, textEl, dropdownEl) {
    optionsEl.innerHTML = '';

    const liAll = document.createElement('li');
    liAll.innerText = 'Все';
    liAll.style.cssText = 'padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--accent); font-weight: bold;';
    liAll.addEventListener('click', () => {
        valueEl.value = 'all';
        textEl.innerText = 'Все';
        dropdownEl.style.display = 'none';
        renderAllRecordsTab();
    });
    optionsEl.appendChild(liAll);

    if (!clients || clients.length === 0) {
        const liEmpty = document.createElement('li');
        liEmpty.innerText = 'Ничего не найдено';
        liEmpty.style.cssText = 'padding: 10px 12px; color: var(--text-muted); cursor: default;';
        optionsEl.appendChild(liEmpty);
        return;
    }

    const sorted = [...clients].sort((a,b) => a.name.localeCompare(b.name));

    sorted.forEach(c => {
        const li = document.createElement('li');
        li.innerText = c.name;
        li.style.cssText = 'padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-main);';
        li.addEventListener('click', () => {
            valueEl.value = c.name;
            textEl.innerText = c.name;
            dropdownEl.style.display = 'none';
            renderAllRecordsTab();
        });
        optionsEl.appendChild(li);
    });
}

// Заполняем остальные стандартные фильтры
function populateFilters(catSel, srvSel, statusSel) {
    const catVal = catSel.value;
    const srvVal = srvSel.value;
    const statusVal = statusSel.value;

    catSel.innerHTML = '<option value="all">Все</option><option value="none">Без категории</option>';
    srvSel.innerHTML = '<option value="all">Все</option><option value="none">Без услуги</option>';
    statusSel.innerHTML = '<option value="all">Все</option>';

    if (state.categories) {
        state.categories.forEach(cat => {
            const name = typeof cat === 'object' ? cat.name : cat;
            catSel.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }
    if (state.directoryMap) {
        const uniqueSrvs = [...new Set(state.directoryMap.map(i => i.service))];
        uniqueSrvs.forEach(srv => srvSel.innerHTML += `<option value="${srv}">${srv}</option>`);
    }
    if (state.statuses) {
        state.statuses.forEach(s => statusSel.innerHTML += `<option value="${s}">${s}</option>`);
    }

    if (catVal) catSel.value = catVal;
    if (srvVal) srvSel.value = srvVal;
    if (statusVal) statusSel.value = statusVal;

    if (!catSel.value) catSel.value = 'all';
    if (!srvSel.value) srvSel.value = 'all';
    if (!statusSel.value) statusSel.value = 'all';
}

function setupListEventDelegation(list) {
    let startX = 0;
    let currentSwipeContent = null;

    list.addEventListener('touchstart', (e) => {
        const content = e.target.closest('.card-content');
        if (!content) return;
        startX = e.touches[0].clientX;
        currentSwipeContent = content;
    }, { passive: true });

    list.addEventListener('touchend', (e) => {
        if (!currentSwipeContent) return;
        const card = currentSwipeContent.closest('.record-card');
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (diff > 40) {
            document.querySelectorAll('.record-card.swiped').forEach(c => c.classList.remove('swiped'));
            card.classList.add('swiped');
        } else if (diff < -40) {
            card.classList.remove('swiped');
        }
        currentSwipeContent = null;
    });

    list.addEventListener('click', async (e) => {
        const header = e.target.closest('.group-header');
        if (header && !e.target.closest('.record-card')) {
            header.classList.toggle('open');
            const content = header.nextElementSibling;
            if (content) content.classList.toggle('open');
            return;
        }

        const card = e.target.closest('.record-card');
        if (!card) return;

        if (e.target.closest('.card-content') && card.classList.contains('swiped')) {
            card.classList.remove('swiped');
            return;
        }

        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn || deleteBtn) {
            const recordId = card.getAttribute('data-id');
            const record = state.records.find(r => r.id === recordId);

            if (!record) return;

            if (editBtn) {
                openEditModal(record);
                card.classList.remove('swiped');
            } else if (deleteBtn) {
                if(confirm(`Удалить запись клиента ${record.client} (${record.date})?`)) {
                    const response = await sendData('deleteRecord', { record: record });
                    if (response && response.status === 'success') {
                        const data = await fetchData();
                        if (data && !data.status) {
                            Object.assign(state, data);
                            renderAllRecordsTab();
                            renderCalendar();
                            renderDailyRecords();
                        }
                    } else { alert("Ошибка при удалении."); }
                }
            }
        }
    });
}

function buildGroupHtml(title, count, records, isOpen, extraClass = '', isSearching) {
    let cardsHtml = records.map(record => {
        const [y, m, d] = record.date.split('-');
        const dateStr = `${d}.${m}.${y}`;
        let priceHTML = record.price > 0 ? `<div class="card-price">${record.price.toFixed(2)} <span class="icon-byn"></span></div>` : '';

        return `
        <div class="record-card status-${record.status}" data-id="${record.id}" style="margin-bottom: 8px;">
        <div class="card-actions-bg">
        <button class="icon-btn edit-btn"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-btn"><i class="ph ph-trash"></i></button>
        </div>
        <div class="card-content" style="padding: 12px; border-left-width: 6px;">
        <div class="card-header" style="margin-bottom: 5px;">
        <span class="card-time" style="font-size: 1rem;">
        <i class="ph ph-calendar-blank"></i> ${dateStr} &nbsp;
        <i class="ph ph-clock"></i> ${record.time}
        </span>
        <span style="font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; background: var(--bg-surface); color: var(--text-muted);">${record.status}</span>
        </div>
        <div class="card-body">
        <div class="card-client" style="font-size: 1.05rem;"><i class="ph ph-user"></i> ${record.client}</div>
        <div class="card-service" style="margin-bottom: 0;">${record.category} | ${record.service}</div>
        ${priceHTML}
        </div>
        </div>
        </div>`;
    }).join('');

    return `
    <div class="accordion-group">
    <div class="group-header ${extraClass} ${isOpen ? 'open' : ''}">
    <div class="group-title">${title}</div>
    <div class="group-count">Исполнено: ${count} <i class="ph ph-caret-down" style="margin-left: 5px;"></i></div>
    </div>
    <div class="group-content ${isOpen ? 'open' : ''}">
    ${cardsHtml}
    </div>
    </div>
    `;
}

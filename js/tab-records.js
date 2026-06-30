import { state } from './state.js';
import { openEditModal } from './main.js';
import { sendData, fetchData } from './api.js';
import { renderCalendar, renderDailyRecords } from './tab-schedule.js';

let isSearchInitialized = false;
let isListListenerAttached = false; // Флаг для умного делегирования событий

export function renderAllRecordsTab() {
    const list = document.getElementById('all-records-list');
    const searchInput = document.getElementById('search-all-records-input');
    if (!list) return;

    // 1. Инициализация поиска
    if (!isSearchInitialized && searchInput) {
        searchInput.addEventListener('input', () => renderAllRecordsTab());
        isSearchInitialized = true;
    }

    // 2. Инициализация делегирования событий (ВЕШАЕТСЯ 1 РАЗ НА ВЕСЬ СПИСОК)
    if (!isListListenerAttached) {
        setupListEventDelegation(list);
        isListListenerAttached = true;
    }

    if (!state.records || state.records.length === 0) {
        list.innerHTML = '<p class="empty-state">Список записей пуст...</p>';
        return;
    }

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const isSearching = query.length > 0;

    let filteredRecords = state.records.filter(r => {
        if (!query) return true;
        const searchStr = `
        ${r.client || ''} ${r.phone || ''} ${r.instagram || ''}
        ${r.category || ''} ${r.service || ''} ${r.comment || ''}
        ${r.date || ''} ${r.time || ''} ${r.price || ''} ${r.status || ''}
        `.toLowerCase();
        return searchStr.includes(query);
    });

    if (filteredRecords.length === 0) {
        list.innerHTML = '<p class="empty-state">По вашему запросу ничего не найдено</p>';
        return;
    }

    // Сортировка
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

        if (!isSearching && rDate >= startOfWeek && rDate <= endOfWeek) {
            weekRecords.push(r);
        }

        if (!groupedByYearAndMonth[year]) groupedByYearAndMonth[year] = {};
        if (!groupedByYearAndMonth[year][monthKey]) groupedByYearAndMonth[year][monthKey] = [];

        groupedByYearAndMonth[year][monthKey].push(r);
    });

    // СОБИРАЕМ HTML В БУФЕР (Не дергаем DOM каждый раз)
    let finalHtml = '';

    // Отрисовка недели
    if (!isSearching && weekRecords.length > 0) {
        const weekDone = weekRecords.filter(r => r.status === 'Исполнена').length;
        finalHtml += buildGroupHtml('На этой неделе', weekDone, weekRecords, true, 'week-header', isSearching);
    }

    // Отрисовка годов и месяцев
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
            const isMonthOpen = isSearching;

            yearContentHtml += buildGroupHtml(`${monthName} ${year}`, doneInMonth, recordsInMonth, isMonthOpen, '', isSearching);
        });

        const isYearOpen = isSearching || parseInt(year) === now.getFullYear();

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

    // ВСТАВЛЯЕМ HTML В ДОМ СТРОГО 1 РАЗ!
    list.innerHTML = finalHtml;
}

// === ЦЕНТР УПРАВЛЕНИЯ КЛИКАМИ И СВАЙПАМИ ===
// Эта функция заменяет тысячи мелких слушателей на карточках
function setupListEventDelegation(list) {
    let startX = 0;
    let currentSwipeContent = null;

    // --- ОПРЕДЕЛЯЕМ НАЧАЛО СВАЙПА ---
    list.addEventListener('touchstart', (e) => {
        const content = e.target.closest('.card-content');
        if (!content) return; // Игнорируем, если клик не по карточке
        startX = e.touches[0].clientX;
        currentSwipeContent = content;
    }, { passive: true });

    // --- ОБРАБОТКА КОНЦА СВАЙПА ---
    list.addEventListener('touchend', (e) => {
        if (!currentSwipeContent) return;
        const card = currentSwipeContent.closest('.record-card');
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (diff > 40) {
            // Закрываем все другие свайпы
            document.querySelectorAll('.record-card.swiped').forEach(c => c.classList.remove('swiped'));
            card.classList.add('swiped');
        } else if (diff < -40) {
            card.classList.remove('swiped');
        }
        currentSwipeContent = null;
    });

    // --- ВСЕ КЛИКИ (Кнопки, Аккордеоны, Карточки) ---
    list.addEventListener('click', async (e) => {

        // 1. Если кликнули по шапке аккордеона (группе)
        const header = e.target.closest('.group-header');
        if (header && !e.target.closest('.record-card')) {
            header.classList.toggle('open');
            const content = header.nextElementSibling;
            if (content) content.classList.toggle('open');
            return;
        }

        // 2. Если кликнули внутри карточки
        const card = e.target.closest('.record-card');
        if (!card) return;

        // Если кликнули просто по самой карточке, чтобы закрыть её свайп
        if (e.target.closest('.card-content') && card.classList.contains('swiped')) {
            card.classList.remove('swiped');
            return;
        }

        // 3. Обработка кнопок действий
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn || deleteBtn) {
            const recordId = card.getAttribute('data-id');
            // Ищем запись в базе ТОЛЬКО если пользователь нажал на кнопку (Экономит CPU)
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

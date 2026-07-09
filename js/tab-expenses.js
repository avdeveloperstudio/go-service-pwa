import { state } from './state.js';
import { sendData } from './api.js';
import { openExpenseEditModal } from './main.js';

let isSearchInitialized = false;
let isListListenerAttached = false;

export function renderExpensesTab() {
    const list = document.getElementById('expenses-list');
    const searchInput = document.getElementById('search-expenses-input');

    if (!list) return;

    if (!isSearchInitialized && searchInput) {
        searchInput.addEventListener('input', () => renderExpensesTab());
        isSearchInitialized = true;
    }

    if (!isListListenerAttached) {
        setupListEventDelegation(list);
        isListListenerAttached = true;
    }

    if (!state.expenses || state.expenses.length === 0) {
        list.innerHTML = '<p class="empty-state">Список расходов пуст...</p>';
        return;
    }

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredExpenses = state.expenses.filter(exp => {
        if (!query) return true;
        const searchStr = `${exp.name || ''} ${exp.seller || ''} ${exp.category || ''} ${exp.date || ''} ${exp.price || ''}`.toLowerCase();
        return searchStr.includes(query);
    });

    let finalHtml = '';

    if (query.length > 0) {
        finalHtml += `
        <div style="margin-bottom: 15px; padding: 0 5px; color: var(--text-muted); font-size: 0.95rem;">
        Всего найдено: <span style="color: var(--text-main); font-weight: bold; font-size: 1.05rem;">${filteredExpenses.length}</span>
        </div>
        `;
    }

    if (filteredExpenses.length === 0) {
        list.innerHTML = finalHtml + '<p class="empty-state">Ничего не найдено</p>';
        return;
    }

    // СОРТИРОВКА: Сначала реверс (чтобы новые по добавлению были сверху), затем сортировка по дате
    filteredExpenses.reverse().sort((a, b) => b.date.localeCompare(a.date));

    const now = new Date();
    const groupedByYearAndMonth = {};

    // Группировка
    filteredExpenses.forEach(exp => {
        const [y, m, d] = exp.date.split('-');
        const year = y;
        const monthKey = `${y}-${m}`;

        if (!groupedByYearAndMonth[year]) groupedByYearAndMonth[year] = {};
        if (!groupedByYearAndMonth[year][monthKey]) groupedByYearAndMonth[year][monthKey] = [];

        groupedByYearAndMonth[year][monthKey].push(exp);
    });

    const monthNames = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const years = Object.keys(groupedByYearAndMonth).sort((a, b) => b - a);

    years.forEach(year => {
        const monthsObj = groupedByYearAndMonth[year];
        const months = Object.keys(monthsObj).sort((a, b) => b.localeCompare(a));

        let yearTotalSum = 0;
        let yearContentHtml = '';

        months.forEach(monthKey => {
            const expensesInMonth = monthsObj[monthKey];
            const sumInMonth = expensesInMonth.reduce((sum, exp) => sum + (parseFloat(exp.price) || 0), 0);
            yearTotalSum += sumInMonth;
            const monthName = monthNames[parseInt(monthKey.split('-')[1])];
            const isMonthOpen = query.length > 0;

            yearContentHtml += buildGroupHtml(`${monthName} ${year}`, sumInMonth, expensesInMonth, isMonthOpen, '', query.length > 0);
        });

        const isYearOpen = query.length > 0 || parseInt(year) === now.getFullYear();

        finalHtml += `
        <div class="accordion-group">
        <div class="group-header year-header ${isYearOpen ? 'open' : ''}">
        <div class="group-title">${year}</div>
        <div class="group-count">Сумма: ${yearTotalSum.toFixed(2)} <span class="icon-byn" style="font-size: 0.8em;"></span> <i class="ph ph-caret-down" style="margin-left: 5px;"></i></div>
        </div>
        <div class="group-content ${isYearOpen ? 'open' : ''}">
        ${yearContentHtml}
        </div>
        </div>
        `;
    });

    list.innerHTML = finalHtml;
}

function buildGroupHtml(title, sum, records, isOpen, extraClass = '', isSearching) {
    let cardsHtml = records.map(exp => {
        const dateStr = exp.date.split('-').reverse().join('.');
        const sellerHtml = exp.seller ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;"><i class="ph ph-storefront"></i> ${exp.seller}</div>` : '';

        return `
        <div class="record-card" data-id="${exp.id}" style="margin-bottom: 12px;">
        <div class="card-actions-bg">
        <button class="icon-btn edit-btn"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-btn"><i class="ph ph-trash"></i></button>
        </div>
        <div class="card-content" style="padding: 15px; border-left: 4px solid var(--status-noshow);">
        <div class="card-header" style="margin-bottom: 8px;">
        <span class="card-time" style="font-size: 0.95rem; font-weight: normal; color: var(--text-muted);"><i class="ph ph-calendar-blank"></i> ${dateStr}</span>
        <span style="font-size: 0.85rem; padding: 2px 8px; border-radius: 6px; background: rgba(179, 157, 219, 0.15); color: var(--accent); font-weight: 500;">${exp.category}</span>
        </div>
        <div class="card-body">
        <div class="card-client" style="font-size: 1.1rem; color: var(--text-main);"><i class="ph ph-shopping-bag"></i> ${exp.name}</div>
        ${sellerHtml}
        <div class="card-price" style="color: var(--status-noshow); font-size: 1.2rem; margin-top: 8px;">${parseFloat(exp.price).toFixed(2)} <span class="icon-byn"></span></div>
        </div>
        </div>
        </div>
        `;
    }).join('');

    return `
    <div class="accordion-group">
    <div class="group-header ${extraClass} ${isOpen ? 'open' : ''}">
    <div class="group-title">${title}</div>
    <div class="group-count">Сумма: ${sum.toFixed(2)} <span class="icon-byn" style="font-size: 0.8em;"></span> <i class="ph ph-caret-down" style="margin-left: 5px;"></i></div>
    </div>
    <div class="group-content ${isOpen ? 'open' : ''}">
    ${cardsHtml}
    </div>
    </div>
    `;
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

        if (e.target.closest('.card-content') && card.classList.contains('swiped') && !e.target.closest('.icon-btn')) {
            card.classList.remove('swiped');
            return;
        }

        const expId = card.getAttribute('data-id');
        const exp = state.expenses.find(r => r.id === expId);
        if (!exp) return;

        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            openExpenseEditModal(exp);
            card.classList.remove('swiped');
        } else if (deleteBtn) {
            if (confirm(`Удалить расход "${exp.name}"?`)) {
                const response = await sendData('deleteExpense', { expense: exp });
                if (response && response.status === 'success') {
                    state.expenses = state.expenses.filter(r => r.id !== expId);
                    renderExpensesTab();
                }
            }
        }
    });
}

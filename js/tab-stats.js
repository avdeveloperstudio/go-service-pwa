import { state } from './state.js';

let revenueChartInstance = null;
let categoryChartInstance = null;
let expenseLineChartInstance = null;
let expenseCategoryChartInstance = null;
let currentPeriod = 'month';
let lastCategoriesHash = '';

// Элементы
const btnFilters = document.querySelectorAll('.stat-filter-btn');
const customDatesBlock = document.getElementById('stat-custom-dates');
const inputDateFrom = document.getElementById('stat-date-from');
const inputDateTo = document.getElementById('stat-date-to');
const catFilterSelect = document.getElementById('stat-category-filter');

export function initStatsTab() {
    // Подписка на изменение категории
    catFilterSelect.addEventListener('change', renderStats);

    // Вешаем клики на фильтры периодов
    btnFilters.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btnFilters.forEach(b => b.classList.remove('active'));
            e.target.closest('.stat-filter-btn').classList.add('active');

            currentPeriod = e.target.closest('.stat-filter-btn').getAttribute('data-period');

            if (currentPeriod === 'custom') {
                customDatesBlock.style.display = 'flex';
            } else {
                customDatesBlock.style.display = 'none';
                renderStats(); // Перерисовываем
            }
        });
    });

    // Авто-перерисовка при изменении кастомных дат
    inputDateFrom.addEventListener('change', renderStats);
    inputDateTo.addEventListener('change', renderStats);

    // Настраиваем глобальные цвета графиков для темной темы
    if (window.Chart) {
        Chart.defaults.color = '#9E9EA7';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    }
}

export function renderStats() {
    if (!state.records) return;

    // 1. ОПРЕДЕЛЯЕМ ПЕРИОД И ТЕКСТ ДЛЯ ЗАГОЛОВКОВ
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let startDate = new Date(0);
    let endDate = now;
    let periodText = "";

    if (currentPeriod === 'today') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        periodText = "(за Сегодня)";
    } else if (currentPeriod === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        periodText = "(за 7 дней)";
    } else if (currentPeriod === 'month') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        periodText = "(за 30 дней)";
    } else if (currentPeriod === 'all') {
        periodText = "(за Всё время)";
    } else if (currentPeriod === 'custom') {
        if (inputDateFrom.value) startDate = new Date(inputDateFrom.value);
        if (inputDateTo.value) {
            endDate = new Date(inputDateTo.value);
            endDate.setHours(23, 59, 59, 999);
        }
        const fromStr = inputDateFrom.value ? inputDateFrom.value.split('-').reverse().join('.') : '...';
        const toStr = inputDateTo.value ? inputDateTo.value.split('-').reverse().join('.') : '...';
        periodText = `(с ${fromStr} по ${toStr})`;
    }

    document.getElementById('chart-revenue-title').innerText = `Динамика дохода ${periodText}`;
    document.getElementById('chart-categories-title').innerText = `Топ категорий. Доход ${periodText}`;
    document.getElementById('chart-expense-categories-title').innerText = `Топ категорий. Расход ${periodText}`;

    // Обновляем список категорий в фильтре, если он изменился
    const currentCatHash = JSON.stringify(state.categories);
    if (lastCategoriesHash !== currentCatHash) {
        const currentSelected = catFilterSelect.value;
        catFilterSelect.innerHTML = '<option value="all">Все категории</option>';
        if (state.categories) {
            state.categories.forEach(cat => {
                const name = typeof cat === 'object' ? cat.name : cat;
                catFilterSelect.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        catFilterSelect.value = currentSelected || 'all';
        if (!catFilterSelect.value) catFilterSelect.value = 'all';
        lastCategoriesHash = currentCatHash;
    }

    const selectedCategory = catFilterSelect.value;

    // 2. ФИЛЬТРУЕМ ЗАПИСИ (ДОХОДЫ)
    const validRecords = state.records.filter(r => {
        if (!r.date) return false;
        const [y, m, d] = r.date.split('-');
        const rDate = new Date(y, m - 1, d);
        if (rDate < startDate || rDate > endDate) return false;
        if (!r.category || r.category.trim() === '') return false;

        // Фильтр по выбранной категории
        if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;

        if (state.categories) {
            const catObj = state.categories.find(c => (typeof c === 'object' ? c.name : c) === r.category);
            if (catObj && typeof catObj === 'object' && catObj.inStats === false) return false;
        }
        return true;
    });

    // 2.1 ФИЛЬТРУЕМ РАСХОДЫ
    const validExpenses = (state.expenses || []).filter(e => {
        if (!e.date) return false;
        const [y, m, d] = e.date.split('-');
        const eDate = new Date(y, m - 1, d);
        if (eDate < startDate || eDate > endDate) return false;

        // Фильтр по выбранной категории
        if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;

        return true;
    });

    // 3. СЧИТАЕМ МЕТРИКИ, ЧЕК И ЧИСТУЮ ПРИБЫЛЬ
    let totalRevenue = 0;
    let totalExpense = 0;
    let completedCount = 0;
    let minCheck = Infinity;
    let maxCheck = 0;

    const statusCounts = {};
    const revenueByDate = {};
    const revenueByCategory = {};

    validRecords.forEach(r => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

        if (r.status === 'Исполнена') {
            const price = parseFloat(r.price) || 0;
            totalRevenue += price;
            completedCount++;

            if (price < minCheck) minCheck = price;
            if (price > maxCheck) maxCheck = price;

            const dateStr = r.date.split('-').slice(1).reverse().join('.');
            revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + price;

            // Категория 100% есть, так как пустые мы отфильтровали выше
            const cat = r.category;
            revenueByCategory[cat] = (revenueByCategory[cat] || 0) + price;
        }
    });

    if (minCheck === Infinity) minCheck = 0;

    // Считаем расходы
    const expenseByCategory = {};
    validExpenses.forEach(e => {
        const price = parseFloat(e.price) || 0;
        totalExpense += price;
        const cat = e.category;
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + price;
    });

    const avgCheck = completedCount > 0 ? (totalRevenue / completedCount).toFixed(2) : "0.00";
    const netProfit = totalRevenue - totalExpense;

    // 4. ОБНОВЛЯЕМ ИНТЕРФЕЙС
    document.getElementById('stat-revenue-total').innerHTML = `${totalRevenue.toFixed(2)} <span class="icon-byn"></span>`;
    document.getElementById('stat-expense-total').innerHTML = `${totalExpense.toFixed(2)} <span class="icon-byn"></span>`;
    document.getElementById('stat-net-profit').innerHTML = `${netProfit.toFixed(2)} <span class="icon-byn"></span>`;
    document.getElementById('stat-records-total').innerText = validRecords.length;

    document.getElementById('stat-min-check').innerHTML = `${minCheck.toFixed(2)} <span class="icon-byn" style="font-size: 0.8em;"></span>`;
    document.getElementById('stat-avg-check').innerHTML = `${avgCheck} <span class="icon-byn" style="font-size: 0.8em;"></span>`;
    document.getElementById('stat-max-check').innerHTML = `${maxCheck.toFixed(2)} <span class="icon-byn" style="font-size: 0.8em;"></span>`;

    // 5. РЕНДЕР ВОРОНКИ СТАТУСОВ
    const statusesListEl = document.getElementById('stat-statuses-list');
    statusesListEl.innerHTML = '';
    const statusColors = { 'Активна': 'var(--status-active)', 'Исполнена': 'var(--status-done)', 'Отмена': 'var(--status-cancel)', 'Неявка': 'var(--status-noshow)', 'Перенос': 'var(--status-move)' };

    const sortedStatuses = Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a]);

    if (sortedStatuses.length === 0) {
        statusesListEl.innerHTML = '<div class="empty-state" style="padding: 10px;">Нет данных за этот период</div>';
    } else {
        sortedStatuses.forEach(status => {
            const count = statusCounts[status];
            const percent = validRecords.length > 0 ? (count / validRecords.length) * 100 : 0;
            const color = statusColors[status] || 'var(--accent)';

            statusesListEl.innerHTML += `
            <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-main);">${status}</span>
            <span style="font-weight: bold;">${count} <span style="color: var(--text-muted); font-weight: normal;">(${Math.round(percent)}%)</span></span>
            </div>
            <div class="stat-progress-bg">
            <div class="stat-progress-fill" style="width: ${percent}%; background: ${color};"></div>
            </div>
            </div>
            `;
        });
    }

    if (typeof Chart !== 'undefined') {
        renderCharts(revenueByDate, revenueByCategory, expenseByCategory);
    }
}

function renderCharts(revenueByDate, revenueByCategory, expenseByCategory) {
    // ХЕЛПЕР: Функция сортировки дат для линейных графиков
    const sortDates = (dict) => Object.keys(dict).sort((a, b) => {
        const [d1, m1] = a.split('.'); const [d2, m2] = b.split('.');
        return new Date(`2024-${m1}-${d1}`) - new Date(`2024-${m2}-${d2}`);
    });

    // ХЕЛПЕР: Формирование массива лейблов с процентами
    const getLabelsWithPercent = (labels, data) => {
        const total = data.reduce((a, b) => a + b, 0);
        return labels.map((label, i) => {
            const pct = total > 0 ? Math.round((data[i] / total) * 100) : 0;
            return `${label} (${pct}%)`;
        });
    };

    const pieColors = ['#B39DDB', '#435E6F', '#4CAF50', '#FF9500', '#E91E63', '#00BCD4', '#9C27B0'];

    // 1. ГРАФИК ДОХОДОВ (Линейный)
    const revSortedDates = sortDates(revenueByDate);
    const lineLabels = revSortedDates;
    const lineData = revSortedDates.map(d => revenueByDate[d]);

    if (revenueChartInstance) revenueChartInstance.destroy();
    const ctxLine = document.getElementById('chart-revenue').getContext('2d');
    revenueChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: lineLabels.length > 0 ? lineLabels : ['Нет данных'],
            datasets: [{
                label: 'Доход', data: lineData.length > 0 ? lineData : [0],
                borderColor: '#B39DDB', backgroundColor: 'rgba(179, 157, 219, 0.2)',
                                     borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#1E1E24', pointBorderColor: '#B39DDB', pointRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } }, x: { grid: { display: false } } } }
    });

    // 2. ГРАФИК КАТЕГОРИЙ ДОХОДА (Круговой с процентами)
    const sortedRevCategories = Object.keys(revenueByCategory).sort((a, b) => revenueByCategory[b] - revenueByCategory[a]);
    const revPieData = sortedRevCategories.map(c => revenueByCategory[c]);
    const revPieLabels = getLabelsWithPercent(sortedRevCategories, revPieData);

    if (categoryChartInstance) categoryChartInstance.destroy();
    const ctxPie = document.getElementById('chart-categories').getContext('2d');
    categoryChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: revPieLabels.length > 0 ? revPieLabels : ['Нет данных'],
            datasets: [{ data: revPieData.length > 0 ? revPieData : [1], backgroundColor: revPieData.length > 0 ? pieColors : ['#2A2A35'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });

    // 3. ГРАФИК КАТЕГОРИЙ РАСХОДА (Круговой с процентами)
    const sortedExpCategories = Object.keys(expenseByCategory).sort((a, b) => expenseByCategory[b] - expenseByCategory[a]);
    const expPieData = sortedExpCategories.map(c => expenseByCategory[c]);
    const expPieLabels = getLabelsWithPercent(sortedExpCategories, expPieData);

    if (expenseCategoryChartInstance) expenseCategoryChartInstance.destroy();
    const ctxExpPie = document.getElementById('chart-expense-categories').getContext('2d');

    // Проверка на наличие canvas (на всякий случай, если он не успел отрендериться)
    if (ctxExpPie) {
        expenseCategoryChartInstance = new Chart(ctxExpPie, {
            type: 'doughnut',
            data: {
                labels: expPieLabels.length > 0 ? expPieLabels : ['Нет данных'],
                datasets: [{ data: expPieData.length > 0 ? expPieData : [1], backgroundColor: expPieData.length > 0 ? pieColors : ['#2A2A35'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
    }
}

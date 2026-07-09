import { state } from './state.js';
import { formatDateForDB } from './utils.js';
import { sendData, fetchData } from './api.js';
import { openEditModal } from './main.js'; // Функция модалки приедет из main.js

export function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthYearText = document.getElementById('current-month-year');
    const date = state.currentDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const realTodayFormatted = formatDateForDB(new Date());

    monthYearText.innerText = `${monthNames[month]} ${year}`;
    calendarDays.innerHTML = '';
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    daysOfWeek.forEach(day => {
        const div = document.createElement('div');
        div.innerText = day; div.style.color = 'var(--text-muted)'; div.style.fontSize = '0.8rem';
        calendarDays.appendChild(div);
    });

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-day', 'empty');
        calendarDays.appendChild(emptyDiv);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        dayDiv.innerText = i;
        const cellDate = new Date(year, month, i);
        const cellDateFormatted = formatDateForDB(cellDate);
        const dayRecords = state.records.filter(r => formatDateForDB(r.date) === cellDateFormatted);

        if (dayRecords.length > 0) {
            const dot = document.createElement('span');
            dot.classList.add('record-dot');
            const statuses = [...new Set(dayRecords.map(r => r.status))];
            if (statuses.length === 1) {
                const statusMap = { 'Активна': 'active', 'Исполнена': 'done', 'Отмена': 'cancel', 'Неявка': 'noshow', 'Перенос': 'move' };
                dot.classList.add(`dot-${statusMap[statuses[0]]}`);
            } else {
                dot.classList.add('dot-mixed');
            }
            dayDiv.appendChild(dot);
        }

        if (cellDateFormatted === realTodayFormatted) {
            dayDiv.classList.add('today'); // Накладываем тень "сегодня"
        }

        if (formatDateForDB(state.currentDate) === cellDateFormatted) {
            dayDiv.classList.add('active'); // Выделение выбранной даты (перекроет .today в CSS)
        }

        dayDiv.addEventListener('click', () => {
            state.currentDate = cellDate;
            renderCalendar();
            renderDailyRecords();
        });
        calendarDays.appendChild(dayDiv);
    }
}

export function renderDailyRecords() {
    const list = document.getElementById('daily-records');
    const title = document.getElementById('selected-date-title');
    const selectedDateStr = formatDateForDB(state.currentDate);
    const options = { day: 'numeric', month: 'long' };
    title.innerText = `Записи на ${state.currentDate.toLocaleDateString('ru-RU', options)}`;
    const dayRecords = state.records.filter(r => formatDateForDB(r.date) === selectedDateStr);

    if (dayRecords.length === 0) {
        list.innerHTML = `<p class="empty-state">На этот день записей нет.<br>Отдохни уже наконец! ☕</p>`;
        return;
    }

    dayRecords.sort((a, b) => a.time.localeCompare(b.time));
    list.innerHTML = '';

    dayRecords.forEach(record => {
        const card = document.createElement('div');
        card.classList.add('record-card', `status-${record.status}`);
        let priceHTML = record.price > 0 ? `<div class="card-price">${record.price.toFixed(2)} <span class="icon-byn"></span></div>` : '';

        card.innerHTML = `
        <div class="card-actions-bg">
        <button class="icon-btn edit-btn"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-btn"><i class="ph ph-trash"></i></button>
        </div>
        <div class="card-content">
        <div class="card-header">
        <span class="card-time"><i class="ph ph-clock"></i> ${record.time}</span>
        <select class="quick-status-select">
        ${state.statuses.map(s => `<option value="${s}" ${s === record.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        </div>
        <div class="card-body">
        <div class="card-client"><i class="ph ph-user"></i> ${record.client}</div>
        <div class="card-service">${record.category} | ${record.service}</div>
        ${priceHTML}
        </div>
        </div>
        `;

        const content = card.querySelector('.card-content');
        let startX = 0;

        content.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, {passive: true});
        content.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            if (diff > 40) {
                document.querySelectorAll('.record-card.swiped').forEach(c => c.classList.remove('swiped'));
                card.classList.add('swiped');
            } else if (diff < -40) {
                card.classList.remove('swiped');
            }
        });
        content.addEventListener('click', () => {
            if (card.classList.contains('swiped')) card.classList.remove('swiped');
        });

            card.querySelector('.quick-status-select').addEventListener('change', (e) => { handleQuickStatus(record, e.target.value, e.target); });
            card.querySelector('.edit-btn').addEventListener('click', () => { openEditModal(record); });
            card.querySelector('.delete-btn').addEventListener('click', () => {
                if(confirm(`Удалить запись клиента ${record.client}?`)) { deleteRecordAPI(record); }
            });

            list.appendChild(card);
    });
}

async function handleQuickStatus(record, newStatus, selectElement) {
    if (newStatus === 'Перенос') {
        openEditModal(record);
        document.getElementById('input-status').value = 'Перенос';
        selectElement.value = record.status;
        return;
    }
    let updatedRecord = { ...record, status: newStatus, date: formatDateForDB(record.date) };
    const formattedOldRecord = { ...record, date: formatDateForDB(record.date) };

    if (newStatus === 'Исполнена') {
        let price = prompt("Введите итоговую сумму (Br):", record.price || "");
        if (price === null) { selectElement.value = record.status; return; }
        updatedRecord.price = parseFloat(price.replace(',', '.')) || 0;
    }

    selectElement.disabled = true;
    const response = await sendData('updateRecord', { oldRecord: formattedOldRecord, newRecord: updatedRecord });
    if (response && response.status === 'success') {
        const data = await fetchData();
        if (data && !data.status) { Object.assign(state, data); renderCalendar(); renderDailyRecords(); }
    } else {
        alert("Ошибка при обновлении статуса");
        selectElement.value = record.status;
    }
    selectElement.disabled = false;
}

async function deleteRecordAPI(record) {
    const formattedRecord = { ...record, date: formatDateForDB(record.date) };
    const response = await sendData('deleteRecord', { record: formattedRecord });
    if (response && response.status === 'success') {
        const data = await fetchData();
        if (data && !data.status) { Object.assign(state, data); renderCalendar(); renderDailyRecords(); }
    } else { alert("Ошибка при удалении."); }
}

// Кнопки переключения месяцев
document.getElementById('prev-month').addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); renderDailyRecords(); });
document.getElementById('next-month').addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); renderDailyRecords(); });

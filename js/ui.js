// js/ui.js

function formatDateForDB(dateInput) {
    if (!dateInput) return "";

    // Если дата уже в формате YYYY-MM-DD, просто возвращаем её,
    // чтобы избежать паразитных сдвигов часовых поясов!
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }

    const d = new Date(dateInput);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthYearText = document.getElementById('current-month-year');

    const date = state.currentDate;
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
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

            // Логика цветов
            const statuses = [...new Set(dayRecords.map(r => r.status))];
            if (statuses.length === 1) {
                const statusMap = { 'Активна': 'active', 'Исполнена': 'done', 'Отмена': 'cancel', 'Неявка': 'noshow', 'Перенос': 'move' };
                dot.classList.add(`dot-${statusMap[statuses[0]]}`);
            } else {
                dot.classList.add('dot-mixed'); // Фиолетовая, если статусы разные
            }

            dayDiv.appendChild(dot);
        }

        if (formatDateForDB(state.currentDate) === cellDateFormatted) {
            dayDiv.classList.add('active');
        }

        dayDiv.addEventListener('click', () => {
            state.currentDate = cellDate;
            renderCalendar();
            renderDailyRecords();
        });

        calendarDays.appendChild(dayDiv);
    }
}

function renderDailyRecords() {
    const list = document.getElementById('daily-records');
    const title = document.getElementById('selected-date-title');
    const selectedDateStr = formatDateForDB(state.currentDate);

    const options = { day: 'numeric', month: 'long' };
    title.innerText = `Записи на ${state.currentDate.toLocaleDateString('ru-RU', options)}`;

    const dayRecords = state.records.filter(r => formatDateForDB(r.date) === selectedDateStr);

    if (dayRecords.length === 0) {
        list.innerHTML = `<p class="empty-state">На этот день записей нет.<br>Отдохните или добавьте новую! ☕</p>`;
        return;
    }

    dayRecords.sort((a, b) => a.time.localeCompare(b.time));
    list.innerHTML = '';

    dayRecords.forEach(record => {
        const card = document.createElement('div');
        card.classList.add('record-card', `status-${record.status}`);

        let priceHTML = '';
        if (record.price > 0) {
            priceHTML = `<div class="card-price">${record.price.toFixed(2)} <span class="byn-sign">Б</span></div>`;
        }

        // Обновленная структура: задний фон (кнопки) и передний фон (контент)
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

        // === Логика Свайпа (Сенсорного управления) ===
        const content = card.querySelector('.card-content');
        let startX = 0;

        content.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, {passive: true});

        content.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;

            if (diff > 40) {
                // Свайп влево -> закрываем все другие карточки и открываем эту
                document.querySelectorAll('.record-card.swiped').forEach(c => c.classList.remove('swiped'));
                card.classList.add('swiped');
            } else if (diff < -40) {
                // Свайп вправо -> закрываем
                card.classList.remove('swiped');
            }
        });

        // НОВОЕ: Закрытие по клику на саму карточку
        content.addEventListener('click', () => {
            if (card.classList.contains('swiped')) {
                card.classList.remove('swiped');
            }
        });

        // События кнопок
        card.querySelector('.quick-status-select').addEventListener('change', (e) => {
            window.handleQuickStatus(record, e.target.value, e.target);
        });
        card.querySelector('.edit-btn').addEventListener('click', () => { window.openEditModal(record); });
        card.querySelector('.delete-btn').addEventListener('click', () => {
            if(confirm(`Удалить запись клиента ${record.client}?`)) { window.deleteRecordAPI(record); }
        });

        list.appendChild(card);
    });
}

document.getElementById('prev-month').addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); renderDailyRecords(); });
document.getElementById('next-month').addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); renderDailyRecords(); });

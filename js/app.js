// js/app.js
const state = { currentDate: new Date(), records: [], clients: [], categories: [], services: [], times: [], statuses: [], directoryMap: [] };
let editingRecord = null; // Глобальная переменная для понимания: мы создаем новую или редактируем старую?

document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    const data = await fetchData();
    if (data && !data.status) {
        Object.assign(state, data);
        renderCalendar();
        renderDailyRecords();
        renderClientsTab();
    } else { alert("Не удалось загрузить данные."); }
});

function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabs = document.querySelectorAll('.tab-content');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });
}

// Элементы
const modal = document.getElementById('modal-record');
const form = document.getElementById('record-form');
const inputClient = document.getElementById('input-client');
const clientTrigger = document.getElementById('client-trigger');
const clientDropdown = document.getElementById('client-dropdown');
const clientSearch = document.getElementById('client-search');
const clientOptions = document.getElementById('client-options');
const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputCategory = document.getElementById('input-category');
const inputService = document.getElementById('input-service');
const inputStatus = document.getElementById('input-status');
const inputPrice = document.getElementById('input-price');
const clientPreview = document.getElementById('client-info-preview');

// === УМНАЯ КНОПКА ПЛЮС (FAB) ===
document.getElementById('fab-add').addEventListener('click', () => {
    const activeTab = document.querySelector('.tab-content.active').id;

    if (activeTab === 'tab-clients') {
        // Если мы на вкладке Клиенты - открываем форму клиента
        document.getElementById('modal-client').classList.remove('hidden');
        document.getElementById('input-client-name').focus();
    } else {
        // Иначе открываем форму новой записи (как было раньше)
        editingRecord = null;
        document.getElementById('modal-title').innerText = 'Новая запись';
        clientDropdown.classList.add('hidden');
        clientPreview.classList.add('hidden');
        populateFormDropdowns();
        inputClient.value = '';
        clientTrigger.innerText = 'Выберите клиента...';
        clientSearch.value = '';
        inputDate.value = formatDateForDB(state.currentDate);
        inputStatus.value = 'Активна';
        inputPrice.value = '';
        modal.classList.remove('hidden');
    }
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.add('hidden'); form.reset();
});

// Заполнение списков (с атрибутом hidden, чтобы они не дублировались)
function populateFormDropdowns() {
    renderClientList([...state.clients].sort((a, b) => a.name.localeCompare(b.name)));

    inputTime.innerHTML = '';
    state.times.forEach(t => {
        inputTime.innerHTML += `<option value="${t}">${t}</option>`;
    });

    inputCategory.innerHTML = '<option value="" disabled selected hidden>Выберите категорию...</option>';
    state.categories.forEach(cat => {
        inputCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    inputService.innerHTML = '<option value="" disabled selected hidden>Сначала выберите категорию</option>';
}

// Кастомный список клиентов
function renderClientList(clients) {
    clientOptions.innerHTML = '';
    if (clients.length === 0) {
        clientOptions.innerHTML = '<li style="color: var(--text-muted); cursor: default;">Не найдено</li>';
        return;
    }
    clients.forEach(c => {
        const li = document.createElement('li'); li.innerText = c.name;
        li.addEventListener('click', () => {
            clientTrigger.innerText = c.name; inputClient.value = c.name;
            clientDropdown.classList.add('hidden');
            triggerClientPreview(c.name);
        });
        clientOptions.appendChild(li);
    });
}

clientTrigger.addEventListener('click', () => {
    clientDropdown.classList.toggle('hidden');
    if (!clientDropdown.classList.contains('hidden')) {
        clientSearch.value = '';
        renderClientList([...state.clients].sort((a, b) => a.name.localeCompare(b.name)));
        clientSearch.focus();
    }
});

clientSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    renderClientList(state.clients.filter(c => c.name.toLowerCase().includes(query)));
});

function triggerClientPreview(selectedName) {
    const clientData = state.clients.find(c => c.name === selectedName);
    if (clientData && (clientData.phone || clientData.instagram)) {
        document.getElementById('preview-phone').innerHTML = clientData.phone ? `<i class="ph ph-phone"></i> ${clientData.phone}` : '';
        document.getElementById('preview-inst').innerHTML = clientData.instagram ? (clientData.instagram.includes('http') ? `<a href="${clientData.instagram}" target="_blank" style="color: var(--accent)"><i class="ph ph-instagram-logo"></i> Перейти</a>` : `<i class="ph ph-instagram-logo"></i> ${clientData.instagram}`) : '';
        clientPreview.classList.remove('hidden');
    } else { clientPreview.classList.add('hidden'); }
}

// Зависимый список Услуг
inputCategory.addEventListener('change', (e) => {
    const selectedCat = e.target.value;
    inputService.innerHTML = '<option value="" disabled selected hidden>Выберите услугу...</option>';
    if (!state.directoryMap) return;

    let services = [...new Set(state.directoryMap.filter(item => item.category === selectedCat).map(item => item.service))];
    // Сортируем услуги по глобальному порядку из Справочника
    services.sort((a, b) => {
        let ia = state.services.indexOf(a);
        let ib = state.services.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });

    if (services.length > 0) {
        services.forEach(srv => inputService.innerHTML += `<option value="${srv}">${srv}</option>`);
    } else { inputService.innerHTML = '<option value="" disabled selected hidden>Нет услуг</option>'; }
});


// === ГЛОБАЛЬНЫЕ ФУНКЦИИ (Вызываются из карточки ui.js) ===

// 1. Открытие формы для Редактирования
window.openEditModal = function(record) {
    editingRecord = record;
    document.getElementById('modal-title').innerText = 'Редактирование записи';
    populateFormDropdowns();

    inputClient.value = record.client;
    clientTrigger.innerText = record.client;
    triggerClientPreview(record.client);

    inputDate.value = formatDateForDB(record.date);
    inputTime.value = record.time;

    inputCategory.value = record.category;
    inputCategory.dispatchEvent(new Event('change')); // Инициируем подгрузку услуг
    inputService.value = record.service;

    inputStatus.value = record.status;
    inputPrice.value = record.price || '';

    clientDropdown.classList.add('hidden');
    modal.classList.remove('hidden');
};

// 2. Удаление записи
window.deleteRecordAPI = async function(record) {
    // ВАЖНО: Форматируем дату перед отправкой в гугл таблицу
    const formattedRecord = { ...record, date: formatDateForDB(record.date) };

    const response = await sendData('deleteRecord', { record: formattedRecord });
    if (response && response.status === 'success') {
        const data = await fetchData();
        if (data && !data.status) {
            Object.assign(state, data);
            renderCalendar(); renderDailyRecords();
        }
    } else { alert("Ошибка при удалении."); }
};

// 3. Быстрая смена статуса
window.handleQuickStatus = async function(record, newStatus, selectElement) {
    if (newStatus === 'Перенос') {
        window.openEditModal(record);
        inputStatus.value = 'Перенос';
        selectElement.value = record.status;
        return;
    }

    let updatedRecord = { ...record, status: newStatus, date: formatDateForDB(record.date) };

    // ВАЖНО: Форматируем дату старой записи для корректного поиска
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
        if (data && !data.status) {
            Object.assign(state, data);
            renderCalendar(); renderDailyRecords();
        }
    } else {
        alert("Ошибка при обновлении статуса");
        selectElement.value = record.status;
    }
    selectElement.disabled = false;
};

// === ОТПРАВКА ФОРМЫ (Создание ИЛИ Обновление) ===
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inputClient.value) return alert("Пожалуйста, выберите клиента из списка!");

                      const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Сохранение...';

    const clientData = state.clients.find(c => c.name === inputClient.value) || {};
    const newRecord = {
        client: inputClient.value, date: inputDate.value, time: inputTime.value,
        category: inputCategory.value, service: inputService.value, status: inputStatus.value,
        price: inputPrice.value ? parseFloat(inputPrice.value.replace(',', '.')) : 0,
                      comment: "", phone: clientData.phone || "", instagram: clientData.instagram || ""
    };

    const action = editingRecord ? 'updateRecord' : 'addRecord';

    // ВАЖНО: Форматируем дату старой записи, если мы редактируем
    const payload = editingRecord
    ? { oldRecord: { ...editingRecord, date: formatDateForDB(editingRecord.date) }, newRecord: newRecord }
    : { record: newRecord };

    const response = await sendData(action, payload);

    if (response && response.status === 'success') {
        const data = await fetchData();
        if (data && !data.status) {
            Object.assign(state, data);
            renderCalendar(); renderDailyRecords();
        }
        modal.classList.add('hidden'); form.reset();
    } else { alert("Ошибка при сохранении: " + (response.message || "")); }

    submitBtn.disabled = false; submitBtn.innerText = originalText;
});

// === ЛОГИКА ВКЛАДКИ КЛИЕНТОВ ===

// Закрытие окна клиента
document.getElementById('btn-close-client-modal').addEventListener('click', () => {
    document.getElementById('modal-client').classList.add('hidden');
    document.getElementById('client-form').reset();
});

// Отправка формы клиента
document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Сохранение...';

    const newClient = {
        name: document.getElementById('input-client-name').value.trim(),
                                                        phone: document.getElementById('input-client-phone').value.trim(),
                                                        instagram: document.getElementById('input-client-inst').value.trim()
    };

    // Отправляем данные (api.js сам раскидает их в Firebase и Google Sheets)
    const response = await sendData('addClient', { client: newClient });

    if (response && response.status === 'success') {
        // Добавляем в локальный стейт, чтобы сразу увидеть без перезагрузки
        state.clients.push(newClient);
        renderClientsTab();

        document.getElementById('modal-client').classList.add('hidden');
        e.target.reset();
    } else {
        alert("Ошибка при сохранении: " + (response.message || ""));
    }

    submitBtn.disabled = false;
    submitBtn.innerText = originalText;
});

// Отрисовка списка клиентов
function renderClientsTab() {
    const list = document.getElementById('clients-list');
    if (!state.clients || state.clients.length === 0) {
        list.innerHTML = '<p class="empty-state">Список клиентов пуст</p>';
        return;
    }

    // Сортируем по алфавиту
    const sortedClients = [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = '';

    sortedClients.forEach(c => {
        const card = document.createElement('div');
        card.classList.add('record-card'); // Используем стили карточек из журнала
        card.innerHTML = `
        <div class="card-content" style="border-left-color: var(--accent);">
        <div class="card-header">
        <span class="card-time" style="font-size: 1.1rem; color: var(--accent);"><i class="ph ph-user"></i> ${c.name}</span>
        </div>
        <div class="card-body" style="margin-top: 10px;">
        ${c.phone ? `<div style="margin-bottom: 5px;"><i class="ph ph-phone"></i> ${c.phone}</div>` : ''}
        ${c.instagram ? `<div><i class="ph ph-instagram-logo"></i> ${c.instagram}</div>` : ''}
        </div>
        </div>
        `;
        list.appendChild(card);
    });
}

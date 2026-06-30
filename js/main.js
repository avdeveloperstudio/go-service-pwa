import { fetchData, sendData } from './api.js';
import { state, appState } from './state.js';
import { renderCalendar, renderDailyRecords } from './tab-appointments.js';
import { renderClientsTab } from './tab-clients.js';
import { formatDateForDB } from './utils.js';
import { initMenuAndSettings } from './menu-settings.js';

// === ЭЛЕМЕНТЫ ===
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

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    initMenuAndSettings();
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
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'tab-clients') { renderClientsTab(); }
        });
    });
}

// === УМНАЯ КНОПКА ПЛЮС (FAB) ===
document.getElementById('fab-add').addEventListener('click', () => {
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === 'tab-clients') {
        appState.editingClient = null;
        document.querySelector('#modal-client h3').innerText = 'Новый клиент';
        document.getElementById('input-client-name').value = '';
        document.getElementById('input-client-phone').value = '';
        document.getElementById('input-client-inst').value = '';
        document.getElementById('modal-client').classList.remove('hidden');
        document.getElementById('input-client-name').focus();
    } else {
        appState.editingRecord = null;
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

document.getElementById('btn-close-modal').addEventListener('click', () => { modal.classList.add('hidden'); form.reset(); });
document.getElementById('btn-close-client-modal').addEventListener('click', () => { document.getElementById('modal-client').classList.add('hidden'); document.getElementById('client-form').reset(); });

// === ФОРМА ЗАПИСИ (ЖУРНАЛ) ===
function populateFormDropdowns() {
    renderClientList([...state.clients].sort((a, b) => a.name.localeCompare(b.name)));
    inputTime.innerHTML = '';
    state.times.forEach(t => { inputTime.innerHTML += `<option value="${t}">${t}</option>`; });
    inputCategory.innerHTML = '<option value="" disabled selected hidden>Выберите категорию...</option>';
    state.categories.forEach(cat => { inputCategory.innerHTML += `<option value="${cat}">${cat}</option>`; });
    inputService.innerHTML = '<option value="" disabled selected hidden>Сначала выберите категорию</option>';
}

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
        document.getElementById('preview-phone').innerHTML = clientData.phone ? `<div style="display: flex; align-items: center; gap: 5px; color: var(--accent);"><i class="ph ph-phone"></i> <a href="tel:${clientData.phone.replace(/[^+\d]/g, '')}" style="color: inherit; text-decoration: underline; display: inline;">${clientData.phone}</a></div>` : '';
        document.getElementById('preview-inst').innerHTML = clientData.instagram ? (clientData.instagram.includes('http') ? `<a href="${clientData.instagram}" target="_blank" style="color: var(--accent)"><i class="ph ph-instagram-logo"></i> Перейти</a>` : `<i class="ph ph-instagram-logo"></i> ${clientData.instagram}`) : '';
        clientPreview.classList.remove('hidden');
    } else { clientPreview.classList.add('hidden'); }
}

inputCategory.addEventListener('change', (e) => {
    const selectedCat = e.target.value;
    inputService.innerHTML = '<option value="" disabled selected hidden>Выберите услугу...</option>';
    if (!state.directoryMap) return;
    let services = [...new Set(state.directoryMap.filter(item => item.category === selectedCat).map(item => item.service))];
    services.sort((a, b) => {
        let ia = state.services.indexOf(a), ib = state.services.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    if (services.length > 0) {
        services.forEach(srv => inputService.innerHTML += `<option value="${srv}">${srv}</option>`);
    } else { inputService.innerHTML = '<option value="" disabled selected hidden>Нет услуг</option>'; }
});

export function openEditModal(record) {
    appState.editingRecord = record;
    document.getElementById('modal-title').innerText = 'Редактирование записи';
    populateFormDropdowns();
    inputClient.value = record.client;
    clientTrigger.innerText = record.client;
    triggerClientPreview(record.client);
    inputDate.value = formatDateForDB(record.date);
    inputTime.value = record.time;
    inputCategory.value = record.category;
    inputCategory.dispatchEvent(new Event('change'));
    inputService.value = record.service;
    inputStatus.value = record.status;
    inputPrice.value = record.price || '';
    clientDropdown.classList.add('hidden');
    modal.classList.remove('hidden');
}

export function openClientEditModal(client) {
    appState.editingClient = client;
    document.querySelector('#modal-client h3').innerText = 'Редактирование клиента';
    document.getElementById('input-client-name').value = client.name || '';
    document.getElementById('input-client-phone').value = client.phone || '';
    document.getElementById('input-client-inst').value = client.instagram || '';
    document.getElementById('modal-client').classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inputClient.value) return alert("Пожалуйста, выберите клиента из списка!");
                      const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true; submitBtn.innerText = 'Сохранение...';

    const clientData = state.clients.find(c => c.name === inputClient.value) || {};
    const newRecord = {
        client: inputClient.value, date: inputDate.value, time: inputTime.value,
        category: inputCategory.value, service: inputService.value, status: inputStatus.value,
        price: inputPrice.value ? parseFloat(inputPrice.value.replace(',', '.')) : 0,
                      comment: "", phone: clientData.phone || "", instagram: clientData.instagram || ""
    };

    const action = appState.editingRecord ? 'updateRecord' : 'addRecord';
    const payload = appState.editingRecord ? { oldRecord: { ...appState.editingRecord, date: formatDateForDB(appState.editingRecord.date) }, newRecord: newRecord } : { record: newRecord };
    const response = await sendData(action, payload);

    if (response && response.status === 'success') {
        const data = await fetchData();
        if (data && !data.status) { Object.assign(state, data); renderCalendar(); renderDailyRecords(); }
        modal.classList.add('hidden'); form.reset();
    } else { alert("Ошибка при сохранении: " + (response.message || "")); }
    submitBtn.disabled = false; submitBtn.innerText = originalText;
});

// === ФОРМА КЛИЕНТА ===
document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true; submitBtn.innerText = 'Сохранение...';

    const newClient = {
        name: document.getElementById('input-client-name').value.trim(),
                                                        phone: document.getElementById('input-client-phone').value.trim(),
                                                        instagram: document.getElementById('input-client-inst').value.trim()
    };

    const action = appState.editingClient ? 'updateClient' : 'addClient';
    const payload = appState.editingClient ? { oldClient: appState.editingClient, newClient: newClient } : { client: newClient };
    const response = await sendData(action, payload);

    if (response && response.status === 'success') {
        if (appState.editingClient) {
            const index = state.clients.findIndex(cl => cl.id === appState.editingClient.id);
            if (index !== -1) state.clients[index] = newClient;
        } else {
            if (!state.clients) state.clients = [];
            state.clients.push(newClient);
        }
        renderClientsTab();
        document.getElementById('modal-client').classList.add('hidden');
        e.target.reset();
    } else { alert("Ошибка при сохранении: " + (response.message || "")); }
    submitBtn.disabled = false; submitBtn.innerText = originalText;
});

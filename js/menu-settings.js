import { state } from './state.js';
import { sendData } from './api.js';

// Элементы
const btnMenu = document.getElementById('btn-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const sidebarTitle = document.getElementById('sidebar-title');

// Уровни меню
const sidebarMainMenu = document.getElementById('sidebar-main-menu');
const sidebarSettingsMenu = document.getElementById('sidebar-settings-menu');
const sidebarTimeSlotsView = document.getElementById('sidebar-time-slots-view');

// Кнопки навигации
const navSettings = document.getElementById('nav-settings');
const btnSidebarBack = document.getElementById('btn-sidebar-back');
const settingTimeSlots = document.getElementById('setting-time-slots');
const btnTimeSlotsBack = document.getElementById('btn-time-slots-back');

// Элементы слотов
const timeSlotsList = document.getElementById('time-slots-list');
const btnAddTimeSlot = document.getElementById('btn-add-time-slot');

export function initMenuAndSettings() {
    // === ОТКРЫТИЕ МЕНЮ ===
    btnMenu.addEventListener('click', () => {
        sidebarOverlay.classList.remove('hidden');
        // Сброс на первый уровень
        sidebarMainMenu.style.display = 'block';
        sidebarSettingsMenu.style.display = 'none';
        sidebarTimeSlotsView.style.display = 'none';
        sidebarTitle.innerText = 'Меню';
    });

    btnCloseSidebar.addEventListener('click', () => sidebarOverlay.classList.add('hidden'));

    // Закрытие по клику вне меню
    sidebarOverlay.addEventListener('click', (e) => {
        if (e.target === sidebarOverlay) sidebarOverlay.classList.add('hidden');
    });

        // === ПЕРЕХОД: МЕНЮ -> НАСТРОЙКИ ===
        navSettings.addEventListener('click', () => {
            sidebarMainMenu.style.display = 'none';
            sidebarSettingsMenu.style.display = 'block';
            sidebarTitle.innerText = 'Настройки';
        });

        // === НАЗАД: НАСТРОЙКИ -> МЕНЮ ===
        btnSidebarBack.addEventListener('click', () => {
            sidebarSettingsMenu.style.display = 'none';
            sidebarMainMenu.style.display = 'block';
            sidebarTitle.innerText = 'Меню';
        });

        // === ПЕРЕХОД: НАСТРОЙКИ -> СЛОТЫ ВРЕМЕНИ ===
        settingTimeSlots.addEventListener('click', () => {
            sidebarSettingsMenu.style.display = 'none';
            sidebarTimeSlotsView.style.display = 'block';
            sidebarTitle.innerText = 'Слоты времени';
            renderTimeSlots();
        });

        // === НАЗАД: СЛОТЫ ВРЕМЕНИ -> НАСТРОЙКИ ===
        btnTimeSlotsBack.addEventListener('click', () => {
            sidebarTimeSlotsView.style.display = 'none';
            sidebarSettingsMenu.style.display = 'block';
            sidebarTitle.innerText = 'Настройки';
        });

        // === ДОБАВЛЕНИЕ СЛОТА ===
        btnAddTimeSlot.addEventListener('click', async () => {
            const newTime = prompt("Введите новое время (например, 10:00 или 09:30):");
            if (!newTime) return;

            const match = newTime.match(/^(\d{1,2}):(\d{2})$/);
            if (!match) return alert("Некорректный формат. Используйте ЧЧ:ММ (например, 14:00)");

            const formattedTime = (match[1].length === 1 ? "0" + match[1] : match[1]) + ":" + match[2];

            if (state.times.includes(formattedTime)) return alert("Такое время уже существует!");

            state.times.push(formattedTime);
            state.times.sort();
            await saveSettings();
            renderTimeSlots();
        });
}

function renderTimeSlots() {
    timeSlotsList.innerHTML = '';
    if (!state.times || state.times.length === 0) {
        timeSlotsList.innerHTML = '<p class="empty-state" style="padding-top: 0;">Слоты времени не найдены</p>';
        return;
    }

    state.times.forEach(time => {
        const item = document.createElement('div');
        item.classList.add('time-slot-item');
        item.innerHTML = `
        <span class="time-val"><i class="ph ph-clock"></i> ${time}</span>
        <div class="time-slot-actions">
        <button class="icon-btn edit-btn"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-btn"><i class="ph ph-trash"></i></button>
        </div>
        `;

        item.querySelector('.edit-btn').addEventListener('click', async () => {
            const newTime = prompt("Редактировать время:", time);
            if (!newTime || newTime === time) return;

            const match = newTime.match(/^(\d{1,2}):(\d{2})$/);
            if (!match) return alert("Некорректный формат.");
            const formattedTime = (match[1].length === 1 ? "0" + match[1] : match[1]) + ":" + match[2];

            const index = state.times.indexOf(time);
            if (index !== -1) {
                state.times[index] = formattedTime;
                state.times.sort();
                await saveSettings();
                renderTimeSlots();
            }
        });

        item.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm(`Точно удалить слот ${time}?`)) {
                state.times = state.times.filter(t => t !== time);
                await saveSettings();
                renderTimeSlots();
            }
        });

        timeSlotsList.appendChild(item);
    });
}

async function saveSettings() {
    const originalText = btnAddTimeSlot.innerHTML;
    btnAddTimeSlot.disabled = true;
    btnAddTimeSlot.innerHTML = 'Сохранение...';

    const response = await sendData('updateSettings', { settings: { times: state.times } });
    if (response && response.status !== 'success') {
        alert("Ошибка при сохранении: " + (response.message || ""));
    }

    btnAddTimeSlot.disabled = false;
    btnAddTimeSlot.innerHTML = '<i class="ph ph-plus"></i> Добавить слот';
}

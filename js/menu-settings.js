import { state } from './state.js';
import { sendData } from './api.js';

const btnMenu = document.getElementById('btn-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const sidebarTitle = document.getElementById('sidebar-title');

const sidebarMainMenu = document.getElementById('sidebar-main-menu');
const sidebarSettingsMenu = document.getElementById('sidebar-settings-menu');
const sidebarTimeSlotsView = document.getElementById('sidebar-time-slots-view');
const sidebarCategoriesView = document.getElementById('sidebar-categories-view');

const navSettings = document.getElementById('nav-settings');
const btnSidebarBack = document.getElementById('btn-sidebar-back');
const settingTimeSlots = document.getElementById('setting-time-slots');
const btnTimeSlotsBack = document.getElementById('btn-time-slots-back');
const settingCategories = document.getElementById('setting-categories');
const btnCategoriesBack = document.getElementById('btn-categories-back');

const timeSlotsList = document.getElementById('time-slots-list');
const btnAddTimeSlot = document.getElementById('btn-add-time-slot');
const categoriesList = document.getElementById('categories-list');
const btnAddCategory = document.getElementById('btn-add-category');

export function initMenuAndSettings() {
    // === НАВИГАЦИЯ МЕНЮ ===
    btnMenu.addEventListener('click', () => {
        sidebarOverlay.classList.remove('hidden');
        sidebarMainMenu.style.display = 'block';
        sidebarSettingsMenu.style.display = 'none';
        sidebarTimeSlotsView.style.display = 'none';
        sidebarCategoriesView.style.display = 'none';
        sidebarTitle.innerText = 'Меню';
    });

    btnCloseSidebar.addEventListener('click', () => sidebarOverlay.classList.add('hidden'));
    sidebarOverlay.addEventListener('click', (e) => { if (e.target === sidebarOverlay) sidebarOverlay.classList.add('hidden'); });

    navSettings.addEventListener('click', () => {
        sidebarMainMenu.style.display = 'none';
        sidebarSettingsMenu.style.display = 'block';
        sidebarTitle.innerText = 'Настройки';
    });

    btnSidebarBack.addEventListener('click', () => {
        sidebarSettingsMenu.style.display = 'none';
        sidebarMainMenu.style.display = 'block';
        sidebarTitle.innerText = 'Меню';
    });

    // === ПЕРЕХОД: СЛОТЫ ВРЕМЕНИ ===
    settingTimeSlots.addEventListener('click', () => {
        sidebarSettingsMenu.style.display = 'none';
        sidebarTimeSlotsView.style.display = 'block';
        sidebarTitle.innerText = 'Слоты времени';
        renderTimeSlots();
    });
    btnTimeSlotsBack.addEventListener('click', () => {
        sidebarTimeSlotsView.style.display = 'none';
        sidebarSettingsMenu.style.display = 'block';
        sidebarTitle.innerText = 'Настройки';
    });

    // === ПЕРЕХОД: КАТЕГОРИИ ===
    settingCategories.addEventListener('click', () => {
        sidebarSettingsMenu.style.display = 'none';
        sidebarCategoriesView.style.display = 'block';
        sidebarTitle.innerText = 'Категории и Услуги';
        renderCategories();
    });
    btnCategoriesBack.addEventListener('click', () => {
        sidebarCategoriesView.style.display = 'none';
        sidebarSettingsMenu.style.display = 'block';
        sidebarTitle.innerText = 'Настройки';
    });

    // === ЛОГИКА ДОБАВЛЕНИЯ ===
    btnAddTimeSlot.addEventListener('click', async () => {
        const newTime = prompt("Введите новое время (например, 10:00):");
        if (!newTime) return;
        const match = newTime.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return alert("Некорректный формат.");
        const formattedTime = (match[1].length === 1 ? "0" + match[1] : match[1]) + ":" + match[2];
        if (state.times.includes(formattedTime)) return alert("Уже существует!");
        state.times.push(formattedTime);
        state.times.sort();
        await saveSettings();
        renderTimeSlots();
    });

    btnAddCategory.addEventListener('click', async () => {
        const catName = prompt("Название:");
        if (!catName) return;
        const inStats = confirm("Учитывать в статистике?");
        state.categories.push({ name: catName, inStats: inStats });
        await saveSettings();
        renderCategories();
    });

    setupCategoriesEventDelegation();
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
            if (index !== -1) { state.times[index] = formattedTime; state.times.sort(); await saveSettings(); renderTimeSlots(); }
        });
        item.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm(`Точно удалить слот ${time}?`)) { state.times = state.times.filter(t => t !== time); await saveSettings(); renderTimeSlots(); }
        });
        timeSlotsList.appendChild(item);
    });
}

function renderCategories() {
    let html = '';
    if (!state.categories || state.categories.length === 0) {
        categoriesList.innerHTML = '<p class="empty-state" style="padding-top: 0;">Категории не найдены</p>';
        return;
    }

    state.categories.forEach(cat => {
        const catName = typeof cat === 'object' ? cat.name : cat;
        const inStats = typeof cat === 'object' ? cat.inStats : true;
        const statsIcon = inStats ? '' : '<i class="ph ph-eye-slash" style="color: var(--text-muted); margin-left: 8px; font-size: 0.9rem;" title="Не учитывается в статистике"></i>';

        const services = state.directoryMap ? state.directoryMap.filter(i => i.category === catName) : [];
        let servicesHtml = services.map(srv => `
        <div class="service-item" data-srv="${srv.service}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--bg-surface); border-radius: 8px; margin-bottom: 6px;">
        <span>${srv.service}</span>
        <div style="display: flex; gap: 5px;">
        <button class="icon-btn edit-srv-btn" style="padding: 5px; color: var(--text-muted);"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-srv-btn" style="padding: 5px; color: var(--status-cancel);"><i class="ph ph-trash"></i></button>
        </div>
        </div>
        `).join('');

        html += `
        <div class="accordion-group category-group" data-cat="${catName}" style="margin-bottom: 10px;">
            <div class="record-card category-card" style="margin-bottom: 0;">
                <div class="card-actions-bg">
                    <button class="icon-btn edit-cat-btn"><i class="ph ph-pencil-simple"></i></button>
                    <button class="icon-btn delete-cat-btn"><i class="ph ph-trash"></i></button>
                </div>
                <div class="card-content group-header" style="padding: 15px; border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; border-radius: 12px;">
                    <span style="font-weight: bold; font-size: 1.05rem;">${catName} ${statsIcon}</span>
                    <i class="ph ph-caret-down"></i>
                </div>
            </div>
            <div class="group-content" data-cat="${catName}" style="padding-top: 10px;">
                ${servicesHtml}
                <button class="btn-add-service" data-cat="${catName}" style="width: 100%; padding: 10px; background: transparent; border: 1px dashed var(--text-muted); color: var(--text-main); border-radius: 8px; margin-top: 5px; cursor: pointer;"><i class="ph ph-plus"></i> Добавить услугу</button>
            </div>
        </div>`;
    });
    categoriesList.innerHTML = html;
}

function setupCategoriesEventDelegation() {
    let startX = 0;
    let currentSwipeContent = null;

    categoriesList.addEventListener('touchstart', (e) => {
        const content = e.target.closest('.card-content');
        if (!content) return;
        startX = e.touches[0].clientX;
        currentSwipeContent = content;
    }, { passive: true });

    categoriesList.addEventListener('touchend', (e) => {
        if (!currentSwipeContent) return;
        const card = currentSwipeContent.closest('.category-card');
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (diff > 40) {
            document.querySelectorAll('.category-card.swiped').forEach(c => c.classList.remove('swiped'));
            card.classList.add('swiped');
        } else if (diff < -40) { card.classList.remove('swiped'); }
        currentSwipeContent = null;
    });

    categoriesList.addEventListener('click', async (e) => {
        const header = e.target.closest('.group-header');
        const card = e.target.closest('.category-card');

        // Закрытие свайпа кликом
        if (header && card && card.classList.contains('swiped')) {
            card.classList.remove('swiped');
            return;
        }

        // Раскрытие аккордеона категории
        if (header && card && !e.target.closest('.icon-btn')) {
            header.classList.toggle('open');
            const content = card.parentElement.querySelector('.group-content');
            if (content) content.classList.toggle('open');
            return;
        }

        // --- КНОПКИ КАТЕГОРИИ ---
        const editCatBtn = e.target.closest('.edit-cat-btn');
        const deleteCatBtn = e.target.closest('.delete-cat-btn');

        if (editCatBtn || deleteCatBtn) {
            const catName = e.target.closest('.category-group').getAttribute('data-cat');
            const catObj = state.categories.find(c => (typeof c === 'object' ? c.name : c) === catName);

            if (editCatBtn) {
                const newCatName = prompt("Редактировать название:", typeof catObj === 'object' ? catObj.name : catObj);
                if (!newCatName) return;
                const newInStats = confirm("Учитывать в статистике?");

                const idx = state.categories.indexOf(catObj);
                if(idx > -1) state.categories[idx] = { name: newCatName, inStats: newInStats };

                if (state.directoryMap) {
                    state.directoryMap.forEach(item => { if (item.category === catName) item.category = newCatName; });
                }
                await saveSettings();
                renderCategories();
            } else if (deleteCatBtn) {
                if (confirm(`Удалить категорию "${catName}" и все её услуги?`)) {
                    state.categories = state.categories.filter(c => (typeof c === 'object' ? c.name : c) !== catName);
                    if (state.directoryMap) state.directoryMap = state.directoryMap.filter(i => i.category !== catName);
                    await saveSettings();
                    renderCategories();
                }
            }
            return;
        }

        // --- КНОПКИ УСЛУГИ ---
        const editSrvBtn = e.target.closest('.edit-srv-btn');
        const deleteSrvBtn = e.target.closest('.delete-srv-btn');

        if (editSrvBtn || deleteSrvBtn) {
            const srvName = e.target.closest('.service-item').getAttribute('data-srv');
            const catName = e.target.closest('.group-content').getAttribute('data-cat');

            if (editSrvBtn) {
                const newSrvName = prompt("Редактировать услугу:", srvName);
                if (!newSrvName) return;
                const srvItem = state.directoryMap.find(i => i.category === catName && i.service === srvName);
                if (srvItem) srvItem.service = newSrvName;
                await saveSettings();
                renderCategories();
            } else if (deleteSrvBtn) {
                if (confirm(`Удалить услугу "${srvName}"?`)) {
                    state.directoryMap = state.directoryMap.filter(i => !(i.category === catName && i.service === srvName));
                    await saveSettings();
                    renderCategories();
                }
            }
            return;
        }

        // --- ДОБАВИТЬ УСЛУГУ ---
        const addSrvBtn = e.target.closest('.btn-add-service');
        if (addSrvBtn) {
            const catName = addSrvBtn.getAttribute('data-cat');
            const newSrvName = prompt(`Название:`);
            if (!newSrvName) return;
            if (!state.directoryMap) state.directoryMap = [];
            state.directoryMap.push({ category: catName, service: newSrvName });
            await saveSettings();
            renderCategories();
        }
    });
}

async function saveSettings() {
    const response = await sendData('updateSettings', {
        settings: {
            times: state.times,
            categories: state.categories,
            customDirectoryMap: state.directoryMap || []
        }
    });
    if (response && response.status !== 'success') {
        alert("Ошибка при сохранении: " + (response.message || ""));
    }
}

import { state } from './state.js';
import { sendData } from './api.js';
import { openClientEditModal } from './main.js';

export function renderClientsTab() {
    const list = document.getElementById('clients-list');
    if (!list) return;

    if (!state.clients || state.clients.length === 0) {
        list.innerHTML = '<p class="empty-state">Список клиентов пуст...</p>';
        return;
    }

    const sortedClients = [...state.clients].sort((a, b) => {
        const nameA = a.name ? a.name.toString() : "";
        const nameB = b.name ? b.name.toString() : "";
        return nameA.localeCompare(nameB);
    });

    list.innerHTML = '';

    sortedClients.forEach(c => {
        if (!c.name) return;
        const card = document.createElement('div');
        card.classList.add('record-card');
        card.innerHTML = `
        <div class="card-actions-bg">
        <button class="icon-btn edit-btn"><i class="ph ph-pencil-simple"></i></button>
        <button class="icon-btn delete-btn"><i class="ph ph-trash"></i></button>
        </div>
        <div class="card-content" style="border-left: 4px solid var(--accent);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <span class="card-time" style="font-size: 1.1rem; font-weight: bold; color: var(--accent); display: flex; align-items: center; gap: 5px;">
        <i class="ph ph-user"></i> ${c.name}
        </span>
        </div>
        <div class="card-body" style="font-size: 0.95rem;">
        ${c.phone ? `<a href="tel:${c.phone.replace(/[^+\d]/g, '')}" style="margin-bottom: 4px; color: var(--text-main); display: flex; align-items: center; gap: 5px; text-decoration: none;"><i class="ph ph-phone"></i> ${c.phone}</a>` : ''}
        ${c.instagram ? `<div style="color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 5px;"><i class="ph ph-instagram-logo"></i> ${c.instagram}</div>` : ''}
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
                document.querySelectorAll('.record-card.swiped').forEach(el => el.classList.remove('swiped'));
                card.classList.add('swiped');
            } else if (diff < -40) {
                card.classList.remove('swiped');
            }
        });

        content.addEventListener('click', () => {
            if (card.classList.contains('swiped')) card.classList.remove('swiped');
        });

            card.querySelector('.edit-btn').addEventListener('click', () => {
                openClientEditModal(c);
                card.classList.remove('swiped');
            });

            card.querySelector('.delete-btn').addEventListener('click', async () => {
                if(confirm(`Удалить клиента ${c.name}? Записи в журнале останутся.`)) {
                    const response = await sendData('deleteClient', { client: c });
                    if (response && response.status === 'success') {
                        state.clients = state.clients.filter(cl => cl.id !== c.id);
                        renderClientsTab();
                    } else { alert("Ошибка при удалении."); }
                }
            });

            list.appendChild(card);
    });
}

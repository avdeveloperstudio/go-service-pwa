// js/api.js

const firebaseConfig = {
    apiKey: "AIzaSyA_677lUWX6Uu3p2RE7y58oXbnf1AC7lOo",
    authDomain: "go-service-pwa.firebaseapp.com",
    projectId: "go-service-pwa",
    storageBucket: "go-service-pwa.firebasestorage.app",
    messagingSenderId: "446440787199",
    appId: "1:446440787199:web:0f58f36ca287e2f70250ca"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.enablePersistence().catch(function(err) { console.warn("Оффлайн кэш недоступен", err); });

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbywbPsFijSn-4mBpeoNMu1YmaIR2FS5jOFAvZh0zK2_VaT16krwWrL1X1Xw1luEGDFtug/exec";

export async function fetchData() {
    try {
        // Загружаем всё параллельно, включая твои настройки
        const [clientsSnap, servicesSnap, recordsSnap, settingsSnap] = await Promise.all([
            db.collection("clients").get(),
                                                                                         db.collection("services").get(),
                                                                                         db.collection("records").get(),
                                                                                         db.collection("settings").doc("appData").get()
        ]);

        const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const records = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const settings = settingsSnap.exists ? settingsSnap.data() : { times: [], statuses: [], categories: [] };

        // Подтягиваем кастомные услуги (если их создавали через приложение), иначе берем из Таблицы
        const directoryMap = settings.customDirectoryMap || servicesSnap.docs.map(doc => doc.data());

        // Подтягиваем категории и приводим их к формату { name: "Стрижка", inStats: true }
        let categories = settings.categories || [...new Set(directoryMap.map(item => item.category))];
        categories = categories.map(c => typeof c === 'string' ? { name: c, inStats: true } : c);

        let uniqueServices = [...new Set(directoryMap.map(item => item.service))];

        return {
            categories: categories,
            services: uniqueServices,
            times: settings.times || [],
            statuses: settings.statuses || [],
            directoryMap: directoryMap,
            clients: clients,
            records: records
        };
    } catch (error) {
        console.error("Ошибка загрузки данных из Firebase:", error);
        return null;
    }
}

export async function sendData(action, payload) {
    try {
        // 1. Мгновенное обновление в Firebase
        if (action === "addRecord") {
            let docRef = await db.collection("records").add(payload.record);
            payload.record.id = docRef.id; // КРИТИЧНО: Привязываем ID для Гугл Таблицы
        } else if (action === "updateRecord") {
            if (!payload.oldRecord.id) throw new Error("Нет ID");
            let updatedData = { ...payload.newRecord };
            delete updatedData.id;
            await db.collection("records").doc(payload.oldRecord.id).update(updatedData);
            payload.newRecord.id = payload.oldRecord.id; // КРИТИЧНО: Передаем старый ID для обновления
        } else if (action === "deleteRecord") {
            if (!payload.record.id) throw new Error("Нет ID");
            await db.collection("records").doc(payload.record.id).delete();
        } else if (action === "addClient") {
            let docRef = await db.collection("clients").add(payload.client);
            payload.client.id = docRef.id;
        } else if (action === "updateClient") {
            let updatedData = { ...payload.newClient };
            delete updatedData.id;
            await db.collection("clients").doc(payload.oldClient.id).update(updatedData);
            payload.newClient.id = payload.oldClient.id; // Возвращаем ID на место
        } else if (action === "deleteClient") {
            if (!payload.client.id) throw new Error("Нет ID клиента");
            await db.collection("clients").doc(payload.client.id).delete();
        } else if (action === "updateSettings") {
            await db.collection("settings").doc("appData").update(payload.settings);
        }

        // 2. Фоновый бэкап в Google Таблицы
        fetch(GOOGLE_SHEETS_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: action, ...payload })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "error") console.warn("Гугл Таблица не обновилась:", data.message);
            else console.log("Бэкап в Гугл Таблицу прошел успешно!");
        })
        .catch(err => console.log("Фоновый бэкап не удался (нет сети):", err));

        return { status: "success" };

    } catch (error) {
        console.error(`Ошибка при выполнении ${action}:`, error);
        return { status: "error", message: error.message };
    }
}

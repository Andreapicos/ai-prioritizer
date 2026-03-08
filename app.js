// State
let tasks = JSON.parse(localStorage.getItem('ai-tasks')) || [];
let discoveredModelName = localStorage.getItem('gemini-model-name');
let isAiCooldown = false;

// DOM Elements
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const aiSortBtn = document.getElementById('ai-sort-btn');
const emptyState = document.getElementById('empty-state');
const taskList = document.getElementById('task-list');
const taskCount = document.getElementById('task-count');
const loader = document.getElementById('loader');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');
const taskDateInput = document.getElementById('task-date');
const taskReminderInput = document.getElementById('task-reminder');

// Inizializza API Key se presente
const savedKey = localStorage.getItem('gemini-api-key');
if (savedKey) apiKeyInput.value = savedKey;

saveKeyBtn.addEventListener('click', () => {
    localStorage.setItem('gemini-api-key', apiKeyInput.value.trim());
    showToast("API Key salvata con successo nel tuo browser! Ora l'AI è attiva.", "success");
});

// Event Listeners
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});
aiSortBtn.addEventListener('click', prioritizeWithAI);
deleteAllBtn.addEventListener('click', deleteAllTasks);

// =========================================================
// TOAST NOTIFICATIONS
// =========================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <div class="toast-content">${escapeHTML(message)}</div>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                toast.remove();
            }
        }, 400); // Wait for transition
    }, 4000);
}

// =========================================================
// CUSTOM CONFIRM MODAL
// =========================================================

function showConfirm(message, onConfirmCallback) {
    const modal = document.getElementById('custom-confirm');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');

    if (!modal) return;

    // Imposta il messaggio
    messageEl.textContent = message;

    // Funzione per chiudere il modale pulendo gli event listener
    const closeModal = () => {
        modal.classList.remove('show');
        // Rimuovi i listener per evitare esecuzioni multiple in futuro
        cancelBtn.removeEventListener('click', handleCancel);
        okBtn.removeEventListener('click', handleOk);
    };

    const handleCancel = () => {
        closeModal();
    };

    const handleOk = () => {
        closeModal();
        if (typeof onConfirmCallback === 'function') {
            // Eseguiamo il callback (es. elimina tutto) dopo che l'animazione di chiusura è iniziata
            setTimeout(onConfirmCallback, 200);
        }
    };

    // Aggiungi listener freschi
    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);

    // Mostra il modale
    modal.classList.add('show');
}

// =========================================================
// CUSTOM EDIT MODAL
// =========================================================

function showEditModal(task, onSaveCallback) {
    const modal = document.getElementById('custom-edit');
    const textInput = document.getElementById('edit-task-text');
    const dateInput = document.getElementById('edit-task-date');
    const reminderInput = document.getElementById('edit-task-reminder');
    const cancelBtn = document.getElementById('edit-cancel-btn');
    const saveBtn = document.getElementById('edit-save-btn');

    if (!modal) return;

    // Popola i campi con i dati attuali
    textInput.value = task.text;
    dateInput.value = task.dueDate || '';
    reminderInput.value = task.reminderMinutes || '';

    const closeModal = () => {
        modal.classList.remove('show');
        cancelBtn.removeEventListener('click', handleCancel);
        saveBtn.removeEventListener('click', handleSave);
    };

    const handleCancel = () => {
        closeModal();
    };

    const handleSave = () => {
        const newText = textInput.value.trim();
        const newDate = dateInput.value;
        const newReminder = reminderInput.value ? parseInt(reminderInput.value) : null;

        if (newText === '') {
            showToast("Il testo dell'impegno non può essere vuoto!", "warning");
            return;
        }

        closeModal();
        if (typeof onSaveCallback === 'function') {
            setTimeout(() => onSaveCallback(newText, newDate, newReminder), 200);
        }
    };

    cancelBtn.addEventListener('click', handleCancel);
    saveBtn.addEventListener('click', handleSave);

    modal.classList.add('show');
}

// =========================================================
// NOTIFICATION REMINDERS
// =========================================================

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') {
                hideBanner();
                showToast('Notifiche attivate! Riceverai i promemoria.', 'success');
            }
        });
    }
}

function hideBanner() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.classList.add('hidden');
}

// Mostra il banner solo se le notifiche non sono state ancora concesse
function showBannerIfNeeded() {
    if (!('Notification' in window)) return;
    const banner = document.getElementById('notification-banner');
    if (!banner) return;

    if (Notification.permission === 'default') {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// Listener per il pulsante "Attiva" nel banner
const enableNotifBtn = document.getElementById('enable-notifications-btn');
if (enableNotifBtn) {
    enableNotifBtn.addEventListener('click', requestNotificationPermission);
}

// Mostra il banner all'avvio
showBannerIfNeeded();

// DIAGNOSTICA BACKGROUND
function updateSupportStatus() {
    const badge = document.getElementById('trigger-badge');
    if (!badge) {
        console.warn("Badge diagnostica non trovato nel DOM.");
        return;
    }

    try {
        const hasNotificationAPI = ('Notification' in window);
        const hasTriggers = hasNotificationAPI && (
            ('showTrigger' in Notification.prototype) ||
            (window.TimestampTrigger !== undefined) ||
            (typeof TimestampTrigger !== 'undefined')
        );

        if (hasTriggers) {
            badge.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #238636;"></i> Background: Supportato';
            badge.title = "Il tuo telefono permette di programmare i promemoria nativi.";
        } else {
            badge.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: #da3633;"></i> Background: Limitato';
            badge.title = "Il tuo browser non supporta la chiusura totale. Tieni l'app aperta in background.";
        }
        console.log("Stato supporto background aggiornato:", hasTriggers);
    } catch (e) {
        console.error("Errore durante il controllo del supporto:", e);
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #d29922;"></i> Errore controllo';
    }
}

// Esegui con un piccolo delay per sicurezza DOM
setTimeout(updateSupportStatus, 1000);

// CONTROLLA QUANDO L'APP TORNA IN PRIMO PIANO
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log("App tornata visibile, controllo promemoria...");
        checkReminders();
    }
});

function getReminderLabel(minutes) {
    if (minutes == 60) return '1 ora prima';
    if (minutes == 360) return '6 ore prima';
    if (minutes == 1440) return '1 giorno prima';
    return '';
}

function checkReminders() {
    const now = new Date();
    let changed = false;
    const canNotify = ('Notification' in window) && Notification.permission === 'granted';

    tasks.forEach(task => {
        if (!task.dueDate || task.completed || task.reminded) return;
        if (!task.reminderMinutes) return;

        const dueTime = new Date(task.dueDate).getTime();
        const reminderTime = dueTime - (task.reminderMinutes * 60 * 1000);

        // Se il momento del promemoria è passato, mostriamo la notifica subito
        if (now.getTime() >= reminderTime) {
            triggerNotification(task);
            task.reminded = true;
            changed = true;
        } else {
            // Se invece il promemoria è nel futuro, proviamo a programmarlo (Trigger API)
            scheduleBackgroundReminder(task);
        }
    });

    if (changed) {
        localStorage.setItem('ai-tasks', JSON.stringify(tasks));
        renderTasks();
    }
}

// Funzione dedicata per mostrare la notifica subito
function triggerNotification(task) {
    if (Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('\u23F0 Promemoria: AI Prioritizer', {
                body: `${task.text} — scade tra poco`,
                icon: './logo.png',
                badge: './logo.png',
                tag: task.id,
                vibrate: [200, 100, 200],
                data: { taskId: task.id }
            });
        });
    } else {
        new Notification('\u23F0 Promemoria: AI Prioritizer', {
            body: `${task.text}`,
            icon: './logo.png'
        });
    }
}

// PROGRAMMAZIONE BACKGROUND (Per Android/Chrome quando l'app è chiusa)
function scheduleBackgroundReminder(task) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;

    const dueTime = new Date(task.dueDate).getTime();
    const reminderTime = dueTime - (task.reminderMinutes * 60 * 1000);

    // Verifichiamo se il browser supporta i Triggers (PWA Background Notifications)
    const hasTriggerAPI = ('showTrigger' in Notification.prototype) || (window.TimestampTrigger !== undefined);

    if (hasTriggerAPI) {
        navigator.serviceWorker.ready.then(registration => {
            try {
                // Se non esiste TimestampTrigger, il try/catch ci salverà
                const trigger = new TimestampTrigger(reminderTime);
                registration.showNotification('\u23F0 Promemoria: AI Prioritizer', {
                    body: `${task.text} — promemoria programmato`,
                    icon: './logo.png',
                    badge: './logo.png',
                    tag: task.id,
                    vibrate: [200, 100, 200],
                    showTrigger: trigger,
                    data: { taskId: task.id }
                });
                console.log(`PWA: Programmata notifica per ${task.text}`);
            } catch (e) {
                console.warn("Trigger API presente ma non utilizzabile per questo browser.", e);
            }
        });
    }
}

// Controlla i promemoria all'avvio e poi ogni minuto per massima precisione
setTimeout(checkReminders, 2000);
setInterval(checkReminders, 60 * 1000);

// =========================================================
// CORE FUNCTIONS
// =========================================================

function addTask() {
    const text = taskInput.value.trim();
    const dueDate = taskDateInput.value;
    const reminderMinutes = taskReminderInput.value ? parseInt(taskReminderInput.value) : null;
    if (!text) return;

    const newTask = {
        id: Date.now().toString(),
        text: text,
        dueDate: dueDate || null,
        reminderMinutes: reminderMinutes,
        completed: false,
        priority: null,
        aiReasoning: null,
        reminded: false
    };

    tasks.unshift(newTask);
    taskInput.value = '';
    taskDateInput.value = '';
    taskReminderInput.value = '';

    // Chiedi il permesso per le notifiche se l'utente ha scelto un promemoria
    if (reminderMinutes) {
        requestNotificationPermission();
    }

    renderTasks();
    checkReminders();
}

function toggleComplete(id) {
    tasks = tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
    );
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    renderTasks();
}

function updateTaskCount() {
    const plural = tasks.length === 1 ? 'task' : 'tasks';
    taskCount.textContent = `${tasks.length} ${plural}`;

    if (tasks.length > 0) {
        deleteAllBtn.style.display = 'flex';
    } else {
        deleteAllBtn.style.display = 'none';
    }
}

function deleteAllTasks() {
    if (tasks.length === 0) return;

    showConfirm('Sei sicuro di voler eliminare TUTTI gli impegni? Questa azione non può essere annullata.', () => {
        tasks = [];
        renderTasks();
        showToast("Tutti gli impegni sono stati eliminati.", "success");
    });
}

// =========================================================
// GESTIONE DRAG AND DROP E MODIFICA
// =========================================================
let dragStartIndex = null;

function handleDragStart(e) {
    dragStartIndex = tasks.findIndex(t => t.id === e.target.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const currentItem = e.target.closest('.task-item');
    if (currentItem && !currentItem.classList.contains('dragging')) {
        currentItem.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const currentItem = e.target.closest('.task-item');
    if (currentItem) {
        currentItem.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const currentItem = e.target.closest('.task-item');
    if (currentItem) {
        currentItem.classList.remove('drag-over');
        const dragEndIndex = tasks.findIndex(t => t.id === currentItem.dataset.id);

        if (dragStartIndex !== null && dragEndIndex !== -1 && dragStartIndex !== dragEndIndex) {
            const itemToMove = tasks.splice(dragStartIndex, 1)[0];
            tasks.splice(dragEndIndex, 0, itemToMove);
            renderTasks();
        }
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(item => item.classList.remove('drag-over'));
    dragStartIndex = null;
}

function editTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    showEditModal(tasks[taskIndex], (newText, newDate, newReminder) => {
        tasks[taskIndex].text = newText;
        tasks[taskIndex].dueDate = newDate || null;
        tasks[taskIndex].reminderMinutes = newReminder;
        tasks[taskIndex].reminded = false; // Reset per il nuovo promemoria
        renderTasks();
        showToast("Impegno aggiornato con successo!", "success");
        checkReminders();
    });
}

// =========================================================
// VERA AI PRIORITIZATION (Chiamata a Google Gemini API)
// =========================================================

async function prioritizeWithAI() {
    if (isAiCooldown) {
        showToast("IA in pausa tecnica. Attendi qualche secondo.", "warning");
        return;
    }

    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
        showToast("Inserisci e salva la tua API Key nelle impostazioni!", "warning");
        return;
    }

    if (tasks.length === 0) {
        showToast("Aggiungi qualche task prima di usare l'AI!", "warning");
        return;
    }

    const uncompletedTasks = tasks.filter(t => !t.completed);
    if (uncompletedTasks.length === 0) {
        showToast("Tutti i task sono già completati!", "info");
        return;
    }

    // UX: Mostra loader
    taskList.style.display = 'none';
    loader.classList.remove('hidden');
    aiSortBtn.disabled = true;
    aiSortBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analisi in corso...`;

    const taskData = uncompletedTasks.map(t => ({
        id: t.id,
        text: t.text,
        scadenza: t.dueDate || "Nessuna"
    }));

    const promptText = `Analizza questi task e assegna una priorità (1=Alta, 2=Media, 3=Bassa). Considera le scadenze vicine come priorità 1. Rispondi solo con un array JSON: [{"id":"123", "priority":1, "aiReasoning":"Motivo breve"}] \n\n Task: ${JSON.stringify(taskData)}`;

    try {
        // SOLUZIONE AUTO-DIAGNOSTICA: Chiediamo a Google cosa vuole
        aiSortBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass fa-spin"></i> Identificazione...`;

        let modelName = '';
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const listData = await listRes.json();
            // Cerchiamo un modello che supporti generateContent
            const found = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
            if (found) {
                modelName = found.name;
                console.log("Modello rilevato:", modelName);
            } else {
                throw new Error("Nessun modello disponibile per questa chiave.");
            }
        } catch (e) {
            console.warn("Discovery fallita, scarico su fallback.");
            modelName = 'models/gemini-1.5-flash'; // Fallback estremo
        }

        async function callGemini(retries = 2) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });

            if (response.status === 429 && retries > 0) {
                aiSortBtn.innerHTML = `<i class="fa-solid fa-hourglass-half fa-spin"></i> Limite raggiunto, attendo 10s...`;
                await new Promise(r => setTimeout(r, 10000));
                return callGemini(retries - 1);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || "Errore Google API");
            }

            return response.json();
        }

        const data = await callGemini();
        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanJson = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResults = JSON.parse(cleanJson);

        aiResults.forEach(result => {
            const taskIndex = tasks.findIndex(t => t.id === result.id);
            if (taskIndex !== -1) {
                tasks[taskIndex].priority = result.priority;
                tasks[taskIndex].aiReasoning = result.aiReasoning;
            }
        });

        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.priority !== b.priority) return (a.priority || 4) - (b.priority || 4);
            return 0;
        });

    } catch (error) {
        console.error("AI Error:", error);
        showToast("Ops! Google è occupato: " + error.message, "error");
    } finally {
        loader.classList.add('hidden');
        taskList.style.display = 'flex';

        // Cooldown ridotto a 10s
        isAiCooldown = true;
        let cooldownTime = 10;

        const updateCooldownBtn = () => {
            if (cooldownTime > 0) {
                aiSortBtn.disabled = true;
                aiSortBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Pausa (${cooldownTime}s)`;
                cooldownTime--;
                setTimeout(updateCooldownBtn, 1000);
            } else {
                isAiCooldown = false;
                aiSortBtn.disabled = false;
                aiSortBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Riordina con AI';
            }
        };

        updateCooldownBtn();
        renderTasks();
    }
}

// =========================================================
// RENDER UI E SALVATAGGIO DATI
// =========================================================

function renderTasks() {
    // Salvataggio nel Local Storage
    localStorage.setItem('ai-tasks', JSON.stringify(tasks));

    taskList.innerHTML = '';

    tasks.forEach((task, index) => {
        const li = document.createElement('li');

        // Check if expired
        const now = new Date();
        const isExpired = !task.completed && task.dueDate && new Date(task.dueDate) < now;

        // Classes for styling
        li.className = `task-item ${task.completed ? 'completed' : ''} ${isExpired ? 'expired' : ''}`;
        if (task.priority) li.classList.add(`priority-${task.priority}`);
        if (task.aiReasoning) li.classList.add('has-ai');

        // Drag and drop attributes and events
        li.setAttribute('draggable', 'true');
        li.dataset.id = task.id;
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);

        // Animation delay
        li.style.animationDelay = `${index * 0.1}s`;

        // Priority Badge HTML
        let priorityLabel = '';
        if (task.priority === 1) priorityLabel = '🔴 Alta';
        else if (task.priority === 2) priorityLabel = '🟡 Media';
        else if (task.priority === 3) priorityLabel = '🔵 Bassa';

        // Date Display HTML
        let dateHTML = '';
        if (task.dueDate) {
            const dateObj = new Date(task.dueDate);
            const formattedDate = dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            const formattedTime = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const reminderLabel = task.reminderMinutes ? `<span style="margin-left: 6px; opacity: 0.7;"><i class="fa-solid fa-bell" style="font-size: 0.7rem;"></i> ${getReminderLabel(task.reminderMinutes)}</span>` : '';
            dateHTML = `<div class="task-date-display"><i class="fa-solid fa-calendar-day"></i> ${formattedDate} alle ${formattedTime}${reminderLabel}</div>`;
        }

        li.innerHTML = `
            <div class="custom-checkbox" onclick="toggleComplete('${task.id}')"></div>
            <div class="task-content">
                <span class="priority-badge">${priorityLabel}</span>
                <span class="task-text">${escapeHTML(task.text)}</span>
                ${dateHTML}
                ${task.aiReasoning ? `<div class="task-reasoning"><i class="fa-solid fa-robot"></i> ${task.aiReasoning}</div>` : ''}
            </div>
            <div class="task-actions">
                <button class="btn-icon edit" onclick="editTask('${task.id}')" title="Modifica">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-icon delete" onclick="deleteTask('${task.id}')" title="Elimina">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        taskList.appendChild(li);
    });

    updateTaskCount();
}

// Utility to prevent XSS attacks
function escapeHTML(str) {
    let div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// Initial render
renderTasks();

// =========================================================
// SERVICE WORKER REGISTRATION & UPDATE (PWA)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('SW registrato.');
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.error('Errore SW:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            window.location.reload();
            refreshing = true;
        }
    });
}

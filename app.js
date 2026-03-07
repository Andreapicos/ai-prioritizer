// =========================================================
// AI TASK PRIORITIZER LOGIC
// =========================================================

// State (Carica dal LocalStorage se esiste, altrimenti usa un array vuoto)
let tasks = JSON.parse(localStorage.getItem('ai-tasks')) || [];

// DOM Elements
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const aiSortBtn = document.getElementById('ai-sort-btn');
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

        if (now.getTime() >= reminderTime) {
            if (canNotify) {
                // Notifica di sistema (più affidabile per Android via Service Worker)
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification('\u23F0 Promemoria: AI Prioritizer', {
                            body: `${task.text} — scade ${getReminderLabel(task.reminderMinutes)}`,
                            icon: './logo.png',
                            badge: './logo.png', // Icona piccola nella barra di stato
                            tag: task.id,
                            vibrate: [200, 100, 200] // Vibrazione tipica
                        });
                    }).catch(err => {
                        showToast(`\u23F0 Promemoria: ${task.text}`, 'warning');
                    });
                } else {
                    // Fallback per browser che non supportano SW
                    new Notification('\u23F0 Promemoria: AI Prioritizer', {
                        body: `${task.text}`,
                        icon: './logo.png'
                    });
                }
            } else {
                // Fallback: notifica dentro l'app
                showToast(`\u23F0 Promemoria: ${task.text}`, 'warning');
            }

            task.reminded = true;
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('ai-tasks', JSON.stringify(tasks));
    }
}

// Controlla i promemoria all'avvio e poi ogni 5 minuti
setTimeout(checkReminders, 3000);
setInterval(checkReminders, 5 * 60 * 1000);

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
    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
        showToast("Inserisci e salva la tua API Key di Google Gemini nel campo in alto prima di usare l'Intelligenza Artificiale!", "warning");
        return;
    }

    if (tasks.length === 0) {
        showToast("Aggiungi qualche task prima di usare l'AI!", "warning");
        return;
    }

    const uncompletedTasks = tasks.filter(t => !t.completed);
    if (uncompletedTasks.length === 0) {
        showToast("Tutti i task sono già completati! Aggiungine di nuovi.", "info");
        return;
    }

    // UX: Mostra loader
    taskList.style.display = 'none';
    loader.classList.remove('hidden');
    aiSortBtn.disabled = true;
    aiSortBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connessione ai server Google...`;

    // Costruiamo la domanda (prompt) per Gemini con le date
    const taskData = uncompletedTasks.map(t => ({
        id: t.id,
        text: t.text,
        scadenza: t.dueDate || "Nessuna"
    }));

    const promptText = `
Sei un assistente per la produttività esperto. Analizza questi task e assegna una priorità (1=Alta urgenza/importanza, 2=Media, 3=Bassa).
IMPORTANTE: Tieni conto delle date di scadenza. Un task con scadenza vicina o passata deve avere priorità alta (1 o 2).
Per ogni task aggiungi una brevissima motivazione (max 10 parole) spiegando la priorità in base a urgenza e data.
Rispondi ESATTAMENTE e SOLO con un array JSON valido, NIENTE formattazione markdown.

Esempio output: [{"id":"123", "priority":1, "aiReasoning":"Scade oggi, molto urgente"}]

Task da analizzare:
${JSON.stringify(taskData)}
`;

    try {
        // Usiamo gemini-2.0-flash che ha limiti più alti nel piano gratuito
        const modelName = 'models/gemini-2.0-flash';

        aiSortBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sto chiedendo all'AI...`;

        // Funzione con retry automatico in caso di rate limit
        async function callGeminiWithRetry(retries = 2) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });

            if (response.status === 429 && retries > 0) {
                // Rate limit: aspetta 10 secondi e riprova
                aiSortBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Troppo traffico, riprovo tra pochi secondi...`;
                await new Promise(r => setTimeout(r, 10000));
                return callGeminiWithRetry(retries - 1);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || `Codice: ${response.status}`;
                throw new Error(`\nGoogle dice: ${errorMessage}`);
            }

            return response.json();
        }

        const data = await callGeminiWithRetry();

        // Estrai il testo della risposta AI
        const aiResponseText = data.candidates[0].content.parts[0].text;

        // Pulizia eventuale del JSON (nel caso in cui Gemini lo "incapsuli" per errore tra i backticks)
        const cleanJson = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResults = JSON.parse(cleanJson);

        // Aggiorna la nostra vera lista dei task locale con i risultati ricevuti dal Cloud
        aiResults.forEach(result => {
            const taskIndex = tasks.findIndex(t => t.id === result.id);
            if (taskIndex !== -1) {
                tasks[taskIndex].priority = result.priority;
                tasks[taskIndex].aiReasoning = result.aiReasoning;
            }
        });

        // Ordinamento dinamico (Priorità 1 in alto)
        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.priority !== b.priority) return (a.priority || 4) - (b.priority || 4);
            return 0; // Se uguali, non cambiare ordine
        });

    } catch (error) {
        console.error("Errore Dettagliato:", error);
        showToast("Ops! Qualcosa è andato storto: " + error.message, "error");
    } finally {
        // UX: Nascondi loader e ripristina bottone
        loader.classList.add('hidden');
        taskList.style.display = 'flex';
        aiSortBtn.disabled = false;
        aiSortBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Riordina con AI';

        // Mostra a schermo i task aggiornati 
        renderTasks();
    }
}

// =========================================================
// RENDER UI E SALVATAGGIO DATI
// =========================================================

function renderTasks() {
    // Salvataggio nel Local Storage: ogni volta che la UI si aggiorna, i dati vengono salvati!
    localStorage.setItem('ai-tasks', JSON.stringify(tasks));

    taskList.innerHTML = '';

    tasks.forEach((task, index) => {
        const li = document.createElement('li');

        // Check if expired (usando datetime)
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

        // Animation delay for cascading effect
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

// Utility to prevent XSS attacks when rendering user input
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

                // Se c'è un aggiornamento, ricarichiamo la pagina quando il nuovo SW prende il controllo
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nuovo contenuto disponibile!
                            console.log('Nuova versione rilevata. Ricarico...');
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.error('Errore SW:', err));
    });

    // Evento che scatta quando un nuovo SW prende il controllo
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            window.location.reload();
            refreshing = true;
        }
    });
}

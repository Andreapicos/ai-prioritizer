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
// CORE FUNCTIONS
// =========================================================

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;

    const newTask = {
        id: Date.now().toString(),
        text: text,
        completed: false,
        priority: null, // 1 (High), 2 (Medium), 3 (Low)
        aiReasoning: null
    };

    tasks.unshift(newTask); // Add to top of list
    taskInput.value = '';

    renderTasks();
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

    const newText = prompt("Modifica il testo dell'impegno:", tasks[taskIndex].text);
    if (newText !== null && newText.trim() !== '') {
        tasks[taskIndex].text = newText.trim();
        renderTasks();
    }
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

    // Costruiamo la domanda (prompt) per Gemini
    const taskData = uncompletedTasks.map(t => ({ id: t.id, text: t.text }));
    const promptText = `
Sei un assistente per la produttività. Analizza questi task e assegna una priorità (1=Alta urgenza/importanza, 2=Media, 3=Bassa).
Per ogni task aggiungi una brevissima motivazione (max 10 parole).
Rispondi ESATTAMENTE e SOLO con un array JSON valido, NIENTE formattazione markdown (niente backticks o \`\`\`json).
Esempio output: [{"id":"123", "priority":1, "aiReasoning":"Riunione di lavoro"}]

Task da analizzare:
${JSON.stringify(taskData)}
`;

    try {
        // 1. Diciamo all'API di dirci quali modelli la tua chiave può effettivamente usare!
        const modelListRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!modelListRes.ok) throw new Error("Impossibile leggere i modelli Google. La chiave potrebbe non essere attiva.");

        const modelsData = await modelListRes.json();
        // Filtriamo e prendiamo il primo modello disponibile che supporti la generazione testo
        const validModels = modelsData.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        if (validModels.length === 0) throw new Error("Il tuo account non ha modelli abilitati per la generazione.");

        // Prendiamo il primo nome utile (es: "models/gemini-1.5-flash")
        const dynamicModelName = validModels.find(m => m.name.includes("gemini"))?.name || validModels[0].name;

        aiSortBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sto chiedendo a ${dynamicModelName.split('/')[1]}...`;

        // 2. Chiamata API REST a Gemini usando il modello esatto appena trovato!
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${dynamicModelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.1 } // Bassa temperatura per risposte più logiche
            })
        });

        if (!response.ok) {
            // Estraiamo il vero errore che ci restituisce Google per capire cosa non va!
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `Codice: ${response.status}`;
            throw new Error(`\nGoogle dice: ${errorMessage}`);
        }

        const data = await response.json();

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

        // Classes for styling
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
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

        li.innerHTML = `
            <div class="custom-checkbox" onclick="toggleComplete('${task.id}')"></div>
            <div class="task-content">
                <span class="priority-badge">${priorityLabel}</span>
                <span class="task-text">${escapeHTML(task.text)}</span>
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
// SERVICE WORKER REGISTRATION (PWA)
// =========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registrato con successo con scope: ', registration.scope);
            })
            .catch(err => {
                console.error('Registrazione ServiceWorker fallita: ', err);
            });
    });
}

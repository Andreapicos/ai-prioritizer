// =========================================================
// AI TASK PRIORITIZER LOGIC
// =========================================================

// State
let tasks = [];

// DOM Elements
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const aiSortBtn = document.getElementById('ai-sort-btn');
const taskList = document.getElementById('task-list');
const taskCount = document.getElementById('task-count');
const loader = document.getElementById('loader');

// Event Listeners
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});
aiSortBtn.addEventListener('click', prioritizeWithAI);

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
}

// =========================================================
// MOCK AI PRIORITIZATION (Normally this would call an API like OpenAI)
// =========================================================

async function prioritizeWithAI() {
    if (tasks.length === 0) {
        alert("Aggiungi qualche task prima di usare l'AI!");
        return;
    }

    // UX: Show loader
    taskList.style.display = 'none';
    loader.classList.remove('hidden');
    aiSortBtn.disabled = true;
    aiSortBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Elaborazione...';

    // Simulate Network Request Delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simple heuristical "AI" for the mock
    // In a real app, you would send the tasks array to a backend/API
    tasks = tasks.map(task => {
        const textLower = task.text.toLowerCase();
        let priority = 3; // Default Low
        let reason = "Task flessibile, da fare quando hai tempo.";

        const highKeywords = ['urgente', 'asap', 'oggi', 'scadenza', 'capo', 'chiamare', 'medico', 'pagare'];
        const medKeywords = ['email', 'leggere', 'studiare', 'pulire', 'spesa', 'finire', 'progetto'];

        if (highKeywords.some(kw => textLower.includes(kw))) {
            priority = 1;
            reason = "Le parole chiave indicano alta urgenza o importanza critica.";
        } else if (medKeywords.some(kw => textLower.includes(kw))) {
            priority = 2;
            reason = "Impegno importante ma non critico nell'immediato.";
        }

        return { ...task, priority, aiReasoning: reason };
    });

    // Sort by priority (1 is highest) and then uncompleted first
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.priority !== b.priority) return (a.priority || 4) - (b.priority || 4);
        return 0; // Keep original order if same priority
    });

    // UX: Hide loader & Reset button
    loader.classList.add('hidden');
    taskList.style.display = 'flex';
    aiSortBtn.disabled = false;
    aiSortBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Riordina con AI';

    renderTasks();
}

// =========================================================
// RENDER UI
// =========================================================

function renderTasks() {
    taskList.innerHTML = '';

    tasks.forEach((task, index) => {
        const li = document.createElement('li');

        // Classes for styling
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        if (task.priority) li.classList.add(`priority-${task.priority}`);
        if (task.aiReasoning) li.classList.add('has-ai');

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

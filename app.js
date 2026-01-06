// ============================================
// APP.JS - JavaScript Principal Completo
// ============================================

let confirmCallback = null;
let currentEditId = null;
let currentReopenProjectId = null;
let timerInterval = null;
let timerSeconds = 0;
let startTime = null;
let inactivityTimer = null;
let lastActivityTime = Date.now();
let timerPaused = false;
let pausedSeconds = 0;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const subcategories = {
    'projeto': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
    'eletrico': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
    'desenvolvimento': [],
    'orcamentacao': ['Orçamento', 'Ordem de produção']
};

// Modal Functions
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.add('show');
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.add('show');
}

document.getElementById('confirmYes').addEventListener('click', function() {
    document.getElementById('confirmModal').classList.remove('show');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

document.getElementById('confirmNo').addEventListener('click', function() {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
});

document.getElementById('alertOk').addEventListener('click', function() {
    document.getElementById('alertModal').classList.remove('show');
});

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getProjects() {
    const projects = localStorage.getItem('projects_global');
    return projects ? JSON.parse(projects) : [];
}

function saveProjects(projects) {
    localStorage.setItem('projects_global', JSON.stringify(projects));
}

function getOpenProjects() { return getProjects().filter(p => p.status === 'open'); }
function getProjectByCode(code) { return getProjects().find(p => p.workCode === code); }
function getProjectById(id) { return getProjects().find(p => p.id == id); }

function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) { localStorage.setItem('users', JSON.stringify(users)); }

function getWorkHistory() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `workHistory_${user.username}`;
    const history = localStorage.getItem(key);
    return history ? JSON.parse(history) : [];
}

function getComments() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `comments_${user.username}`;
    const comments = localStorage.getItem(key);
    return comments ? JSON.parse(comments) : {};
}

function saveComments(comments) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    localStorage.setItem(`comments_${user.username}`, JSON.stringify(comments));
}

function loadMeetingProjects(containerId, countId) {
    const openProjects = getOpenProjects();
    const container = document.getElementById(containerId);
    if (!container) return;
    if (openProjects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px; font-size: 12px;">Sem obras abertas</p>';
        return;
    }
    container.innerHTML = openProjects.map(project => `
        <div class="checkbox-item">
            <label>
                <input type="checkbox" value="${project.id}" onchange="updateMeetingProjectsCount('${countId}', '${containerId}')">
                <span class="project-code-small">${project.workCode}</span>
                <span class="project-name-small">${project.name}</span>
            </label>
        </div>
    `).join('');
    updateMeetingProjectsCount(countId, containerId);
}

function updateMeetingProjectsCount(countId, containerId) {
    const container = document.getElementById(containerId);
    const countElement = document.getElementById(countId);
    if (!container || !countElement) return;
    const checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
    countElement.textContent = `${checkedCount} obra${checkedCount !== 1 ? 's' : ''} selecionada${checkedCount !== 1 ? 's' : ''}`;
}

function getSelectedMeetingProjects(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const projectIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    return projectIds.map(id => {
        const project = getProjectById(id);
        return project ? { id: project.id, workCode: project.workCode, name: project.name } : null;
    }).filter(p => p !== null);
}

function setSelectedMeetingProjects(containerId, projectIds) {
    const container = document.getElementById(containerId);
    if (!container || !projectIds) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => { cb.checked = projectIds.includes(parseInt(cb.value)); });
}

function updateMeetingProjects() {
    const category = document.getElementById('internalCategory').value;
    const group = document.getElementById('meetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('meetingProjectsList', 'meetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

function updateEditMeetingProjects() {
    const category = document.getElementById('editInternalCategory').value;
    const group = document.getElementById('editMeetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('editMeetingProjectsList', 'editMeetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

function updateManualMeetingProjects() {
    const category = document.getElementById('manualInternalCategory').value;
    const group = document.getElementById('manualMeetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('manualMeetingProjectsList', 'manualMeetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

async function register() {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const department = document.getElementById('regDepartment').value;
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    if (!firstName || !lastName || !username || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (!department) {
        errorDiv.textContent = 'Por favor, selecione seu departamento padrão.';
        errorDiv.classList.remove('hidden');
        document.getElementById('regDepartment').focus();
        return;
    }
    if (username.length < 3) {
        errorDiv.textContent = 'O nome de utilizador deve ter pelo menos 3 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = 'A password deve ter pelo menos 6 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        errorDiv.textContent = 'Este nome de utilizador já existe.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const hashedPassword = await sha256(password);
    users.push({ firstName, lastName, username, password: hashedPassword, defaultDepartment: department, isAdmin: false });
    saveUsers(users);

    successDiv.textContent = 'Conta criada com sucesso! Pode fazer login.';
    successDiv.classList.remove('hidden');
    document.getElementById('regFirstName').value = '';
    document.getElementById('regLastName').value = '';
    document.getElementById('regDepartment').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    setTimeout(() => { showLogin(); }, 2000);
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');

    if (!username || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const hashedPassword = await sha256(password);
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === hashedPassword);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        showApp();
    } else {
        errorDiv.textContent = 'Utilizador ou password incorretos.';
        errorDiv.classList.remove('hidden');
    }
}

function logout() {
    if (timerInterval) {
        showConfirm('Confirmar', 'Tem um timer ativo. Tem certeza que deseja sair?', function() {
            localStorage.removeItem('activeTimer');
            stopWork();
            localStorage.removeItem('currentUser');
            showLogin();
        });
    } else {
        localStorage.removeItem('currentUser');
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
    
    // Limpar UI de admin ao fazer logout
    const header = document.getElementById('mainHeader');
    if (header) {
        header.classList.remove('admin');
    }
    
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) {
        adminBadge.classList.add('hidden');
    }
    
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => tab.classList.add('hidden'));
    
    setTimeout(() => document.getElementById('loginUsername').focus(), 100);
}

function showRegister() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
    document.getElementById('registerSuccess').classList.add('hidden');
    
    // Limpar UI de admin ao ir para registo
    const header = document.getElementById('mainHeader');
    if (header) {
        header.classList.remove('admin');
    }
    
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) {
        adminBadge.classList.add('hidden');
    }
    
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => tab.classList.add('hidden'));
    
    setTimeout(() => document.getElementById('regFirstName').focus(), 100);
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
    if (user.defaultDepartment) {
        document.getElementById('projectType').value = user.defaultDepartment;
        updateSubcategories();
    }
    if (typeof setupAdminUI === 'function') { setupAdminUI(); }
    loadWorkHistory();
    updateStats();
    updateReports();
    updateExportStats();
    loadWorkSelectForComments();
    loadProjectSelects();
    loadProjectsList();
    startClock();
    resumeActiveTimer();
}

function showTab(event, tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tabName === 'timer') {
        document.getElementById('timerTab').classList.add('active');
    } else if (tabName === 'projects') {
        document.getElementById('projectsTab').classList.add('active');
        loadProjectsList();
    } else if (tabName === 'comments') {
        document.getElementById('commentsTab').classList.add('active');
        loadWorkSelectForComments();
    } else if (tabName === 'reports') {
        document.getElementById('reportsTab').classList.add('active');
        updateReports();
    } else if (tabName === 'export') {
        document.getElementById('exportTab').classList.add('active');
        updateExportStats();
    } else if (tabName === 'profile') {
        document.getElementById('profileTab').classList.add('active');
        loadProfileData();
    } else if (tabName === 'users') {
        document.getElementById('usersTab-content').classList.add('active');
        if (typeof loadUsersList === 'function') { loadUsersList(); }
    } else if (tabName === 'globalHistory') {
        document.getElementById('globalHistoryTab-content').classList.add('active');
        if (typeof updateGlobalHistory === 'function') { updateGlobalHistory(); }
    } else if (tabName === 'companyStats') {
        document.getElementById('companyStatsTab-content').classList.add('active');
        if (typeof updateCompanyStats === 'function') { updateCompanyStats(); }
    }
}

let clockInterval;
function startClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('currentTime').textContent = `${hours}:${minutes}:${seconds}`;
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    document.getElementById('currentDate').textContent = `${dayName}, ${day} de ${month} de ${year}`;
}

function updateWorkTypeFields() {
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const projectFields = document.getElementById('projectFields');
    const internalFields = document.getElementById('internalFields');
    const workTimerDisplay = document.getElementById('workTimerDisplay');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        workTimerDisplay.classList.add('internal');
        updateMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
        workTimerDisplay.classList.remove('internal');
    }
}

function updateEditFields() {
    const workType = document.querySelector('input[name="editWorkType"]:checked').value;
    const projectFields = document.getElementById('editProjectFields');
    const internalFields = document.getElementById('editInternalFields');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        updateEditMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
    }
}

function updateManualFields() {
    const workType = document.querySelector('input[name="manualWorkType"]:checked').value;
    const projectFields = document.getElementById('manualProjectFields');
    const internalFields = document.getElementById('manualInternalFields');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        updateManualMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
    }
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

function formatHours(seconds) {
    const hours = (seconds / 3600).toFixed(1);
    return `${hours}h`;
}

function getDepartmentName(departmentCode) {
    const departments = { 'projeto': 'Projeto', 'eletrico': 'Elétrico', 'desenvolvimento': 'Desenvolvimento', 'orcamentacao': 'Orçamentação' };
    return departments[departmentCode] || departmentCode;
}

function getInternalCategoryName(categoryCode) {
    const categories = { 'reuniao': 'Reunião', 'formacao': 'Formação' };
    return categories[categoryCode] || categoryCode;
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadProjectSelects() {
    const openProjects = getOpenProjects();
    const selects = [document.getElementById('projectSelect'), document.getElementById('editProjectSelect'), document.getElementById('manualProjectSelect')];
    selects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- Selecione uma obra aberta --</option>';
            openProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = `${project.workCode} - ${project.name}`;
                select.appendChild(option);
            });
            if (currentValue) { select.value = currentValue; }
        }
    });
}

function updateProjectInfo() {
    const projectType = document.getElementById('projectType').value;
    if (projectType) { updateSubcategories(); }
}

function updateEditProjectInfo() {}
function updateManualProjectInfo() {}

function updateSubcategories() {
    const projectType = document.getElementById('projectType').value;
    const subcategoryGroup = document.getElementById('subcategoryGroup');
    const subcategorySelect = document.getElementById('subcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

function updateEditSubcategories() {
    const projectType = document.getElementById('editProjectType').value;
    const subcategoryGroup = document.getElementById('editSubcategoryGroup');
    const subcategorySelect = document.getElementById('editSubcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

function updateManualSubcategories() {
    const projectType = document.getElementById('manualProjectType').value;
    const subcategoryGroup = document.getElementById('manualSubcategoryGroup');
    const subcategorySelect = document.getElementById('manualSubcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

// Continua na próxima parte devido ao limite de tamanho...

function startWork() {
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const errorDiv = document.getElementById('timerError');
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    let validationPassed = false;
    let projectId = null;
    let projectType = null;

    if (workType === 'project') {
        projectId = document.getElementById('projectSelect').value;
        projectType = document.getElementById('projectType').value;
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra antes de iniciar.';
            errorDiv.classList.remove('hidden');
            document.getElementById('projectSelect').focus();
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento antes de iniciar.';
            errorDiv.classList.remove('hidden');
            document.getElementById('projectType').focus();
            return;
        }
        validationPassed = true;
    } else {
        const internalDescription = document.getElementById('internalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, insira uma descrição para o trabalho interno.';
            errorDiv.classList.remove('hidden');
            document.getElementById('internalDescription').focus();
            return;
        }
        validationPassed = true;
    }

    if (!validationPassed) return;

    startTime = new Date();
    timerSeconds = 0;
    timerPaused = false;
    pausedSeconds = 0;

    const user = JSON.parse(localStorage.getItem('currentUser'));
    const timerState = { startTime: startTime.toISOString(), workType: workType, username: user.username };

    if (workType === 'project') {
        timerState.projectId = projectId;
        timerState.projectType = projectType;
        timerState.subcategory = document.getElementById('subcategory').value || '';
    } else {
        timerState.internalCategory = document.getElementById('internalCategory').value;
        timerState.internalDescription = document.getElementById('internalDescription').value;
        if (timerState.internalCategory === 'reuniao') {
            timerState.relatedProjects = getSelectedMeetingProjects('meetingProjectsList');
        }
    }

    localStorage.setItem('activeTimer', JSON.stringify(timerState));

    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');

    if (workType === 'project') {
        document.getElementById('projectSelect').disabled = true;
        document.getElementById('projectType').disabled = true;
    } else {
        document.getElementById('internalCategory').disabled = true;
        document.getElementById('internalDescription').disabled = true;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = true);

    document.getElementById('floatingTimer').classList.remove('hidden');
    if (workType === 'internal') {
        document.getElementById('floatingTimer').classList.add('internal');
    }

    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);

    startInactivityMonitor();
}

function stopWork() {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
    stopInactivityMonitor();
    const endTime = new Date();
    const duration = timerSeconds;
    saveWorkSession(startTime, endTime, duration);
    localStorage.removeItem('activeTimer');

    document.getElementById('startBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('timerStatus').textContent = 'Parado';
    document.getElementById('timerStatus').classList.remove('active');

    const workType = document.querySelector('input[name="workType"]:checked').value;
    if (workType === 'project') {
        document.getElementById('projectSelect').disabled = false;
        document.getElementById('projectType').disabled = false;
    } else {
        document.getElementById('internalCategory').disabled = false;
        document.getElementById('internalDescription').disabled = false;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = false);

    document.getElementById('floatingTimer').classList.add('hidden');
    document.getElementById('floatingTimer').classList.remove('internal');
    document.getElementById('workTimerDisplay').classList.remove('internal');

    timerSeconds = 0;
    timerPaused = false;
    pausedSeconds = 0;
    updateTimerDisplay();

    if (workType === 'project') {
        document.getElementById('projectSelect').value = '';
        document.getElementById('projectType').value = '';
    } else {
        document.getElementById('internalDescription').value = '';
    }

    loadWorkHistory();
    updateStats();
    loadWorkSelectForComments();
}

function updateTimerDisplay() {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('workTimer').textContent = timeString;
    const floatTime = document.querySelector('.float-time');
    const floatStatus = document.querySelector('.float-status');
    if (floatTime && floatStatus) {
        floatTime.textContent = timeString;
        const workType = document.querySelector('input[name="workType"]:checked').value;
        if (workType === 'project') {
            const projectSelect = document.getElementById('projectSelect');
            if (projectSelect && projectSelect.value) {
                const project = getProjects().find(p => p.id == projectSelect.value);
                if (project) { floatStatus.textContent = project.workCode; }
            }
        } else {
            const internalCategory = document.getElementById('internalCategory');
            if (internalCategory && internalCategory.selectedIndex >= 0) {
                floatStatus.textContent = internalCategory.options[internalCategory.selectedIndex].text;
            }
        }
    }
}

function saveWorkSession(startTime, endTime, duration, comment = '') {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const session = { id: Date.now(), userName: `${user.firstName} ${user.lastName}`, workType: workType, startTime: startTime.toISOString(), endTime: endTime.toISOString(), duration, comment: comment };

    if (workType === 'project') {
        const projectId = document.getElementById('projectSelect').value;
        const project = getProjects().find(p => p.id == projectId);
        const projectType = document.getElementById('projectType').value;
        if (project) {
            session.projectId = project.id;
            session.projectType = projectType;
            session.projectName = getDepartmentName(projectType);
            session.workCode = project.workCode;
            session.workName = project.name;
            session.subcategory = document.getElementById('subcategory').value || '';
        }
    } else {
        const internalCategory = document.getElementById('internalCategory').value;
        session.internalCategory = internalCategory;
        session.internalCategoryName = getInternalCategoryName(internalCategory);
        session.internalDescription = document.getElementById('internalDescription').value;
        if (internalCategory === 'reuniao') {
            session.relatedProjects = getSelectedMeetingProjects('meetingProjectsList');
        }
    }

    const history = getWorkHistory();
    history.unshift(session);
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(history));
}

function resumeActiveTimer() {
    const timerState = localStorage.getItem('activeTimer');
    if (!timerState) return;
    const state = JSON.parse(timerState);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (state.username !== user.username) return;

    startTime = new Date(state.startTime);
    const now = new Date();
    timerSeconds = Math.floor((now - startTime) / 1000);

    if (state.workType === 'internal') {
        document.getElementById('workTypeInternal').checked = true;
        updateWorkTypeFields();
        document.getElementById('internalCategory').value = state.internalCategory || 'reuniao';
        updateMeetingProjects();
        if (state.relatedProjects && state.relatedProjects.length > 0) {
            const projectIds = state.relatedProjects.map(p => p.id);
            setSelectedMeetingProjects('meetingProjectsList', projectIds);
        }
        document.getElementById('internalDescription').value = state.internalDescription || '';
    } else {
        document.getElementById('workTypeProject').checked = true;
        updateWorkTypeFields();
        document.getElementById('projectSelect').value = state.projectId || '';
        document.getElementById('projectType').value = state.projectType || '';
        updateSubcategories();
        if (state.subcategory) {
            document.getElementById('subcategory').value = state.subcategory;
        }
    }

    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');

    if (state.workType === 'internal') {
        document.getElementById('internalCategory').disabled = true;
        document.getElementById('internalDescription').disabled = true;
    } else {
        document.getElementById('projectSelect').disabled = true;
        document.getElementById('projectType').disabled = true;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = true);

    document.getElementById('floatingTimer').classList.remove('hidden');
    if (state.workType === 'internal') {
        document.getElementById('floatingTimer').classList.add('internal');
        document.getElementById('workTimerDisplay').classList.add('internal');
    }

    updateTimerDisplay();
    timerPaused = false;
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);
    startInactivityMonitor();
}

function resetActivityTimer() { lastActivityTime = Date.now(); }

function startInactivityMonitor() {
    lastActivityTime = Date.now();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => { document.addEventListener(event, resetActivityTimer); });
    inactivityTimer = setInterval(checkInactivity, 10000);
}

function stopInactivityMonitor() {
    if (inactivityTimer) {
        clearInterval(inactivityTimer);
        inactivityTimer = null;
    }
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => { document.removeEventListener(event, resetActivityTimer); });
}

function checkInactivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT && !timerPaused && timerInterval) {
        pauseTimerForInactivity();
    }
    if (timerPaused) { updatePausedDuration(); }
}

function pauseTimerForInactivity() {
    timerPaused = true;
    pausedSeconds = 0;
    document.getElementById('inactivityModal').classList.add('show');
    document.getElementById('timerStatus').textContent = 'Pausado (Inatividade)';
    document.getElementById('timerStatus').classList.remove('active');
    const minutes = Math.floor(INACTIVITY_TIMEOUT / 60000);
    document.getElementById('inactivityTime').textContent = `${minutes} minutos`;
}

function updatePausedDuration() {
    pausedSeconds++;
    const minutes = Math.floor(pausedSeconds / 60);
    const seconds = pausedSeconds % 60;
    document.getElementById('pausedDuration').textContent = `${minutes}m ${seconds}s`;
}

function resumeTimer() {
    timerPaused = false;
    lastActivityTime = Date.now();
    document.getElementById('inactivityModal').classList.remove('show');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');
    pausedSeconds = 0;
}

function stopWorkFromInactivity() {
    localStorage.removeItem('activeTimer');
    document.getElementById('inactivityModal').classList.remove('show');
    stopWork();
}

// Continua...

function loadWorkHistory() {
    const history = getWorkHistory();
    const container = document.getElementById('workHistory');
    if (history.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem histórico de trabalho</p>';
        return;
    }
    container.innerHTML = history.slice(0, 5).map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const commentHtml = session.comment ? `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        let badgesHtml = '';
        if (session.workType === 'internal') { badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>'; }
        if (session.manualEntry) { badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>'; }
        if (session.manualEdit) { badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>'; }
        let mainInfo = '';
        let subInfo = '';
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                const projectsList = session.relatedProjects.map(p => p.workCode).join(', ');
                subInfo += `<div class="hist-obra">🏗️ Obras: ${projectsList}</div>`;
            }
        } else {
            mainInfo = session.projectName;
            const workNameHtml = session.workName ? `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        return `
            <div class="${itemClass}">
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
                <div class="hist-actions">
                    <button class="btn btn-primary btn-small" onclick="editSession(${session.id})">✏️ Editar</button>
                    <button class="btn btn-warning btn-small" onclick="openComments(${session.id})">💬 Comentário</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSession(${session.id})">🗑️ Apagar</button>
                </div>
            </div>
        `;
    }).join('');
}

function editSession(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    currentEditId = sessionId;
    loadProjectSelects();
    if (session.workType === 'internal') {
        document.getElementById('editWorkTypeInternal').checked = true;
        updateEditFields();
        document.getElementById('editInternalCategory').value = session.internalCategory || 'reuniao';
        updateEditMeetingProjects();
        if (session.relatedProjects && session.relatedProjects.length > 0) {
            const projectIds = session.relatedProjects.map(p => p.id);
            setSelectedMeetingProjects('editMeetingProjectsList', projectIds);
        }
        document.getElementById('editInternalDescription').value = session.internalDescription || '';
    } else {
        document.getElementById('editWorkTypeProject').checked = true;
        updateEditFields();
        if (session.projectId) {
            document.getElementById('editProjectSelect').value = session.projectId;
        } else {
            const project = getProjects().find(p => p.workCode === session.workCode);
            if (project) { document.getElementById('editProjectSelect').value = project.id; }
        }
        if (session.projectType) {
            document.getElementById('editProjectType').value = session.projectType;
            updateEditSubcategories();
        }
        if (session.subcategory) {
            document.getElementById('editSubcategory').value = session.subcategory;
        }
    }
    const startDate = new Date(session.startTime);
    const endDate = new Date(session.endTime);
    document.getElementById('editStartTime').value = formatDateTimeLocal(startDate);
    document.getElementById('editEndTime').value = formatDateTimeLocal(endDate);
    document.getElementById('editComment').value = session.comment || '';
    document.getElementById('editModal').classList.add('show');
}

function saveEdit() {
    if (!currentEditId) return;
    const errorDiv = document.getElementById('editError');
    const successDiv = document.getElementById('editSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workType = document.querySelector('input[name="editWorkType"]:checked').value;
    const startTime = new Date(document.getElementById('editStartTime').value);
    const endTime = new Date(document.getElementById('editEndTime').value);
    const comment = document.getElementById('editComment').value.trim();
    if (!startTime || !endTime) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos obrigatórios.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (endTime <= startTime) {
        errorDiv.textContent = '⚠️ A hora de fim deve ser posterior à hora de início.';
        errorDiv.classList.remove('hidden');
        return;
    }
    let validationPassed = false;
    if (workType === 'project') {
        const projectId = document.getElementById('editProjectSelect').value;
        const projectType = document.getElementById('editProjectType').value;
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra.';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento.';
            errorDiv.classList.remove('hidden');
            return;
        }
        validationPassed = true;
    } else {
        const internalDescription = document.getElementById('editInternalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, preencha a descrição.';
            errorDiv.classList.remove('hidden');
            return;
        }
        validationPassed = true;
    }
    if (!validationPassed) return;
    const duration = Math.floor((endTime - startTime) / 1000);
    const history = getWorkHistory();
    const sessionIndex = history.findIndex(s => s.id === currentEditId);
    if (sessionIndex !== -1) {
        history[sessionIndex].workType = workType;
        history[sessionIndex].startTime = startTime.toISOString();
        history[sessionIndex].endTime = endTime.toISOString();
        history[sessionIndex].duration = duration;
        history[sessionIndex].comment = comment;
        history[sessionIndex].manualEdit = true;
        if (workType === 'project') {
            const projectId = document.getElementById('editProjectSelect').value;
            const project = getProjects().find(p => p.id == projectId);
            const projectType = document.getElementById('editProjectType').value;
            if (project) {
                history[sessionIndex].projectId = project.id;
                history[sessionIndex].projectType = projectType;
                history[sessionIndex].projectName = getDepartmentName(projectType);
                history[sessionIndex].workCode = project.workCode;
                history[sessionIndex].workName = project.name;
                history[sessionIndex].subcategory = document.getElementById('editSubcategory').value || '';
            }
            delete history[sessionIndex].internalCategory;
            delete history[sessionIndex].internalCategoryName;
            delete history[sessionIndex].internalDescription;
            delete history[sessionIndex].relatedProjects;
        } else {
            const internalCategory = document.getElementById('editInternalCategory').value;
            history[sessionIndex].internalCategory = internalCategory;
            history[sessionIndex].internalCategoryName = getInternalCategoryName(internalCategory);
            history[sessionIndex].internalDescription = document.getElementById('editInternalDescription').value;
            if (internalCategory === 'reuniao') {
                history[sessionIndex].relatedProjects = getSelectedMeetingProjects('editMeetingProjectsList');
            } else {
                delete history[sessionIndex].relatedProjects;
            }
            delete history[sessionIndex].projectId;
            delete history[sessionIndex].projectType;
            delete history[sessionIndex].projectName;
            delete history[sessionIndex].workCode;
            delete history[sessionIndex].workName;
            delete history[sessionIndex].subcategory;
        }
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const key = `workHistory_${user.username}`;
        localStorage.setItem(key, JSON.stringify(history));
        successDiv.textContent = '✅ Sessão atualizada com sucesso!';
        successDiv.classList.remove('hidden');
        setTimeout(() => {
            closeEditModal();
            loadWorkHistory();
            updateStats();
            updateReports();
        }, 1500);
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentEditId = null;
}

function openManualEntry() {
    document.getElementById('manualWorkTypeProject').checked = true;
    updateManualFields();
    loadProjectSelects();
    const now = new Date();
    document.getElementById('manualStartTime').value = formatDateTimeLocal(now);
    document.getElementById('manualEndTime').value = formatDateTimeLocal(now);
    document.getElementById('manualError').classList.add('hidden');
    document.getElementById('manualSuccess').classList.add('hidden');
    document.getElementById('manualEntryModal').classList.add('show');
}

function closeManualEntryModal() {
    document.getElementById('manualEntryModal').classList.remove('show');
    document.getElementById('manualProjectSelect').value = '';
    document.getElementById('manualProjectType').value = '';
    document.getElementById('manualInternalCategory').value = 'reuniao';
    document.getElementById('manualInternalDescription').value = '';
    document.getElementById('manualStartTime').value = '';
    document.getElementById('manualEndTime').value = '';
    document.getElementById('manualComment').value = '';
    document.getElementById('manualSubcategory').value = '';
    document.getElementById('manualSubcategoryGroup').style.display = 'none';
}

function saveManualEntry() {
    const errorDiv = document.getElementById('manualError');
    const successDiv = document.getElementById('manualSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workType = document.querySelector('input[name="manualWorkType"]:checked').value;
    const startTime = new Date(document.getElementById('manualStartTime').value);
    const endTime = new Date(document.getElementById('manualEndTime').value);
    const comment = document.getElementById('manualComment').value.trim();
    if (!startTime || !endTime) {
        errorDiv.textContent = '⚠️ Por favor, preencha as datas de início e fim.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (endTime <= startTime) {
        errorDiv.textContent = '⚠️ A hora de fim deve ser posterior à hora de início.';
        errorDiv.classList.remove('hidden');
        return;
    }
    let validationPassed = false;
    const duration = Math.floor((endTime - startTime) / 1000);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const session = { id: Date.now(), userName: `${user.firstName} ${user.lastName}`, workType: workType, startTime: startTime.toISOString(), endTime: endTime.toISOString(), duration, comment: comment, manualEntry: true };
    if (workType === 'project') {
        const projectId = document.getElementById('manualProjectSelect').value;
        const projectType = document.getElementById('manualProjectType').value;
        const subcategory = document.getElementById('manualSubcategory').value || '';
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra.';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento.';
            errorDiv.classList.remove('hidden');
            return;
        }
        const project = getProjects().find(p => p.id == projectId);
        if (project) {
            session.projectId = project.id;
            session.projectType = projectType;
            session.projectName = getDepartmentName(projectType);
            session.workCode = project.workCode;
            session.workName = project.name;
            session.subcategory = subcategory;
        }
        validationPassed = true;
    } else {
        const internalCategory = document.getElementById('manualInternalCategory').value;
        const internalDescription = document.getElementById('manualInternalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, insira uma descrição para o trabalho interno.';
            errorDiv.classList.remove('hidden');
            return;
        }
        session.internalCategory = internalCategory;
        session.internalCategoryName = getInternalCategoryName(internalCategory);
        session.internalDescription = internalDescription;
        if (internalCategory === 'reuniao') {
            session.relatedProjects = getSelectedMeetingProjects('manualMeetingProjectsList');
        }
        validationPassed = true;
    }
    if (!validationPassed) return;
    const history = getWorkHistory();
    history.unshift(session);
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(history));
    successDiv.textContent = '✅ Sessão adicionada com sucesso!';
    successDiv.classList.remove('hidden');
    setTimeout(() => {
        closeManualEntryModal();
        loadWorkHistory();
        updateStats();
        updateReports();
    }, 1500);
}

function deleteSession(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    const newHistory = history.filter(s => s.id !== sessionId);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(newHistory));
    const allComments = getComments();
    if (allComments[sessionId]) {
        delete allComments[sessionId];
        saveComments(allComments);
    }
    loadWorkHistory();
    updateStats();
    updateReports();
    loadWorkSelectForComments();
}

// Devido ao limite, vou continuar com o resto das funções num próximo comando...
// Continuação do app.js - Projects, Comments, Stats, Export

function openNewProjectModal() {
    document.getElementById('newProjectError').classList.add('hidden');
    document.getElementById('newProjectSuccess').classList.add('hidden');
    document.getElementById('newProjectModal').classList.add('show');
    setTimeout(() => document.getElementById('newProjectCode').focus(), 100);
}

function closeNewProjectModal() {
    document.getElementById('newProjectModal').classList.remove('show');
    document.getElementById('newProjectCode').value = '';
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectNotes').value = '';
}

function createNewProject() {
    const errorDiv = document.getElementById('newProjectError');
    const successDiv = document.getElementById('newProjectSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workCode = document.getElementById('newProjectCode').value.trim();
    const name = document.getElementById('newProjectName').value.trim();
    const notes = document.getElementById('newProjectNotes').value.trim();
    if (!workCode || !name) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos obrigatórios.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (workCode.length < 5) {
        errorDiv.textContent = '⚠️ Código da obra inválido! Deve ter pelo menos 5 caracteres.';
        errorDiv.classList.remove('hidden');
        document.getElementById('newProjectCode').focus();
        return;
    }
    const projects = getProjects();
    if (projects.find(p => p.workCode === workCode)) {
        errorDiv.textContent = '⚠️ Já existe uma obra com este código.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const newProject = { id: Date.now(), workCode: workCode, name: name, status: 'open', createdDate: new Date().toISOString(), notes: notes, reopenHistory: [] };
    projects.push(newProject);
    saveProjects(projects);
    successDiv.textContent = '✅ Obra criada com sucesso!';
    successDiv.classList.remove('hidden');
    setTimeout(() => {
        closeNewProjectModal();
        loadProjectsList();
        loadProjectSelects();
    }, 1500);
}

function loadProjectsList() {
    const statusFilter = document.getElementById('projectStatusFilter').value;
    const projects = getProjects();
    const container = document.getElementById('projectsList');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const isAdmin = user && user.isAdmin === true;
    
    // Calcular estatísticas de reabertura
    updateProjectsStats(projects);
    
    let filteredProjects = projects;
    if (statusFilter === 'open') { filteredProjects = projects.filter(p => p.status === 'open'); }
    else if (statusFilter === 'closed') { filteredProjects = projects.filter(p => p.status === 'closed'); }
    if (filteredProjects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem obras para mostrar</p>';
        return;
    }
    container.innerHTML = filteredProjects.map(project => {
        const createdDate = new Date(project.createdDate);
        const createdStr = `${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()}`;
        let closedStr = '';
        if (project.closedDate) {
            const closedDate = new Date(project.closedDate);
            closedStr = `${closedDate.getDate()}/${closedDate.getMonth() + 1}/${closedDate.getFullYear()}`;
        }
        const statusClass = project.status === 'open' ? 'status-open' : 'status-closed';
        const statusText = project.status === 'open' ? 'Aberta' : 'Fechada';
        const cardClass = project.status === 'closed' ? 'project-card closed' : 'project-card';
        let reopenInfoHtml = '';
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            const lastReopen = project.reopenHistory[project.reopenHistory.length - 1];
            const reopenDate = new Date(lastReopen.date);
            const reopenDateStr = `${reopenDate.getDate()}/${reopenDate.getMonth() + 1}/${reopenDate.getFullYear()}`;
            const reasonText = lastReopen.reason === 'client_change' ? 'Alteração do Cliente' : 'Erro Nosso';
            const reasonColor = lastReopen.reason === 'client_change' ? '#f39c12' : '#e74c3c';
            const reopenCount = project.reopenHistory.length;
            const reopenLabel = reopenCount > 1 ? `(${reopenCount}x reabertas)` : '';
            reopenInfoHtml = `<div class="reopen-info" style="border-color: ${reasonColor};"><strong>🔄 Reaberta ${reopenLabel}:</strong> ${reopenDateStr} - <span style="color: ${reasonColor}; font-weight: 600;">${reasonText}</span>${lastReopen.comment ? `<br><em>${lastReopen.comment}</em>` : ''}</div>`;
        }
        
        // Apenas admins podem fechar/reabrir obras
        let actionsHtml = '';
        if (isAdmin) {
            actionsHtml = project.status === 'open' 
                ? `<button class="btn btn-danger btn-small" onclick="closeProject(${project.id})">🔒 Terminar Obra</button>` 
                : `<button class="btn btn-warning btn-small" onclick="openReopenProjectModal(${project.id})">🔄 Reabrir Obra</button>`;
        }
        
        return `
            <div class="${cardClass}">
                <div class="project-header">
                    <div class="project-code">${project.workCode}</div>
                    <div class="project-status ${statusClass}">${statusText}</div>
                </div>
                <div class="project-name">${project.name}</div>
                <div class="project-dates">📅 Aberta: ${createdStr}${closedStr ? ` | Fechada: ${closedStr}` : ''}</div>
                ${project.notes ? `<div class="project-notes" style="font-size: 12px; color: #6c757d; margin-top: 8px;">📝 ${project.notes}</div>` : ''}
                ${reopenInfoHtml}
                ${actionsHtml ? `<div class="project-actions">${actionsHtml}</div>` : ''}
            </div>
        `;
    }).join('');
}

function updateProjectsStats(projects) {
    const openCount = projects.filter(p => p.status === 'open').length;
    const closedCount = projects.filter(p => p.status === 'closed').length;
    
    let clientReopens = 0;
    let errorReopens = 0;
    
    projects.forEach(project => {
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            project.reopenHistory.forEach(reopen => {
                if (reopen.reason === 'client_change') {
                    clientReopens++;
                } else if (reopen.reason === 'our_error') {
                    errorReopens++;
                }
            });
        }
    });
    
    document.getElementById('statsOpenProjects').textContent = openCount;
    document.getElementById('statsClosedProjects').textContent = closedCount;
    document.getElementById('statsClientReopens').textContent = clientReopens;
    document.getElementById('statsErrorReopens').textContent = errorReopens;
}

function closeProject(projectId) {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    showConfirm('Terminar Obra', `Tem a certeza que deseja terminar a obra "${project.workCode}"?\n\nIsto marcará a obra como concluída.`, function() {
        project.status = 'closed';
        project.closedDate = new Date().toISOString();
        saveProjects(projects);
        loadProjectsList();
        loadProjectSelects();
    });
}

function openReopenProjectModal(projectId) {
    const project = getProjects().find(p => p.id === projectId);
    if (!project) return;
    currentReopenProjectId = projectId;
    document.getElementById('reopenProjectCode').textContent = project.workCode;
    document.getElementById('reopenProjectName').textContent = project.name;
    document.getElementById('reopenReason').value = '';
    document.getElementById('reopenComment').value = '';
    document.getElementById('reopenProjectError').classList.add('hidden');
    document.getElementById('reopenProjectModal').classList.add('show');
}

function closeReopenProjectModal() {
    document.getElementById('reopenProjectModal').classList.remove('show');
    currentReopenProjectId = null;
}

function confirmReopenProject() {
    const errorDiv = document.getElementById('reopenProjectError');
    errorDiv.classList.add('hidden');
    const reason = document.getElementById('reopenReason').value;
    const comment = document.getElementById('reopenComment').value.trim();
    if (!reason) {
        errorDiv.textContent = '⚠️ Por favor, selecione o motivo da reabertura.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const projects = getProjects();
    const projectIndex = projects.findIndex(p => p.id === currentReopenProjectId);
    if (projectIndex === -1) return;
    projects[projectIndex].status = 'open';
    delete projects[projectIndex].closedDate;
    if (!projects[projectIndex].reopenHistory) { projects[projectIndex].reopenHistory = []; }
    projects[projectIndex].reopenHistory.push({ date: new Date().toISOString(), reason: reason, comment: comment });
    saveProjects(projects);
    closeReopenProjectModal();
    loadProjectsList();
    loadProjectSelects();
}

function openComments(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    currentEditId = sessionId;
    if (session.workType === 'internal') {
        document.getElementById('commentProject').textContent = session.internalCategoryName || 'Trabalho Interno';
        document.getElementById('commentWorkCode').textContent = session.internalDescription || '';
    } else {
        document.getElementById('commentProject').textContent = session.projectName;
        document.getElementById('commentWorkCode').textContent = session.workCode;
    }
    loadSessionComments(sessionId);
    document.getElementById('commentsModal').classList.add('show');
}

function loadSessionComments(sessionId) {
    const allComments = getComments();
    const sessionComments = allComments[sessionId] || [];
    const container = document.getElementById('commentsList');
    if (sessionComments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px;">Sem comentários</p>';
        return;
    }
    container.innerHTML = sessionComments.map(c => `
        <div class="comment-item">
            <div class="comment-text">${c.text}</div>
            <div class="comment-meta">${new Date(c.date).toLocaleString('pt-PT')}</div>
        </div>
    `).join('');
}

function addComment() {
    const errorDiv = document.getElementById('commentError');
    const successDiv = document.getElementById('commentSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const text = document.getElementById('newComment').value.trim();
    if (!text) {
        errorDiv.textContent = '⚠️ Por favor, escreva um comentário.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const allComments = getComments();
    if (!allComments[currentEditId]) { allComments[currentEditId] = []; }
    allComments[currentEditId].push({ text: text, date: new Date().toISOString() });
    saveComments(allComments);
    const history = getWorkHistory();
    const session = history.find(s => s.id === currentEditId);
    if (session) {
        session.comment = text;
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const key = `workHistory_${user.username}`;
        localStorage.setItem(key, JSON.stringify(history));
    }
    document.getElementById('newComment').value = '';
    loadSessionComments(currentEditId);
    loadWorkHistory();
    successDiv.textContent = '✅ Comentário adicionado!';
    successDiv.classList.remove('hidden');
    setTimeout(() => { successDiv.classList.add('hidden'); }, 2000);
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('show');
    currentEditId = null;
}

function loadWorkSelectForComments() {
    const projects = getProjects();
    const select = document.getElementById('selectWorkForComments');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    projects.forEach(project => {
        select.innerHTML += `<option value="${project.workCode}">${project.workCode} - ${project.name}</option>`;
    });
}

function loadCommentsForWork() {
    const workCode = document.getElementById('selectWorkForComments').value;
    if (!workCode) {
        document.getElementById('commentsDisplay').classList.add('hidden');
        return;
    }
    document.getElementById('commentsDisplay').classList.remove('hidden');
    const history = getWorkHistory();
    const workSessions = history.filter(s => s.workCode === workCode);
    const allComments = getComments();
    let allWorkComments = [];
    workSessions.forEach(session => {
        const sessionComments = allComments[session.id] || [];
        allWorkComments = allWorkComments.concat(sessionComments);
    });
    const container = document.getElementById('workCommentsList');
    if (allWorkComments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px;">Sem comentários para esta obra</p>';
        return;
    }
    container.innerHTML = allWorkComments.map(c => `
        <div class="comment-item">
            <div class="comment-text">${c.text}</div>
            <div class="comment-meta">${new Date(c.date).toLocaleString('pt-PT')}</div>
        </div>
    `).join('');
}

function addQuickComment() {
    const workCode = document.getElementById('selectWorkForComments').value;
    const text = document.getElementById('quickComment').value.trim();
    if (!workCode || !text) {
        if (!workCode) {
            document.getElementById('selectWorkForComments').style.borderColor = '#e74c3c';
            setTimeout(() => { document.getElementById('selectWorkForComments').style.borderColor = ''; }, 2000);
        }
        if (!text) {
            document.getElementById('quickComment').style.borderColor = '#e74c3c';
            setTimeout(() => { document.getElementById('quickComment').style.borderColor = ''; }, 2000);
        }
        return;
    }
    const history = getWorkHistory();
    const lastSession = history.find(s => s.workCode === workCode);
    if (!lastSession) return;
    const allComments = getComments();
    if (!allComments[lastSession.id]) { allComments[lastSession.id] = []; }
    allComments[lastSession.id].push({ text: text, date: new Date().toISOString() });
    saveComments(allComments);
    document.getElementById('quickComment').value = '';
    loadCommentsForWork();
    loadWorkHistory();
}

function updateStats() {
    const history = getWorkHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayProjectSeconds = history.filter(s => new Date(s.startTime) >= today && s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
    const todayInternalSeconds = history.filter(s => new Date(s.startTime) >= today && s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
    document.getElementById('todayProjectHours').textContent = formatHours(todayProjectSeconds);
    document.getElementById('todayInternalHours').textContent = formatHours(todayInternalSeconds);
}

function updateReports() {
    const typeFilter = document.getElementById('reportTypeFilter').value;
    const departmentFilter = document.getElementById('reportFilter').value;
    const internalCategoryFilter = document.getElementById('internalCategoryFilter').value;
    const history = getWorkHistory();
    const departmentFilterSection = document.getElementById('departmentFilterSection');
    const internalCategoryFilterSection = document.getElementById('internalCategoryFilterSection');
    if (typeFilter === 'project') {
        departmentFilterSection.classList.remove('hidden');
        internalCategoryFilterSection.classList.add('hidden');
    } else if (typeFilter === 'internal') {
        departmentFilterSection.classList.add('hidden');
        internalCategoryFilterSection.classList.remove('hidden');
    } else {
        departmentFilterSection.classList.remove('hidden');
        internalCategoryFilterSection.classList.add('hidden');
    }
    let filteredHistory = history;
    if (typeFilter === 'project') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'project');
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.projectType === departmentFilter);
        }
    } else if (typeFilter === 'internal') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'internal');
        if (internalCategoryFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.internalCategory === internalCategoryFilter);
        }
    } else {
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.workType === 'internal' || s.projectType === departmentFilter);
        }
    }
    const projectSeconds = filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
    const internalSeconds = filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
    document.getElementById('totalProjectHours').textContent = formatHours(projectSeconds);
    document.getElementById('totalInternalHours').textContent = formatHours(internalSeconds);
    const container = document.getElementById('fullHistory');
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados para mostrar</p>';
        return;
    }
    container.innerHTML = filteredHistory.map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const commentHtml = session.comment ? `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        let badgesHtml = '';
        if (session.workType === 'internal') { badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>'; }
        if (session.manualEntry) { badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>'; }
        if (session.manualEdit) { badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>'; }
        let mainInfo = '';
        let subInfo = '';
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                const projectsList = session.relatedProjects.map(p => p.workCode).join(', ');
                subInfo += `<div class="hist-obra">🏗️ Obras: ${projectsList}</div>`;
            }
        } else {
            mainInfo = session.projectName;
            const workNameHtml = session.workName ? `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        return `
            <div class="${itemClass}">
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
                <div class="hist-actions">
                    <button class="btn btn-primary btn-small" onclick="editSession(${session.id})">✏️ Editar</button>
                    <button class="btn btn-warning btn-small" onclick="openComments(${session.id})">💬 Comentário</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSession(${session.id})">🗑️ Apagar</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateExportStats() {
    const history = getWorkHistory();
    const users = getUsers();
    const projects = getProjects();
    document.getElementById('exportSessionCount').textContent = history.length;
    document.getElementById('exportProjectCount').textContent = projects.length;
    document.getElementById('exportUserCount').textContent = users.length;
}

function exportCSV() {
    const history = getWorkHistory();
    if (history.length === 0) {
        showAlert('Aviso', 'Não há dados para exportar.');
        return;
    }
    let csv = 'Data Início,Hora Início,Data Fim,Hora Fim,Utilizador,Tipo Trabalho,Departamento/Categoria,Subcategoria,Código Obra/Descrição,Nome Obra,Obras Relacionadas,Duração (segundos),Duração (horas),Comentário\n';
    history.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        const startDateStr = `${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`;
        const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const hours = (session.duration / 3600).toFixed(2);
        const comment = session.comment || '';
        const workTypeLabel = session.workType === 'internal' ? 'Interno' : 'Projeto';
        let departmentCategory = '';
        let subcategory = '';
        let workCodeDescription = '';
        let workName = '';
        let relatedProjects = '';
        if (session.workType === 'internal') {
            departmentCategory = session.internalCategoryName || '';
            workCodeDescription = session.internalDescription || '';
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                relatedProjects = session.relatedProjects.map(p => p.workCode).join('; ');
            }
        } else {
            departmentCategory = session.projectName || '';
            subcategory = session.subcategory || '';
            workCodeDescription = session.workCode || '';
            workName = session.workName || '';
        }
        csv += `${startDateStr},${startTimeStr},${endDateStr},${endTimeStr},"${session.userName}","${workTypeLabel}","${departmentCategory}","${subcategory}","${workCodeDescription}","${workName}","${relatedProjects}",${session.duration},${hours},"${comment}"\n`;
    });
    downloadFile(csv, 'controlo_obra.csv', 'text/csv');
}

function exportJSON() {
    const history = getWorkHistory();
    if (history.length === 0) {
        showAlert('Aviso', 'Não há dados para exportar.');
        return;
    }
    const json = JSON.stringify(history, null, 2);
    downloadFile(json, 'controlo_obra.json', 'application/json');
}

function backupData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const history = getWorkHistory();
    const users = getUsers();
    const comments = getComments();
    const projects = getProjects();
    const backup = { version: '3.1', exportDate: new Date().toISOString(), currentUser: user, workHistory: history, comments: comments, projects: projects, users: users.map(u => ({ firstName: u.firstName, lastName: u.lastName, username: u.username })) };
    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `backup_controlo_obra_${Date.now()}.json`, 'application/json');
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.version || !backup.workHistory) {
                showAlert('Erro', 'Ficheiro de backup inválido.');
                return;
            }
            showConfirm('Confirmar Restauro', 'Isto irá substituir os seus dados atuais. Deseja continuar?', function() {
                const user = JSON.parse(localStorage.getItem('currentUser'));
                const key = `workHistory_${user.username}`;
                localStorage.setItem(key, JSON.stringify(backup.workHistory));
                if (backup.comments) {
                    const commentsKey = `comments_${user.username}`;
                    localStorage.setItem(commentsKey, JSON.stringify(backup.comments));
                }
                // Obras não são mais restauradas por utilizador (são globais)
                showAlert('Sucesso', 'Dados restaurados com sucesso!');
                loadWorkHistory();
                updateStats();
                updateReports();
                loadWorkSelectForComments();
                loadProjectSelects();
                loadProjectsList();
            });
        } catch (error) {
            showAlert('Erro', 'Erro ao ler o ficheiro de backup.');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// Profile Management Functions
function loadProfileData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const currentUserData = users.find(u => u.username === user.username);
    
    if (!currentUserData) return;
    
    document.getElementById('profileFirstName').value = currentUserData.firstName || '';
    document.getElementById('profileLastName').value = currentUserData.lastName || '';
    document.getElementById('profileUsername').value = currentUserData.username || '';
    document.getElementById('profileDepartment').value = currentUserData.defaultDepartment || '';
    
    const accountType = currentUserData.isAdmin ? '👑 Administrador' : '👤 Utilizador Normal';
    document.getElementById('profileAccountType').textContent = accountType;
    
    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    
    document.getElementById('profileError').classList.add('hidden');
    document.getElementById('profileSuccess').classList.add('hidden');
}

function updatePersonalInfo() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const firstName = document.getElementById('profileFirstName').value.trim();
    const lastName = document.getElementById('profileLastName').value.trim();
    const department = document.getElementById('profileDepartment').value;
    
    if (!firstName || !lastName) {
        errorDiv.textContent = '⚠️ Por favor, preencha o nome completo.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === currentUser.username);
    
    if (userIndex === -1) return;
    
    users[userIndex].firstName = firstName;
    users[userIndex].lastName = lastName;
    users[userIndex].defaultDepartment = department;
    
    saveUsers(users);
    
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.defaultDepartment = department;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('userName').textContent = `${firstName} ${lastName}`;
    
    successDiv.textContent = '✅ Informações pessoais atualizadas com sucesso!';
    successDiv.classList.remove('hidden');
    
    setTimeout(() => { successDiv.classList.add('hidden'); }, 3000);
}

async function updateUsername() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const newUsername = document.getElementById('profileUsername').value.trim();
    
    if (!newUsername) {
        errorDiv.textContent = '⚠️ Por favor, insira um nome de utilizador.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newUsername.length < 3) {
        errorDiv.textContent = '⚠️ O nome de utilizador deve ter pelo menos 3 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (newUsername === currentUser.username) {
        errorDiv.textContent = '⚠️ Este já é o seu nome de utilizador atual.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const users = getUsers();
    
    if (users.find(u => u.username === newUsername)) {
        errorDiv.textContent = '⚠️ Este nome de utilizador já está em uso.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    showConfirm('Alterar Username', 
        `Tem certeza que deseja alterar o username de "${currentUser.username}" para "${newUsername}"?`,
        async function() {
            const userIndex = users.findIndex(u => u.username === currentUser.username);
            if (userIndex === -1) return;
            
            const oldUsername = users[userIndex].username;
            users[userIndex].username = newUsername;
            saveUsers(users);
            
            const oldHistoryKey = `workHistory_${oldUsername}`;
            const oldProjectsKey = `projects_${oldUsername}`;
            const oldCommentsKey = `comments_${oldUsername}`;
            
            const history = localStorage.getItem(oldHistoryKey);
            const projects = localStorage.getItem(oldProjectsKey);
            const comments = localStorage.getItem(oldCommentsKey);
            
            if (history) {
                localStorage.setItem(`workHistory_${newUsername}`, history);
                localStorage.removeItem(oldHistoryKey);
            }
            if (projects) {
                localStorage.setItem(`projects_${newUsername}`, projects);
                localStorage.removeItem(oldProjectsKey);
            }
            if (comments) {
                localStorage.setItem(`comments_${newUsername}`, comments);
                localStorage.removeItem(oldCommentsKey);
            }
            
            currentUser.username = newUsername;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            if (localStorage.getItem('activeTimer')) {
                const timerState = JSON.parse(localStorage.getItem('activeTimer'));
                timerState.username = newUsername;
                localStorage.setItem('activeTimer', JSON.stringify(timerState));
            }
            
            successDiv.textContent = `✅ Username alterado com sucesso para "${newUsername}"! Continua com a sessão ativa.`;
            successDiv.classList.remove('hidden');
            
            setTimeout(() => { successDiv.classList.add('hidden'); }, 4000);
        }
    );
}

async function updatePassword() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const oldPassword = document.getElementById('profileOldPassword').value;
    const newPassword = document.getElementById('profileNewPassword').value;
    const confirmPassword = document.getElementById('profileConfirmPassword').value;
    
    if (!oldPassword || !newPassword || !confirmPassword) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos de password.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = '⚠️ A nova password deve ter pelo menos 6 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = '⚠️ As passwords não coincidem.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === currentUser.username);
    
    if (userIndex === -1) return;
    
    const oldPasswordHash = await sha256(oldPassword);
    
    if (users[userIndex].password !== oldPasswordHash) {
        errorDiv.textContent = '⚠️ Password atual incorreta.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    showConfirm('Alterar Password', 
        'Tem certeza que deseja alterar a password?\n\nPor questões de segurança, será desconectado e terá de fazer login novamente com a nova password.',
        async function() {
            const newPasswordHash = await sha256(newPassword);
            users[userIndex].password = newPasswordHash;
            saveUsers(users);
            
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeTimer');
            
            showAlert('Password Alterada', 'Password alterada com sucesso!\n\nVai ser redirecionado para o login. Use a sua nova password.');
            
            setTimeout(() => {
                showLogin();
            }, 2500);
        }
    );
}

window.addEventListener('load', () => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) { showApp(); } else { showLogin(); }
});

window.addEventListener('beforeunload', (e) => {
    if (timerInterval) {
        e.preventDefault();
        e.returnValue = '';
    }
});
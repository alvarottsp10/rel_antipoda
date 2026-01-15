function isUserAdmin() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    return user && user.isAdmin === true;
}

function initializeDefaultAdmin() {
    const users = getUsers();
    const adminExists = users.find(u => u.username === 'admin');
    
    if (!adminExists) {
        sha256('admin123').then(hashedPassword => {
            users.push({
                firstName: 'Admin',
                lastName: 'Sistema',
                username: 'admin',
                password: hashedPassword,
                defaultDepartment: '',
                isAdmin: true
            });
            saveUsers(users);
        });
    }
    
    migrateProjectsToGlobal();
}

function migrateProjectsToGlobal() {
    const globalProjects = localStorage.getItem('projects_global');
    if (globalProjects) {
        return; 
    }
    
    const users = getUsers();
    let allProjects = [];
    const seenCodes = new Set();
    
    users.forEach(user => {
        const key = `projects_${user.username}`;
        const userProjects = localStorage.getItem(key);
        if (userProjects) {
            const projects = JSON.parse(userProjects);
            projects.forEach(project => {
                if (!seenCodes.has(project.workCode)) {
                    seenCodes.add(project.workCode);
                    allProjects.push(project);
                }
            });
        }
    });
    
    if (allProjects.length > 0) {
        localStorage.setItem('projects_global', JSON.stringify(allProjects));
        console.log(`✅ Migração completa: ${allProjects.length} obras movidas para sistema global`);
    }
}

function getAllUsersHistory() {
    const users = getUsers();
    let allHistory = [];
    
    users.forEach(user => {
        const key = `workHistory_${user.username}`;
        const history = localStorage.getItem(key);
        if (history) {
            const userHistory = JSON.parse(history);
            allHistory = allHistory.concat(userHistory);
        }
    });
    
    return allHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

function getAllUsersProjects() {
    const projects = localStorage.getItem('projects_global');
    return projects ? JSON.parse(projects) : [];
}

function loadUsersList() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const container = document.getElementById('usersList');
    
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem utilizadores registados</p>';
        return;
    }
    
    container.innerHTML = users.map(user => {
        const cardClass = user.isAdmin ? 'user-card admin-user' : 'user-card';
        const badgeHtml = user.isAdmin ? '<div class="user-badge">👑 ADMIN</div>' : '';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const isSelf = currentUser.username === user.username;
        
        let actionsHtml = '';
        if (!isSelf) {
            if (user.isAdmin) {
                actionsHtml = `<button class="btn btn-secondary btn-small" onclick="demoteFromAdmin('${user.username}')">⬇️ Remover Admin</button>`;
            } else {
                actionsHtml = `<button class="btn btn-admin btn-small" onclick="promoteToAdmin('${user.username}')">⬆️ Promover a Admin</button>`;
            }
        } else {
            actionsHtml = '<span style="font-size: 12px; color: #95a5a6; font-style: italic;">Você</span>';
        }
        
        return `
            <div class="${cardClass}">
                <div class="user-header">
                    <div class="user-name">${user.firstName} ${user.lastName}</div>
                    ${badgeHtml}
                </div>
                <div class="user-info">👤 Username: ${user.username}</div>
                <div class="user-info">🏢 Departamento: ${getDepartmentName(user.defaultDepartment || 'N/A')}</div>
                <div class="user-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

function promoteToAdmin(username) {
    if (!isUserAdmin()) {
        showAlert('Erro', 'Apenas administradores podem promover utilizadores.');
        return;
    }
    
    showConfirm('Promover a Admin', `Tem certeza que deseja promover "${username}" a Administrador?`, function() {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex !== -1) {
            users[userIndex].isAdmin = true;
            saveUsers(users);
            
            showAlert('Sucesso', `${username} foi promovido a Administrador!`);
            loadUsersList();
        }
    });
}

function demoteFromAdmin(username) {
    if (!isUserAdmin()) {
        showAlert('Erro', 'Apenas administradores podem remover privilégios.');
        return;
    }
    
    showConfirm('Remover Admin', `Tem certeza que deseja remover privilégios de administrador de "${username}"?`, function() {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex !== -1) {
            users[userIndex].isAdmin = false;
            saveUsers(users);
            
            showAlert('Sucesso', `Privilégios de administrador removidos de ${username}.`);
            loadUsersList();
        }
    });
}

function populateGlobalUserFilter() {
    if (!isUserAdmin()) return;
    
    const select = document.getElementById('globalUserFilter');
    if (!select) return;
    
    const users = getUsers();
    
    select.innerHTML = '<option value="all">Todos os Utilizadores</option>';
    users.forEach(user => {
        select.innerHTML += `<option value="${user.username}">${user.firstName} ${user.lastName}</option>`;
    });
}

function updateGlobalHistory() {
    if (!isUserAdmin()) return;
    
    const userFilter = document.getElementById('globalUserFilter').value;
    const typeFilter = document.getElementById('globalTypeFilter').value;
    const departmentFilter = document.getElementById('globalDepartmentFilter').value;
    
    const allHistory = getAllUsersHistory();
    
    const departmentFilterSection = document.getElementById('globalDepartmentFilterSection');
    if (typeFilter === 'project') {
        departmentFilterSection.classList.remove('hidden');
    } else {
        departmentFilterSection.classList.add('hidden');
    }
    
    let filteredHistory = allHistory;
    
    if (userFilter !== 'all') {
        filteredHistory = filteredHistory.filter(s => {
            const username = s.userName.toLowerCase().includes(userFilter) || 
                           (s.userName.includes(userFilter));
            const users = getUsers();
            const user = users.find(u => `${u.firstName} ${u.lastName}` === s.userName);
            return user && user.username === userFilter;
        });
    }
    
    if (typeFilter === 'project') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'project');
        
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.projectType === departmentFilter);
        }
    } else if (typeFilter === 'internal') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'internal');
    }
    
    const projectSeconds = filteredHistory
        .filter(s => s.workType === 'project')
        .reduce((sum, s) => sum + s.duration, 0);
    
    const internalSeconds = filteredHistory
        .filter(s => s.workType === 'internal')
        .reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('globalTotalProjectHours').textContent = formatHours(projectSeconds);
    document.getElementById('globalTotalInternalHours').textContent = formatHours(internalSeconds);
    
    const container = document.getElementById('globalHistoryList');
    
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados para mostrar</p>';
        return;
    }
    
    container.innerHTML = filteredHistory.slice(0, 50).map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        const commentHtml = session.comment ? 
            `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        
        let badgesHtml = '';
        if (session.workType === 'internal') {
            badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>';
        }
        if (session.manualEntry) {
            badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>';
        }
        if (session.manualEdit) {
            badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>';
        }
        
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
            const workNameHtml = session.workName ? 
                `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : 
                `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? 
                `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        
        return `
            <div class="${itemClass}">
                <div class="hist-user">👤 ${session.userName}</div>
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
            </div>
        `;
    }).join('');
}


function updateCompanyStats() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const allHistory = getAllUsersHistory();
    const allProjects = getAllUsersProjects();
    
    const totalHours = allHistory.reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('companyTotalUsers').textContent = users.length;
    document.getElementById('companyTotalProjects').textContent = allProjects.length;
    document.getElementById('companyTotalSessions').textContent = allHistory.length;
    document.getElementById('companyTotalHours').textContent = formatHours(totalHours);
    
    const deptProjeto = allHistory.filter(s => s.projectType === 'projeto').reduce((sum, s) => sum + s.duration, 0);
    const deptEletrico = allHistory.filter(s => s.projectType === 'eletrico').reduce((sum, s) => sum + s.duration, 0);
    const deptDesenvolvimento = allHistory.filter(s => s.projectType === 'desenvolvimento').reduce((sum, s) => sum + s.duration, 0);
    const deptOrcamentacao = allHistory.filter(s => s.projectType === 'orcamentacao').reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('deptProjetoHours').textContent = formatHours(deptProjeto);
    document.getElementById('deptEletricoHours').textContent = formatHours(deptEletrico);
    document.getElementById('deptDesenvolvimentoHours').textContent = formatHours(deptDesenvolvimento);
    document.getElementById('deptOrcamentacaoHours').textContent = formatHours(deptOrcamentacao);
    
    const internalReuniao = allHistory.filter(s => s.internalCategory === 'reuniao').reduce((sum, s) => sum + s.duration, 0);
    const internalFormacao = allHistory.filter(s => s.internalCategory === 'formacao').reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('internalReuniaoHours').textContent = formatHours(internalReuniao);
    document.getElementById('internalFormacaoHours').textContent = formatHours(internalFormacao);
    
    let totalReopens = 0;
    let clientChangeReopens = 0;
    let ourErrorReopens = 0;
    const projectsWithReopens = [];
    
    allProjects.forEach(project => {
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            const reopenCount = project.reopenHistory.length;
            totalReopens += reopenCount;
            
            project.reopenHistory.forEach(reopen => {
                if (reopen.reason === 'client_change') {
                    clientChangeReopens++;
                } else if (reopen.reason === 'our_error') {
                    ourErrorReopens++;
                }
            });
            
            projectsWithReopens.push({
                workCode: project.workCode,
                name: project.name,
                reopenCount: reopenCount,
                history: project.reopenHistory
            });
        }
    });
    
    const reopenPercentage = allProjects.length > 0 ? ((projectsWithReopens.length / allProjects.length) * 100).toFixed(1) : 0;
    
    document.getElementById('totalReopens').textContent = totalReopens;
    document.getElementById('clientChangeReopens').textContent = clientChangeReopens;
    document.getElementById('ourErrorReopens').textContent = ourErrorReopens;
    document.getElementById('reopenPercentage').textContent = `${reopenPercentage}%`;

    const reopenContainer = document.getElementById('reopenDetailsBreakdown');
    if (projectsWithReopens.length === 0) {
        reopenContainer.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Nenhuma obra foi reaberta</p>';
    } else {
        reopenContainer.innerHTML = projectsWithReopens.sort((a, b) => b.reopenCount - a.reopenCount).map(project => {
            const reopensHtml = project.history.map(reopen => {
                const date = new Date(reopen.date);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                const reasonText = reopen.reason === 'client_change' ? '🟡 Alteração do Cliente' : '🔴 Erro Nosso';
                const reasonColor = reopen.reason === 'client_change' ? '#f39c12' : '#e74c3c';
                return `<div style="font-size: 12px; margin: 3px 0; padding-left: 10px;">
                    <span style="color: ${reasonColor}; font-weight: 600;">${reasonText}</span> - ${dateStr}
                    ${reopen.comment ? `<br><em style="color: #6c757d; padding-left: 10px;">"${reopen.comment}"</em>` : ''}
                </div>`;
            }).join('');
            
            return `
                <div class="history-item">
                    <div class="hist-project">📋 ${project.workCode} - ${project.name} <span class="hist-badge badge-edited">${project.reopenCount}x reabertas</span></div>
                    ${reopensHtml}
                </div>
            `;
        }).join('');
    }
    
    const userStats = users.map(user => {
        const userHistory = allHistory.filter(s => {
            const fullName = `${user.firstName} ${user.lastName}`;
            return s.userName === fullName;
        });
        
        const totalSeconds = userHistory.reduce((sum, s) => sum + s.duration, 0);
        const projectSeconds = userHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
        const internalSeconds = userHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
        
        return {
            name: `${user.firstName} ${user.lastName}`,
            username: user.username,
            isAdmin: user.isAdmin,
            totalHours: formatHours(totalSeconds),
            projectHours: formatHours(projectSeconds),
            internalHours: formatHours(internalSeconds),
            sessions: userHistory.length
        };
    }).sort((a, b) => {
        const aHours = parseFloat(a.totalHours);
        const bHours = parseFloat(b.totalHours);
        return bHours - aHours;
    });
    
    const container = document.getElementById('userStatsBreakdown');
    
    if (userStats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados de utilizadores</p>';
        return;
    }
    
    container.innerHTML = userStats.map(stat => {
        const adminBadge = stat.isAdmin ? '<span class="hist-badge" style="background: var(--admin-color); color: white;">👑 ADMIN</span>' : '';
        
        return `
            <div class="history-item">
                <div class="hist-project">👤 ${stat.name} ${adminBadge}</div>
                <div class="hist-obra">📊 Total: ${stat.totalHours} | 🏢 Projeto: ${stat.projectHours} | 🏠 Interno: ${stat.internalHours}</div>
                <div class="hist-date">📝 ${stat.sessions} sessões registadas</div>
            </div>
        `;
    }).join('');
}

function setupAdminUI() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    if (user && user.isAdmin) {
        const header = document.getElementById('mainHeader');
        if (header) {
            header.classList.add('admin');
        }
        
        const adminBadge = document.getElementById('adminBadge');
        if (adminBadge) {
            adminBadge.classList.remove('hidden');
        }
        
        const adminTabs = document.querySelectorAll('.admin-tab');
        adminTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.remove('hidden');
        }
        
        populateGlobalUserFilter();
    } else {
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.add('hidden');
        }
    }
}

window.addEventListener('load', () => {
    initializeDefaultAdmin();
});
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
        
        // Mostrar os sub-tabs de admin na Gestão
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.remove('hidden');
        }
        
        populateGlobalUserFilter();
        populateTeamUserFilter();
    } else {
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.add('hidden');
        }
        
        // Esconder os sub-tabs de admin na Gestão
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.add('hidden'));
    }
}

// ============================================
// FUNÇÕES PARA HORAS DA EQUIPA
// ============================================

function populateTeamUserFilter() {
    if (!isUserAdmin()) return;
    
    const select = document.getElementById('teamUserFilter');
    if (!select) return;
    
    const users = getUsers();
    
    select.innerHTML = '<option value="all">Todos os Utilizadores</option>';
    users.forEach(user => {
        select.innerHTML += `<option value="${user.username}">${user.firstName} ${user.lastName}</option>`;
    });
}

function getTeamHoursFilters() {
    const userFilter = document.getElementById('teamUserFilter')?.value || 'all';
    const periodFilter = document.getElementById('teamPeriodFilter')?.value || 'week';
    const workTypeFilter = document.getElementById('teamWorkTypeFilter')?.value || 'all';
    const departmentFilter = document.getElementById('teamDepartmentFilter')?.value || 'all';
    const dateFrom = document.getElementById('teamDateFrom')?.value || '';
    const dateTo = document.getElementById('teamDateTo')?.value || '';
    
    // Calcular datas baseado no período
    const now = new Date();
    let startDate, endDate;
    
    switch(periodFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            startDate = dateFrom ? new Date(dateFrom) : new Date(0);
            endDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();
            break;
    }
    
    return {
        userFilter,
        periodFilter,
        workTypeFilter,
        departmentFilter,
        startDate,
        endDate
    };
}

function toggleCustomDateFields() {
    const periodFilter = document.getElementById('teamPeriodFilter')?.value || 'week';
    const fromGroup = document.getElementById('teamCustomDateGroup');
    const toGroup = document.getElementById('teamCustomDateToGroup');
    
    if (periodFilter === 'custom') {
        if (fromGroup) fromGroup.style.display = 'flex';
        if (toGroup) toGroup.style.display = 'flex';
    } else {
        if (fromGroup) fromGroup.style.display = 'none';
        if (toGroup) toGroup.style.display = 'none';
    }
}

function updateTeamHoursView() {
    if (!isUserAdmin()) return;
    
    toggleCustomDateFields();
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    // Filtrar histórico
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        // Filtro de data
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        // Filtro de utilizador
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        // Filtro de tipo de trabalho
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        // Filtro de departamento (só para trabalho de projeto)
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    // Calcular totais
    const totalSeconds = filteredHistory.reduce((sum, s) => sum + s.duration, 0);
    const projectSeconds = filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
    const internalSeconds = filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
    
    // Atualizar cards de resumo
    document.getElementById('teamTotalHours').textContent = formatHoursMinutes(totalSeconds);
    document.getElementById('teamProjectHours').textContent = formatHoursMinutes(projectSeconds);
    document.getElementById('teamInternalHours').textContent = formatHoursMinutes(internalSeconds);
    document.getElementById('teamSessionCount').textContent = filteredHistory.length;
    
    // Agrupar por utilizador
    const userStats = {};
    filteredHistory.forEach(session => {
        const userName = session.userName;
        if (!userStats[userName]) {
            userStats[userName] = {
                name: userName,
                total: 0,
                project: 0,
                internal: 0,
                sessions: 0,
                isAdmin: false
            };
            
            // Verificar se é admin
            const user = users.find(u => `${u.firstName} ${u.lastName}` === userName);
            if (user) {
                userStats[userName].isAdmin = user.isAdmin;
                userStats[userName].username = user.username;
            }
        }
        
        userStats[userName].total += session.duration;
        userStats[userName].sessions++;
        
        if (session.workType === 'project') {
            userStats[userName].project += session.duration;
        } else {
            userStats[userName].internal += session.duration;
        }
    });
    
    // Converter para array e ordenar
    const userStatsArray = Object.values(userStats).sort((a, b) => b.total - a.total);
    
    // Renderizar tabela de utilizadores
    renderTeamHoursTable(userStatsArray);
    
    // Renderizar lista de sessões
    renderTeamSessionsList(filteredHistory);
}

function renderTeamHoursTable(userStats) {
    const container = document.getElementById('teamHoursTable');
    if (!container) return;
    
    if (userStats.length === 0) {
        container.innerHTML = `
            <div class="empty-team-data">
                <div class="empty-icon">📊</div>
                <p>Sem dados para o período selecionado</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="team-hours-row header">
            <div>Utilizador</div>
            <div style="text-align: center;">🏢 Projeto</div>
            <div style="text-align: center;">🏠 Interno</div>
            <div style="text-align: center;">⏱️ Total</div>
            <div style="text-align: center;">📝 Sessões</div>
        </div>
    `;
    
    userStats.forEach(stat => {
        const initials = stat.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const adminClass = stat.isAdmin ? 'admin' : '';
        
        html += `
            <div class="team-hours-row expandable" onclick="toggleUserDetails('${stat.username || stat.name}')">
                <div class="user-name-col">
                    <div class="user-avatar ${adminClass}">${initials}</div>
                    <span>${stat.name}</span>
                    ${stat.isAdmin ? '<span class="hist-badge" style="background: var(--admin-color); color: white; font-size: 10px; padding: 2px 6px; margin-left: 8px;">ADMIN</span>' : ''}
                </div>
                <div class="hours-col project">${formatHoursMinutes(stat.project)}</div>
                <div class="hours-col internal">${formatHoursMinutes(stat.internal)}</div>
                <div class="hours-col total">${formatHoursMinutes(stat.total)}</div>
                <div class="sessions-col">${stat.sessions}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function toggleUserDetails(userId) {
    // Funcionalidade para expandir detalhes do utilizador
    // Pode ser implementado para mostrar breakdown por departamento/obra
    console.log('Toggle details for:', userId);
}

function renderTeamSessionsList(sessions) {
    const container = document.getElementById('teamSessionsList');
    if (!container) return;
    
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-team-data">
                <div class="empty-icon">📋</div>
                <p>Sem sessões para o período selecionado</p>
            </div>
        `;
        return;
    }
    
    // Limitar a 100 sessões para performance
    const displaySessions = sessions.slice(0, 100);
    
    container.innerHTML = displaySessions.map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        const commentHtml = session.comment ? 
            `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        
        let badgesHtml = '';
        if (session.workType === 'internal') {
            badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>';
        }
        if (session.manualEntry) {
            badgesHtml += '<span class="hist-badge badge-manual">📝 Manual</span>';
        }
        if (session.manualEdit) {
            badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado</span>';
        }
        
        let mainInfo = '';
        let subInfo = '';
        
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
        } else {
            mainInfo = session.projectName || 'Projeto';
            const workNameHtml = session.workName ? 
                `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : 
                `<div class="hist-obra">📋 ${session.workCode || ''}</div>`;
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
    
    if (sessions.length > 100) {
        container.innerHTML += `
            <div class="info-panel" style="margin-top: 15px; text-align: center;">
                <p style="color: #6c757d; font-size: 12px;">
                    A mostrar as primeiras 100 de ${sessions.length} sessões. 
                    Exporte para CSV para ver todas.
                </p>
            </div>
        `;
    }
}

function formatHoursMinutes(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// ============================================
// FUNÇÕES DE EXPORTAÇÃO DA EQUIPA
// ============================================

function exportTeamHoursCSV() {
    if (!isUserAdmin()) return;
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    // Aplicar os mesmos filtros
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    // Criar CSV
    let csv = 'Utilizador,Data,Hora Início,Hora Fim,Duração (h),Tipo,Departamento,Código Obra,Nome Obra,Subcategoria,Descrição,Comentário\n';
    
    filteredHistory.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        
        const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`;
        const startTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        const durationHours = (session.duration / 3600).toFixed(2);
        
        const tipo = session.workType === 'internal' ? 'Interno' : 'Projeto';
        const departamento = session.workType === 'project' ? (getDepartmentName(session.projectType) || '') : '';
        const codigoObra = session.workCode || '';
        const nomeObra = session.workName || '';
        const subcategoria = session.subcategory || '';
        const descricao = session.workType === 'internal' ? (session.internalDescription || '') : '';
        const comentario = session.comment || '';
        
        csv += `"${session.userName}","${dateStr}","${startTimeStr}","${endTimeStr}","${durationHours}","${tipo}","${departamento}","${codigoObra}","${nomeObra}","${subcategoria}","${descricao}","${comentario}"\n`;
    });
    
    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const periodLabel = filters.periodFilter === 'custom' ? 'personalizado' : filters.periodFilter;
    link.download = `horas_equipa_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportTeamHoursJSON() {
    if (!isUserAdmin()) return;
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    const exportData = {
        exportDate: new Date().toISOString(),
        filters: {
            user: filters.userFilter,
            period: filters.periodFilter,
            workType: filters.workTypeFilter,
            department: filters.departmentFilter,
            startDate: filters.startDate.toISOString(),
            endDate: filters.endDate.toISOString()
        },
        summary: {
            totalSessions: filteredHistory.length,
            totalHours: (filteredHistory.reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2),
            projectHours: (filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2),
            internalHours: (filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2)
        },
        sessions: filteredHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const periodLabel = filters.periodFilter === 'custom' ? 'personalizado' : filters.periodFilter;
    link.download = `horas_equipa_${periodLabel}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

// ============================================
// FUNÇÕES PARA GESTÃO DE UTILIZADORES
// ============================================

function loadAdminUsersList() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const allHistory = getAllUsersHistory();
    const container = document.getElementById('adminUsersList');
    
    if (!container) return;
    
    // Atualizar estatísticas
    const adminCount = users.filter(u => u.isAdmin).length;
    const regularCount = users.length - adminCount;
    
    document.getElementById('totalUsersCount').textContent = users.length;
    document.getElementById('adminUsersCount').textContent = adminCount;
    document.getElementById('regularUsersCount').textContent = regularCount;
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem utilizadores registados</p>';
        return;
    }
    
    // Calcular estatísticas por utilizador
    const userStatsMap = {};
    allHistory.forEach(session => {
        const userName = session.userName;
        if (!userStatsMap[userName]) {
            userStatsMap[userName] = { total: 0, project: 0, internal: 0, sessions: 0 };
        }
        userStatsMap[userName].total += session.duration;
        userStatsMap[userName].sessions++;
        if (session.workType === 'project') {
            userStatsMap[userName].project += session.duration;
        } else {
            userStatsMap[userName].internal += session.duration;
        }
    });
    
    container.innerHTML = users.map(user => {
        const cardClass = user.isAdmin ? 'user-card admin-user' : 'user-card';
        const badgeHtml = user.isAdmin ? '<div class="user-badge">👑 ADMIN</div>' : '';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const isSelf = currentUser.username === user.username;
        
        const fullName = `${user.firstName} ${user.lastName}`;
        const stats = userStatsMap[fullName] || { total: 0, project: 0, internal: 0, sessions: 0 };
        
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
                    <div class="user-name">${fullName}</div>
                    ${badgeHtml}
                </div>
                <div class="user-info">👤 Username: ${user.username}</div>
                <div class="user-info">🏢 Departamento: ${getDepartmentName(user.defaultDepartment || 'N/A')}</div>
                <div class="user-stats">
                    <div class="user-stat">
                        <div class="user-stat-value">${formatHoursMinutes(stats.total)}</div>
                        <div class="user-stat-label">Total Horas</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value" style="color: var(--secondary-color);">${formatHoursMinutes(stats.project)}</div>
                        <div class="user-stat-label">🏢 Projeto</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value" style="color: var(--internal-color);">${formatHoursMinutes(stats.internal)}</div>
                        <div class="user-stat-label">🏠 Interno</div>
                    </div>
                </div>
                <div class="user-info">📝 ${stats.sessions} sessões registadas</div>
                <div class="user-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

window.addEventListener('load', () => {
    initializeDefaultAdmin();
});
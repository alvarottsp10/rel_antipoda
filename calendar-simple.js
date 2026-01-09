// ============================================
// CALENDAR-SIMPLE.JS - Calendário Anual Simples
// ============================================

// Feriados fixos portugueses 2026
const HOLIDAYS_2026 = {
    '2026-01-01': 'Ano Novo',
    '2026-04-03': 'Sexta-feira Santa',
    '2026-04-05': 'Domingo de Páscoa',
    '2026-04-25': 'Dia da Liberdade',
    '2026-05-01': 'Dia do Trabalhador',
    '2026-06-04': 'Corpo de Deus',
    '2026-06-10': 'Dia de Portugal',
    '2026-08-15': 'Assunção de Nossa Senhora',
    '2026-10-05': 'Implantação da República',
    '2026-11-01': 'Dia de Todos os Santos',
    '2026-12-01': 'Restauração da Independência',
    '2026-12-08': 'Imaculada Conceição',
    '2026-12-25': 'Natal'
};

let currentYear = 2026;

// Obter dados do calendário do utilizador
function getCalendarData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `calendar_${currentYear}_${user.username}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
}

// Guardar dados do calendário
function saveCalendarData(data) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `calendar_${currentYear}_${user.username}`;
    localStorage.setItem(key, JSON.stringify(data));
}

// Formatar data para chave (YYYY-MM-DD)
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Verificar se é fim de semana (apenas Domingo - Sábado é dia útil)
function isWeekend(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0; // Apenas domingo
}

// Verificar se é feriado
function isHoliday(dateStr) {
    return HOLIDAYS_2026[dateStr] || null;
}

// Verificar se trabalhou neste dia
function hasWorkedOnDay(dateStr) {
    const history = getWorkHistory();
    return history.some(session => {
        const sessionDate = new Date(session.startTime);
        return formatDateKey(sessionDate) === dateStr;
    });
}

// Obter tipo e cor do dia
function getDayInfo(dateStr) {
    const calendarData = getCalendarData();
    const date = new Date(dateStr + 'T00:00:00');
    
    // 1. Verificar marcação manual
    if (calendarData[dateStr]) {
        const entry = calendarData[dateStr];
        if (entry.type === 'vacation') {
            return { type: 'vacation', color: 'vacation', icon: '🏖️', note: entry.note };
        }
        if (entry.type === 'absence') {
            return { type: 'absence', color: 'absence', icon: '❌', note: entry.note };
        }
    }
    
    // 2. Verificar feriado
    const holiday = isHoliday(dateStr);
    if (holiday) {
        return { type: 'holiday', color: 'holiday', icon: '🎉', note: holiday };
    }
    
    // 3. Verificar fim de semana
    if (isWeekend(date)) {
        return { type: 'weekend', color: 'weekend', icon: '🏠', note: '' };
    }
    
    // 4. Verificar se trabalhou
    if (hasWorkedOnDay(dateStr)) {
        return { type: 'worked', color: 'worked', icon: '💼', note: '' };
    }
    
    // 5. Dia normal sem informação
    return { type: 'empty', color: 'empty', icon: '', note: '' };
}

// Renderizar calendário anual
function renderAnnualCalendar(year) {
    currentYear = year;
    const container = document.getElementById('annualCalendarGrid');
    if (!container) return;
    
    container.innerHTML = '';
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    months.forEach((monthName, monthIndex) => {
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';
        
        // Header do mês
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';
        monthHeader.textContent = monthName;
        monthCard.appendChild(monthHeader);
        
        // Grid de dias da semana
        const daysHeader = document.createElement('div');
        daysHeader.className = 'month-days-header';
        ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.textContent = day;
            daysHeader.appendChild(dayEl);
        });
        monthCard.appendChild(daysHeader);
        
        // Grid de dias do mês
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';
        
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Dias vazios antes do início do mês
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'month-day empty';
            daysGrid.appendChild(emptyDay);
        }
        
        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, monthIndex, day);
            const dateStr = formatDateKey(date);
            const dayInfo = getDayInfo(dateStr);
            
            const dayEl = document.createElement('div');
            dayEl.className = `month-day day-${dayInfo.color}`;
            dayEl.textContent = day;
            
            // Marcar dia atual
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayEl.classList.add('today');
            }
            
            // Adicionar ícone se tiver
            if (dayInfo.icon) {
                const icon = document.createElement('div');
                icon.className = 'day-icon-mini';
                icon.textContent = dayInfo.icon;
                dayEl.appendChild(icon);
            }
            
            // Adicionar evento de clique
            dayEl.onclick = () => openDayModal(dateStr, dayInfo);
            
            daysGrid.appendChild(dayEl);
        }
        
        monthCard.appendChild(daysGrid);
        container.appendChild(monthCard);
    });
    
    // Atualizar estatísticas
    updateAnnualStats();
}

// Abrir modal de detalhes do dia
function openDayModal(dateStr, dayInfo) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
    const dayNum = date.getDate();
    const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][date.getMonth()];
    
    document.getElementById('modalDayDate').textContent = `${dayName}, ${dayNum} de ${monthName} de ${currentYear}`;
    
    const contentDiv = document.getElementById('modalDayContent');
    let statusHtml = '';
    
    if (dayInfo.type === 'vacation') {
        statusHtml = `
            <div class="day-status vacation-status">
                <span class="status-icon">🏖️</span>
                <span class="status-text">Férias</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
            <button class="btn btn-danger btn-small" onclick="clearDayMarking('${dateStr}')">🗑️ Limpar</button>
        `;
    } else if (dayInfo.type === 'absence') {
        statusHtml = `
            <div class="day-status absence-status">
                <span class="status-icon">❌</span>
                <span class="status-text">Falta</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
            <button class="btn btn-danger btn-small" onclick="clearDayMarking('${dateStr}')">🗑️ Limpar</button>
        `;
    } else if (dayInfo.type === 'holiday') {
        statusHtml = `
            <div class="day-status holiday-status">
                <span class="status-icon">🎉</span>
                <span class="status-text">Feriado</span>
            </div>
            <div class="day-note">📅 ${dayInfo.note}</div>
        `;
    } else if (dayInfo.type === 'weekend') {
        statusHtml = `
            <div class="day-status weekend-status">
                <span class="status-icon">🏠</span>
                <span class="status-text">Fim de Semana</span>
            </div>
        `;
    } else if (dayInfo.type === 'worked') {
        statusHtml = `
            <div class="day-status worked-status">
                <span class="status-icon">💼</span>
                <span class="status-text">Dia Trabalhado</span>
            </div>
            <p style="font-size: 12px; color: #6c757d; margin: 15px 0;">Este dia foi registado automaticamente pelo sistema com base no seu histórico de trabalho.</p>
            <div class="day-actions">
                <button class="btn btn-warning btn-small" onclick="closeDayModal(); markAsVacation('${dateStr}')">🏖️ Marcar Férias</button>
                <button class="btn btn-danger btn-small" onclick="closeDayModal(); markAsAbsence('${dateStr}')">❌ Marcar Falta</button>
            </div>
        `;
    } else {
        statusHtml = `
            <div class="day-status empty-status">
                <span class="status-icon">📅</span>
                <span class="status-text">Sem Registo</span>
            </div>
            <p style="font-size: 12px; color: #6c757d; margin: 15px 0;">Este dia não tem informação registada.</p>
            <div class="day-actions">
                <button class="btn btn-warning btn-small" onclick="closeDayModal(); markAsVacation('${dateStr}')">🏖️ Marcar Férias</button>
                <button class="btn btn-danger btn-small" onclick="closeDayModal(); markAsAbsence('${dateStr}')">❌ Marcar Falta</button>
            </div>
        `;
    }
    
    contentDiv.innerHTML = statusHtml;
    document.getElementById('dayModal').classList.add('show');
}

// Fechar modal do dia
function closeDayModal() {
    document.getElementById('dayModal').classList.remove('show');
}

// Limpar marcação do dia
function clearDayMarking(dateStr) {
    showConfirm('Limpar Marcação', 'Tem certeza que deseja remover esta marcação?', function() {
        const calendarData = getCalendarData();
        delete calendarData[dateStr];
        saveCalendarData(calendarData);
        closeDayModal();
        renderAnnualCalendar(currentYear);
        showAlert('Sucesso', 'Marcação removida com sucesso!');
    });
}

// Marcar como férias (dia único)
function markAsVacation(dateStr) {
    document.getElementById('singleVacationDate').value = dateStr;
    document.getElementById('singleVacationNote').value = '';
    document.getElementById('singleVacationModal').classList.add('show');
}

// Confirmar férias dia único
function confirmSingleVacation() {
    const dateStr = document.getElementById('singleVacationDate').value;
    const note = document.getElementById('singleVacationNote').value.trim();
    
    const calendarData = getCalendarData();
    calendarData[dateStr] = {
        type: 'vacation',
        note: note,
        markedAt: new Date().toISOString()
    };
    saveCalendarData(calendarData);
    
    closeSingleVacationModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', 'Férias marcadas com sucesso!');
}

// Fechar modal de férias únicas
function closeSingleVacationModal() {
    document.getElementById('singleVacationModal').classList.remove('show');
}

// Marcar como falta (dia único)
function markAsAbsence(dateStr) {
    document.getElementById('singleAbsenceDate').value = dateStr;
    document.getElementById('singleAbsenceNote').value = '';
    document.getElementById('absenceError').classList.add('hidden');
    document.getElementById('singleAbsenceModal').classList.add('show');
}

// Confirmar falta dia único
function confirmSingleAbsence() {
    const dateStr = document.getElementById('singleAbsenceDate').value;
    const note = document.getElementById('singleAbsenceNote').value.trim();
    const errorDiv = document.getElementById('absenceError');
    
    if (!note) {
        errorDiv.textContent = '⚠️ O motivo da falta é obrigatório.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const calendarData = getCalendarData();
    calendarData[dateStr] = {
        type: 'absence',
        note: note,
        markedAt: new Date().toISOString()
    };
    saveCalendarData(calendarData);
    
    closeSingleAbsenceModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', 'Falta marcada com sucesso!');
}

// Fechar modal de falta única
function closeSingleAbsenceModal() {
    document.getElementById('singleAbsenceModal').classList.remove('show');
}

// Abrir modal de marcar período de férias
function openVacationPeriodModal() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('vacationStartDate').value = formatDateKey(tomorrow);
    document.getElementById('vacationEndDate').value = formatDateKey(tomorrow);
    document.getElementById('vacationPeriodNote').value = '';
    updateVacationDaysCount();
    document.getElementById('vacationPeriodModal').classList.add('show');
}

// Fechar modal de período de férias
function closeVacationPeriodModal() {
    document.getElementById('vacationPeriodModal').classList.remove('show');
}

// Atualizar contagem de dias de férias
function updateVacationDaysCount() {
    const startDateStr = document.getElementById('vacationStartDate').value;
    const endDateStr = document.getElementById('vacationEndDate').value;
    
    if (!startDateStr || !endDateStr) {
        document.getElementById('vacationDaysCount').textContent = '0 dias';
        return;
    }
    
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    
    if (endDate < startDate) {
        document.getElementById('vacationDaysCount').textContent = '0 dias';
        return;
    }
    
    let count = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateStr = formatDateKey(currentDate);
        // Contar apenas dias úteis (não domingos nem feriados)
        if (!isWeekend(currentDate) && !isHoliday(dateStr)) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    document.getElementById('vacationDaysCount').textContent = `${count} dia${count !== 1 ? 's' : ''} útei${count !== 1 ? 's' : ''}`;
}

// Confirmar período de férias
function confirmVacationPeriod() {
    const startDateStr = document.getElementById('vacationStartDate').value;
    const endDateStr = document.getElementById('vacationEndDate').value;
    const note = document.getElementById('vacationPeriodNote').value.trim();
    
    if (!startDateStr || !endDateStr) {
        showAlert('Erro', 'Por favor, preencha as datas de início e fim.');
        return;
    }
    
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    
    if (endDate < startDate) {
        showAlert('Erro', 'A data de fim deve ser posterior à data de início.');
        return;
    }
    
    const calendarData = getCalendarData();
    const currentDate = new Date(startDate);
    let markedCount = 0;
    
    while (currentDate <= endDate) {
        const dateStr = formatDateKey(currentDate);
        // Marcar apenas dias úteis
        if (!isWeekend(currentDate) && !isHoliday(dateStr)) {
            calendarData[dateStr] = {
                type: 'vacation',
                note: note,
                markedAt: new Date().toISOString()
            };
            markedCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    saveCalendarData(calendarData);
    closeVacationPeriodModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', `${markedCount} dia${markedCount !== 1 ? 's' : ''} de férias marcado${markedCount !== 1 ? 's' : ''}!`);
}

// Atualizar estatísticas anuais
function updateAnnualStats() {
    let workedDays = 0;
    let vacationDays = 0;
    let absenceDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;
    
    for (let month = 0; month < 12; month++) {
        const lastDay = new Date(currentYear, month + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(currentYear, month, day);
            const dateStr = formatDateKey(date);
            const dayInfo = getDayInfo(dateStr);
            
            switch(dayInfo.type) {
                case 'worked': workedDays++; break;
                case 'vacation': vacationDays++; break;
                case 'absence': absenceDays++; break;
                case 'holiday': holidayDays++; break;
                case 'weekend': weekendDays++; break;
            }
        }
    }
    
    const totalDays = 365 + (currentYear % 4 === 0 ? 1 : 0); // Ano bissexto
    const remainingDays = totalDays - workedDays - vacationDays - absenceDays - holidayDays - weekendDays;
    
    document.getElementById('statWorkedDays').textContent = workedDays;
    document.getElementById('statVacationDays').textContent = vacationDays;
    document.getElementById('statAbsenceDays').textContent = absenceDays;
    document.getElementById('statHolidayDays').textContent = holidayDays;
    document.getElementById('statWeekendDays').textContent = weekendDays;
    document.getElementById('statRemainingDays').textContent = remainingDays;
}

// Mudar ano
function changeYear(delta) {
    const todayYear = new Date().getFullYear();
    const newYear = currentYear + delta;
    
    // Não permitir voltar para anos anteriores ao ano atual
    if (newYear < todayYear) {
        return;
    }
    
    currentYear = newYear;
    document.getElementById('currentYearDisplay').textContent = currentYear;
    renderAnnualCalendar(currentYear);
}

// Ir para ano atual
function goToCurrentYear() {
    currentYear = new Date().getFullYear();
    document.getElementById('currentYearDisplay').textContent = currentYear;
    renderAnnualCalendar(currentYear);
}

// Inicializar calendário
function initializeAnnualCalendar() {
    currentYear = new Date().getFullYear();
    document.getElementById('currentYearDisplay').textContent = currentYear;
    renderAnnualCalendar(currentYear);
}
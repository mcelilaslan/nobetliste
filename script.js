let persons = [];
    let availabilityMode = true;
    let unavailableCells = {};
    let selectedCells = {};
    let collapsiblePersonel;
    let collapsibleCalendar;
    let statsCollapsible;
    let guideCollapsible;
    let validationErrors = [];
    let history = [];
    let historyIndex = -1;
    let isDragging = false;
    let dragStart = null;

    const defaultPersons = [];

    document.addEventListener('DOMContentLoaded', function() {
    M.AutoInit();
    collapsiblePersonel = M.Collapsible.init(document.querySelector('#personelCollapsible'), { accordion: false });
    collapsibleCalendar = M.Collapsible.init(document.querySelector('#calendarCollapsible'), {
        accordion: false,
        onOpenStart: function() {
            document.getElementById('calendarContainer').classList.add('expanded');
        },
        onCloseEnd: function() {
            document.getElementById('calendarContainer').classList.remove('expanded');
        }
    });
    statsCollapsible = M.Collapsible.init(document.querySelector('#statsCollapsible'), { accordion: false });
    guideCollapsible = M.Collapsible.init(document.querySelector('#guideCollapsible'), { accordion: false });

    const datepickers = document.querySelectorAll('.datepicker');
    M.Datepicker.init(datepickers, {
        format: 'dd-mm-yyyy',
        autoClose: true,
        firstDay: 1,
        i18n: {
            months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
            monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
            weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
            weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
            weekdaysAbbrev: ['P', 'P', 'S', 'Ç', 'P', 'C', 'C']
        },
        onOpen: function() {
            const instance = this;
            setTimeout(() => {
                const days = instance.el.parentElement.querySelectorAll('.datepicker-table th');
                days.forEach((day, index) => {
                    day.textContent = this.options.i18n.weekdaysShort[index];
                });
            }, 0);
        }
    });

    const startDatePicker = document.getElementById('startDate');
    const endDatePicker = document.getElementById('endDate');
    startDatePicker.addEventListener('change', function() {
        const startDate = M.Datepicker.getInstance(startDatePicker).date;
        if (startDate) {
            const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            const endDateInstance = M.Datepicker.getInstance(endDatePicker);
            endDateInstance.setDate(lastDay);
            endDatePicker.value = lastDay.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
            M.updateTextFields();
        }
        if (startDatePicker.value && endDatePicker.value && collapsiblePersonel) {
            collapsiblePersonel.open(0);
        }
    });

    endDatePicker.addEventListener('change', function() {
        if (startDatePicker.value && endDatePicker.value && collapsiblePersonel) {
            collapsiblePersonel.open(0);
        }
    });

    const personNameInput = document.getElementById('personName');
    if (personNameInput) {
        personNameInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                addPerson();
            }
        });
    }

    persons = [...defaultPersons];
    renderTable();

    var dropdowns = document.querySelectorAll('.dropdown-trigger');
    M.Dropdown.init(dropdowns, {
        coverTrigger: false,
        constrainWidth: false
    });
    
     // Modal başlatma kodu buraya ekleniyor
    const emailModal = M.Modal.init(document.getElementById('emailModal'));

    const csvUploadInput = document.getElementById('csvUpload');
    if (csvUploadInput) {
        csvUploadInput.removeEventListener('change', uploadPersonnel);
        csvUploadInput.addEventListener('change', uploadPersonnel);
    } else {
        console.error('csvUpload input elementi bulunamadı!');
    }
});

    function saveToHistory() {
        const currentState = {
            selectedCells: JSON.parse(JSON.stringify(selectedCells)),
            unavailableCells: JSON.parse(JSON.stringify(unavailableCells))
        };
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(currentState);
        historyIndex++;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            applyState(history[historyIndex]);
            updateCalendar();
            updateStatistics();
        }
        updateUndoRedoButtons();
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            applyState(history[historyIndex]);
            updateCalendar();
            updateStatistics();
        }
        updateUndoRedoButtons();
    }

    function applyState(state) {
        selectedCells = JSON.parse(JSON.stringify(state.selectedCells));
        unavailableCells = JSON.parse(JSON.stringify(state.unavailableCells));
    }

    function updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = historyIndex <= 0;
        document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
    }

    function addPerson() {
        const name = document.getElementById('personName').value.trim().toUpperCase();
        if (!name) return M.toast({html: 'Lütfen isim girin!'});
        if (persons.some(p => p.name === name)) return M.toast({html: 'Bu isim zaten var!'});

        persons.push({
            name: name,
            weekdayDuties: undefined,
            weekendDuties: undefined,
            minDaysBetween: 1
        });

        document.getElementById('personName').value = '';
        renderTable();
        if (collapsiblePersonel) collapsiblePersonel.open(0);
        M.toast({html: `${name} eklendi!`});
    }

    function deletePerson(index) {
        const name = persons[index].name;
        persons.splice(index, 1);
        renderTable();
        M.toast({html: `${name} silindi!`});
    }

    function incrementDutyGap(index) {
        persons[index].minDaysBetween++;
        renderTable();
    }

    function decrementDutyGap(index) {
        if (persons[index].minDaysBetween > 0) {
            persons[index].minDaysBetween--;
            renderTable();
        }
    }

    function incrementAllDutyGaps() {
        persons.forEach(p => p.minDaysBetween++);
        renderTable();
    }

    function decrementAllDutyGaps() {
        persons.forEach(p => { if (p.minDaysBetween > 0) p.minDaysBetween--; });
        renderTable();
    }

    function toggleAvailabilityMode() {
    const switchInput = document.getElementById('modeSwitch');
    availabilityMode = !switchInput.checked;
    }

    function renderTable() {
    const tableContainer = document.getElementById('personnelTableContainer');
    const noPersonnelMessage = document.getElementById('noPersonnelMessage');

    if (persons.length === 0) {
        // Personel yoksa: Tabloyu gizle, mesajı göster
        tableContainer.style.display = 'none';
        noPersonnelMessage.style.display = 'block';
    } else {
        // Personel varsa: Tabloyu göster, mesajı gizle, başlık ve içeriği ekle
        tableContainer.style.display = 'table';
        noPersonnelMessage.style.display = 'none';

        let html = `
            <thead>
                <tr>
                    <th>İsim</th>
                    <th>Hafta İçi</th>
                    <th>Hafta Sonu</th>
                    <th class="duty-gap-header">
                        Nöbet Ertesi Boşluk
                        <a class="btn-floating btn-small waves-effect waves-light teal decrement-btn" onclick="decrementAllDutyGaps()">
                            <i class="material-icons">arrow_downward</i>
                        </a>
                        <a class="btn-floating btn-small waves-effect waves-light teal increment-btn" onclick="incrementAllDutyGaps()">
                            <i class="material-icons">arrow_upward</i>
                        </a>
                    </th>
                    <th style="text-align: center;">Sil</th>
                </tr>
            </thead>
            <tbody id="personTable">
        `;

        persons.forEach((person, index) => {
            html += `
               <tr style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; background-color: #f9fafb; transition: background-color 0.2s;">
    <td style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; vertical-align: middle; line-height: 30px; padding: 0 8px; box-sizing: border-box; font-family: 'Arial', sans-serif; color: #374151;">
        ${person.name}
    </td>
    <td style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; vertical-align: middle; line-height: 30px; padding: 0 8px; box-sizing: border-box;">
        <input type="number" class="planning-input" min="0" 
            value="${person.weekdayDuties === undefined ? '' : person.weekdayDuties}" 
            onchange="updateDuty(${index}, 'weekdayDuties', this.value)"
            style="height: 24px; min-height: 24px; max-height: 24px; line-height: 24px; font-size: 13px; margin: 0; padding: 0 6px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; background-color: #ffffff; transition: border-color 0.2s; outline: none; overflow: hidden;">
    </td>
    <td style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; vertical-align: middle; line-height: 30px; padding: 0 8px; box-sizing: border-box;">
        <input type="number" class="planning-input" min="0" 
            value="${person.weekendDuties === undefined ? '' : person.weekendDuties}" 
            onchange="updateDuty(${index}, 'weekendDuties', this.value)"
            style="height: 24px; min-height: 24px; max-height: 24px; line-height: 24px; font-size: 13px; margin: 0; padding: 0 6px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; background-color: #ffffff; transition: border-color 0.2s; outline: none; overflow: hidden;">
    </td>
    <td class="duty-gap-cell" style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; vertical-align: middle; line-height: 30px; padding: 0 8px; box-sizing: border-box;">
        <span style="margin-right: 8px; font-size: 13px; line-height: 24px; height: 24px; display: inline-block; color: #4b5563;">${person.minDaysBetween}</span>
        <a class="btn-floating btn-small waves-effect waves-light" onclick="decrementDutyGap(${index})"
           style="width: 24px; height: 24px; min-height: 24px; max-height: 24px; line-height: 24px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #10b981; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
            <i class="material-icons" style="line-height: 24px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 24px; width: 24px; color: #ffffff;">arrow_downward</i>
        </a>
        <a class="btn-floating btn-small waves-effect waves-light" onclick="incrementDutyGap(${index})"
           style="width: 24px; height: 24px; min-height: 24px; max-height: 24px; line-height: 24px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #10b981; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
            <i class="material-icons" style="line-height: 24px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 24px; width: 24px; color: #ffffff;">arrow_upward</i>
        </a>
    </td>
    <td class="left-align" style="height: 30px; min-height: 30px; max-height: 30px; overflow: hidden; vertical-align: middle; line-height: 30px; padding: 0 8px; box-sizing: border-box;">
        <a class="btn-floating btn-small" onclick="deletePerson(${index})"
           style="width: 24px; height: 24px; min-height: 24px; max-height: 24px; line-height: 24px; font-size: 12px; margin: 0 4px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #ef4444; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: background-color 0.2s; overflow: hidden;">
            <i class="material-icons" style="line-height: 24px; font-size: 14px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 24px; width: 24px; color: #ffffff;">delete</i>
        </a>
    </td>
</tr>
            `;
        });

        html += `</tbody>`;
        tableContainer.innerHTML = html;
    }
}

    function updateDuty(index, type, value) {
        if (value === "" || value === null) {
            persons[index][type] = undefined;
        } else {
            persons[index][type] = parseInt(value) || 0;
        }
    }
    
    function resetDuties() {
    persons.forEach(person => {
        person.weekdayDuties = undefined;
        person.weekendDuties = undefined;
    });
    renderTable();
    if (collapsibleCalendar) collapsibleCalendar.close(0);
    document.getElementById('calendarTable').innerHTML = '';
    M.toast({html: 'Nöbet dağıtımı ve takvim sıfırlandı!'});
}

function generateCalendar() {
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    const dutyPerDayInput = document.getElementById('dutyPerDay').value.trim(); // Boşlukları temizle

    // Önce dutyPerDay kontrolü
    if (!dutyPerDayInput || dutyPerDayInput === "") {
        M.toast({ html: 'Kaçar kişinin nöbetçi olacağını belirleyiniz!' });
        return;
    }

    const dutyPerDay = parseInt(dutyPerDayInput); // Değeri integer'a çevir
    if (isNaN(dutyPerDay) || dutyPerDay < 1) {
        M.toast({ html: 'Lütfen geçerli bir sayı girin (1 veya daha fazla)!' });
        return;
    }

    // Tarih kontrolü
    if (!startInput || !endInput) {
        M.toast({ html: 'Lütfen tarih seçin!' });
        return;
    }

    const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
    const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const holidayInput = document.getElementById('holidays').value;
    const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

    selectedCells = {};
    history = [];
    historyIndex = -1;
    saveToHistory();

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const dates = [];
    let weekendDays = 0;
    let weekdayDays = 0;
    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
        dates.push({ date: date.toISOString(), isWeekend });
        if (isWeekend) weekendDays++;
        else weekdayDays++;
    }

    const totalDuties = days * dutyPerDay;
    const totalWeekendDuties = weekendDays * dutyPerDay;
    const totalWeekdayDuties = weekdayDays * dutyPerDay;

    let preplannedWeekendDuties = 0;
    let preplannedWeekdayDuties = 0;
    persons.forEach(person => {
        if (person.weekendDuties !== undefined) preplannedWeekendDuties += person.weekendDuties;
        if (person.weekdayDuties !== undefined) preplannedWeekdayDuties += person.weekdayDuties;
    });

    const adjustedTotalDuties = totalDuties - (preplannedWeekendDuties + preplannedWeekdayDuties);
    const adjustedWeekendDuties = totalWeekendDuties - preplannedWeekendDuties;
    const adjustedWeekdayDuties = totalWeekdayDuties - preplannedWeekdayDuties;

    const unplannedPersons = persons.filter(p => p.weekdayDuties === undefined && p.weekendDuties === undefined);
    const shuffledUnplanned = shuffleArray([...unplannedPersons]);
    const unplannedCount = unplannedPersons.length;

    const avgDutiesPerPerson = unplannedCount ? Math.floor(adjustedTotalDuties / unplannedCount) : 0;
    const extraTotalDuties = unplannedCount ? adjustedTotalDuties % unplannedCount : 0;
    const avgWeekendPerPerson = unplannedCount ? Math.floor(adjustedWeekendDuties / unplannedCount) : 0;
    const extraWeekendDuties = unplannedCount ? adjustedWeekendDuties % unplannedCount : 0;

    let personDutyAssignments = persons.map(person => {
        if (person.weekdayDuties !== undefined || person.weekendDuties !== undefined) {
            return {
                person,
                totalDuties: (person.weekdayDuties || 0) + (person.weekendDuties || 0),
                weekendDuties: person.weekendDuties || 0,
                weekdayDuties: person.weekdayDuties || 0
            };
        }
        return null;
    }).filter(p => p !== null);

    shuffledUnplanned.forEach((person, index) => {
        personDutyAssignments.push({
            person,
            totalDuties: avgDutiesPerPerson + (index < extraTotalDuties ? 1 : 0),
            weekendDuties: avgWeekendPerPerson + (index < extraWeekendDuties ? 1 : 0),
            weekdayDuties: 0
        });
    });

    personDutyAssignments.forEach(assignment => {
        if (assignment.person.weekdayDuties === undefined) {
            assignment.weekdayDuties = assignment.totalDuties - assignment.weekendDuties;
        }
    });

    personDutyAssignments.forEach(assignment => {
        const originalPerson = persons.find(p => p.name === assignment.person.name);
        originalPerson.weekdayDuties = assignment.weekdayDuties;
        originalPerson.weekendDuties = assignment.weekendDuties;
    });

    renderTable();

    let html = '<tr><th class="name-column">İsim</th>';
      const displayDates = [];
      for (let i = 0; i < days; i++) {
          const date = new Date(start);
          date.setDate(date.getDate() + i);
          displayDates.push(date);
          html += `<th>${date.getDate()}</th>`;
      }
      html += '</tr>';

    persons.forEach((person, pIndex) => {
        html += `<tr><td class="name-column">${person.name}</td>`;
        dates.forEach((dateObj, dIndex) => {
            const isWeekend = dateObj.isWeekend;
            const cellKey = `${pIndex}-${dIndex}`;
            const isUnavailable = unavailableCells[cellKey];
            const isSelected = selectedCells[cellKey];

            html += `
                <td class="calendar-cell 
                    ${isWeekend ? 'holiday' : ''} 
                    ${isUnavailable ? 'unavailable' : ''} 
                    ${isSelected ? 'selected' : ''}"
                    data-pindex="${pIndex}" 
                    data-dindex="${dIndex}">
                </td>`;
        });
        html += '</tr>';
    });

    document.getElementById('calendarTable').innerHTML = html;

    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        cell.addEventListener('mousedown', startDragging);
        cell.addEventListener('mousemove', dragOver);
        cell.addEventListener('mouseup', stopDragging);
        cell.addEventListener('click', () => {
            const pIndex = parseInt(cell.dataset.pindex);
            const dIndex = parseInt(cell.dataset.dindex);
            handleCellClick(pIndex, dIndex);
        });
    });

    if (collapsibleCalendar) collapsibleCalendar.open(0);
    M.toast({html: 'Takvim oluşturuldu ve nöbetler dengeli dağıtıldı!'});
    updateStatistics();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

    function startDragging(event) {
        const cell = event.target;
        const pIndex = parseInt(cell.dataset.pindex);
        const dIndex = parseInt(cell.dataset.dindex);
        dragStart = { pIndex, dIndex };
        isDragging = true;
        event.preventDefault();
    }

    function dragOver(event) {
    if (!isDragging || !dragStart) return;

    const cell = event.target;
    if (!cell.classList.contains('calendar-cell')) return;

    const pIndex = parseInt(cell.dataset.pindex);
    const dIndex = parseInt(cell.dataset.dindex);
    const cellKey = `${pIndex}-${dIndex}`;

    cell.classList.remove('dragging');

    const dragColor = availabilityMode ? 'rgba(255, 182, 193, 0.8)' : 'rgba(200, 230, 201, 0.8)';
    cell.style.backgroundColor = dragColor;

    cell.classList.add('dragging');
    event.preventDefault();
}

    function stopDragging(event) {
        if (!isDragging || !dragStart) return;

        const cells = document.querySelectorAll('.calendar-cell.dragging');
        const totalDays = document.querySelectorAll('th').length - 1;
        saveToHistory();

        let hasConsecutive = false;
        const tempSelected = [...cells].map(cell => {
            const pIndex = parseInt(cell.dataset.pindex);
            const dIndex = parseInt(cell.dataset.dindex);
            return `${pIndex}-${dIndex}`;
        });

        tempSelected.forEach(cellKey => {
            const [pIndex, dIndex] = cellKey.split('-').map(Number);
            const prevDay = dIndex - 1;
            const nextDay = dIndex + 1;
            const prevCellKey = `${pIndex}-${prevDay}`;
            const nextCellKey = `${pIndex}-${nextDay}`;

            if ((prevDay >= 0 && (selectedCells[prevCellKey] || tempSelected.includes(prevCellKey))) ||
                (nextDay < totalDays && (selectedCells[nextCellKey] || tempSelected.includes(nextCellKey)))) {
                hasConsecutive = true;
            }
        });

        if (!availabilityMode && hasConsecutive) {
            M.toast({ html: 'Seçilen günlerde üst üste nöbet ataması tespit edildi!' });
        }

        cells.forEach(cell => {
            const pIndex = parseInt(cell.dataset.pindex);
            const dIndex = parseInt(cell.dataset.dindex);
            const cellKey = `${pIndex}-${dIndex}`;

            if (availabilityMode) {
                unavailableCells[cellKey] = !unavailableCells[cellKey];
                cell.classList.toggle('unavailable', unavailableCells[cellKey]);
                if (unavailableCells[cellKey]) {
                    delete selectedCells[cellKey];
                    cell.classList.remove('selected');
                }
            } else {
                if (!unavailableCells[cellKey] && !selectedCells[cellKey]) {
                    selectedCells[cellKey] = true;
                    cell.classList.add('selected');
                }
            }
            cell.classList.remove('dragging');
            cell.style.backgroundColor = '';
        });

        checkScheduleValidity();
        updateStatistics();
        isDragging = false;
        dragStart = null;
    }

function handleCellClick(pIndex, dIndex) {
    const cellKey = `${pIndex}-${dIndex}`;
    const cell = document.querySelector(`td[data-pindex="${pIndex}"][data-dindex="${dIndex}"]`);
    saveToHistory();

    if (availabilityMode) {
        unavailableCells[cellKey] = !unavailableCells[cellKey];
        cell.classList.toggle('unavailable', unavailableCells[cellKey]);
        if (unavailableCells[cellKey]) {
            delete selectedCells[cellKey];
            cell.classList.remove('selected');
        }
    } else {
        if (!unavailableCells[cellKey]) {
            if (selectedCells[cellKey]) {
                delete selectedCells[cellKey];
                cell.classList.remove('selected');
            } else {
                const prevDay = dIndex - 1;
                const nextDay = dIndex + 1;
                const prevCellKey = `${pIndex}-${prevDay}`;
                const nextCellKey = `${pIndex}-${nextDay}`;
                const totalDays = document.querySelectorAll('th').length - 1;

                if ((prevDay >= 0 && selectedCells[prevCellKey]) || (nextDay < totalDays && selectedCells[nextCellKey])) {
                    M.toast({ html: `${persons[pIndex].name} için üst üste nöbet ataması tespit edildi!` });
                }

                selectedCells[cellKey] = true;
                cell.classList.add('selected');
            }
        }
    }
    checkScheduleValidity();
    updateStatistics();
}

    function updateStatistics() {
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    if (!startInput || !endInput) return;

    const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
    const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const holidayInput = document.getElementById('holidays').value;
    const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

    const stats = persons.map(p => ({name: p.name, weekday: 0, weekend: 0, friday: 0}));
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    for (let d = 0; d < days; d++) {
        const date = new Date(start);
        date.setDate(date.getDate() + d);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
        const isFriday = date.getDay() === 5;

        persons.forEach((person, pIndex) => {
            if (selectedCells[`${pIndex}-${d}`]) {
                if (isWeekend) {
                    stats[pIndex].weekend++;
                } else {
                    stats[pIndex].weekday++;
                    if (isFriday) {
                        stats[pIndex].friday++;
                    }
                }
            }
        });
    }

    const html = stats.map(stat => `
        <tr>
            <td>${stat.name}</td>
            <td>${stat.weekday}</td>
            <td>${stat.weekend}</td>
            <td>${stat.friday}</td>
            <td>${stat.weekday + stat.weekend}</td>
        </tr>
    `).join('');

    document.getElementById('statsTable').innerHTML = html;
    if (statsCollapsible) statsCollapsible.open(0);
}
    function checkScheduleValidity() {
    validationErrors = [];
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    if (!startInput || !endInput) return;

    const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
    const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
    const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    for (let d = 0; d < days; d++) {
        const assigned = document.querySelectorAll(`td[data-dindex="${d}"].selected`).length;
        if (assigned < dutyPerDay) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);
            validationErrors.push({
                type: 'error',
                message: `${date.toLocaleDateString('tr-TR')} tarihine ${dutyPerDay} nöbetçi atanmamış, atanan: ${assigned}`
            });
        }
    }

    for (let d = 0; d < days; d++) {
        const assigned = [];
        document.querySelectorAll(`td[data-dindex="${d}"].selected`).forEach(td => {
            assigned.push(td.closest('tr').querySelector('td:first-child').innerText);
        });
        if (assigned.length > dutyPerDay) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);
            validationErrors.push({
                type: 'warning',
                message: `${date.toLocaleDateString('tr-TR')} tarihinde fazla atama: ${assigned.join(', ')} (${assigned.length} > ${dutyPerDay})`
            });
        }
    }

    persons.forEach((person, pIndex) => {
        const duties = [];
        for (let d = 0; d < days; d++) {
            if (selectedCells[`${pIndex}-${d}`]) duties.push(d);
        }
        for (let i = 1; i < duties.length; i++) {
            if (duties[i] - duties[i-1] === 1) {
                const date1 = new Date(start);
                date1.setDate(date1.getDate() + duties[i-1]);
                const date2 = new Date(start);
                date2.setDate(date2.getDate() + duties[i]);
                validationErrors.push({
                    type: 'warning',
                    message: `${person.name} üst üste nöbet: ${date1.toLocaleDateString('tr-TR')} - ${date2.toLocaleDateString('tr-TR')}`
                });
            }
        }
    });

    Object.keys(selectedCells).forEach(key => {
        if (selectedCells[key] && unavailableCells[key]) {
            const [pIndex, dIndex] = key.split('-');
            const person = persons[pIndex].name;
            const date = new Date(start);
            date.setDate(date.getDate() + parseInt(dIndex));
            validationErrors.push({
                type: 'error',
                message: `${person} istenmeyen günde nöbet: ${date.toLocaleDateString('tr-TR')}`
            });
        }
    });

    persons.forEach((person, index) => {
        const plannedWeekday = person.weekdayDuties;
        const plannedWeekend = person.weekendDuties;
        const stats = updateStatsForPerson(index);
        const actualWeekday = stats.weekday;
        const actualWeekend = stats.weekend;
        if (plannedWeekday !== undefined && plannedWeekday > 0 && actualWeekday !== plannedWeekday) {
            validationErrors.push({
                type: 'warning',
                message: `${person.name}: Planlanan hafta içi nöbet (${plannedWeekday}), atanan nöbet (${actualWeekday})`
            });
        }
        if (plannedWeekend !== undefined && plannedWeekend > 0 && actualWeekend !== plannedWeekend) {
            validationErrors.push({
                type: 'warning',
                message: `${person.name}: Planlanan hafta sonu nöbet (${plannedWeekend}), atanan nöbet (${actualWeekend})`
            });
        }
    });
}

    function updateStatsForPerson(pIndex) {
        const startInput = document.getElementById('startDate').value;
        const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
        const start = new Date(startYear, startMonth - 1, startDay);
        start.setHours(0, 0, 0, 0);

        const holidayInput = document.getElementById('holidays').value;
        const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

        const days = Math.ceil((new Date(document.getElementById('endDate').value.split('-').reverse().join('-')) - start) / (1000 * 60 * 60 * 24)) + 1;
        let weekday = 0, weekend = 0;

        for (let d = 0; d < days; d++) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
            if (selectedCells[`${pIndex}-${d}`]) {
                if (isWeekend) weekend++;
                else weekday++;
            }
        }
        return { weekday, weekend };
    }

    function showErrorModal() {
        const errorList = document.getElementById('errorList');
        errorList.innerHTML = validationErrors.map(error => `
            <div class="error-item">
                <span class="${error.type === 'error' ? 'error-type' : 'warning-type'}">
                    ${error.type === 'error' ? 'HATA' : 'UYARI'}:
                </span>
                ${error.message}
            </div>
        `).join('');
        const modal = M.Modal.init(document.getElementById('errorModal'));
        modal.open();
    }

   function confirmSend() {
    performExport();
}

    function sendSchedule() {
    checkScheduleValidity();
    updateStatistics();
    if (validationErrors.length > 0) {
        showErrorModal();
    } else {
        M.toast({ html: 'Lütfen bir paylaşım seçeneği seçin!' });
    }
}

function performExport(callback) {
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    const dutyPerDay = parseInt(document.getElementById('dutyPerDay').value) || 1;
    if (!startInput || !endInput) {
        M.toast({ html: 'Lütfen tarih seçin!' });
        return;
    }

    const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
    const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const scheduleData = {};

    for (let d = 0; d < days; d++) {
        const currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() + d);
        const dateStr = currentDate.toLocaleDateString('tr-TR');
        scheduleData[dateStr] = [];
        document.querySelectorAll(`td[data-dindex="${d}"].selected`).forEach(td => {
            const person = td.closest('tr').querySelector('td:first-child').innerText;
            scheduleData[dateStr].push(person);
        });
    }

    let maxAssignedPerDay = 0;
    for (const date in scheduleData) {
        const assignedCount = scheduleData[date].length;
        maxAssignedPerDay = Math.max(maxAssignedPerDay, assignedCount);
    }
    const columnCount = Math.max(dutyPerDay, maxAssignedPerDay);
    const headers = ['Tarih'];
    for (let i = 1; i <= columnCount; i++) {
        headers.push(`Nöbetçi ${i}`);
    }
    const data = [headers];

    for (let d = 0; d < days; d++) {
        const currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() + d);
        const dateStr = currentDate.toLocaleDateString('tr-TR');
        const row = [dateStr];
        const assigned = scheduleData[dateStr] || [];
        for (let i = 0; i < columnCount; i++) {
            row.push(assigned[i] || '');
        }
        data.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nöbet Listesi");
    const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
    const fileName = `nobet_listesi_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (callback) callback(blob, fileName);
}

function downloadSchedule() {
    performExport(function(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        M.toast({ html: 'Nöbet listesi indirildi!' });
    });
}

function emailSchedule() {
    performExport(function(blob, fileName) {
        const reader = new FileReader();
        reader.onloadend = function() {
            const base64Data = reader.result.split(',')[1];
            window.emailData = { base64Data, fileName };
            const emailModal = M.Modal.getInstance(document.getElementById('emailModal'));
            emailModal.open();
        };
        reader.readAsDataURL(blob);
    });
}

function sendEmailWithRecipient() {
    const recipient = document.getElementById('recipientEmail').value.trim();
    if (!recipient) {
        M.toast({ html: 'Lütfen bir e-posta adresi girin!' });
        return;
    }
    const { base64Data, fileName } = window.emailData;

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx-84tIP0jZ-dIHTqC1c1XFoGzIoGNKz-dSBzNyX3hqLy7kC6l8-UtyyfWjarXj3I5OQ/exec'; // Apps Script URL'nizi buraya ekleyin

    fetch(APPS_SCRIPT_URL + '?action=sendEmail', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient, base64Data, fileName })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(response => {
        M.toast({ html: response });
        const emailModal = M.Modal.getInstance(document.getElementById('emailModal'));
        emailModal.close();
        document.getElementById('recipientEmail').value = '';
    })
    .catch(error => {
        M.toast({ html: 'E-posta gönderilirken hata oluştu: ' + error.message });
    });
}

function autoAssignDuties() {
    if (!document.getElementById('calendarTable').innerHTML) {
        M.toast({ html: 'Önce takvim oluşturun!' });
        return;
    }

    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    const dutyPerDayInput = document.getElementById('dutyPerDay').value.trim();

    if (!dutyPerDayInput || dutyPerDayInput === "") {
        M.toast({ html: 'Kaçar kişinin nöbetçi olacağını belirleyiniz!' });
        return;
    }

    const dutyPerDay = parseInt(dutyPerDayInput);
    if (isNaN(dutyPerDay) || dutyPerDay < 1) {
        M.toast({ html: 'Lütfen geçerli bir sayı girin (1 veya daha fazla)!' });
        return;
    }

    if (!startInput || !endInput) {
        M.toast({ html: 'Lütfen tarih seçin!' });
        return;
    }

    const [startDay, startMonth, startYear] = startInput.split('-').map(Number);
    const [endDay, endMonth, endYear] = endInput.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const holidayInput = document.getElementById('holidays').value;
    const holidays = holidayInput ? holidayInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)) : [];

    const dates = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6 || holidays.includes(date.getDate());
        const isFriday = date.getDay() === 5;
        dates.push({ index: i, isWeekend, isFriday });
    }

    const totalExpectedDuties = days * dutyPerDay;
    const expectedWeekdayDuties = dates.filter(d => !d.isWeekend).length * dutyPerDay;
    const expectedWeekendDuties = dates.filter(d => d.isWeekend).length * dutyPerDay;

    let totalPlannedDuties = 0;
    let plannedWeekdayDuties = 0;
    let plannedWeekendDuties = 0;

    persons.forEach(person => {
        plannedWeekdayDuties += person.weekdayDuties || 0;
        plannedWeekendDuties += person.weekendDuties || 0;
        totalPlannedDuties += (person.weekdayDuties || 0) + (person.weekendDuties || 0);
    });

    if (totalPlannedDuties !== totalExpectedDuties || 
        plannedWeekdayDuties !== expectedWeekdayDuties || 
        plannedWeekendDuties !== expectedWeekendDuties) {
        const weekdayDiff = plannedWeekdayDuties - expectedWeekdayDuties;
        const weekendDiff = plannedWeekendDuties - expectedWeekendDuties;
        let customMessage = "";

        if (totalPlannedDuties > totalExpectedDuties) {
            customMessage = "Fazla nöbet yazdınız! ";
            if (weekdayDiff > 0) customMessage += `${weekdayDiff} miktar hafta içini azaltın`;
            if (weekendDiff > 0) customMessage += `${weekdayDiff > 0 && weekendDiff > 0 ? ' ve ' : ''}${weekendDiff} miktar hafta sonunu azaltın`;
            customMessage += ".";
        } else if (totalPlannedDuties < totalExpectedDuties) {
            customMessage = "Az nöbet yazdınız! ";
            if (weekdayDiff < 0) customMessage += `${Math.abs(weekdayDiff)} miktar hafta içini artırın`;
            if (weekendDiff < 0) customMessage += `${weekdayDiff < 0 && weekendDiff < 0 ? ' ve ' : ''}${Math.abs(weekendDiff)} miktar hafta sonunu artırın`;
            customMessage += ".";
        } else {
            customMessage = "Nöbet dağılımı uyumsuz! ";
            if (weekdayDiff > 0) customMessage += `${weekdayDiff} miktar hafta içini azaltın`;
            if (weekendDiff < 0) customMessage += `${weekdayDiff > 0 ? ' ve ' : ''}${Math.abs(weekendDiff)} miktar hafta sonunu artırın`;
            if (weekendDiff > 0) customMessage += `${weekdayDiff > 0 || weekendDiff < 0 ? ' ve ' : ''}${weekendDiff} miktar hafta sonunu azaltın`;
            if (weekdayDiff < 0) customMessage += `${weekendDiff > 0 || weekdayDiff > 0 ? ' ve ' : ''}${Math.abs(weekdayDiff)} miktar hafta içini artırın`;
            customMessage += ".";
        }

        M.toast({ html: customMessage, displayLength: 8000 });
        return;
    }

    document.getElementById('loadingOverlay').style.display = 'flex';

    const personnelDuties = persons.map(person => ({
        name: person.name,
        weekdayLeft: person.weekdayDuties || 0,
        weekendLeft: person.weekendDuties || 0,
        minDaysBetween: person.minDaysBetween,
        dutyDays: [],
        originalIndex: persons.findIndex(p => p.name === person.name)
    }));

    const preAssignedDays = {};
    Object.keys(selectedCells).forEach(key => {
        if (selectedCells[key]) {
            const [pIndex, dIndex] = key.split('-').map(Number);
            const person = personnelDuties.find(p => p.originalIndex === pIndex);
            if (person && dIndex >= 0 && dIndex < dates.length) {
                preAssignedDays[key] = true;
                if (dates[dIndex].isWeekend) {
                    person.weekendLeft = Math.max(0, person.weekendLeft - 1);
                } else {
                    person.weekdayLeft = Math.max(0, person.weekdayLeft - 1);
                }
                person.dutyDays.push(dIndex);
            }
        }
    });

    const balanceFridays = document.getElementById('balanceFridays').checked;

    const data = {
        personnel: personnelDuties,
        totalDays: days,
        weekendDays: dates.map(d => d.isWeekend ? d.index : null).filter(d => d !== null),
        fridayDays: dates.map(d => d.isFriday ? d.index : null).filter(d => d !== null),
        unavailableCells: unavailableCells || {},
        preAssignedDays: preAssignedDays,
        maxConsecutiveDuties: 1,
        dutyPerDay: dutyPerDay,
        balanceFridays: balanceFridays
    };

    saveToHistory();

    const CLOUD_FUNCTIONS_URL = 'https://optimize-nobet-174463354439.us-central1.run.app'; // Cloud Functions URL'niz

    fetch(CLOUD_FUNCTIONS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        document.getElementById('loadingOverlay').style.display = 'none';
        if (Array.isArray(result.assignments)) { // Cloud Functions yanıt yapısına göre ayarlayın
            result.assignments.forEach(a => {
                const cellKey = `${a.pIndex}-${a.dayIndex}`;
                selectedCells[cellKey] = true;
            });
            updateCalendar();
            updateStatistics();
            saveToHistory();
            M.toast({ html: 'Tüm nöbetler atandı!' });
        } else {
            M.toast({ html: result.error || 'Bilinmeyen bir hata oluştu', displayLength: 8000 });
        }
    })
    .catch(error => {
        document.getElementById('loadingOverlay').style.display = 'none';
        M.toast({ html: 'Sunucuyla bağlantı kurulamadı: ' + error.message, displayLength: 8000 });
    });
}
    function updateCalendar() {
        const cells = document.querySelectorAll('.calendar-cell');
        cells.forEach(cell => {
            const pIndex = cell.dataset.pindex;
            const dIndex = cell.dataset.dindex;
            const cellKey = `${pIndex}-${dIndex}`;
            cell.classList.toggle('selected', !!selectedCells[cellKey]);
            cell.classList.toggle('unavailable', !!unavailableCells[cellKey]);
        });
        updateUndoRedoButtons();
    }

    function triggerFileUpload() {
        const csvUploadInput = document.getElementById('csvUpload');
        if (csvUploadInput) {
            csvUploadInput.click();
        } else {
            console.error('csvUpload input elementi bulunamadı!');
            M.toast({ html: 'Dosya yükleme alanı bulunamadı!' });
        }
    }

    let isUploading = false;
function uploadPersonnel(event) {
    if (isUploading) {
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        M.toast({ html: 'Lütfen bir dosya seçin!' });
        return;
    }
    if (!file.name.endsWith('.csv')) {
        M.toast({ html: 'Lütfen geçerli bir CSV dosyası yükleyin!' });
        return;
    }

    isUploading = true;
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = loadingOverlay.querySelector('span');
    loadingMessage.textContent = 'Dosya yükleniyor...';
    loadingOverlay.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            M.toast({ html: 'Dosya boş veya okunamadı!' });
            loadingOverlay.style.display = 'none';
            isUploading = false;
            return;
        }
        const data = new Uint8Array(arrayBuffer);
        const base64String = arrayBufferToBase64(data);

        const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx-84tIP0jZ-dIHTqC1c1XFoGzIoGNKz-dSBzNyX3hqLy7kC6l8-UtyyfWjarXj3I5OQ/exec'; // Apps Script URL'nizi buraya ekleyin

        fetch(APPS_SCRIPT_URL + '?action=uploadPersonnel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ base64Data: base64String })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(response => {
            loadingOverlay.style.display = 'none';
            if (response.success) {
                persons = response.persons.map(p => ({
                    name: p.name,
                    weekdayDuties: p.weekdayDuties,
                    weekendDuties: p.weekendDuties,
                    minDaysBetween: p.minDaysBetween || 1
                }));
                renderTable();
                M.toast({ html: 'Personel listesi başarıyla yüklendi!' });
            } else {
                M.toast({ html: response.error || 'Bilinmeyen bir hata oluştu!' });
            }
            isUploading = false;
        })
        .catch(error => {
            M.toast({ html: 'Sunucu hatası: ' + error.message });
            loadingOverlay.style.display = 'none';
            isUploading = false;
        });
    };
    reader.onerror = function() {
        M.toast({ html: 'Dosya okunurken bir hata oluştu: ' + (reader.error ? reader.error.message : 'Bilinmeyen hata') });
        loadingOverlay.style.display = 'none';
        isUploading = false;
    };
    reader.readAsArrayBuffer(file);

    setTimeout(() => {
        event.target.value = '';
    }, 0);
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

   function downloadPersonnel() {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx-84tIP0jZ-dIHTqC1c1XFoGzIoGNKz-dSBzNyX3hqLy7kC6l8-UtyyfWjarXj3I5OQ/exec'; // Apps Script URL'nizi buraya ekleyin

    fetch(APPS_SCRIPT_URL + '?action=downloadPersonnel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ persons: persons })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(csvContent => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `personel_listesi_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        M.toast({ html: 'Personel listesi CSV olarak indirildi!' });
    })
    .catch(error => {
        M.toast({ html: 'İndirme hatası: ' + error.message });
    });
}

    function clearCalendar() {
    // Geçmişi kaydet
    saveToHistory();
    
    // Tüm işaretlemeleri temizle
    selectedCells = {};
    unavailableCells = {};
    
    // Takvimi güncelle
    updateCalendar();
    updateStatistics();
    
    M.toast({ html: 'Takvimdeki tüm işaretlemeler temizlendi!' });
    }

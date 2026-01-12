// Основные переменные
let events = [];
let filteredEvents = [];
let currentDay = new Date().getDay();
currentDay = currentDay === 0 ? 7 : currentDay;

// Цвета для типов мероприятий
const eventTypeColors = {
    'мастер-класс': '#FF6B6B',
    'олимпиада': '#4ECDC4',
    'родительское собрание': '#FFD166',
    'кружок': '#06D6A0',
    'интенсив': '#118AB2',
    'концерт': '#9D4EDD'
};

// DOM элементы
let canvas, ctx;
let timeline, eventsArea, timeScale;
let modal, modalTitle, modalBody;

// Переменные для управления временем
let currentTimeMinutes = getCurrentTimeMinutes();
let currentTimeLinePosition = 0;
let isDragging = false;
let dragStartX = 0;
let timelineStartX = 0;

// Переменная для отслеживания, был ли ручной выбор времени
let manualTimeMode = false;

let autocompleteData = {
    teacher: new Set(),
    room: new Set(), // Будем хранить "здание-номер"
    course: new Set(),
    tutor: new Set(),
    pupil: new Set(),
    title: new Set()
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Получаем DOM элементы
    canvas = document.getElementById('gantt-canvas');
    ctx = canvas.getContext('2d');
    timeline = document.getElementById('timeline');
    eventsArea = document.getElementById('events-area');
    timeScale = document.getElementById('time-scale');
    
    // Модальное окно
    modal = document.getElementById('event-modal');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    
    // Загружаем данные
    loadEvents();
    
    // Устанавливаем текущий день
    setCurrentDay();
    
    // Инициализируем календарь
    initCalendar();
    
    // Устанавливаем временную линию
    updateTimeline();
    setInterval(updateTimeline, 60000);
    
    // Обработчики событий
    setupEventListeners();
    
    // Инициализируем Canvas
    initCanvas();
    
    window.addEventListener('resize', function() {
        resizeCanvas();
    });
    
    // Создаем временную шкалу
    createTimeScale();
    
    // Рисуем сетку
    drawGrid();
});

// Загрузка событий из JSON файла
async function loadEvents() {
    try {
        // Загружаем данные из JSON файла
        const response = await fetch('events.json');
        
        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${response.status}`);
        }
        
        events = await response.json();
        
        events.forEach(event => {
            autocompleteData.teacher.add(event.teacher);
            autocompleteData.course.add(event.course);
            autocompleteData.tutor.add(event.tutor);
            // Для комнаты и учеников - добавляем уникальные значения
            autocompleteData.room.add(`${event.room.building}-${event.room.number}`);
            event.pupils.forEach(pupil => autocompleteData.pupil.add(pupil));
            autocompleteData.title.add(event.title);
        });

        // Преобразуем Sets в массивы для удобства поиска
        for (let key in autocompleteData) {
            autocompleteData[key] = Array.from(autocompleteData[key]).sort();
        }

        // Устанавливаем общее количество
        document.getElementById('total-count').textContent = events.length;
        
        // Считаем события на сегодня
        const todayCount = events.filter(event => event.day_of_week === currentDay).length;
        document.getElementById('today-count').textContent = todayCount;
        
        // Отображаем события текущего дня
        filterByDay(currentDay);
        
        // Инициализируем canvas
        initCanvas();
        
        // Отображаем события
        renderEvents();
        
        // Обновляем статистику
        updateStatistics();
        
        console.log(`Загружено ${events.length} мероприятий`);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        // Показываем сообщение об ошибке
        const resultDiv = document.getElementById('filter-result');
        resultDiv.textContent = 'Ошибка загрузки данных. Проверьте наличие файла events.json';
        resultDiv.style.color = '#dc3545';
        
        // Или используйте тестовые данные как fallback
        // events = testEvents; // раскомментируйте, если хотите использовать тестовые данные при ошибке
    }
}

// Устанавливаем текущий день
function setCurrentDay() {
    // Снимаем активный класс со всех кнопок
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Добавляем активный класс к текущему дню
    const currentDayBtn = document.querySelector(`.day-btn[data-day="${currentDay}"]`);
    if (currentDayBtn) {
        currentDayBtn.classList.add('active');
    }
}

// Инициализация календаря
function initCalendar() {
    flatpickr("#datepicker", {
        locale: "ru",
        dateFormat: "d.m.Y",
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0) {
                const selectedDay = selectedDates[0].getDay();
                const day = selectedDay === 0 ? 7 : selectedDay;
                filterByDay(day);
                
                // Активируем соответствующую кнопку дня
                document.querySelectorAll('.day-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (parseInt(btn.dataset.day) === day) {
                        btn.classList.add('active');
                    }
                });
            }
        }
    });
    
    // Обработчик кнопки календаря
    document.getElementById('calendar-toggle').addEventListener('click', function() {
        const calendarContainer = document.getElementById('calendar-container');
        calendarContainer.style.display = calendarContainer.style.display === 'none' ? 'block' : 'none';
    });
}

// Инициализация Canvas
function initCanvas() {
    // Устанавливаем размеры canvas
    resizeCanvas();
    // Рисуем сетку сразу после инициализации
    drawGrid(); // <-- Добавленная строка

    // Обработчик изменения размера окна
    window.addEventListener('resize', function() {
        resizeCanvas();
        drawGrid();
        renderEvents();
    });
}

// Измените функцию resizeCanvas()
function resizeCanvas() {
  const container = eventsArea;
  const containerWidth = container.clientWidth;

  // Устанавливаем ширину canvas равной ширине контейнера
  canvas.width = containerWidth;

  // ВАЖНО: Не устанавливаем высоту здесь! Она будет рассчитана в renderEvents()
  // canvas.height = container.clientHeight || 600;

  // Создаем временную шкалу с правильной шириной
  createTimeScale();

  // Перерисовываем сетку и события
  drawGrid();
  renderEvents(); // <-- Эта функция теперь сама установит правильную высоту!
}

// Создание временной шкалы с интервалом 30 минут
function createTimeScale() {
    const container = timeScale;
    container.innerHTML = '';
    const startHour = 8;
    const endHour = 20;

    // Рассчитываем количество интервалов
    const totalIntervals = (endHour - startHour) * 2;

    // Получаем ширину контейнера (это может быть полезно для адаптивности)
    const containerWidth = container.clientWidth;
    const intervalWidth = containerWidth / totalIntervals;

    // Отображаем время с 8:00 до 20:00 с интервалом 30 минут
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'time-slot';
            div.textContent = time;
            div.setAttribute('data-time', `${hour}:${minute}`);

            // Можно задать ширину через style, если нужно точно контролировать
            // div.style.width = `${intervalWidth}px`;

            container.appendChild(div);
        }
    }
}


// ОБНОВЛЕННАЯ ФУНКЦИЯ drawGrid
function drawGrid() {
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const startHour = 8; // 8:00
    const endHour = 20; // 20:00
    const hoursCount = endHour - startHour;
    const totalIntervals = hoursCount * 4; // 15-минутные интервалы

    // Рассчитываем ширину одного 30-минутного интервала на canvas
    const intervalWidth = width / totalIntervals;

    // Очищаем canvas
    ctx.clearRect(0, 0, width, height);

    // Рисуем вертикальные линии сетки (каждые 30 минут)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    for (let i = 0; i <= totalIntervals; i++) {
        const x = i * intervalWidth;
        if (x > width) break;

        // Линия каждые 30 минут
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);

        // Более жирная линия каждый час (каждый второй интервал)
        if (i % 2 === 0) {
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = '#d0d0d0';
        } else {
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = '#e8e8e8';
        }
        ctx.stroke();
    }

    // Горизонтальные линии - АВТОМАТИЧЕСКИ ПО ВСЕЙ ВЫСОТЕ
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    
    // Рисуем горизонтальные линии каждые 100px для наглядности
    const gridSize = 100;
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

// Обновление временной линии
function updateTimeline() {
    const now = new Date();
    // Если мы в ручном режиме, НЕ обновляем время на текущее
    if (!manualTimeMode) {
        currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    }

    // Обновляем отображение времени
    const displayHours = Math.floor(currentTimeMinutes / 60);
    const displayMinutes = Math.floor(currentTimeMinutes % 60);
    document.getElementById('current-time').textContent =
        displayHours.toString().padStart(2, '0') + ':' +
        displayMinutes.toString().padStart(2, '0');

    // Позиционируем временную линию
    updateTimelinePosition();

    // Обновляем список мероприятий, пересекающихся с текущим временем
    updateEventNames();
}

// Обновление позиции временной линии
function updateTimelinePosition() {
    const startHour = 8;
    const endHour = 20;
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const totalMinutes = endMinutes - startMinutes; // 720 минут

    // Ограничиваем время в пределах отображаемого диапазона
    let displayTime = Math.max(startMinutes, Math.min(endMinutes, currentTimeMinutes));

    // Вычисляем позицию в процентах
    const minutesFromStart = displayTime - startMinutes;
    currentTimeLinePosition = (minutesFromStart / totalMinutes) * 100;

    // Устанавливаем позицию линии
    timeline.style.left = `${currentTimeLinePosition}%`;

    // Прокручиваем к текущему времени
    // Используем ширину canvas, а не scrollWidth, так как ширина events-area фиксирована
    const eventsAreaWidth = eventsArea.clientWidth;
    const timelinePositionPx = (currentTimeLinePosition / 100) * canvas.width; // Используем canvas.width
    const scrollLeft = timelinePositionPx - (eventsAreaWidth / 2);

    // Плавная прокрутка
    eventsArea.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопки дней недели
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const day = this.dataset.day; // <-- Берем значение как строку!
            filterByDay(day); // <-- Передаем строку напрямую
            // Обновляем активную кнопку (это уже делает filterByDay, но можно оставить для уверенности)
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Кнопка "Сейчас"
    document.getElementById('now-btn').addEventListener('click', function() {
        const now = new Date();
        currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // Обновляем отображение времени
        document.getElementById('current-time').textContent =
            now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');

        updateTimelinePosition();
        updateEventNames();
        // Сбрасываем ручной режим
        manualTimeMode = false;
    });
    
    // Перетаскивание временной линии
    timeline.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
    
    // Также добавляем обработчики для касаний (для мобильных устройств)
    timeline.addEventListener('touchstart', startDragging);
    document.addEventListener('touchmove', handleDragging);
    document.addEventListener('touchend', stopDragging);
    
    // Закрытие модального окна
    document.querySelector('.close').addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Кнопка выгрузки в Excel
    document.getElementById('export-excel').addEventListener('click', exportToExcel);
    
    // Кнопки фильтров
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);

    // Обработчик клика для мыши
    canvas.addEventListener('click', handleCanvasClick);

    // Обработчик для сенсорных устройств (touchend)
    canvas.addEventListener('touchend', handleCanvasTouch);
}

// Начало перетаскивания временной линии
function startDragging(e) {
    e.preventDefault();
    isDragging = true;
    timeline.classList.add('dragging');
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    dragStartX = clientX;
    timelineStartX = parseFloat(timeline.style.left) || currentTimeLinePosition;

    // Включаем ручной режим при начале перетаскивания
    manualTimeMode = true;
}

// Обработка перетаскивания
function handleDragging(e) {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;
    const containerRect = eventsArea.getBoundingClientRect();
    const deltaX = clientX - dragStartX;
    const deltaPercentage = (deltaX / containerRect.width) * 100;
    let newPosition = timelineStartX + deltaPercentage;
    // Ограничиваем перемещение в пределах контейнера
    newPosition = Math.max(0, Math.min(100, newPosition));
    // Обновляем позицию линии
    timeline.style.left = `${newPosition}%`;
    currentTimeLinePosition = newPosition;
    // Вычисляем время
    const startHour = 8;
    const endHour = 20;
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const totalMinutes = endMinutes - startMinutes;
    currentTimeMinutes = startMinutes + (newPosition / 100) * totalMinutes;
    // Обновляем отображение времени
    const hours = Math.floor(currentTimeMinutes / 60);
    const minutes = Math.floor(currentTimeMinutes % 60);
    document.getElementById('current-time').textContent =
        hours.toString().padStart(2, '0') + ':' +
        minutes.toString().padStart(2, '0');
    // Прокручиваем область при перетаскивании к краям
    // Автоматическая прокрутка: центрируем линию в видимой области
    const timelinePositionPx = (newPosition / 100) * eventsArea.scrollWidth;
    const scrollLeft = timelinePositionPx - (eventsArea.clientWidth / 2);
    eventsArea.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });
    // Обновляем список мероприятий
    updateEventNames();
}

// Окончание перетаскивания
function stopDragging() {
    isDragging = false;
    timeline.classList.remove('dragging');
    // manualTimeMode остаётся true — пользователь всё ещё смотрит выбранное время
}

// Функция для фильтрации по дню или показа всех мероприятий
function filterByDay(day) {
    currentDay = day; // Сохраняем текущий день/состояние

    if (day === 'all') {
        // Показываем все мероприятия
        filteredEvents = [...events]; // Создаем копию массива
        // Сортируем по дню недели, а затем по времени начала
        filteredEvents.sort((a, b) => {
            // Сначала сортируем по дню недели (1=Пн, 7=Вс)
            if (a.day_of_week !== b.day_of_week) {
                return a.day_of_week - b.day_of_week;
            }
            // Затем сортируем по времени начала
            return timeToMinutes(a.time.begining) - timeToMinutes(b.time.begining);
        });
        // Обновляем счетчик (все мероприятия)
        document.getElementById('today-count').textContent = filteredEvents.length;
    } else {
        // Показываем мероприятия только для выбранного дня
        currentDay = parseInt(day); // Убедимся, что это число
        filteredEvents = events.filter(event => event.day_of_week === currentDay);
        // Обновляем счетчик
        document.getElementById('today-count').textContent = filteredEvents.length;
    }

    // Пересчитываем и отображаем события
    drawGrid();
    renderEvents();
    updateEventNames();

    // Прокручиваем к началу
    eventsArea.scrollTop = 0;

    // Обновляем активную кнопку
    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
    const currentBtn = document.querySelector(`.day-btn[data-day="${day}"]`);
    if (currentBtn) {
        currentBtn.classList.add('active');
    }
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ renderEvents
function renderEvents() {
    if (!ctx || filteredEvents.length === 0) return;

    // Сортируем события по времени начала
    const sortedEvents = [...filteredEvents].sort((a, b) =>
        timeToMinutes(a.time.begining) - timeToMinutes(b.time.begining)
    );

    // Параметры отображения
    const width = canvas.width;
    const startHour = 8;
    const endHour = 20;
    const totalMinutes = (endHour - startHour) * 60; // 720 минут
    const pixelsPerMinute = width / totalMinutes;

    // Высота одного события и отступы
    const eventHeight = 85;
    const eventMargin = 10;
    const eventPadding = 5; // Внутренний отступ

    // Размещаем события в несколько столбцов
    const columns = [];
    const placedEvents = new Set();

    // Алгоритм упаковки событий
    sortedEvents.forEach(event => {
        if (placedEvents.has(event.id)) return;
        const startTime = timeToMinutes(event.time.begining);
        const endTime = timeToMinutes(event.time.ending);
        const eventStart = startTime - (startHour * 60);
        const eventDuration = endTime - startTime;
        const eventX = eventStart * pixelsPerMinute;
        const eventWidth = eventDuration * pixelsPerMinute;

        // Ищем подходящий столбец
        let columnIndex = -1;
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            let canPlace = true;
            for (const placedEvent of column) {
                const placedStart = timeToMinutes(placedEvent.time.begining) - (startHour * 60);
                const placedEnd = timeToMinutes(placedEvent.time.ending) - (startHour * 60);
                // Проверяем пересечение по времени
                if (eventStart < placedEnd && eventStart + eventDuration > placedStart) {
                    canPlace = false;
                    break;
                }
            }
            if (canPlace) {
                columnIndex = i;
                break;
            }
        }

        // Если не нашли подходящий столбец, создаем новый
        if (columnIndex === -1) {
            columnIndex = columns.length;
            columns.push([]);
        }

        // Добавляем событие в столбец
        columns[columnIndex].push(event);
        placedEvents.add(event.id);

        // Рассчитываем Y-координату
        const eventY = columnIndex * (eventHeight + eventMargin) + eventPadding;

        // Сохраняем координаты для обработки кликов
        event.canvasRect = {
            x: eventX,
            y: eventY,
            width: eventWidth,
            height: eventHeight,
            column: columnIndex
        };
    });

    // РАСЧЕТ ВЫСОТЫ CANVAS НА ОСНОВЕ КОЛИЧЕСТВА КОЛОНОК
    const totalRows = columns.length;
    const canvasHeight = totalRows * (eventHeight + eventMargin) + (100 * eventPadding);
    
    // Устанавливаем высоту canvas
    canvas.height = canvasHeight;
    
    // Также устанавливаем высоту для events-area
    const eventsArea = document.getElementById('events-area');
    eventsArea.style.minHeight = canvasHeight + 'px';
    
    // Перерисовываем сетку с новой высотой
    drawGrid();
    
    // Отрисовываем все события
    sortedEvents.forEach(event => {
        if (event.canvasRect) {
            drawEvent(event, event.canvasRect.x + 2, event.canvasRect.y, 
                     event.canvasRect.width - 4, event.canvasRect.height);
        }
    });
}

// Отрисовка одного события
function drawEvent(event, x, y, width, height) {
    // Цвет в зависимости от типа мероприятия
    const color = eventTypeColors[event.type_of_event] || '#888888';
    const hoverColor = adjustColor(color, 20);
    const isHovered = event.isHovered;
    
    // Рисуем закругленный прямоугольник с тенью
    const radius = 8;
    ctx.fillStyle = isHovered ? hoverColor : color;
    
    // Тень для блока
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    
    // Сбрасываем тень для текста
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Белый цвет для текста
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Arial, sans-serif';
    
    // Название мероприятия (с обрезкой если не помещается)
    const maxTitleWidth = width - 20;
    let displayTitle = event.title;
    
    if (ctx.measureText(displayTitle).width > maxTitleWidth) {
        while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 3) {
            displayTitle = displayTitle.substring(0, displayTitle.length - 1);
        }
        displayTitle = displayTitle + '...';
    }
    
    ctx.fillText(displayTitle, x + 12, y + 28);
    
    // Преподаватель и кабинет
    ctx.font = '13px Arial, sans-serif';
    const teacherLastName = event.teacher.split(' ')[0];
    const roomText = `${event.room.building}-${event.room.number}`;
    const infoText = `${teacherLastName} | ${roomText}`;
    
    let displayInfo = infoText;
    if (ctx.measureText(displayInfo).width > maxTitleWidth) {
        while (ctx.measureText(displayInfo + '...').width > maxTitleWidth && displayInfo.length > 3) {
            displayInfo = displayInfo.substring(0, displayInfo.length - 1);
        }
        displayInfo = displayInfo + '...';
    }
    
    ctx.fillText(displayInfo, x + 12, y + 52);
    
    // Время
    ctx.font = '12px Arial, sans-serif';
    const timeText = `${event.time.begining}-${event.time.ending}`;
    ctx.fillText(timeText, x + 12, y + 76);
    
    // Проверяем конфликты времени
    if (hasTimeConflict(event, filteredEvents)) {
        // Рисуем значок конфликта
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('⚠️', x + width - 25, y + 32);
    }
}

// Обработка кликов по событиям на Canvas
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Ищем событие, по которому кликнули
    for (const event of filteredEvents) {
        if (event.canvasRect && 
            x >= event.canvasRect.x && 
            x <= event.canvasRect.x + event.canvasRect.width &&
            y >= event.canvasRect.y && 
            y <= event.canvasRect.y + event.canvasRect.height) {
            
            showEventDetails(event);
            break;
        }
    }
});

// Обработка наведения на события
canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let hoveredEvent = null;
    
    // Проверяем, на какое событие наведена мышь
    for (const event of filteredEvents) {
        if (event.canvasRect && 
            x >= event.canvasRect.x && 
            x <= event.canvasRect.x + event.canvasRect.width &&
            y >= event.canvasRect.y && 
            y <= event.canvasRect.y + event.canvasRect.height) {
            
            hoveredEvent = event;
            break;
        }
    }
    
    // Сбрасываем hover для всех событий
    let needRedraw = false;
    for (const event of filteredEvents) {
        if (event.isHovered && event !== hoveredEvent) {
            event.isHovered = false;
            needRedraw = true;
        }
    }
    
    // Устанавливаем hover для найденного события
    if (hoveredEvent && !hoveredEvent.isHovered) {
        hoveredEvent.isHovered = true;
        canvas.style.cursor = 'pointer';
        needRedraw = true;
    } else if (!hoveredEvent) {
        canvas.style.cursor = 'default';
    }
    
    // Перерисовываем, если нужно
    if (needRedraw) {
        drawGrid();
        renderEvents();
    }
});

canvas.addEventListener('mouseleave', function() {
    // Сбрасываем hover при выходе из canvas
    let needRedraw = false;
    for (const event of filteredEvents) {
        if (event.isHovered) {
            event.isHovered = false;
            needRedraw = true;
        }
    }
    
    if (needRedraw) {
        drawGrid();
        renderEvents();
    }
});

// Показать детали события с полным списком учеников
function showEventDetails(event) {
    modalTitle.textContent = event.title;
    
    let html = `
        <div class="modal-field">
            <span class="modal-label">ID:</span>
            <span>${event.id}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Тип:</span>
            <span>${event.type_of_event}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Преподаватель:</span>
            <span>${event.teacher}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Куратор:</span>
            <span>${event.tutor}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Кабинет:</span>
            <span>${event.room.building}-${event.room.number}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Направление:</span>
            <span>${event.course}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Время:</span>
            <span>${event.time.begining} - ${event.time.ending}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">День недели:</span>
            <span>${getDayName(event.day_of_week)}</span>
        </div>
        <div class="modal-field">
            <span class="modal-label">Ученики (${event.pupils.length}):</span>
            <div class="pupils-list" style="max-height: 200px; overflow-y: auto; margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                ${event.pupils.map(pupil => `<div style="padding: 3px 0; border-bottom: 1px solid #eee;">${pupil}</div>`).join('')}
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
    modal.style.display = 'block';
}

// Обновление списка названий мероприятий (только пересекающиеся с текущим временем)
function updateEventNames() {
    const container = document.getElementById('event-names');
    container.innerHTML = '';
    
    // Находим события, пересекающиеся с текущим временем
    const intersectingEvents = filteredEvents.filter(event => {
        const eventStart = timeToMinutes(event.time.begining);
        const eventEnd = timeToMinutes(event.time.ending);
        return eventStart <= currentTimeMinutes && eventEnd >= currentTimeMinutes;
    });
    
    if (intersectingEvents.length === 0) {
        const div = document.createElement('div');
        div.className = 'event-name-item';
        div.textContent = 'Нет мероприятий в текущее время';
        container.appendChild(div);
        return;
    }
    
    intersectingEvents.forEach((event, index) => {
        const div = document.createElement('div');
        div.className = 'event-name-item';
        
        if (hasTimeConflict(event, intersectingEvents)) {
            div.classList.add('conflict');
            div.innerHTML = `<span style="color: #dc3545; margin-right: 5px;">⚠️</span> ${event.title}`;
        } else {
            div.textContent = `${index + 1}. ${event.title}`;
        }
        
        div.addEventListener('click', () => {
            // Прокручиваем к событию на диаграмме
            if (event.canvasRect) {
                const scrollX = event.canvasRect.x - 100;
                eventsArea.scrollTo({
                    left: scrollX,
                    behavior: 'smooth'
                });
            }
            showEventDetails(event);
        });
        container.appendChild(div);
    });
}

// Проверка конфликтов времени
function hasTimeConflict(event, eventList) {
    const eventStart = timeToMinutes(event.time.begining);
    const eventEnd = timeToMinutes(event.time.ending);
    
    // Проверяем конфликты по преподавателю
    const teacherConflicts = eventList.filter(e => 
        e.id !== event.id && 
        e.teacher === event.teacher &&
        timeOverlap(eventStart, eventEnd, timeToMinutes(e.time.begining), timeToMinutes(e.time.ending))
    );
    
    // Проверяем конфликты по кабинету
    const roomConflicts = eventList.filter(e => 
        e.id !== event.id && 
        e.room.building === event.room.building &&
        e.room.number === event.room.number &&
        timeOverlap(eventStart, eventEnd, timeToMinutes(e.time.begining), timeToMinutes(e.time.ending))
    );
    
    return teacherConflicts.length > 0 || roomConflicts.length > 0;
}

// Вспомогательные функции
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

function timeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

function getCurrentTimeMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function getDayName(dayNumber) {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[dayNumber] || 'Неизвестно';
}

function adjustColor(color, amount) {
    // Преобразуем HEX в RGB
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    
    // Осветляем
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    
    // Возвращаем в HEX
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Фильтрация (остальные функции остаются без изменений, но добавлю их для полноты)
function updateFilterInputs(select) {
    const row = select.closest('.filter-row');
    const valueContainer = row.querySelector('.filter-value-container');
    const timeFilters = row.querySelector('.time-filters');
    
    valueContainer.style.display = 'none';
    timeFilters.style.display = 'none';
    
    if (!select.value) return;
    
    valueContainer.style.display = 'flex';
    valueContainer.innerHTML = '';
    
    const filterType = select.value;
    
    // Для разных типов фильтров создаем разные поля ввода
    switch(filterType) {
        case 'type':
            // Выпадающий список для типов мероприятий
            const typeSelect = document.createElement('select');
            typeSelect.className = 'filter-value';
            typeSelect.innerHTML = `
                <option value="">Выберите тип</option>
                ${Object.keys(eventTypeColors).map(type => 
                    `<option value="${type}">${type}</option>`
                ).join('')}
            `;
            valueContainer.appendChild(typeSelect);
            break;
            
        case 'title':
        case 'teacher':
        case 'course':
        case 'tutor':
        case 'pupil':
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-value';
            input.placeholder = 'Введите или выберите...'; // Изменим плейсхолдер

            // Добавляем контейнер для автодополнения
            const autocompleteContainer = document.createElement('div');
            autocompleteContainer.className = 'autocomplete-container';
            autocompleteContainer.style.display = 'none';
            autocompleteContainer.innerHTML = '<ul class="autocomplete-list"></ul>';

            valueContainer.appendChild(input);
            valueContainer.appendChild(autocompleteContainer); // Добавляем контейнер в DOM

            // Инициализируем автодополнение
            initAutocomplete(input, filterType);
            break;
        case 'room':
            // ОДНО поле ввода для кабинета (формат "A-112")
            const roomInput = document.createElement('input');
            roomInput.type = 'text';
            roomInput.className = 'filter-value';
            roomInput.placeholder = 'Например: A-112 или только A';
            roomInput.style.flex = '1';

            // Добавляем контейнер для автодополнения
            const roomAutoContainer = document.createElement('div');
            roomAutoContainer.className = 'autocomplete-container';
            roomAutoContainer.style.display = 'none';
            roomAutoContainer.innerHTML = '<ul class="autocomplete-list"></ul>';

            valueContainer.appendChild(roomInput);
            valueContainer.appendChild(roomAutoContainer);

            // Инициализируем автодополнение с полными значениями кабинетов
            initAutocomplete(roomInput, 'room');
            break;
        
    }
}

// Добавление строки фильтра
function addFilterRow(logic = 'and') { // Принимаем логику как параметр, по умолчанию 'and'
    const filtersContainer = document.getElementById('filters-container');
    const allChildren = Array.from(filtersContainer.children);
    const lastRow = document.querySelector('.filter-row:last-of-type'); // Находим последнюю строку фильтра

    // Если есть предыдущая строка, добавляем между ней и новой строкой индикатор
    if (lastRow) {
        const logicIndicator = document.createElement('div');
        logicIndicator.className = 'filter-logic-indicator';
        logicIndicator.textContent = logic.toUpperCase(); // Показываем 'AND' или 'OR'
        logicIndicator.setAttribute('data-logic', logic); // Сохраняем значение в атрибуте
        logicIndicator.addEventListener('click', toggleLogicIndicator); // Добавляем обработчик клика
        filtersContainer.appendChild(logicIndicator);
    }

    const newRow = document.createElement('div');
    newRow.className = 'filter-row';
    // Присваиваем data-group как индекс новой строки (для отладки или будущих нужд)
    // newRow.setAttribute('data-group', ...); // Можно добавить, если нужно

    newRow.innerHTML = `
        <div class="filter-group">
            <select class="filter-type" onchange="updateFilterInputs(this)">
                <option value="">Выберите тип фильтра</option>
                <option value="type">Тип мероприятия</option>
                <option value="title">Название мероприятия</option>
                <option value="teacher">Учитель</option>
                <option value="room">Кабинет</option>
                <option value="course">Направление</option>
                <option value="tutor">Куратор</option>
                <option value="pupil">Ребенок</option>
            </select>
            <div class="filter-value-container" style="display: none;">
                <!-- Динамически заполняется -->
            </div>
            <div class="time-filters" style="display: none;">
                <input type="time" class="time-start" placeholder="Начало">
                <input type="time" class="time-end" placeholder="Окончание">
            </div>
        </div>
        <div class="filter-actions-row"> <!-- Новый контейнер для кнопок удаления и добавления -->
            <button class="btn-remove" onclick="removeFilterRow(this)">
                <i class="fas fa-times"></i>
            </button>
            <div class="add-logic-buttons"> <!-- Контейнер для кнопок добавления "И" или "ИЛИ" -->
                <button class="btn-add-logic" data-logic="and" onclick="addFilterRow('and')">+ И</button>
                <button class="btn-add-logic" data-logic="or" onclick="addFilterRow('or')">+ ИЛИ</button>
            </div>
        </div>
    `;
    filtersContainer.appendChild(newRow);

    // Прокручиваем к новой строке для удобства
    newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeFilterRow(button) {
    const row = button.closest('.filter-row');
    if (row && document.querySelectorAll('.filter-row').length > 1) {
        const container = document.getElementById('filters-container');
        const allChildren = Array.from(container.children);
        const rowIndex = allChildren.indexOf(row);

        // Найти и удалить индикатор *перед* этой строкой
        if (rowIndex > 0) {
            const prevElement = allChildren[rowIndex - 1];
            if (prevElement && prevElement.classList.contains('filter-logic-indicator')) {
                prevElement.remove();
            }
        }
        row.remove();
    } else if (row && document.querySelectorAll('.filter-row').length === 1) {
        // Если удаляется последняя строка, очищаем её, но не удаляем
        const selects = row.querySelectorAll('select');
        const inputs = row.querySelectorAll('input');
        selects.forEach(sel => sel.value = '');
        inputs.forEach(inp => inp.value = '');
        const valueContainers = row.querySelectorAll('.filter-value-container');
        const timeContainers = row.querySelectorAll('.time-filters');
        valueContainers.forEach(cont => cont.style.display = 'none');
        timeContainers.forEach(cont => cont.style.display = 'none');
    }
}

// Применение фильтров
function applyFilters() {
    const filtersContainer = document.getElementById('filters-container');
    // Собираем только строки фильтров
    const filterRows = Array.from(filtersContainer.children).filter(child => child.classList.contains('filter-row'));
    // Собираем только индикаторы логики
    const logicIndicators = Array.from(filtersContainer.children).filter(child => child.classList.contains('filter-logic-indicator'));
    const activeFilters = [];

    // Собираем активные фильтры
    filterRows.forEach((row, index) => {
        const filterType = row.querySelector('.filter-type').value;
        const valueContainer = row.querySelector('.filter-value-container');
        if (!filterType || valueContainer.style.display === 'none') return;
        let filterValue = '';
        switch(filterType) {
            case 'type':
            case 'title':
            case 'teacher':
            case 'course':
            case 'tutor':
            case 'pupil':
                const input = valueContainer.querySelector('.filter-value');
                filterValue = input ? input.value.trim() : '';
                break;
            case 'room':
                const roomInput = valueContainer.querySelector('input.filter-value');
                filterValue = roomInput ? roomInput.value.trim() : '';
                break;
        }
        if (filterValue && (typeof filterValue === 'string' ? filterValue.length > 0 :
            (filterValue.building || filterValue.number))) {
            // Определяем логику для этого фильтра
            let logic = 'and'; // По умолчанию "И" для первого фильтра
            if (index > 0 && logicIndicators[index - 1]) { // Логика - это индикатор ПЕРЕД текущей строкой
                logic = logicIndicators[index - 1].getAttribute('data-logic');
            }
            activeFilters.push({
                type: filterType,
                value: filterValue,
                logic: logic
            });
        }
    });

    // Если нет активных фильтров, показываем все события текущего дня
    if (activeFilters.length === 0) {
        filterByDay(currentDay); // <-- Вызываем filterByDay, чтобы восстановить состояние
        const resultDiv = document.getElementById('filter-result');
        resultDiv.textContent = 'Фильтры не применены. Показаны все мероприятия текущего дня.';
        resultDiv.style.color = '#888';
        return;
    }

    // --- ИСПРАВЛЕНИЕ ---
    // Применяем фильтры к событиям текущего дня
    let initialFiltered;
    if (currentDay === 'all') {
        initialFiltered = [...events]; // Все мероприятия
    } else {
        initialFiltered = events.filter(event => event.day_of_week === currentDay); // Только текущий день
    }
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    // Начинаем с первого фильтра (всегда "И" с начальным списком)
    let filtered = initialFiltered.filter(event => {
        const firstFilter = activeFilters[0];
        return checkEventAgainstFilter(event, firstFilter.type, firstFilter.value);
    });

    // Применяем остальные фильтры с учетом логики
    for (let i = 1; i < activeFilters.length; i++) {
        const currentFilter = activeFilters[i];
        const currentFilterEvents = initialFiltered.filter(event => {
            return checkEventAgainstFilter(event, currentFilter.type, currentFilter.value);
        });
        if (currentFilter.logic === 'or') {
            // Объединяем (ИЛИ) текущий результат с результатом текущего фильтра
            const combinedIds = new Set([...filtered.map(e => e.id), ...currentFilterEvents.map(e => e.id)]);
            filtered = initialFiltered.filter(event => combinedIds.has(event.id));
        } else { // 'and'
            // Пересекаем (И) текущий результат с результатом текущего фильтра
            const currentFilterIds = new Set(currentFilterEvents.map(e => e.id));
            filtered = filtered.filter(event => currentFilterIds.has(event.id));
        }
    }

    filteredEvents = filtered;

    // Обновляем отображение
    renderEvents();
    updateEventNames();

    // Показываем результат фильтрации
    const resultDiv = document.getElementById('filter-result');
    // Функция для форматирования значения фильтра
    function formatFilterValue(type, value) {
        if (type === 'room') {
            // Для типа "room" просто возвращаем введенное значение
            return value || 'любой';
        } else {
            // Для остальных типов просто возвращаем значение как строку
            return value.toString() || 'любой';
        }
    }
    resultDiv.innerHTML = `
Найдено мероприятий: <strong>${filteredEvents.length}</strong><br>
Применены фильтры: ${activeFilters.map((f, i) =>
`${i > 0 ? ` ${f.logic.toUpperCase()} ` : ''}${getFilterLabel(f.type)}: "${formatFilterValue(f.type, f.value)}"`
).join('')}
`;
    resultDiv.style.color = '#000';

    // Обновляем счетчик
    document.getElementById('today-count').textContent = filteredEvents.length;
}

function toggleLogicIndicator(event) {
    const indicator = event.currentTarget;
    const currentLogic = indicator.getAttribute('data-logic');
    const newLogic = currentLogic === 'and' ? 'or' : 'and';
    indicator.textContent = newLogic.toUpperCase();

    indicator.setAttribute('data-logic', newLogic);
    // Опционально: добавить визуальный эффект (например, кратковременное выделение)
    indicator.classList.add('toggled');
    setTimeout(() => {
        indicator.classList.remove('toggled');
    }, 200);
}

// Вспомогательная функция для проверки события по одному фильтру
function checkEventAgainstFilter(event, filterType, filterValue) {
    switch(filterType) {
        case 'type':
            return event.type_of_event.toLowerCase().includes(filterValue.toLowerCase());
        case 'title':
            return event.title.toLowerCase().includes(filterValue.toLowerCase());
        case 'teacher':
            return event.teacher.toLowerCase().includes(filterValue.toLowerCase());
        case 'room':
            // Если фильтр пустой, пропускаем все мероприятия
            if (!filterValue || filterValue.trim() === '') {
                return true;
            }
            
            const searchRoom = filterValue.toLowerCase().trim();
            const eventRoomFull = `${event.room.building}-${event.room.number}`.toLowerCase();
            const eventBuilding = event.room.building.toLowerCase();
            const eventNumber = event.room.number.toString().toLowerCase();
            
            // Если введено с дефисом, ищем точное совпадение
            if (searchRoom.includes('-')) {
                return eventRoomFull === searchRoom;
            }
            
            // Если введены только цифры, ищем по номеру
            if (/^\d+$/.test(searchRoom)) {
                return eventNumber.includes(searchRoom);
            }
            
            // Иначе ищем по зданию
            return eventBuilding.includes(searchRoom);
        case 'course':
            return event.course.toLowerCase().includes(filterValue.toLowerCase());
        case 'tutor':
            return event.tutor.toLowerCase().includes(filterValue.toLowerCase());
        case 'pupil':
            return event.pupils.some(pupil =>
                pupil.toLowerCase().includes(filterValue.toLowerCase())
            );
        default:
            return true;
    }
}

// Очистка фильтров
function clearFilters() {
    const filtersContainer = document.getElementById('filters-container');

    // Удаляем все строки фильтров и индикаторы, кроме первой строки фильтра
    const allChildren = Array.from(filtersContainer.children);
    for (let i = allChildren.length - 1; i >= 0; i--) { // Идём с конца
        const child = allChildren[i];
        // Удаляем всё, что не является первой строкой фильтра
        if (child.classList.contains('filter-row') && i === 0) {
            // Оставляем только первую строку
            // Очищаем поля в первой строке
            const selects = child.querySelectorAll('select');
            const inputs = child.querySelectorAll('input');
            selects.forEach(sel => sel.value = '');
            inputs.forEach(inp => inp.value = '');
            // Скрываем контейнеры значений и времени
            const valueContainers = child.querySelectorAll('.filter-value-container');
            const timeContainers = child.querySelectorAll('.time-filters');
            valueContainers.forEach(cont => cont.style.display = 'none');
            timeContainers.forEach(cont => cont.style.display = 'none');
        } else {
            // Удаляем любую строку (кроме первой, которая обработана выше) и любой индикатор
            child.remove();
        }
    }

    const resultDiv = document.getElementById('filter-result');
    resultDiv.textContent = '';

    // Восстанавливаем отображение текущего дня
    filterByDay(currentDay);
}

// Обновление статистики
function updateStatistics() {
    // Статистика по преподавателям
    const teacherStats = {};
    events.forEach(event => {
        if (!teacherStats[event.teacher]) {
            teacherStats[event.teacher] = 0;
        }
        const start = timeToMinutes(event.time.begining);
        const end = timeToMinutes(event.time.ending);
        const hours = (end - start) / 60;
        teacherStats[event.teacher] += hours;
    });
    
    let teacherHTML = '';
    Object.entries(teacherStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([teacher, hours]) => {
            teacherHTML += `<div>${teacher}: ${hours.toFixed(1)} ч</div>`;
        });
    
    document.getElementById('teacher-stats').innerHTML = teacherHTML || 'Нет данных';
    
    // Статистика по кабинетам
    const roomStats = {};
    events.forEach(event => {
        const room = `${event.room.building}-${event.room.number}`;
        if (!roomStats[room]) {
            roomStats[room] = 0;
        }
        roomStats[room]++;
    });
    
    let roomHTML = '';
    Object.entries(roomStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([room, count]) => {
            roomHTML += `<div>${room}: ${count} мероприятий</div>`;
        });
    
    document.getElementById('room-stats').innerHTML = roomHTML || 'Нет данных';
    
    // Статистика по типам мероприятий
    const typeStats = {};
    events.forEach(event => {
        if (!typeStats[event.type_of_event]) {
            typeStats[event.type_of_event] = 0;
        }
        typeStats[event.type_of_event]++;
    });
    
    let typeHTML = '';
    Object.entries(typeStats).forEach(([type, count]) => {
        const color = eventTypeColors[type] || '#888888';
        typeHTML += `<div>
            <span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; margin-right: 8px; border-radius: 2px;"></span>
            ${type}: ${count}
        </div>`;
    });
    
    document.getElementById('type-stats').innerHTML = typeHTML || 'Нет данных';
}

// Выгрузка в Excel с дополнительным листом "Все мероприятия"
function exportToExcel() {
    if (filteredEvents.length === 0) {
        alert('Нет данных для выгрузки');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    // 1. СОЗДАЕМ ЛИСТ "ВСЕ МЕРОПРИЯТИЯ" (первый лист)
    const allEventsData = [];
    
    // Заголовки для листа "Все мероприятия"
    allEventsData.push([
        '№ п/п',
        'ID мероприятия',
        'Название мероприятия',
        'Тип мероприятия',
        'День недели',
        'Время',
        'Продолжительность (часы)',
        'Преподаватель',
        'Куратор',
        'Кабинет',
        'Направление',
        'Количество учеников'
    ]);
    
    // Заполняем данными
    filteredEvents.forEach((event, index) => {
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
        const dayName = days[event.day_of_week - 1] || 'Неизвестно';
        
        // Рассчитываем продолжительность в часах
        const startMinutes = timeToMinutes(event.time.begining);
        const endMinutes = timeToMinutes(event.time.ending);
        const durationHours = ((endMinutes - startMinutes) / 60).toFixed(1);
        
        allEventsData.push([
            index + 1,
            event.id,
            event.title,
            event.type_of_event,
            dayName,
            `${event.time.begining}-${event.time.ending}`,
            durationHours,
            event.teacher,
            event.tutor,
            `${event.room.building}-${event.room.number}`,
            event.course,
            event.pupils.length
        ]);
    });
    
    const allEventsWs = XLSX.utils.aoa_to_sheet(allEventsData);
    XLSX.utils.book_append_sheet(wb, allEventsWs, 'Все мероприятия');
    
    // 2. СОЗДАЕМ ОТДЕЛЬНЫЕ ЛИСТЫ ПО НАПРАВЛЕНИЯМ (как было раньше)
    const eventsByCourse = {};
    filteredEvents.forEach(event => {
        const course = event.course || 'Без направления';
        if (!eventsByCourse[course]) {
            eventsByCourse[course] = [];
        }
        eventsByCourse[course].push(event);
    });
    
    Object.entries(eventsByCourse).forEach(([course, courseEvents]) => {
        const data = [];
        
        data.push([
            '№ п/п',
            'ID мероприятия',
            'Название мероприятия',
            'Кол-во посещающих',
            'Средняя посещаемость',
            'Преподаватели',
            'Расписание',
            'Кол-во часов в неделю'
        ]);
        
        courseEvents.forEach((event, index) => {
            const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
            const dayName = days[event.day_of_week - 1] || 'Неизвестно';
            
            data.push([
                index + 1,
                event.id,
                event.title,
                event.pupils.length,
                '', // Средняя посещаемость - оставляем пустым
                event.teacher,
                `${dayName} ${event.time.begining}-${event.time.ending}`,
                '' // Часы в неделю - оставляем пустым
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        // Ограничиваем длину названия листа 31 символом (ограничение Excel)
        const sheetName = course.length > 31 ? course.substring(0, 28) + '...' : course;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    
    // 3. СОЗДАЕМ ЛИСТ С КРАТКОЙ СТАТИСТИКОЙ (дополнительно, по желанию)
    const statsData = [];
    statsData.push(['СТАТИСТИКА ФИЛЬТРА', '']);
    statsData.push(['Всего мероприятий', filteredEvents.length]);
    
    // Статистика по типам мероприятий
    const typeStats = {};
    filteredEvents.forEach(event => {
        if (!typeStats[event.type_of_event]) {
            typeStats[event.type_of_event] = 0;
        }
        typeStats[event.type_of_event]++;
    });
    
    statsData.push(['', '']);
    statsData.push(['Статистика по типам', 'Количество']);
    
    Object.entries(typeStats).forEach(([type, count]) => {
        statsData.push([type, count]);
    });
    
    // Статистика по преподавателям
    const teacherStats = {};
    filteredEvents.forEach(event => {
        if (!teacherStats[event.teacher]) {
            teacherStats[event.teacher] = 0;
        }
        teacherStats[event.teacher]++;
    });
    
    // Сортируем по количеству мероприятий
    const sortedTeachers = Object.entries(teacherStats)
        .sort((a, b) => b[1] - a[1]);
    
    statsData.push(['', '']);
    statsData.push(['Топ преподавателей', 'Количество мероприятий']);
    
    sortedTeachers.slice(0, 10).forEach(([teacher, count]) => {
        statsData.push([teacher, count]);
    });
    
    const statsWs = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsWs, 'Статистика');
    
    // 4. ГЕНЕРИРУЕМ И СОХРАНЯЕМ ФАЙЛ
    const fileName = `Расписание_${new Date().toISOString().split('T')[0]}_${filteredEvents.length}_мероприятий.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    // Показываем сообщение об успехе
    alert(`Файл успешно сохранен как "${fileName}"\n\nВ файле содержится:\n- Лист "Все мероприятия": ${filteredEvents.length} записей\n- Листы по направлениям: ${Object.keys(eventsByCourse).length} направлений\n- Лист "Статистика": сводная информация`);
}

// Функция для обработки клика мышью
function handleCanvasClick(e) {
    e.preventDefault(); // Опционально, может помочь с поведением по умолчанию
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    findEventAtCoordinates(x, y);
}

// Функция для обработки touch события
function handleCanvasTouch(e) {
    e.preventDefault(); // Предотвращает стандартные жесты браузера
    if (e.touches.length > 0) { // Проверяем, что есть хотя бы один контакт
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0]; // Берем первый контакт
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        findEventAtCoordinates(x, y);
    }
}

// Вспомогательная функция для поиска события по координатам
function findEventAtCoordinates(x, y) {
    // Проходим по всем отфильтрованным событиям
    for (const event of filteredEvents) {
        // Проверяем, существуют ли координаты блока (canvasRect) и попадают ли x, y внутрь него
        if (event.canvasRect &&
            x >= event.canvasRect.x &&
            x <= event.canvasRect.x + event.canvasRect.width &&
            y >= event.canvasRect.y &&
            y <= event.canvasRect.y + event.canvasRect.height) {

            // Найдено совпадение, открываем модальное окно
            showEventDetails(event);
            // Важно: выходим из цикла, так как нас интересует только первое попавшееся событие
            // (в случае наложения блоков, может потребоваться логика z-index, но обычно первый подойдет)
            return;
        }
    }
    // Если цикл завершился и совпадений не нашлось, ничего не делаем
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ resizeCanvas
function resizeCanvas() {
    const container = eventsArea;
    const containerWidth = container.clientWidth;
    
    // Устанавливаем ширину canvas равной ширине контейнера
    canvas.width = containerWidth;
    
    // Высоту НЕ устанавливаем - она будет рассчитываться в renderEvents
    // canvas.height = container.clientHeight || 600;
    
    // Создаем временную шкалу с правильной шириной
    createTimeScale();
    
    // Перерисовываем сетку и события
    drawGrid();
    renderEvents();
}

// Вспомогательная функция для получения читаемого названия фильтра
function getFilterLabel(filterType) {
    const labels = {
        'type': 'Тип мероприятия',
        'title': 'Название мероприятия',
        'teacher': 'Учитель',
        'room': 'Кабинет',
        'course': 'Направление',
        'tutor': 'Куратор',
        'pupil': 'Ребенок'
    };
    return labels[filterType] || filterType;
}

function showAutocomplete(listElement, items, onSelectCallback) {
    listElement.innerHTML = ''; // Очищаем список

    if (items.length === 0) {
        listElement.parentElement.style.display = 'none'; // Скрываем контейнер, если нет совпадений
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        li.textContent = item;
        li.addEventListener('click', () => {
            onSelectCallback(item);
            listElement.parentElement.style.display = 'none'; // Скрываем после выбора
        });
        listElement.appendChild(li);
    });

    listElement.parentElement.style.display = 'block'; // Показываем контейнер
}

function initAutocomplete(inputElement, filterType, customData = null) {
    // Проверяем, есть ли уже обработчики для этого элемента
    if (inputElement.autocompleteInitialized) return;
    inputElement.autocompleteInitialized = true;

    const container = inputElement.parentElement.querySelector('.autocomplete-container');
    const listElement = container.querySelector('.autocomplete-list');

    if (!listElement) return;

    // Используем кастомные данные, если переданы, иначе - из глобального объекта
    let sourceData = customData || autocompleteData[filterType];
    if (!sourceData) sourceData = []; // Если данных нет, используем пустой массив

    let filteredItems = [...sourceData]; // Копируем массив

    inputElement.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        if (query.length === 0) {
            filteredItems = [...sourceData];
        } else {
            filteredItems = sourceData.filter(item =>
                item.toLowerCase().includes(query)
            );
        }
        showAutocomplete(listElement, filteredItems, (item) => { this.value = item; });
    });

    inputElement.addEventListener('focus', function() {
        const query = this.value.toLowerCase();
        if (query.length === 0) {
            filteredItems = [...sourceData];
        } else {
            filteredItems = sourceData.filter(item =>
                item.toLowerCase().includes(query)
            );
        }
        showAutocomplete(listElement, filteredItems, (item) => { this.value = item; });
    });

    inputElement.addEventListener('blur', function() {
        setTimeout(() => {
            container.style.display = 'none';
        }, 200);
    });
}
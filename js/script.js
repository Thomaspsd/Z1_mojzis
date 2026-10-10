const SEMESTER_START = new Date(2026, 8, 15);
const SEMESTER_END = new Date(2027, 1, 13, 23, 59, 59);

// Set up the map if it is on this page.
if (document.querySelector('#map')) {
    const map = L.map('map').setView([48.804, 19.636], 15);

    // Load the map tiles from OpenStreetMap.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Get the map controls and store the map points.
    const pointsList = document.querySelector('#map-points-list');
    const emptyMessage = document.querySelector('#map-points-empty');
    const startSelect = document.querySelector('#map-start');
    const targetSelect = document.querySelector('#map-target');
    const distanceText = document.querySelector('#map-distance');
    const destinations = {
        school: [48.151965, 17.072995],
        home: [48.80783, 19.6373]
    };
    const points = new Map();
    const customPoints = new Map();
    const STORAGE_KEY = 'map-custom-points';
    let nextPointId = 1;
    let connection = null;

    // Calculate the distance between two coordinates in kilometres.
    function haversine(start, end) {
        const toRadians = degrees => degrees * Math.PI / 180;
        const latitudeDifference = toRadians(end[0] - start[0]);
        const longitudeDifference = toRadians(end[1] - start[1]);
        const a = Math.sin(latitudeDifference / 2) ** 2 +
            Math.cos(toRadians(start[0])) * Math.cos(toRadians(end[0])) *
            Math.sin(longitudeDifference / 2) ** 2;
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    }

    // Show the distance and draw a line between the selected points.
    function updateDistance() {
        if (connection) connection.remove();
        connection = null;
        const start = points.get(startSelect.ue);
        if (!start) {
            distanceText.textContent = 'Vyber bod a cieľ na výpočet vzdialenosti.';
            return;
        }
        const target = destinations[targetSelect.value];
        const distance = haversine(start, target);
        distanceText.textContent = `Vzdialenosť vzdušnou čiarou: ${distance.toLocaleString('sk-SK', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        })} km.`;
        connection = L.polyline([start, target], { color: '#0052ff' }).addTo(map);
        map.fitBounds(connection.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }

    // Add a point to the map and the start dropdown.
    function addPoint(id, name, coordinates) {
        points.set(id, coordinates);
        startSelect.add(new Option(name, id));
        const popup = document.createElement('span');
        popup.textContent = name;
        const marker = L.marker(coordinates).addTo(map).bindPopup(popup);
        return marker;
    }

    // Add the default points and listen for selection changes.
    addPoint('school', 'FEI STU', destinations.school);
    addPoint('home', 'Domov', destinations.home);
    startSelect.addEventListener('change', updateDistance);
    targetSelect.addEventListener('change', updateDistance);

    // Save custom points in the browser for the next visit.
    function savePoints() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...customPoints.values()]));
        } catch (error) {
            console.warn('Body sa nepodarilo uložiť.', error);
        }
    }

    function addCustomPoint(name, coordinates) {
        const id = `point-${nextPointId++}`;
        const marker = addPoint(id, name, coordinates);
        customPoints.set(id, { name, coordinates });

        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Odstrániť';
        remove.setAttribute('aria-label', `Odstrániť bod ${name}`);
        // Remove the point from the map, list, dropdown and storage.
        remove.addEventListener('click', () => {
            marker.remove();
            item.remove();
            points.delete(id);
            customPoints.delete(id);
            savePoints();
            const option = [...startSelect.options].find(option => option.value === id);
            const wasSelected = startSelect.value === id;
            option.remove();
            if (wasSelected) {
                startSelect.value = '';
                updateDistance();
            }
            emptyMessage.hidden = pointsList.children.length > 0;
        });
        item.append(label, remove);
        pointsList.append(item);
        emptyMessage.hidden = true;
        return { id, marker };
    }

    // Load saved points and check their data before adding them.
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(saved)) {
            saved.filter(point => point && typeof point.name === 'string' && point.name.trim() &&
                Array.isArray(point.coordinates) && point.coordinates.length === 2 &&
                point.coordinates.every(Number.isFinite) && Math.abs(point.coordinates[0]) <= 90
            ).forEach(point => addCustomPoint(point.name, point.coordinates));
        }
    } catch (error) {
        console.warn('Uložené body sa nepodarilo načítať.', error);
    }

    // Ask for a name when the user clicks to add a point.
    map.on('click', event => {
        const input = window.prompt('Názov nového bodu:');
        const name = input?.trim();
        if (!name) return;

        const point = addCustomPoint(name, [event.latlng.lat, event.latlng.lng]);
        savePoints();
        point.marker.openPopup();
    });
}

// Set up the timetable if it is on this page.
if (document.querySelector('.schedule')) {
    const buttons = document.querySelectorAll('[data-filter]');
    const lessons = document.querySelectorAll('.exercise, .lecture, .sport');

    // Show lessons that match the selected type.
    function filterLessons(filter) {
        let visibleCount = 0;

        lessons.forEach(lesson => {
            const show = filter === 'all' || lesson.classList.contains(filter);
            lesson.classList.toggle('filtered-out', !show);
            if (show) visibleCount++;
        });

        document.querySelector('.schedule-empty').hidden = visibleCount > 0;
        document.querySelector('.schedule-scroll').hidden = visibleCount === 0;
    }

    // Apply the selected filter and mark its button as active.
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;

            filterLessons(filter);

            buttons.forEach(item => {
                const active = item === button;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', active);
            });

            updateCurrentLesson();
        });
    });

    // Highlight current lessons and find the next lesson.
    function updateCurrentLesson() {
        const now = new Date();
        const today = now.getDay();
        const currentMinute = now.getHours() * 60 + now.getMinutes();
        const currentLessons = [];
        let nextLesson = null;
        let shortestWait = Infinity;

        for (const lesson of lessons) {
            lesson.classList.remove('is-current');

            const day = Number(lesson.dataset.day);
            const hour = Number(lesson.dataset.hour);
            const start = hour * 60;
            const end = (hour + lesson.colSpan - 1) * 60 + 50;

            if (day === today && currentMinute >= start && currentMinute < end) {
                if (!lesson.classList.contains('filtered-out')) {
                    lesson.classList.add('is-current');
                }
                currentLessons.push(lesson.textContent.trim());
            }

            // If the start time has passed, use the same lesson next week.
            let wait = ((day - today + 7) % 7) * 1440 + start - currentMinute;
            if (wait <= 0) wait += 7 * 1440;
            if (wait < shortestWait) {
                shortestWait = wait;
                nextLesson = lesson;
            }
        }

        // Display the current or next lesson below the timetable.
        const status = document.querySelector('.schedule-status');
        const dayNames = ['', 'Po', 'Ut', 'St', 'Št', 'Pi'];
        if (currentLessons.length) {
            status.textContent = `Práve prebieha: ${currentLessons.join(', ')}.`;
        } else if (nextLesson) {
            status.textContent = `Teraz neprebieha žiadna hodina. Najbližšia: ${nextLesson.textContent.trim()}, ${dayNames[nextLesson.dataset.day]} o ${nextLesson.dataset.hour}:00.`;
        } else {
            status.textContent = 'V rozvrhu nie sú žiadne hodiny.';
        }
    }

    // Calculate semester progress and keep it between 0 and 100 percent.
    function updateSemester() {
        const elapsed = (new Date() - SEMESTER_START) / (SEMESTER_END - SEMESTER_START);
        const percent = Math.max(0, Math.min(100, Math.round(elapsed * 100)));

        document.querySelector('#semester-bar').value = percent;
        document.querySelector('#semester-bar').textContent = `${percent} %`;
        document.querySelector('#semester-percent').textContent = `${percent} %`;
    }

    // Show the initial timetable and refresh the status every minute.
    filterLessons('all');
    updateSemester();
    updateCurrentLesson();
    setInterval(() => {
        updateSemester();
        updateCurrentLesson();
    }, 60_000);
}

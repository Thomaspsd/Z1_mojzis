const map = L.map('map').setView([48.804, 19.636], 15);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const pointsList = document.querySelector('#map-points-list');
const emptyMessage = document.querySelector('#map-points-empty');
const startSelect = document.querySelector('#map-start');
const targetSelect = document.querySelector('#map-target');
const distanceText = document.querySelector('#map-distance');

const destinations = {
    school: [48.151965, 17.072995],
    home: [48.80783, 19.6373]
};
const points = {};
const customPoints = [];
const STORAGE_KEY = 'map-custom-points';
let nextPointId = 1;
let connection = null;

function haversineDistance(start, target) {
    const earthRadius = 6371; // Earth's radius in kilometres.
    const toRadians = degrees => degrees * Math.PI / 180;
    const startLatitude = toRadians(start[0]);
    const targetLatitude = toRadians(target[0]);
    const latitudeDifference = toRadians(target[0] - start[0]);
    const longitudeDifference = toRadians(target[1] - start[1]);
    
    const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(targetLatitude)
    * Math.sin(longitudeDifference / 2) ** 2;
    const clampedA = Math.min(1, Math.max(0, a));
    const centralAngle = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return earthRadius * centralAngle;
}

// line between start and finish from selected menu
function updateDistance() {
    if (connection) {
        connection.remove();
        connection = null;
    }

    const start = points[startSelect.value];
    const target = destinations[targetSelect.value];
    if (!start || !target) {
        distanceText.textContent = 'Vyber bod a cieľ na výpočet vzdialenosti.';
        return;
    }

    const kilometres = haversineDistance(start, target);
    const formattedDistance = kilometres.toLocaleString('sk-SK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    distanceText.textContent = `Vzdialenosť vzdušnou čiarou: ${formattedDistance} km.`;

    connection = L.polyline([start, target], { color: '#0052ff' }).addTo(map);
    map.fitBounds(connection.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

// every newly created point is added to startSelect (Menu)
function addPoint(id, name, coordinates) {
    points[id] = coordinates;
    startSelect.add(new Option(name, id));

    const popup = document.createElement('span');
    popup.textContent = name;
    return L.marker(coordinates).addTo(map).bindPopup(popup);
}

//custom points, add, remove, remove button, 
function addCustomPoint(name, coordinates) {
    const id = 'point-' + nextPointId;
    nextPointId++;

    const point = { name: name, coordinates: coordinates };
    customPoints.push(point);
    const marker = addPoint(id, name, coordinates);
    const option = startSelect.lastElementChild; // saves to the menu

    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = name;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Odstrániť';
    removeButton.addEventListener('click', function () {
        const wasSelected = startSelect.value === id;
        marker.remove();
        item.remove();
        option.remove();
        delete points[id];

        const index = customPoints.indexOf(point);
        customPoints.splice(index, 1); //removes point from customPoints[]
        savePoints();

        if (wasSelected) {
            startSelect.value = '';
            updateDistance();
        }
        emptyMessage.hidden = customPoints.length > 0;
    });

    item.append(label, removeButton); //appends into a website
    pointsList.append(item);
    emptyMessage.hidden = true;
    return marker;
}

function savePoints() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customPoints));
    } catch (error) {
        console.warn('Body sa nepodarilo uložiť.', error);
    }
}

function isValidPoint(point) {
    if (!point || typeof point.name !== 'string' || point.name.trim() === '') {
        return false;
    }
    if (!Array.isArray(point.coordinates) || point.coordinates.length !== 2) {
        return false;
    }

    const latitude = point.coordinates[0];
    const longitude = point.coordinates[1];
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90;
}

function loadPoints() {
    try {
        const savedText = localStorage.getItem(STORAGE_KEY) || '[]';
        const savedPoints = JSON.parse(savedText);
        if (!Array.isArray(savedPoints)) {
            return;
        }

        for (const point of savedPoints) {
            if (isValidPoint(point)) {
                addCustomPoint(point.name, point.coordinates);
            }
        }
    } catch (error) {
        console.warn('Uložené body sa nepodarilo načítať.', error);
    }
}

// itialize the map
addPoint('school', 'FEI STU', destinations.school);
addPoint('home', 'Domov', destinations.home);
loadPoints();

startSelect.addEventListener('change', updateDistance);
targetSelect.addEventListener('change', updateDistance);

map.on('click', function (event) {
    const input = window.prompt('Názov nového bodu:');
    if (input === null || input.trim() === '') {
        return;
    }

    const name = input.trim();
    const coordinates = [event.latlng.lat, event.latlng.lng];
    const marker = addCustomPoint(name, coordinates);
    savePoints();
    marker.openPopup();
});

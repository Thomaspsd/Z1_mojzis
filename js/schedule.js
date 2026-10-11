const SEMESTER_START = new Date(2026, 8, 15);
const SEMESTER_END = new Date(2027, 1, 13, 23, 59, 59);
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const buttons = document.querySelectorAll('[data-filter]');
const lessons = document.querySelectorAll('.exercise, .lecture, .sport');
const emptyMessage = document.querySelector('.schedule-empty');
const scheduleScroll = document.querySelector('.schedule-scroll');
const statusText = document.querySelector('.schedule-status');
const semesterBar = document.querySelector('#semester-bar');
const semesterPercent = document.querySelector('#semester-percent');
const dayNames = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

// filters out selected category
function filterLessons(filter) {
    let visibleCount = 0;

    for (const lesson of lessons) {
        const show = filter === 'all' || lesson.classList.contains(filter);
        lesson.classList.toggle('filtered-out', !show);
        if (show) {
            visibleCount++;
        }
    }

    emptyMessage.hidden = visibleCount > 0;
    scheduleScroll.hidden = visibleCount === 0;

    for (const button of buttons) {
        const active = button.dataset.filter === filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active);
    }
    updateCurrentLesson();
}

// calculates current lesson or next lesson
function updateCurrentLesson() {
    const now = new Date();
    const today = now.getDay();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const currentLessons = [];
    let nextLesson = null;
    let shortestWait = MINUTES_PER_WEEK;

    for (const lesson of lessons) {
        const day = Number(lesson.dataset.day);
        const hour = Number(lesson.dataset.hour);
        const startMinute = hour * 60;
        const endMinute = startMinute + lesson.colSpan * 60 - 10; // calculates endMinute based on how many colspan it covers
        const isCurrent = day === today && currentMinute >= startMinute && currentMinute < endMinute;
        const isVisible = !lesson.classList.contains('filtered-out');

        lesson.classList.toggle('is-current', isCurrent && isVisible);
        if (isCurrent) {
            currentLessons.push(lesson.textContent.trim());
        }

        let daysUntil = day - today;
        if (daysUntil < 0) {
            daysUntil += 7; //calculates for next week
        }
        let wait = daysUntil * MINUTES_PER_DAY + startMinute - currentMinute; //number of mins until next lesson
        if (wait <= 0) { //if lesson has started
            wait += MINUTES_PER_WEEK; //calculates for next week
        }
        if (nextLesson === null || wait < shortestWait) {
            shortestWait = wait;
            nextLesson = lesson;
        }
    }

    if (currentLessons.length > 0) {
        statusText.textContent = `Práve prebieha: ${currentLessons.join(', ')}.`;
    } else if (nextLesson) {
        const name = nextLesson.textContent.trim();
        const day = dayNames[nextLesson.dataset.day];
        const hour = nextLesson.dataset.hour;
        statusText.textContent = `Teraz neprebieha žiadna hodina. Najbližšia: ${name}, ${day} o ${hour}:00.`;
    } else {
        statusText.textContent = 'V rozvrhu nie sú žiadne hodiny.';
    }
}

// calculates 
function updateSemester() {
    const elapsedTime = new Date() - SEMESTER_START;
    const totalTime = SEMESTER_END - SEMESTER_START;
    let percent = Math.round(elapsedTime / totalTime * 100);

    if (percent < 0) {
        percent = 0;
    }
    if (percent > 100) {
        percent = 100;
    }

    semesterBar.value = percent;
    semesterBar.textContent = percent + ' %';
    semesterPercent.textContent = percent + ' %';
}

for (const button of buttons) {
    button.addEventListener('click', function () {
        filterLessons(button.dataset.filter);
    });
}

filterLessons('all');
updateSemester();
setInterval(function () {
    updateCurrentLesson();
    updateSemester();
}, 60 * 1000); //refresh every minute

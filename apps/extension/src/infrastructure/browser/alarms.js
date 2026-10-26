export function createPeriodicAlarm(name, periodInMinutes) {
    chrome.alarms.create(name, { periodInMinutes });
}

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export function getNotificationTimeLabel(timestamp: number): string {
    const currentTime = Date.now();
    const notificationDate = new Date(timestamp);
    const timeDifference = currentTime - timestamp;

    const diffMinutes = Math.floor(timeDifference / (1000 * 60));
    const diffHours = Math.floor(timeDifference / (1000 * 60 * 60));
    const diffDays = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        if (diffMinutes < 60) {
            return diffMinutes === 0 ? "Just now" : `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
        return `${diffDays}d ago`;
    }

    const today = new Date();
    const dayMonth = `${notificationDate.getDate()} ${MONTHS[notificationDate.getMonth()].substring(0, 3)}`;
    if (
        notificationDate.getMonth() === today.getMonth() &&
        notificationDate.getFullYear() === today.getFullYear()
    ) {
        return dayMonth;
    }
    return `${dayMonth} ${notificationDate.getFullYear()}`;
}

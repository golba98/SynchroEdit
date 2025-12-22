export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function ptToPx(pt) {
    return parseFloat(pt) * 1.333;
}

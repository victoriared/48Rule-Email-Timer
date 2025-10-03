// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveBtn');
    const statusEl = document.getElementById('status');
    const rule48 = document.getElementById('rule48');
    const rule24 = document.getElementById('rule24');

    // Load saved preference when the popup opens
    chrome.storage.sync.get('default_timer', (data) => {
        const defaultTimer = data.default_timer || '48'; // Default to 48 hours
        if (defaultTimer === '24') {
            rule24.checked = true;
        } else {
            rule48.checked = true;
        }
    });

    // Save preference when the button is clicked
    saveBtn.addEventListener('click', () => {
        const selectedRule = document.querySelector('input[name="timerRule"]:checked').value;

        chrome.storage.sync.set({ 'default_timer': selectedRule }, () => {
            statusEl.textContent = `Default set to ${selectedRule} hours.`;
            statusEl.classList.remove('hidden');
            setTimeout(() => statusEl.classList.add('hidden'), 2000);
        });
    });
});

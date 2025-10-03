// content.js
// This script runs on mail.google.com and injects the 48Rule timer next to email subjects.

// --- Configuration ---
// These selectors are specific to Gmail's structure. If the extension stops working, these need adjustment.
const GMAIL_INBOX_SELECTOR = 'div[role="main"]'; // Main container for the inbox view
const THREAD_ROW_SELECTOR = '.zA'; // Selector for individual email thread rows in the inbox list
const DATE_ELEMENT_SELECTOR = '.xW.xY'; // Element containing the date/time of the email (where the timer will be inserted)
const REPLY_INDICATOR_SELECTOR = '.fS'; // Indicator that an email has been replied to (e.g., 'Re: ')

// Global variable to hold the preferred default timer duration (in milliseconds)
let defaultTimerDurationMs = 48 * 60 * 60 * 1000;

// --- Utility Functions ---

/**
 * Loads the user's preferred default timer (24h or 48h) from Chrome storage.
 */
const loadDefaultTimer = () => {
    // The storage key is 'default_timer' (saved as '24' or '48')
    chrome.storage.sync.get('default_timer', (data) => {
        const selectedRule = data.default_timer || '48';
        const hours = parseInt(selectedRule, 10);
        defaultTimerDurationMs = hours * 60 * 60 * 1000;
        console.log(`48Rule: Timer set to ${hours} hours.`);
    });
};

/**
 * Checks if an email thread has been replied to.
 * This is based on finding the reply indicator element.
 * @param {HTMLElement} row The email thread row element.
 * @returns {boolean} True if replied, false otherwise.
 */
const hasBeenRepliedTo = (row) => {
    // Gmail often includes a reply/forward indicator (like a tiny arrow or 'Re:')
    return row.querySelector(REPLY_INDICATOR_SELECTOR) !== null;
};

/**
 * Formats a time duration in milliseconds into Hh Mm Ss format.
 * @param {number} ms Milliseconds remaining.
 * @returns {string} Formatted time string.
 */
const formatTime = (ms) => {
    if (ms <= 0) return 'TIME UP';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

/**
 * Creates and starts the timer element for a single email row.
 * @param {HTMLElement} row The email thread row element.
 */
const injectTimer = (row) => {
    // 1. Check if the timer already exists for this row
    if (row.querySelector('.forty-eight-rule-timer')) {
        return;
    }

    // 2. Determine if the email is unread
    // Unread threads usually have a specific font-weight or class; here we check for Gmail's read/unread class
    const isUnread = row.classList.contains('zE');

    // 3. Check if it has been replied to (if replied, no timer needed)
    if (hasBeenRepliedTo(row) || !isUnread) {
        return;
    }

    // 4. Find the date element where we will place the timer
    const dateElement = row.querySelector(DATE_ELEMENT_SELECTOR);
    if (!dateElement) {
        return;
    }

    // 5. Create the timer element
    const timerEl = document.createElement('span');
    timerEl.className = 'forty-eight-rule-timer';
    timerEl.style.cssText = 'color: #d93025; font-weight: bold; margin-left: 10px; font-size: 11px; white-space: nowrap;';
    
    // We assume the timer starts when the script sees the email for the first time.
    // In a real application, you might use a unique email ID saved in storage
    // to keep the start time persistent across browser restarts.
    const startTime = Date.now();
    const endTime = startTime + defaultTimerDurationMs;

    // 6. Define the update function
    const updateTimer = () => {
        const remainingMs = endTime - Date.now();
        const formattedTime = formatTime(remainingMs);

        timerEl.textContent = formattedTime;

        if (remainingMs <= 0) {
            timerEl.style.color = '#742a2a'; // Darker red for expired
            clearInterval(timerInterval);
        }
        
        // Dynamic check for reply (in case user replies without refreshing)
        if (hasBeenRepliedTo(row)) {
            timerEl.textContent = "REPLIED";
            timerEl.style.color = "#188038"; // Green for replied
            clearInterval(timerInterval);
        }
    };

    // 7. Insert the timer element and start the interval
    dateElement.parentNode.insertBefore(timerEl, dateElement.nextSibling);
    
    // Start interval immediately and then every second
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // 8. Add a "X" button to manually dismiss the timer
    const dismissBtn = document.createElement('span');
    dismissBtn.textContent = ' ✕';
    dismissBtn.style.cssText = 'color: #aaa; cursor: pointer; margin-left: 5px; font-weight: normal;';
    dismissBtn.onclick = () => {
        timerEl.textContent = "DISMISSED";
        timerEl.style.color = "#5f6368"; // Gray for dismissed
        clearInterval(timerInterval);
        dismissBtn.remove();
        // Optionally, save the dismissal state to chrome.storage here
    };
    timerEl.appendChild(dismissBtn);
};

/**
 * Main function to iterate over all thread rows and inject timers.
 * @param {HTMLElement} targetNode The element to search for email threads within.
 */
const processEmailThreads = (targetNode) => {
    // Check if we are in an environment where we expect email threads (e.g., inbox list, not a single thread view)
    if (!targetNode || !document.location.hash.includes('#inbox')) {
        return;
    }

    const emailRows = targetNode.querySelectorAll(THREAD_ROW_SELECTOR);
    emailRows.forEach(injectTimer);
};


// --- Mutation Observer Setup ---

/**
 * Sets up the MutationObserver to watch for dynamic changes in the Gmail DOM.
 */
const setupMutationObserver = () => {
    const inboxContainer = document.querySelector(GMAIL_INBOX_SELECTOR);

    if (!inboxContainer) {
        // If we can't find the main container, wait a bit and try again.
        setTimeout(setupMutationObserver, 500);
        return;
    }

    // Process threads immediately upon script load
    processEmailThreads(inboxContainer);

    // Set up the observer configuration
    const config = { childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            // We only care about new nodes being added (like when a new email list is rendered)
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Since the change could be deep within the DOM tree, we process all new nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches(THREAD_ROW_SELECTOR)) {
                         // Found a new email row directly added, inject timer
                        injectTimer(node);
                    } else if (node.nodeType === 1 && node.querySelector(THREAD_ROW_SELECTOR)) {
                        // Found a container that holds email rows, process all inside it
                        processEmailThreads(node);
                    }
                });
            }
        }
    };

    // Create and start the observer
    const observer = new MutationObserver(callback);
    observer.observe(inboxContainer, config);
    console.log("48Rule: Mutation Observer started on Gmail inbox.");
};


// --- Initialization ---

// 1. Load the user's timer preference
loadDefaultTimer();

// 2. Start watching the page for dynamic content changes
// Wait briefly for the main Gmail structure to load
window.addEventListener('load', () => {
    setupMutationObserver();
});

// 3. Also re-run the process when the hash (URL section after #) changes,
// which indicates navigation between folders (e.g., from Inbox to Sent).
window.addEventListener('hashchange', () => {
    setTimeout(() => {
        processEmailThreads(document.querySelector(GMAIL_INBOX_SELECTOR));
    }, 500); // Give Gmail a moment to render the new list
});

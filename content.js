// content.js
// This script runs on mail.google.com and injects the 48Rule timer next to email subjects.

// --- Configuration ---
const GMAIL_INBOX_SELECTOR = 'div[role="main"]'; // Main container for the inbox view
// Using a slightly more robust selector that includes the data-id attribute for better key retrieval
const THREAD_ROW_SELECTOR = '.zA[data-legacy-thread-id]'; 
const DATE_ELEMENT_SELECTOR = '.xW.xY'; // Element containing the date/time of the email
const REPLY_INDICATOR_SELECTOR = '.fS'; // Indicator that an email has been replied to (e.g., 'Re: ')
const STORAGE_KEY = 'rule_start_times'; // Master key for storing all thread start times

// Global variable to hold the preferred default timer duration (in milliseconds)
let defaultTimerDurationMs = 48 * 60 * 60 * 1000;

// --- Utility Functions ---

/**
 * Loads the user's preferred default timer (24h or 48h) from Chrome storage.
 */
const loadDefaultTimer = () => {
    chrome.storage.sync.get('default_timer', (data) => {
        const selectedRule = data.default_timer || '48';
        const hours = parseInt(selectedRule, 10);
        defaultTimerDurationMs = hours * 60 * 60 * 1000;
        console.log(`48Rule: Timer set to ${hours} hours.`);
    });
};

/**
 * Generates a unique, stable key for the thread using Gmail's attributes.
 * @param {HTMLElement} row The email thread row element.
 * @returns {string | null} The unique thread ID or null if not found.
 */
const getThreadKey = (row) => {
    // The data-legacy-thread-id attribute is typically stable for a thread.
    return row.getAttribute('data-legacy-thread-id');
};

/**
 * Checks if an email thread has been replied to.
 * @param {HTMLElement} row The email thread row element.
 * @returns {boolean} True if replied, false otherwise.
 */
const hasBeenRepliedTo = (row) => {
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
 * Creates and starts the persistent timer element for a single email row.
 * @param {HTMLElement} row The email thread row element.
 */
const injectTimer = (row) => {
    const threadKey = getThreadKey(row);

    // If we can't get a unique ID or timer already exists, exit
    if (!threadKey || row.querySelector('.forty-eight-rule-timer')) {
        return;
    }

    // Determine if the email is unread and not replied to
    const isUnread = row.classList.contains('zE');
    if (hasBeenRepliedTo(row) || !isUnread) {
        // If replied or read, we might want to clean up storage later, but for now, just exit
        return;
    }

    // Use Chrome Storage to manage persistence
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
        let timerStarts = data[STORAGE_KEY] || {};
        let startTime;
        let isNewTimer = false;

        // 1. Check for existing start time
        if (timerStarts[threadKey]) {
            startTime = timerStarts[threadKey];
        } else {
            // 2. If no start time exists, save the current time and mark as new
            startTime = Date.now();
            timerStarts[threadKey] = startTime;
            isNewTimer = true;
        }

        // 3. Save the updated map back to storage (only necessary if it's a new timer)
        if (isNewTimer) {
             // We must first read the storage key again in case another script instance saved a time
             // for a different thread between the initial get and this set operation.
             chrome.storage.sync.set({ [STORAGE_KEY]: timerStarts });
        }
        
        // 4. Calculate end time based on the persistent start time
        const endTime = startTime + defaultTimerDurationMs;
        const dateElement = row.querySelector(DATE_ELEMENT_SELECTOR);
        if (!dateElement) return;

        // 5. Create the timer element
        const timerEl = document.createElement('span');
        timerEl.className = 'forty-eight-rule-timer';
        timerEl.style.cssText = 'color: #d93025; font-weight: bold; margin-left: 10px; font-size: 11px; white-space: nowrap;';

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
            
            // Optionally remove from storage upon dismissal
            chrome.storage.sync.get(STORAGE_KEY, (data) => {
                let currentTimes = data[STORAGE_KEY] || {};
                delete currentTimes[threadKey];
                chrome.storage.sync.set({ [STORAGE_KEY]: currentTimes });
            });
        };
        timerEl.appendChild(dismissBtn);
    });
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

    // We must reload the default timer preference before processing threads
    loadDefaultTimer(); 

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

// The `loadDefaultTimer` is now called inside `processEmailThreads` for reliability.

// 1. Start watching the page for dynamic content changes
// Wait briefly for the main Gmail structure to load
window.addEventListener('load', () => {
    setupMutationObserver();
});

// 2. Also re-run the process when the hash (URL section after #) changes,
// which indicates navigation between folders (e.g., from Inbox to Sent).
window.addEventListener('hashchange', () => {
    setTimeout(() => {
        processEmailThreads(document.querySelector(GMAIL_INBOX_SELECTOR));
    }, 500); // Give Gmail a moment to render the new list
});

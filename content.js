// content.js
// This script runs on mail.google.com and injects the 48Rule timer next to email subjects.

// --- Configuration ---
const GMAIL_INBOX_SELECTOR = 'div[role="main"]'; 
const THREAD_ROW_SELECTOR = '.zA[data-legacy-thread-id]'; // Use a reliable selector for email thread rows
const DATE_ELEMENT_SELECTOR = '.xW.xY'; 
const REPLY_INDICATOR_SELECTOR = '.fS'; 
const STORAGE_KEY = 'rule_start_times'; // Master key for storing all thread start times

// --- Utility Functions ---

/**
 * Loads the user's preferred default timer (24h or 48h) from Chrome storage.
 * Returns a Promise that resolves with the duration in milliseconds.
 */
const getTimerDuration = () => {
    return new Promise(resolve => {
        chrome.storage.sync.get('default_timer', (data) => {
            const selectedRule = data.default_timer || '48';
            const hours = parseInt(selectedRule, 10);
            const durationMs = hours * 60 * 60 * 1000;
            console.log(`48Rule: DEBUG: Timer duration loaded: ${hours} hours.`);
            resolve(durationMs);
        });
    });
};

/**
 * Generates a unique, stable key for the thread using Gmail's attributes.
 * @param {HTMLElement} row The email thread row element.
 * @returns {string | null} The unique thread ID or null if not found.
 */
const getThreadKey = (row) => {
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
 * @param {number} durationMs The timer duration in milliseconds (guaranteed to be loaded).
 */
const injectTimer = (row, durationMs) => {
    const threadKey = getThreadKey(row);

    if (!threadKey) {
        // This is normal if a row is present without an ID yet
        return; 
    }
    if (row.querySelector('.forty-eight-rule-timer')) {
        // Timer is already running
        return;
    }

    const isUnread = row.classList.contains('zE');
    if (hasBeenRepliedTo(row) || !isUnread) {
        // Do not track emails that have been replied to or are already read
        return;
    }

    console.log(`48Rule: DEBUG: Attempting to inject timer for thread: ${threadKey}`);

    // Use Chrome Storage to manage persistence
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
        let timerStarts = data[STORAGE_KEY] || {};
        let startTime;
        let isNewTimer = false;

        // 1. Check for existing start time
        if (timerStarts[threadKey]) {
            startTime = timerStarts[threadKey];
            console.log(`48Rule: DEBUG: Existing timer loaded for ${threadKey}.`);
        } else {
            // 2. If no start time exists, save the current time and mark as new
            startTime = Date.now();
            timerStarts[threadKey] = startTime;
            isNewTimer = true;
            console.log(`48Rule: DEBUG: New timer started and saved for ${threadKey}.`);
        }

        // 3. Save the updated map back to storage (only if a new timer was started)
        if (isNewTimer) {
             chrome.storage.sync.set({ [STORAGE_KEY]: timerStarts });
        }
        
        // 4. Calculate end time based on the persistent start time and the loaded duration
        const endTime = startTime + durationMs;
        const dateElement = row.querySelector(DATE_ELEMENT_SELECTOR);
        if (!dateElement) {
            console.log(`48Rule: ERROR: Could not find date element for thread ${threadKey}.`);
            return;
        }

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
        console.log(`48Rule: SUCCESS: Timer element INJECTED for ${threadKey}.`);


        // 8. Add a "X" button to manually dismiss the timer
        const dismissBtn = document.createElement('span');
        dismissBtn.textContent = ' ✕';
        dismissBtn.style.cssText = 'color: #aaa; cursor: pointer; margin-left: 5px; font-weight: normal;';
        dismissBtn.onclick = () => {
            timerEl.textContent = "DISMISSED";
            timerEl.style.color = "#5f6368"; 
            clearInterval(timerInterval);
            dismissBtn.remove();
            
            // Remove from storage upon dismissal
            chrome.storage.sync.get(STORAGE_KEY, (data) => {
                let currentTimes = data[STORAGE_KEY] || {};
                delete currentTimes[threadKey];
                chrome.storage.sync.set({ [STORAGE_KEY]: currentTimes });
                console.log(`48Rule: DEBUG: Timer dismissed and removed from storage: ${threadKey}`);
            });
        };
        timerEl.appendChild(dismissBtn);
    });
};

/**
 * Main function to iterate over all thread rows and inject timers.
 * This is now the entry point for all processing.
 * @param {HTMLElement} targetNode The element to search for email threads within.
 * @param {number} durationMs The pre-loaded timer duration.
 */
const processEmailThreads = (targetNode, durationMs) => {
    console.log(`48Rule: DEBUG: processEmailThreads called (Duration: ${durationMs/3600000}h).`);
    
    if (!targetNode || !document.location.hash.includes('#inbox')) {
        return;
    }

    const emailRows = targetNode.querySelectorAll(THREAD_ROW_SELECTOR);
    console.log(`48Rule: DEBUG: Found ${emailRows.length} potential email rows.`);
    
    // Inject timer, passing the guaranteed duration
    emailRows.forEach(row => injectTimer(row, durationMs));
};


// --- Mutation Observer Setup ---

/**
 * Sets up the MutationObserver to watch for dynamic changes in the Gmail DOM.
 */
const setupMutationObserver = (durationMs) => {
    const inboxContainer = document.querySelector(GMAIL_INBOX_SELECTOR);

    if (!inboxContainer) {
        // Try again if the main container isn't ready
        setTimeout(() => setupMutationObserver(durationMs), 500);
        return;
    }

    // Process threads immediately upon script load, passing the duration
    processEmailThreads(inboxContainer, durationMs);

    const config = { childList: true, subtree: true };

    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches(THREAD_ROW_SELECTOR)) {
                        // Found a new email row directly added
                        injectTimer(node, durationMs);
                    } else if (node.nodeType === 1 && node.querySelector(THREAD_ROW_SELECTOR)) {
                        // Found a container that holds email rows
                        processEmailThreads(node, durationMs);
                    }
                });
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(inboxContainer, config);
    console.log("48Rule: Mutation Observer started on Gmail inbox.");
};


// --- Initialization ---

/**
 * Main entry point: Loads duration, then starts observer/processing.
 */
const initializeExtension = () => {
    // 1. Get the timer duration (this must happen first and is a promise)
    getTimerDuration()
        .then(durationMs => {
            // 2. Once duration is loaded, start the DOM watcher
            setupMutationObserver(durationMs);
        });
};


// Wait for the full page to load
window.addEventListener('load', initializeExtension);

// Also re-run processing on hashchange (navigation)
window.addEventListener('hashchange', () => {
    // Reload duration first, then process
    getTimerDuration()
        .then(durationMs => {
            setTimeout(() => {
                processEmailThreads(document.querySelector(GMAIL_INBOX_SELECTOR), durationMs);
            }, 500); // Wait for Gmail to render the new folder content
        });
});

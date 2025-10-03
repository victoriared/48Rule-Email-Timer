// content.js
// Optimized for Gmail (mail.google.com) structure.

// --- Utility Functions ---

/**
 * Formats a duration in seconds into H:MM:SS format.
 * @param {number} totalSeconds - The remaining time in seconds.
 * @returns {string} Formatted time string.
 */
const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) return '00:00:00';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return [hours, minutes, seconds]
        .map(v => v < 10 ? '0' + v : v)
        .join(':');
};

// --- DOM Manipulation and Timer Logic ---

/**
 * Creates and styles the timer element to inject into the DOM.
 * @param {string} emailId - The unique ID of the email thread.
 * @returns {HTMLElement} The styled timer container element.
 */
const createTimerElement = (emailId) => {
    const container = document.createElement('div');
    container.id = `48rule-timer-${emailId}`;
    container.className = '48rule-timer-container flex items-center space-x-2 py-0.5 px-2 rounded-full shadow-md transition-all duration-300 transform scale-90';
    container.style.cssText = 'font-family: sans-serif; position: absolute; right: 0; bottom: 0; z-index: 100; min-width: 100px; line-height: 1;';
    
    // Initial styling
    container.classList.add('bg-red-100');

    // The countdown display
    const countdown = document.createElement('span');
    countdown.className = 'timer-countdown text-xs font-extrabold text-red-700 tracking-wider';
    countdown.textContent = '48:00:00'; // Initial display
    container.appendChild(countdown);

    // Dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.innerHTML = '&#10005;'; // X mark
    dismissBtn.title = 'Dismiss Timer (Mark as Actioned)';
    dismissBtn.className = 'dismiss-btn h-4 w-4 flex items-center justify-center text-xs font-bold text-red-700 bg-red-300 hover:bg-red-400 rounded-full cursor-pointer transition-colors leading-none';
    dismissBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent opening the email when dismissing
        dismissTimer(emailId, container);
    };
    container.appendChild(dismissBtn);

    return container;
};

/**
 * Updates the storage entry to mark the timer as dismissed/replied.
 * @param {string} emailId - The unique ID of the email thread.
 * @param {HTMLElement} container - The DOM element to update/remove.
 */
const dismissTimer = (emailId, container) => {
    // 1. Clear any running interval for this specific timer
    const intervalId = container.dataset.intervalId;
    if (intervalId) {
        clearInterval(parseInt(intervalId, 10));
    }

    // 2. Update storage
    chrome.storage.local.get('active_timers', (data) => {
        const timers = data.active_timers || {};
        if (timers[emailId]) {
            timers[emailId].isDismissed = true;
            chrome.storage.local.set({ active_timers: timers }, () => {
                if (container && container.parentNode) {
                    // Visually confirm dismissal
                    container.textContent = 'ACTIONED';
                    container.className = 'bg-green-100 text-green-700 py-0.5 px-2 rounded-full shadow-md transform scale-90';
                    setTimeout(() => container.remove(), 500);
                }
            });
        }
    });
};

/**
 * Starts the countdown and updates the display.
 * @param {HTMLElement} countdownEl - The <span> element to update.
 * @param {number} endTimeMs - The absolute timestamp when the timer should end.
 * @param {string} emailId - The unique ID of the email thread.
 * @param {HTMLElement} container - The main timer container element.
 */
const startCountdown = (countdownEl, endTimeMs, emailId, container) => {
    const intervalId = setInterval(() => {
        const now = Date.now();
        const remainingMs = endTimeMs - now;
        const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        
        countdownEl.textContent = formatTime(remainingSeconds);

        // Update color for urgency
        if (remainingSeconds > 0) {
            if (remainingSeconds <= 3600) { // Less than 1 hour left
                container.classList.replace('bg-red-100', 'bg-yellow-200');
                countdownEl.classList.replace('text-red-700', 'text-yellow-800');
            } else {
                // Default style for > 1 hour
                container.classList.add('bg-red-100');
                countdownEl.classList.add('text-red-700');
            }
        }
        
        // Timer expired
        if (remainingSeconds <= 0) {
            clearInterval(intervalId);
            container.classList.remove('bg-red-100', 'bg-yellow-200');
            container.classList.add('bg-red-600');
            countdownEl.classList.remove('text-red-700', 'text-yellow-800');
            countdownEl.classList.add('text-white');
            countdownEl.textContent = 'EXPIRED!';
        }
        
        // External state check (e.g., replied in another tab)
        chrome.storage.local.get('active_timers', (data) => {
            const timers = data.active_timers || {};
            if (timers[emailId] && timers[emailId].isDismissed) {
                clearInterval(intervalId);
                dismissTimer(emailId, container);
            }
        });

    }, 1000);
    
    // Store interval ID on the container for later cleanup
    container.dataset.intervalId = intervalId.toString();
};


/**
 * Initializes the timer for a single email thread element (tr[role="row"]).
 * @param {HTMLElement} emailElement - The <tr> element for the email thread.
 */
const initializeTimer = async (emailElement) => {
    // Gmail uses data-legacy-thread-id, which is a perfect unique ID.
    const emailId = emailElement.getAttribute('data-legacy-thread-id');
    if (!emailId) return;

    // Check if the timer is already injected to prevent duplicates
    if (emailElement.querySelector(`#48rule-timer-${emailId}`)) {
        return;
    }
    
    // Check if the email is marked as 'read' or 'replied' by checking classes
    // Gmail uses 'zE' for unread and removes it for read/replied.
    // We only want to start timers on UNREAD emails.
    if (!emailElement.classList.contains('zE')) {
        // Assume read/replied or not a primary thread item, ignore.
        // In a real scenario, you'd check for a 'replied' icon, but class checking is simpler.
        return; 
    }

    // 2. Load the stored timers and default duration
    const localData = await new Promise(resolve => chrome.storage.local.get('active_timers', resolve));
    const syncData = await new Promise(resolve => chrome.storage.sync.get('default_timer', resolve));

    const activeTimers = localData.active_timers || {};
    const defaultHours = parseInt(syncData.default_timer || '48', 10);
    const durationMs = defaultHours * 60 * 60 * 1000;

    let timerEntry = activeTimers[emailId];

    if (timerEntry && (timerEntry.isDismissed || timerEntry.isReplied)) {
        // Timer was dismissed or replied to, do not display.
        return;
    }

    if (!timerEntry) {
        // New email, start a new timer
        timerEntry = {
            startTime: Date.now(),
            durationHours: defaultHours,
            isDismissed: false,
            isReplied: false,
        };
        activeTimers[emailId] = timerEntry;
        chrome.storage.local.set({ active_timers: activeTimers });
    }

    // 3. Calculate End Time
    const endTimeMs = timerEntry.startTime + durationMs;

    // 4. Inject Timer Element
    const timerEl = createTimerElement(emailId);
    
    // Target the <td> that holds the date/time information in Gmail (usually the 5th cell)
    const insertionPoint = emailElement.querySelector('td:nth-child(5)'); 
    
    if (insertionPoint) {
        insertionPoint.style.position = 'relative'; // Ensure timer is positioned correctly
        insertionPoint.appendChild(timerEl);
        
        // 5. Start Countdown
        const countdownEl = timerEl.querySelector('.timer-countdown');
        startCountdown(countdownEl, endTimeMs, emailId, timerEl);
    }
};


// --- Initialization using MutationObserver ---

/**
 * Observes the DOM for new email threads appearing on the screen.
 */
const observeEmailThreads = () => {
    // The main Gmail content area selector
    const mainContainerSelector = 'div[role="main"]'; 
    const mainContainer = document.querySelector(mainContainerSelector);

    if (!mainContainer) {
        // Retry if the main container isn't loaded yet (Gmail is slow to load)
        setTimeout(observeEmailThreads, 500);
        return;
    }
    
    // Gmail Thread Selector: tr with class zA (which represents a single row)
    const emailThreadSelector = 'tr.zA';

    // Process existing elements on load
    document.querySelectorAll(emailThreadSelector).forEach(initializeTimer);

    // Watch for new elements being added to the DOM (when scrolling, loading new pages, etc.)
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Check if it's an element
                        // Check if the added node itself is an email thread
                        if (node.matches(emailThreadSelector)) {
                            initializeTimer(node);
                        }
                        // Check for new threads within the added node (e.g., if a whole section was added)
                        node.querySelectorAll(emailThreadSelector).forEach(initializeTimer);
                    }
                });
            }
        }
    });

    // Start observing the target node for configured mutations
    observer.observe(mainContainer, { childList: true, subtree: true });
};


// Start the observation process when the content script loads
observeEmailThreads();

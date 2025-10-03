# 48Rule-Email-Timer

48Rule: Email Response Timer (Chrome Extension)



⏳ Respond, Don't Procrastinate

48Rule is a lightweight Chrome extension designed to combat email procrastination by holding you accountable to a self-imposed response deadline.



When you receive a new email, a timer automatically starts counting down from 48 hours (or your preferred 24-hour setting). The timer remains visible on the email until you reply or explicitly dismiss it, providing a constant, gentle nudge to keep your inbox moving.



✨ Features

Real-time Countdown: A visible timer (H:MM:SS) injected directly into the email list view.



Configurable Time Limit: Easily switch between 48-hour and 24-hour default limits via the extension popup menu.



Persistence: Timers are saved locally across browser sessions using Chrome Storage.



Dismissal: Ability to manually dismiss the timer (e.g., if the email requires no action).



Time Expired Alert: The timer visually changes when the deadline is reached.



🛠️ Installation (Developer Mode)

To load and test this extension locally:



Clone the Repository: Download or clone this project folder to your local machine.



Open Chrome Extensions: Navigate to chrome://extensions in your Google Chrome browser.



Enable Developer Mode: Toggle the Developer mode switch in the top-right corner.



Load Unpacked: Click the Load unpacked button and select the folder containing your extension files (manifest.json, content.js, etc.).



Pin the Extension: Click the puzzle icon next to the address bar, and pin the 48Rule icon for easy access to the settings popup.



⚙️ Configuration

Click the 48Rule extension icon.



Select your preferred default response time: 48 Hours or 24 Hours.



Click Save Settings. This setting will apply to all new emails going forward.



🤝 Contributing

Contributions are welcome! If you find a bug, have a feature request, or want to contribute code, please:



Fork the repository.



Create a new branch (git checkout -b feature/AmazingFeature).



Commit your changes (git commit -m 'Add AmazingFeature').



Push to the branch (git push origin feature/AmazingFeature).



Open a Pull Request.



Important Note on Compatibility

The core functionality in content.js relies on specific CSS selectors to identify and inject the timer into webmail clients. These selectors often break when mail services (like Gmail, Outlook) update their UI. Community contributions to maintain up-to-date selectors for various platforms are highly appreciated!



📜 License

This project is licensed under the MIT License. See the LICENSE file for details.


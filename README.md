**Outlook Account Creator (Puppeteer)**

*Overview*

This project is an automated Outlook account creator built using Node.js and Puppeteer.
It simulates real browser behavior to register Outlook accounts while integrating multiple external services for verification and anti-detection.

The script supports both headless and non-headless execution modes.

*Features*

- Automated Outlook account creation using Puppeteer
- OTP handling via FiveSim
- CAPTCHA solving via Anti-Captcha
- Proxy support for IP rotation
- Multiple and randomized User-Agent support
- Can run in headless or visible browser mode
- Human-like interaction flow
- Cookie injection to maintain session continuity
- Post-creation interaction simulation to reduce suspension risk

*Important Note on CAPTCHA*

⚠️ As of today, bypassing CAPTCHA has become a major challenge.
Outlook’s CAPTCHA and bot-detection mechanisms are continuously evolving, making automated solving unreliable even when using third-party CAPTCHA-solving services. Success rates may vary significantly depending on proxy quality, fingerprinting, and platform changes.

*Tech Stack*

- Node.js
- Puppeteer
- FiveSim API
- Anti-Captcha API
- JavaScript (ES6+)

*Disclaimer*

This project is intended for educational and research purposes only.
The author is not responsible for misuse or violations of Microsoft’s terms of service or any applicable laws.

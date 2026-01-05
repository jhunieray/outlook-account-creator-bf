const puppeteer = require('puppeteer');
const { newInjectedPage } = require('fingerprint-injector');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Utility delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Load proxy based on email
async function getProxyByEmail(email) {
    const proxiesFilePath = path.resolve(__dirname, '../exports/proxies.txt');
    return new Promise((resolve, reject) => {
        fs.readFile(proxiesFilePath, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            const lines = data.trim().split('\n');
            for (const line of lines) {
                const [csvEmail, ip, port, user, pass] = line.split(':');
                if (csvEmail === email) {
                    return resolve({ ip, port, user, pass });
                }
            }
            resolve(null);
        });
    });
}

// Load cookies into the page
async function loadLoginCookies(user, page) {
    const cookies = JSON.parse(fs.readFileSync('../exports/cookies.json', 'utf8'));
    let filteredCookies = cookies.filter(cookie => cookie.id === user && cookie.secure === true);
    for (let cookie of filteredCookies) {
        await page.setCookie({
            name: cookie.name,
            value: cookie.value,
            path: cookie.path,
            domain: cookie.domain,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite
        });
    }
    console.log('Cookies Loaded...');
    await page.reload();
}

// Setup puppeteer with proxy and fingerprint injection
async function setupBrowser(username) {
    const proxy = await getProxyByEmail(username);

    const launchOptions = 
      process.platform === "win32" ?
      {
        headless: false,
        args: []
      } :
      {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };

    if (proxy) {
        launchOptions.args.push(`--proxy-server=http=${proxy.ip}:${proxy.port}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await newInjectedPage(
        browser,
        {},
    );

    if (proxy) {
        await page.authenticate({
            username: proxy.user,
            password: proxy.pass
        });
    }

    await page.setDefaultTimeout(3600000);

    
    return {browser, page};
}

// Get a random email from file
async function getRandomEmail(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const randomIndex = Math.floor(Math.random() * lines.length);
        const randomLine = lines[randomIndex];
        const [email] = randomLine.split(':');
        return email;
    } catch (err) {
        console.error('Error reading the file:', err);
        throw err;
    }
}

// Function to extract names from email
const formatName = (name) => {
    const cleanedName = name.replace(/\d+/g, '');
    return cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1).toLowerCase();
};

const extractNames = (email) => {
    const localPart = email.split('@')[0];
    const [firstName, lastName] = localPart.split('.');
    return {
        firstName: formatName(firstName),
        lastName: formatName(lastName),
    };
};

// Main function for Yahoo login
async function mainFunction() {
    const filePath = path.join(__dirname, '../exports/credentials.txt');
    const data = await fs.promises.readFile(filePath, 'utf8');
    const lines = data.split('\n');

    for (let line of lines) {
        if (line.trim()) {
            let [username, password] = line.split(':');
            console.log(`Username: ${username}, Password: ${password}`);

            const { browser, page } = await setupBrowser(username);

            try {
                await page.goto('https://login.yahoo.com/?.src=ym&done=https%3A%2F%2Fmail.yahoo.com%2F', { waitUntil: 'domcontentloaded' });
                await loadLoginCookies(username, page);

                try {
                    // Perform Yahoo login process here
                    await page.type('#login-username', username);
                    await page.click('#login-signin');
                    await delay(3000);
                    await page.type('#login-passwd', password);
                    await page.click('#login-signin');
                } catch(err) {}

                await delay(5000);
                console.log('Logged in successfully');
                
                // Additional actions, such as handling email replies, sending messages, etc.

                // Locate and handle the abuse section
                try {
                    const abuse = await page.waitForSelector('#serviceAbuseLandingTitle', { timeout: 10000 });
                    if (abuse) {
                        console.log('abuse');
                        // await deleteAccount(`${username}:${password}`);
                    }
                } catch (err) {}

                await delay(2000);

                // Handle not-now button
                try {
                    const notNowButton = await page.waitForSelector('.not-now', { timeout: 10000 });
                    await notNowButton.click();
                } catch (err) {}

                await delay(2100);

                // Handle mail-accept-all button
                try {
                    const acceptAllButton = await page.waitForSelector('#mail-accept-all-1', { timeout: 10000 });
                    await acceptAllButton.click();

                    await delay(2210);

                    const doneButton = await page.waitForSelector('.done-button', { timeout: 10000 });
                    await doneButton.click();
                } catch (err) {}

                await delay(2340);

                // Handle additional accept-all button
                try {
                    const acceptAllButton2 = await page.waitForSelector('.accept-all', { timeout: 10000 });
                    await acceptAllButton2.click();
                } catch (err) {}

                await delay(2000);

                // Handle another element click
                try {
                    const anotherButton = await page.waitForSelector('.it3_dBP', { timeout: 10000 });
                    await anotherButton.click();
                } catch (err) {}

                await delay(5000);

                try {
                    const allMsg = await page.waitForSelector('button[data-category="all"]', { timeout: 10000 });
                    await allMsg.click();
                    console.log('switching to all messages!');
                } catch(err) {}

                let randomNumber = Math.floor(Math.random() * 4) + 2; // Random number between 2 and 5

                // Compose emails based on the random number
                for (let i = 0; i < randomNumber; i++) {
                    try {
                        let composeButton = null;
                        try {
                            composeButton = await page.waitForSelector('button[data-test-id="left-rail-Compose-icon"]', { timeout: 20000 });
                        } catch(err) {
                            composeButton = await page.waitForSelector('a[data-test-id="compose-button"]', { timeout: 20000 });
                        }

                        await composeButton.click();
                        console.log('Compose clicked!');

                        let mtemplates = fs.readFileSync('browser/email_templates.json', 'utf-8');
                        if (mtemplates.trim()) {
                            mtemplates = JSON.parse(mtemplates);
                        }

                        if (Array.isArray(mtemplates) && mtemplates.length > 0) {
                            const recipient = await getRandomEmail('../exports/credentials.txt');
                            const { firstName, lastName } = extractNames(recipient);

                            let t = mtemplates[Math.floor(Math.random() * mtemplates.length)];
                            let tbody = t.body.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                            tbody = tbody.replace('[recipient]', recipient);
                            tbody = tbody.replace('[email]', username);
                            tbody = tbody.replace('[full_name]', `${firstName} ${lastName}`);

                            await page.waitForSelector('#message-to-field', { timeout: 10000 });
                            await page.type('#message-to-field', recipient);

                            await page.waitForSelector('#compose-subject-input', { timeout: 10000 });
                            await page.type('#compose-subject-input', t.subject);

                            const replyText = await page.waitForSelector('div[data-test-id="rte"]', { timeout: 10000 });
                            await page.evaluate((tbody, replyText) => {
                                replyText.innerHTML += `<div dir="ltr">${tbody}</div>`;
                            }, tbody, replyText);

                            const sendButton = await page.waitForSelector('button[data-test-id="compose-send-button"]', { timeout: 20000 });
                            await sendButton.click();

                            console.log('Email sent!');
                        } else {
                            console.error('No email templates found.');
                        }

                        await delay(5496);
                    } catch (err) {
                        console.error(err);
                    }
                }

                try {
                    const allMsg = await page.waitForSelector('button[data-category="all"]', { timeout: 10000 });
                    await allMsg.click();
                    console.log('switching to all messages!');
                } catch(err) {}

                // Iterate over found messages
                try {
                    const messages = await page.$$('.c22hqzz_GN > ul > li');
                    const elementsCount = messages.length;
                    const max = elementsCount < 5 ? elementsCount : 5;
                    randomNumber = Math.floor(Math.random() * (max - 2 + 1)) + 2;

                    for (let i = 0; i < randomNumber; i++) {
                        try {
                            const message = messages[i];
                            await message.click();
                            console.log('Message clicked!');

                            await delay(5000);

                            // Find the reply button and click
                            try {
                                const replyButton = await page.waitForSelector('button[data-test-id="card-toolbar-button-reply"]', { timeout: 20000 });
                                await replyButton.click();
                            } catch (err) {
                                console.log('Failed to find reply button.');
                            }

                            // Load templates and fill reply body
                            let templates = fs.readFileSync('browser/email_templates.json', 'utf-8');
                            if (templates.trim()) {
                                templates = JSON.parse(templates);
                            }

                            if (Array.isArray(templates) && templates.length > 0) {
                                let template = templates[Math.floor(Math.random() * templates.length)];
                                template = template.body.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                                template = template.replace('[email]', username);

                                const replyTextArea = await page.waitForSelector('div[data-test-id="rte"] > div', { timeout: 20000 });
                                await page.evaluate((template, replyTextArea) => {
                                    replyTextArea.innerHTML += `<div dir="ltr">${template}</div>`;
                                }, template, replyTextArea);

                                await delay(3000);

                                // Send the reply
                                const sendButton = await page.waitForSelector('button[data-test-id="compose-send-button"]', { timeout: 20000 });
                                await sendButton.click();

                                await delay(30000);
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                } catch (err) {
                    console.error(err);
                }

                await delay(2000);

            } catch (err) {
                console.error(err);
            } finally {
                await browser.close();
            }
        }
    }
}

// Run the main function
mainFunction();

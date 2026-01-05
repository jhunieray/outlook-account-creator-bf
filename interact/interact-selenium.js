const { Builder, By, until, Select, TimeoutError } = require('selenium-webdriver');
const { newInjectedPage } = require('fingerprint-injector');
const firefox = require('selenium-webdriver/firefox');
// const chrome = require('selenium-webdriver/chrome');
const { delay } = require('./utils');
const CapSolver = require('node-capsolver');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const csv = require('csv-parser');
const proxyy = require('selenium-webdriver/proxy');
const readline = require('readline');
require('chromedriver');

let options = new firefox.Options();
// let options = new chrome.Options();
let proxy = null;

async function loadLoginCookies(user, driver) {
    const cookies = JSON.parse(fs.readFileSync('../exports/cookies.json', 'utf8'));

    let filteredCookies = cookies.filter(cookie => cookie.id === user  && cookie.secure === true);

    for (let cookie of filteredCookies) {
        try {
            await driver.manage().addCookie({
                name: cookie.name,
                value: cookie.value,
                path: cookie.path,
                domain: cookie.domain,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite
            });
        } catch (err) {console.error(err);}
    }
    console.log('Cookies Loaded...');
    await driver.navigate().refresh();
}

async function getProxyByEmail(email) {
    const proxiesFilePath = path.resolve(__dirname, '../exports/proxies.txt'); // Path to your text file

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

async function setupDriver(username) {

    // options.addArguments('-headless');

    proxy = await getProxyByEmail(username);

    if(proxy) {

        // Set proxy settings
        options.setPreference('network.proxy.type', 1);
        options.setPreference('network.proxy.http', proxy.ip);
        options.setPreference('network.proxy.http_port', parseInt(proxy.port));
        options.setPreference('network.proxy.ssl', proxy.ip);
        options.setPreference('network.proxy.ssl_port', parseInt(proxy.port));
        options.setPreference('network.proxy.no_proxies_on', '');
        options.setPreference('network.proxy.share_proxy_settings', true);

        // options.setProxy({
        //     proxyType: 'manual',
        //     httpProxy: `${proxy.ip}:${proxy.port}`,
        //     sslProxy: `${proxy.ip}:${proxy.port}`,
        //     noProxy: []
        // });
        // options.addArguments(`--proxy-server=https://${proxy.ip}:${proxy.port}`);
    }

    let driver = await new Builder()
        .forBrowser('firefox')
        // .forBrowser('chrome')
        .setFirefoxOptions(options)
        // .setChromeOptions(options)
        .build();

    const page = await newInjectedPage(
        driver,
        {},
    );

    return page;
}

async function loginProxy(page, proxy) {
  if (proxy) {
    await page.authenticate({
      username: proxy.user,
      password: proxy.pass
    });
  }
}

async function deleteAccount(account) {
    // Read the file line by line
    const readStream = fs.createReadStream('../exports/credentials.txt');
    const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity
    });

    let lines = [];

    rl.on('line', (line) => {
        // Add lines to array, excluding the line to delete
        if (line.trim() !== account.trim()) {
            lines.push(line);
        }
    });

    rl.on('close', () => {
        // Write the updated lines back to the file
        fs.writeFile('../exports/credentials.txt', lines.join('\n'), (err) => {
            if (err) {
                console.error('Error writing file:', err);
            } else {
                console.log(`${account} has been deleted from the file.`);
            }
        });
    });
}

async function getRandomEmail(filePath) {
    try {
        // Read the file asynchronously
        const data = await fs.promises.readFile(filePath, 'utf8');
        
        // Split the data by newlines to get each line as an array element
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        // Get a random index from the array
        const randomIndex = Math.floor(Math.random() * lines.length);
        
        // Extract the random line (formatted as email:password)
        const randomLine = lines[randomIndex];
        
        // Split the line by ':' to separate email and password
        const [email] = randomLine.split(':');

        // Return the email
        return email;
    } catch (err) {
        console.error('Error reading the file:', err);
        throw err;
    }
}


(async function mainFunction() {
    const filePath = path.join(__dirname, '../exports/credentials.txt');

    fs.readFile(filePath, 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        let lines = data.split('\n');

        for (let line of lines) {
            if (line.trim()) {
                let [username, password] = line.split(':');
                console.log(`Username: ${username}, Password: ${password}`);

                let driver = await setupDriver(username);

                try {

                    await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

                    await driver.get(`https://login.yahoo.com/?.src=ym&done=https%3A%2F%2Fmail.yahoo.com%2F`);

                    await loginProxy(driver, proxy);

                    console.log('Waiting for the "Login" link...');

                    await loadLoginCookies(username, driver);

                    await delay(5000);

                    try {
                        await driver.wait(until.elementLocated(By.id('login-username')), 10000);
                        console.log('usernameInput input located.');

                        await driver.findElement(By.id('login-username')).sendKeys(`${username}`);
            
                        let nextButton = await driver.wait(until.elementLocated(By.id('login-signin')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);

                        await delay(3000);

                        await driver.wait(until.elementLocated(By.id('login-passwd')), 10000);
                        console.log('password input located.');

                        await driver.findElement(By.id('login-passwd')).sendKeys(`${password}`);

                        nextButton = await driver.wait(until.elementLocated(By.id('login-signin')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);
                    } catch (err) {}

                    await delay(3000);

                    try {
                        let abuse = await driver.wait(until.elementLocated(By.id('serviceAbuseLandingTitle')), 10000);
                        
                        if(abuse) {
                            console.log('abuse');
                            // await deleteAccount(`${username}:${password}`);
                        }

                    } catch(err) {}

                    await delay(2000);

                    try {
                        nextButton = await driver.wait(until.elementLocated(By.css('.not-now')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);
                    } catch(err) {}

                    await delay(2100);

                    try {
                        nextButton = await driver.wait(until.elementLocated(By.id('mail-accept-all-1')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);

                        await delay(2210);

                        nextButton = await driver.wait(until.elementLocated(By.css('.done-button')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);
                    } catch(err) {}

                    await delay(2340);

                    try {
                        nextButton = await driver.wait(until.elementLocated(By.css('.accept-all')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);
                    } catch(err) {}

                    await delay(2000);

                    try {
                        nextButton = await driver.wait(until.elementLocated(By.css('.it3_dBP')), 10000);
                        await driver.executeScript("arguments[0].click();", nextButton);
                    } catch(err) {}

                    await delay(5000);

                    let randomNumber = Math.floor(Math.random() * (5 - 2 + 1)) + 2;

                    try {
                        let elements = await driver.findElements(By.css('.c22hqzz_GN > ul > li'));

                        let elementsCount = elements.length;
                        let max = elementsCount < 5 ? elementsCount : 5;
                        randomNumber = Math.floor(Math.random() * (max - 2 + 1)) + 2;

                        let ctr = 0;
                        for (let element of elements) {

                            if(ctr>randomNumber) { break; }

                            try {
                                console.log('Message found.');
                                let actions = driver.actions({ async: true });

                                await actions.move({ origin: element }).click().perform();
                                console.log('Performed click!');

                                await delay(5000);

                                let reply = await driver.wait(until.elementLocated(By.css('button[data-test-id="card-toolbar-button-reply"]')), 20000);
                                console.log('Reply located');

                                try {
                                    await actions.move({ origin: reply }).click().perform();
                                    console.log('Reply clicked by webdriver!');
                                } catch(err) {
                                    await driver.executeScript("arguments[0].click();", reply);
                                    console.log('Reply clicked by javascript!');
                                }

                                let templates = fs.readFileSync('browser/email_templates.json', 'utf-8');

                                if (templates.trim()) {
                                    templates = JSON.parse(templates);
                                }

                                if (Array.isArray(templates) && templates.length > 0) {
                                    let template = templates[Math.floor(Math.random() * templates.length)];
                                    template = template.body;
                                    template = template.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                                    // template = template.replace('[recipient]', recipient);
                                    template = template.replace('[email]', username);
                                    // template = template.replace('[full_name]', `${firstName} ${lastName}`);

                                    let replyText = await driver.wait(until.elementLocated(By.css('.ydp6314ac0yahoo-style-wrap')), 20000);

                                    await delay(2000);

                                    await driver.executeScript(`arguments[0].innerHTML += '<div dir="ltr" data-setdir="false">${template}</div>';`, replyText);

                                    await delay(3000);

                                    let send = await driver.wait(until.elementLocated(By.css('button[data-test-id="compose-send-button"]')), 20000);
                                    
                                    await driver.executeScript("arguments[0].click();", send);

                                    await delay(30000);
                                } else {
                                    console.error("No templates available ");
                                }

                                ctr++;
                            } catch(err) {console.error(err);}
                        }                            

                    } catch(err) {}

                    await delay(2000);

                    for(let i=0; i<randomNumber; i++) {

                        try {
                            let compose = await driver.wait(until.elementLocated(By.css('button[data-test-id="compose-button"]')), 20000);
                            console.log('Compose mail...');
                            let mouse = driver.actions({ async: true });

                            await mouse.move({ origin: compose }).click().perform();
                            console.log('Compose clicked!');

                            let mtemplates = fs.readFileSync('browser/email_templates.json', 'utf-8');

                            if (mtemplates.trim()) {
                                mtemplates = JSON.parse(mtemplates);
                            }

                            if (Array.isArray(mtemplates) && mtemplates.length > 0) {
                                const recipient = await getRandomEmail(filePath);

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

                                // Get the formatted names
                                const { firstName, lastName } = extractNames(email);

                                let t = mtemplates[Math.floor(Math.random() * mtemplates.length)];
                                let tbody = t.body;
                                tbody = tbody.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                                tbody = tbody.replace('[recipient]', recipient);
                                tbody = tbody.replace('[email]', username);
                                tbody = tbody.replace('[full_name]', `${firstName} ${lastName}`);


                                await driver.wait(until.elementLocated(By.id('message-to-field')), 10000);
                                console.log('Recepient input located.');
                                await driver.findElement(By.id('message-to-field')).sendKeys(`${recipient}`);

                                await driver.wait(until.elementLocated(By.id('compose-subject-input')), 10000);
                                console.log('Subject input located.');
                                await driver.findElement(By.id('compose-subject-input')).sendKeys(`${t.subject}`);

                                let replyText = await driver.wait(until.elementLocated(By.css('div[data-test-id="rte"]')), 10000);
                                await driver.executeScript(`arguments[0].innerHTML += '<div dir="ltr" data-setdir="false">${tbody}</div>';`, replyText);

                                let send = await driver.wait(until.elementLocated(By.css('button[data-test-id="compose-send-button"]')), 20000);
                                await mouse.move({ origin: send }).click().perform();
                                console.log('Sending email...');
                            } else {
                                console.error('No email templates found...');
                            }

                            await delay(5496);
                        
                        } catch(err) {}
                    }

                    console.log('Account interaction done on this account.');

                } catch(err) {
                    console.error(err);
                } finally {
                    await driver.quit();
                }
            }
        }
    });
})();

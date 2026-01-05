// const { newInjectedPage } = require('fingerprint-injector');
// const { plugin } = require('puppeteer-with-fingerprints');
// const puppeteer = require('puppeteer');
const fs = require("fs");
const path = require('path');
const csv = require('csv-parser');
const config = require('./config');
const recMail = require('./utility/recMail');
const { FiveSim } = require('node-five-sim');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer'); 
const Captcha = require('@2captcha/captcha-solver');

const ac = require("@antiadmin/anticaptchaofficial");

const solver = new Captcha.Solver("dc02a782990976ecdf3ce0117c6cc874");

const fiveSim = new FiveSim({ token: config.FIVESIMTOKEN });
const product = 'yahoo';
const forSplit = process.platform === "win32" ? "\r\n" : "\n";
let err_ctr = 0;
let countries = [];
let proxy = null;

async function start() {

  ac.setAPIKey('f004705f2398bc68bd9190843aa5069c');

  const browserOptions = 
  process.platform === "win32" ?
  {
    headless: false,
    ignoreDefaultArgs: [
        "--disable-extensions",
        "--enable-automation"
    ],
    args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--mute-audio',
        '--no-zygote',
        '--no-xshm',
        '--window-size=1920,1080',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--enable-webgl',
        '--ignore-certificate-errors',
        '--lang=en-US,en;q=0.9',
        '--password-store=basic',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-infobars',
        '--disable-breakpad',
        '--disable-canvas-aa',
        '--disable-2d-canvas-clip-aa',
        '--disable-gl-drawing-for-tests',
        '--enable-low-end-device-mode'
      ]
    // executablePath: executablePath()
  } :
  {
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  // Load CapsSolver extension
  // const capsSolverExtensionPath = path.join(__dirname, config.CAPSOLVER_PATH);
  // browserOptions.args.push(`--disable-extensions-except=${capsSolverExtensionPath}`);
  // browserOptions.args.push(`--load-extension=${capsSolverExtensionPath}`);

  // Use proxy if configured
  if (config.USE_PROXY) {
    proxy = await getRandomProxyFromCSV('utility/newest_proxies.csv');
    console.log(proxy);
    browserOptions.args.push(`--proxy-server=socks5://${proxy.ip}:${proxy.port}`);
  }

  puppeteer.use(StealthPlugin());
  puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

  const browser = await puppeteer.launch(browserOptions);

  // const page = await newInjectedPage(
  //     browser,
  //     {},
  // );
  const [page] = await browser.pages();

  // Setup proxy authentication if a proxy is used
  if (config.USE_PROXY && proxy!=null) {
    // await loginProxy(page, proxy);
  }


  // const fingerprint = await plugin.fetch('', {
  //   tags: ['Microsoft Windows', 'Chrome'],
  // });
  // plugin.useFingerprint(fingerprint);

  // if (config.USE_PROXY) {
  //   const proxy = await getRandomProxyFromCSV('utility/proxies_random_countries.csv');
  //   console.log(proxy);

  //   //  const browser = await plugin.launch({
  //   //   // This argument will be ignored if the `useProxy` method has been called.
  //   //   args: [`--proxy-server=${proxy}`],
  //   // });

  //   plugin.useProxy(`${proxy.ip}:${proxy.port}@${proxy.user}:${proxy.pass}`, {
  //     detectExternalIP: true,
  //     changeGeolocation: true,
  //     changeBrowserLanguage: true,
  //     changeTimezone: true,
  //     changeWebRTC: true,
  //   });
  // }

  // const capsSolverExtensionPath = path.join(__dirname, config.CAPSOLVER_PATH);

  // const browser = await plugin.launch({
  //   headless: false,
  //   args: [
  //     `--disable-extensions-except=${capsSolverExtensionPath}`,
  //     `--load-extension=${capsSolverExtensionPath}`
  //   ]
  // });  

  await page.setDefaultTimeout(3600000);

  try {
    await createAccount(page);
  }  catch(err) {
    console.error(err);
  }
  finally {
    await page.close();
    await browser.close();
  }
}

async function loginProxy(page, proxy) {
  if (proxy) {
    await page.authenticate({
      username: proxy.user,
      password: proxy.pass
    });
  }
}

async function getRandomProxyFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const proxies = [];

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ':' }))
      .on('data', (row) => {
        proxies.push({
          ip: row.ip,
          port: row.port
          // user: row.user,
          // pass: row.pass
        });
      })
      .on('end', () => {
        if (proxies.length > 0) {
          const randomIndex = Math.floor(Math.random() * proxies.length);
          resolve(proxies[randomIndex]);
        } else {
          reject('No proxies found in the file');
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function getOTP(fiveSim, page, country, product, operator) {
    try {

        // const order = await fiveSim.purchase(country, product, operator);
        const order = await fiveSim.purchaseCheapest(country, product);

        console.log(order);
        let captchaTrigger = false;
        let nxtButton = null;

        try { 
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');

          await page.type('#usernamereg-phone', order.phone);
          await page.waitForSelector('#reg-sms-button');
          await page.click('#reg-sms-button');
        } catch(err) { 
          console.error('Retry error: '+err); 

          await page.$eval(`input[name="editedPhoneNumber"]`, phone => {
            document.getElementsByName('editedPhoneNumber')[0].value = phone;
          });

          await page.waitForSelector('#verify-code-retry');
          await page.click('#verify-code-retry');
        }

        try {
          await page.waitForSelector('#recaptcha-iframe');
          console.log('Captcha found...');

          const iframeElement = await page.$('#recaptcha-iframe');

          const iframe = await iframeElement.contentFrame();

          await delay(12000);

          await iframe.waitForSelector('#recaptcha-submit');
          await iframe.click('#recaptcha-submit');

          console.log('Captcha submitted...');

        } catch(err) { console.error('Recaptcha error: '+err); }

        let sms = null;
        try {

            sms = await fiveSim.waitForCode(order.id)
            console.log('Received the code: ' + sms.code)
        } catch(err) {
            console.error('No SMS received: '+err);

            await delay(3000);
            err_ctr++;
            if(err_ctr<10) {
                await getOTP(fiveSim, page, country, product, operator);
            }
        }

        if(err_ctr<10) {

          await page.type('#verification-code-field', sms.code);
          await page.keyboard.press("Enter");

          console.log('OTP submitted');

          // finish order
          fiveSim.finishOrder(order.id);
        } else {
          console.log('Maximum retries..');
        }
    } catch(err) {
        console.error('getOTP error: '+err);
        await delay(3000);
        err_ctr++;
        if(err_ctr<10) {
            await getOTP(fiveSim, page, country, product, operator);
        }
    }
}

async function createAccount(page) {

  // await page.goto("https://signup.live.com/signup?lcid=1033&wa=wsignin1.0&rpsnv=161&ct=1727009407&rver=7.0.6738.0&wp=MBI_SSL&wreply=https%3a%2f%2foutlook.live.com%2fowa%2f%3fnlp%3d1%26signup%3d1%26cobrandid%3dab0455a0-8d03-46b9-b18b-df2f57b9e44c%26RpsCsrfState%3d8fe15470-5582-2026-61a0-0d34e581d337&id=292841&CBCXT=out&lw=1&fl=dob%2cflname%2cwld&cobrandid=ab0455a0-8d03-46b9-b18b-df2f57b9e44c&lic=1&uaid=e53b5379e24b4f4ab41197d8494f950d");
  await page.goto("https://outlook.live.com/owa/");

  const signUpBtn = await page.waitForSelector('#action-oc9501');

  const href = await page.evaluate(el => el.getAttribute('href'), signUpBtn);

  await page.goto(href);

  const PersonalInfo = await generatePersonalInfo();

  await page.waitForSelector(SELECTORS.USERNAME_INPUT);  
  await page.type(SELECTORS.USERNAME_INPUT, PersonalInfo.username);
  await page.keyboard.press("Enter");

  const password = await generatePassword();
  await page.waitForSelector(SELECTORS.PASSWORD_INPUT);
  await page.type(SELECTORS.PASSWORD_INPUT, password);
  await page.keyboard.press("Enter");

  await page.waitForSelector(SELECTORS.FIRST_NAME_INPUT);
  await page.type(SELECTORS.FIRST_NAME_INPUT, PersonalInfo.randomFirstName);
  await page.type(SELECTORS.LAST_NAME_INPUT, PersonalInfo.randomLastName);
  await page.keyboard.press("Enter");


  await page.waitForSelector(SELECTORS.BIRTH_DAY_INPUT);
  await delay(1000);
  await page.select(SELECTORS.BIRTH_MONTH_INPUT, PersonalInfo.birthMonth);
  await page.select(SELECTORS.BIRTH_DAY_INPUT, PersonalInfo.birthDay);
  await page.type(SELECTORS.BIRTH_YEAR_INPUT, PersonalInfo.birthYear);
  await page.keyboard.press("Enter");

  let domain = 'outlook.com';

  const email = `${PersonalInfo.username}@${domain}`;

  try {

    const mainIframeElement = await page.waitForSelector('#enforcementFrame');
    console.log('Captcha found...');

    const mainIframe = await mainIframeElement.contentFrame();

    console.log('Enforcement Frame found...');

    const secondIframeElement = await mainIframe.waitForSelector('[data-e2e="enforcement-frame"]');

    const secondIframe = await secondIframeElement.contentFrame();

    console.log('Enforcement Frame - 2 found...');

    await delay(10000);

    const thirdIframeElement = await secondIframe.waitForSelector('#game-core-frame');

    const thirdIframe = await thirdIframeElement.contentFrame();

    console.log('Game Core Frame found...');

    await thirdIframe.waitForSelector('body');
    console.log('GC Body found...');

    await thirdIframe.waitForFunction(() => document.readyState === 'complete');
    console.log('GC Ready...');

    const numberOfCaptchas = await thirdIframe.$$eval('div.dWKpco', (elements) => {
      return elements.length;
    });

    console.log(numberOfCaptchas + ' no of captchas');

    if(parseInt(numberOfCaptchas)<100) {

      await thirdIframe.waitForSelector('[data-theme="home.verifyButton"]');
      await thirdIframe.click('[data-theme="home.verifyButton"]');

      const FunCaptchaTokenElement = await secondIframe.waitForSelector('#FunCaptcha-Token');
      let fcToken = await secondIframe.evaluate(el => el.getAttribute('value'), FunCaptchaTokenElement);

      // Split the string by the '|' separator
      const parts = fcToken.split('|');

      // Initialize variables to hold pk and surl
      let pk = null;
      let surl = null;

      // Loop through each part and find the ones containing 'pk' and 'surl'
      parts.forEach(part => {
        if (part.startsWith('pk=')) {
          pk = part.split('=')[1];
        }

        if (part.startsWith('surl=')) {
          surl = part.split('=')[1];
        }
      });

      //optional, but often required:
      ac.settings.funcaptchaApiJSSubdomain = `${surl}`;
      ac.settings.funcaptchaDataBlob = '';

      // let webUrl = await secondIframe.evaluate(el => el.getAttribute('src'), thirdIframeElement);
      console.log(page.url());

      //solve and receive token
      await ac.solveFunCaptchaProxyless(page.url(), `${pk}`)
          .then(token => {
              console.log('result: '+token);
          })
          .catch(error => console.log('test received error '+error));

      // await solver.funCaptcha({
      //   pageurl: `https://api.funcaptcha.com/fc/api/nojs/?pkey=${pk}`,
      //   publickey: pk
      // })
      // .then((res) => {
      //   console.log(res);
      // })
      // .catch((err) => {
      //   console.log(err);
      // })

      // await secondIframe.waitForSelector('.captcha-solver');
      // console.log('Captcha Solver found...');

      // await secondIframe.click('.captcha-solver');

      // await secondIframe.waitForSelector(`.captcha-solver[data-state="solved"]`, {timeout: 2800000});
      // console.log(`Captcha solved...`);

      // for(let i=1; i<numberOfCaptchas; i++) {
      //   await thirdIframe.waitForSelector('.yuVdl');
      //   await thirdIframe.click('.yuVdl');
      //   console.log('Button clicked.');
      //   await delay(4000);
      // }

      await thirdIframe.waitForSelector('.yuVdl');
      await thirdIframe.click('.yuVdl');

      // Waiting for confirmed account.
      await page.keyboard.press("Enter");

      await delay(5000);

      await saveCookies(page, email);

      await writeCredentials(email, password);

      console.log('Account creation successful...');

    } else {
      console.log('Skipped. Captcha more than 10 images...');

    }
  } catch(err) { console.error('Recaptcha error: '+err); }

}

async function saveCookies(page, username) {

    let existingCookies = [];
    if (fs.existsSync('exports/cookies.json')) {
        const fileContent = fs.readFileSync('exports/cookies.json', 'utf-8');

        if (fileContent.trim()) {
            existingCookies = JSON.parse(fileContent);
        }
    }

    let newCookies = await page.cookies();

    newCookies = newCookies.map(cookie => ({ ...cookie, id: username }));

    let allCookies = [...existingCookies, ...newCookies];

    let uniqueCookies = allCookies.reduce((acc, cookie) => {
        if (!acc.find(c => c.id === cookie.id && c.name === cookie.name)) {
            acc.push(cookie);
        }
        return acc;
    }, []);

    fs.writeFileSync('exports/cookies.json', JSON.stringify(uniqueCookies, null, 2));
    console.log('Cookies saved successfully!');
}

async function writeCredentials(email, password) {

  if (config.USE_PROXY) {
    const proxyData = `${email}:${proxy.ip}:${proxy.port}\n`;
    // const proxyData = `${email}:${proxy.ip}:${proxy.port}:${proxy.user}:${proxy.pass}\n`;
    fs.appendFileSync('exports/proxies.txt', proxyData);

    console.log('Proxies saved: ', proxyData);
  }
  const account = email + ":" + password;
  // console.clear();
  console.log(account);
  fs.appendFile(config.ACCOUNTS_FILE, `${account}\n`, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

async function generatePersonalInfo() {
  const names = fs.readFileSync(config.NAMES_FILE, "utf8").split(forSplit);
  const randomFirstName = names[Math.floor(Math.random() * names.length)].trim();
  const randomLastName = names[Math.floor(Math.random() * names.length)].trim();
  const username = randomFirstName.toLowerCase() + '.' + randomLastName.toLowerCase() + Math.floor(Math.random() * 9999);
  const birthDay = (Math.floor(Math.random() * 28) + 1).toString()
  const birthMonth = (Math.floor(Math.random() * 12) + 1).toString()
  const birthYear = (Math.floor(Math.random() * 10) + 1990).toString()
  const personalInfo = { username, randomFirstName, randomLastName, birthDay, birthMonth, birthYear };
  console.log(personalInfo);
  return personalInfo;
}

async function generatePassword() {
  const words = fs.readFileSync(config.WORDS_FILE, "utf8").split(forSplit);
  const firstword = words[Math.floor(Math.random() * words.length)].trim();
  const secondword = words[Math.floor(Math.random() * words.length)].trim();
  return firstword + secondword + Math.floor(Math.random() * 9999) + '!';
}

const SELECTORS = {
  USERNAME_INPUT: '#usernameInput',
  PASSWORD_INPUT: '#Password',
  FIRST_NAME_INPUT: '#firstNameInput',
  LAST_NAME_INPUT: '#lastNameInput',
  BIRTH_DAY_INPUT: '#BirthDay',
  BIRTH_MONTH_INPUT: '#BirthMonth',
  BIRTH_YEAR_INPUT: '#BirthYear',
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

(async function mainFunction() {
    try {
        countries = await fiveSim.getCountriesList();

        for (let index = 0; index < 1000; index++) {
          err_ctr = 0;
          await start();
        }
    } catch (error) {
        console.error(error);
    }

    process.exit(0);
})();

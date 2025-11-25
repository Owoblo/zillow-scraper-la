import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to evade bot detection
puppeteer.use(StealthPlugin());

// Decodo proxy configuration
const DECODO_PROXIES = [
  {
    host: 'isp.decodo.com',
    port: 10001,
    username: 'spob1kyjck',
    password: 'sma7j92aJikN~zIBc2',
    ip: '45.58.216.179',
    country: 'US'
  },
  {
    host: 'isp.decodo.com',
    port: 10002,
    username: 'spob1kyjck',
    password: 'sma7j92aJikN~zIBc2',
    ip: '82.23.110.71',
    country: 'CA'
  },
  {
    host: 'isp.decodo.com',
    port: 10003,
    username: 'spob1kyjck',
    password: 'sma7j92aJikN~zIBc2',
    ip: '82.23.110.38',
    country: 'CA'
  }
];

let proxyIndex = 0;
let browser = null;
let browserProxy = null;

/**
 * Get the next proxy in rotation
 */
function getNextProxy() {
  const proxy = DECODO_PROXIES[proxyIndex % DECODO_PROXIES.length];
  proxyIndex++;
  return proxy;
}

/**
 * Launch browser with proxy
 */
async function launchBrowser(proxy) {
  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;

  console.log(`🌐 Launching browser with Decodo IP: ${proxy.ip} (${proxy.country})`);

  const browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      `--proxy-server=${proxyUrl}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreHTTPSErrors: true
  });

  return { browser: browserInstance, proxy };
}

/**
 * Get or create a browser instance
 */
export async function getBrowser() {
  // If no browser exists or it's disconnected, create a new one
  if (!browser || !browser.isConnected()) {
    const proxy = getNextProxy();
    const result = await launchBrowser(proxy);
    browser = result.browser;
    browserProxy = result.proxy;
  }

  return { browser, proxy: browserProxy };
}

/**
 * Rotate to next proxy by closing current browser
 */
export async function rotateBrowser() {
  if (browser && browser.isConnected()) {
    await browser.close();
  }

  const proxy = getNextProxy();
  const result = await launchBrowser(proxy);
  browser = result.browser;
  browserProxy = result.proxy;

  return { browser, proxy: browserProxy };
}

/**
 * Close browser
 */
export async function closeBrowser() {
  if (browser && browser.isConnected()) {
    await browser.close();
    browser = null;
    browserProxy = null;
  }
}

/**
 * Get a new page from the browser
 */
export async function getNewPage() {
  const { browser, proxy } = await getBrowser();
  const page = await browser.newPage();

  // Set realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });

  return { page, proxy };
}

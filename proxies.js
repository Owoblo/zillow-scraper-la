import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// Decodo static dedicated IP configuration - All 3 IPs with rotation
const DECODO_STATIC_IPS = [
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

let decodoRotationIndex = 0;

// Get Decodo static IP proxy agent with rotation
export function getDecodoProxyAgent() {
  const proxy = DECODO_STATIC_IPS[decodoRotationIndex % DECODO_STATIC_IPS.length];
  decodoRotationIndex++;

  console.log(`🌐 Decodo IP: ${proxy.ip} (${proxy.country}) - Port ${proxy.port}`);

  return new HttpsProxyAgent({
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  });
}

// Get Decodo static IP proxy URL with rotation
export function getDecodoProxyUrl() {
  const proxy = DECODO_STATIC_IPS[decodoRotationIndex % DECODO_STATIC_IPS.length];
  decodoRotationIndex++;

  console.log(`🌐 Decodo IP: ${proxy.ip} (${proxy.country}) - Port ${proxy.port}`);

  return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
}

// Enhanced proxy rotation for better anti-detection
let proxyRotationIndex = 0;
const PROXY_ROTATION = [
  'decodo',
  'smartproxy', 
  'stormproxy'
];

// Main proxy function with rotation for better anti-detection
export function getSmartProxyAgent() {
  const proxyType = PROXY_ROTATION[proxyRotationIndex % PROXY_ROTATION.length];
  proxyRotationIndex++;
  
  console.log(`🔄 Using proxy: ${proxyType} (rotation ${proxyRotationIndex})`);
  
  // Use Decodo for production (Render deployment) with whitelisted IP
  if (process.env.NODE_ENV === 'production') {
    return getDecodoProxyAgent();
  }
  
  // Local development with rotation
  switch (proxyType) {
    case 'decodo':
      return getDecodoProxyAgent();
    case 'smartproxy':
      return new HttpsProxyAgent({
        host: "ca.smartproxy.com",
        port: 20000,
        auth: `${process.env.SMARTPROXY_USER}:${process.env.SMARTPROXY_PASS}`,
      });
    case 'stormproxy':
      return getStormProxyAgent();
    default:
      return getDecodoProxyAgent();
  }
}

export function getSmartProxyUrl() {
  // Use Decodo for production (Render deployment) with whitelisted IP
  if (process.env.NODE_ENV === 'production') {
    return getDecodoProxyUrl();
  }
  
  // Fallback to original SmartProxy for local development
  return `http://${process.env.SMARTPROXY_USER}:${process.env.SMARTPROXY_PASS}@ca.smartproxy.com:20000`;
}

// NOTE: It takes several minutes for the proxy to be set up (407 errors)
export function getStormProxyUrl() {
  const proxies = [
    `185.207.96.124:3199`,
    `185.207.97.170:3199`,
    `181.177.70.19:3199`,
    `186.179.4.108:3199`,
    `181.177.73.18:3199`,
  ];
  const randomIndex = Math.floor(Math.random() * proxies.length);
  const [ip, port] = proxies[randomIndex].split(":");
  return `http://${process.env.STORMPROXY_USER}:${process.env.STORMPROXY_PASS}@${ip}:${port}`;
}

export function getStormProxyAgent() {
  const stormproxies = [
    `185.207.96.124:3199`,
    `185.207.97.170:3199`,
    `181.177.70.19:3199`,
    `186.179.4.108:3199`,
    `181.177.73.18:3199`,
  ];
  const randomIndex = Math.floor(Math.random() * stormproxies.length);
  const [ip, port] = stormproxies[randomIndex].split(":");
  const proxyAgent = new HttpsProxyAgent({
    host: ip,
    port: port,
    auth: `${process.env.STORMPROXY_USER}:${process.env.STORMPROXY_PASS}`,
  });
  return proxyAgent;
}

// Test function (uncomment to test)
// (async () => {
//   const fetchRes = await fetch("https://ip.smartproxy.com/json", {
//     agent: getSmartProxyAgent(),
//   });
//   const fetchJson = await fetchRes.json();
//   console.log("fetchJson", fetchJson);
// })();

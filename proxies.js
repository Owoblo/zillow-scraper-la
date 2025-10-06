import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// Decodo static dedicated IP configuration with whitelisted IP
const DECODO_STATIC_IP = {
  host: 'isp.decodo.com',
  port: 10001,
  username: 'user-spob1kyjck-ip-82.23.110.71',
  password: 'sma7j92aJikN~zIBc2'
};

// Get Decodo static IP proxy agent
export function getDecodoProxyAgent() {
  return new HttpsProxyAgent({
    host: DECODO_STATIC_IP.host,
    port: DECODO_STATIC_IP.port,
    username: DECODO_STATIC_IP.username,
    password: DECODO_STATIC_IP.password,
  });
}

// Get Decodo static IP proxy URL
export function getDecodoProxyUrl() {
  return `http://${DECODO_STATIC_IP.username}:${DECODO_STATIC_IP.password}@${DECODO_STATIC_IP.host}:${DECODO_STATIC_IP.port}`;
}

// Main proxy function - uses Decodo for production with correct whitelisted IP format
export function getSmartProxyAgent() {
  // Use Decodo for production (Render deployment) with whitelisted IP
  if (process.env.NODE_ENV === 'production') {
    return getDecodoProxyAgent();
  }
  
  // Fallback to original SmartProxy for local development
  const proxyAgent = new HttpsProxyAgent({
    host: "ca.smartproxy.com",
    port: 20000,
    auth: `${process.env.SMARTPROXY_USER}:${process.env.SMARTPROXY_PASS}`,
  });
  return proxyAgent;
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

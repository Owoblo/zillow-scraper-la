import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from "node-fetch";
import { gotScraping } from "got-scraping";
import dotenv from "dotenv";
dotenv.config();

export function getSmartProxyAgent() {
  const proxyAgent = new HttpsProxyAgent({
    host: "ca.smartproxy.com",
    port: 20000,
    auth: `${process.env.SMARTPROXY_USER}:${process.env.SMARTPROXY_PASS}`,
  });
  return proxyAgent;
}

export function getSmartProxyUrl() {
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

//uncomment to test them
(async () => {
  const fetchRes = await fetch("https://ip.smartproxy.com/json", {
    agent: getSmartProxyAgent(),
  });
  const fetchJson = await fetchRes.json();
  console.log("fetchJson", fetchJson);

  const gotScrapingRes = await gotScraping({
    url: "https://ipinfo.io/json",
    responseType: "json",
    proxyUrl: getSmartProxyUrl(),
  });
  console.log("gotScrapingRes.body", gotScrapingRes.body);
})();

// run node proxies.js to test after uncommenting

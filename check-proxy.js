// check-proxy.js - A utility script to verify SmartProxy is working
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');

// Read proxy configuration from environment or use defaults
const proxyHost = process.env.PROXY_HOST || 'gate.smartproxy.com';
const proxyPort = process.env.PROXY_PORT || '10001';
const proxyUser = process.env.PROXY_USER || 'spjmpkfax7';
const proxyPass = process.env.PROXY_PASS || 'r0grT~w4Lg0ykdIV4q';

// Test proxy with Axios
async function testProxyWithAxios() {
  console.log('\n=== Testing SmartProxy with Axios ===');
  
  try {
    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    
    console.log(`Using proxy: ${proxyHost}:${proxyPort}`);
    console.log('Checking IP address through proxy...');
    
    const response = await axios.get('https://ip.smartproxy.com/json', {
      httpsAgent: proxyAgent,
      timeout: 30000
    });
    
    console.log('Success! Proxy is working with Axios');
    console.log('Response data:', response.data);
    return true;
  } catch (error) {
    console.error('Error testing proxy with Axios:', error.message);
    return false;
  }
}

// Test proxy with Puppeteer
async function testProxyWithPuppeteer() {
  console.log('\n=== Testing SmartProxy with Puppeteer ===');
  let browser = null;
  
  try {
    console.log(`Using proxy: ${proxyHost}:${proxyPort}`);
    
    // Launch browser with proxy
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${proxyHost}:${proxyPort}`
      ]
    });
    
    const page = await browser.newPage();
    
    // Set proxy authentication
    await page.authenticate({
      username: proxyUser,
      password: proxyPass
    });
    
    console.log('Checking IP address through proxy...');
    await page.goto('https://ip.smartproxy.com/json', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Get page content
    const content = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    console.log('Success! Proxy is working with Puppeteer');
    console.log('Response:', bodyText);
    
    await browser.close();
    return true;
  } catch (error) {
    console.error('Error testing proxy with Puppeteer:', error.message);
    if (browser) await browser.close().catch(e => {});
    return false;
  }
}

// Try direct connection for comparison
async function testDirectConnection() {
  console.log('\n=== Testing Direct Connection (No Proxy) ===');
  
  try {
    console.log('Checking IP address without proxy...');
    const response = await axios.get('https://ip.smartproxy.com/json', {
      timeout: 10000
    });
    
    console.log('Direct connection IP information:');
    console.log(response.data);
    return true;
  } catch (error) {
    console.error('Error with direct connection:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('=== SmartProxy Connection Test ===');
  console.log(`Proxy settings: ${proxyHost}:${proxyPort}`);
  
  const directResult = await testDirectConnection();
  const axiosResult = await testProxyWithAxios();
  const puppeteerResult = await testProxyWithPuppeteer();
  
  console.log('\n=== Test Results ===');
  console.log(`Direct Connection: ${directResult ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Axios with Proxy: ${axiosResult ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Puppeteer with Proxy: ${puppeteerResult ? 'SUCCESS' : 'FAILED'}`);
  
  if (axiosResult && puppeteerResult) {
    console.log('\n✅ Proxy is working correctly with both Axios and Puppeteer!');
  } else if (axiosResult) {
    console.log('\n⚠️ Proxy is working with Axios but not with Puppeteer');
  } else if (puppeteerResult) {
    console.log('\n⚠️ Proxy is working with Puppeteer but not with Axios');
  } else {
    console.log('\n❌ Proxy is not working with either method');
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});

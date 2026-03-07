// Screenshot generator using Puppeteer
// Run: npm install puppeteer --save-dev
// Then: node screenshot.js

const puppeteer = require('puppeteer');
const path = require('path');
(async()=>{
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900});
  const fileUrl = 'file://' + path.resolve(__dirname, 'admin-dashboard.html');
  await page.goto(fileUrl, {waitUntil:'networkidle0'});
  await page.screenshot({path: path.resolve(__dirname,'admin-dashboard-1440x900.png'), fullPage:false});
  await browser.close();
  console.log('Saved: mockups/admin-dashboard-1440x900.png');
})();
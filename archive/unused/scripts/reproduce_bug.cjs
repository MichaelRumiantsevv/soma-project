const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=279,783',
    '--disable-gpu',
    'http://localhost:5173/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2500));

    const targets = await new Promise((resolve, reject) => {
      http.get('http://localhost:9222/json', (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.url.includes('5173'));
    if (!pageTarget) {
      console.error('No page target found:', targets);
      return;
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        console.error('Eval error:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    console.log('Page loaded in Chrome. Waiting 2s for initial images...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('--- INITIAL STATE ---');
    const initialInfo = await evalCode(`
      (() => {
        const hero = document.getElementById('section-hero');
        const illusion = document.getElementById('section-illusion');
        const panel = illusion?.querySelector('.glass-floating-panel');
        const canvas = document.querySelector('canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let pixel = null;
        if (ctx) {
          const p = ctx.getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1).data;
          pixel = Array.from(p);
        }
        return {
          scrollY: window.scrollY,
          docHeight: document.documentElement.scrollHeight,
          heroRect: hero ? hero.getBoundingClientRect() : null,
          illusionRect: illusion ? illusion.getBoundingClientRect() : null,
          illusionOpacity: panel ? window.getComputedStyle(panel).opacity : null,
          illusionVis: panel ? window.getComputedStyle(panel).visibility : null,
          canvasWidth: canvas?.width,
          canvasHeight: canvas?.height,
          canvasPixel: pixel
        };
      })()
    `);
    console.log(JSON.stringify(initialInfo, null, 2));

    console.log('--- SCROLLING DOWN TO 1000px ---');
    await evalCode(`window.scrollTo({ top: 1000, behavior: 'instant' });`);
    await new Promise(r => setTimeout(r, 600));

    const stateAt1000 = await evalCode(`
      (() => {
        const hero = document.getElementById('section-hero');
        const illusion = document.getElementById('section-illusion');
        const panel = illusion?.querySelector('.glass-floating-panel');
        const canvas = document.querySelector('canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let pixel = null;
        if (ctx) {
          const p = ctx.getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1).data;
          pixel = Array.from(p);
        }
        return {
          scrollY: window.scrollY,
          heroRect: hero ? hero.getBoundingClientRect() : null,
          illusionRect: illusion ? illusion.getBoundingClientRect() : null,
          illusionOpacity: panel ? window.getComputedStyle(panel).opacity : null,
          illusionVis: panel ? window.getComputedStyle(panel).visibility : null,
          canvasPixel: pixel
        };
      })()
    `);
    console.log(JSON.stringify(stateAt1000, null, 2));

    console.log('--- SCROLLING TO BOTTOM ---');
    await evalCode(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`);
    await new Promise(r => setTimeout(r, 1000));

    console.log('--- SCROLLING BACK UP TO TOP (scrollY = 0) ---');
    await evalCode(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await new Promise(r => setTimeout(r, 800));

    const stateBackAtTop = await evalCode(`
      (() => {
        const hero = document.getElementById('section-hero');
        const heading = document.querySelector('.hero-monumental-heading');
        const illusion = document.getElementById('section-illusion');
        const panel = illusion?.querySelector('.glass-floating-panel');
        const canvas = document.querySelector('canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let pixel = null;
        if (ctx) {
          const p = ctx.getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1).data;
          pixel = Array.from(p);
        }
        return {
          scrollY: window.scrollY,
          docHeight: document.documentElement.scrollHeight,
          headingOpacity: heading ? window.getComputedStyle(heading).opacity : null,
          headingTransform: heading ? window.getComputedStyle(heading).transform : null,
          illusionOpacity: panel ? window.getComputedStyle(panel).opacity : null,
          illusionVis: panel ? window.getComputedStyle(panel).visibility : null,
          canvasPixel: pixel
        };
      })()
    `);
    console.log(JSON.stringify(stateBackAtTop, null, 2));

    console.log('--- SCROLLING DOWN AGAIN TO 800px & 1500px ---');
    await evalCode(`window.scrollTo({ top: 800, behavior: 'instant' });`);
    await new Promise(r => setTimeout(r, 600));

    const stateSecondScroll = await evalCode(`
      (() => {
        const hero = document.getElementById('section-hero');
        const illusion = document.getElementById('section-illusion');
        const panel = illusion?.querySelector('.glass-floating-panel');
        const mechanics = document.getElementById('section-mechanics');
        const mechPanel = mechanics?.querySelector('.glass-floating-panel');
        const canvas = document.querySelector('canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let pixel = null;
        if (ctx) {
          const p = ctx.getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1).data;
          pixel = Array.from(p);
        }
        return {
          scrollY: window.scrollY,
          docHeight: document.documentElement.scrollHeight,
          heroRect: hero ? hero.getBoundingClientRect() : null,
          illusionRect: illusion ? illusion.getBoundingClientRect() : null,
          illusionOpacity: panel ? window.getComputedStyle(panel).opacity : null,
          illusionVis: panel ? window.getComputedStyle(panel).visibility : null,
          mechRect: mechanics ? mechanics.getBoundingClientRect() : null,
          mechOpacity: mechPanel ? window.getComputedStyle(mechPanel).opacity : null,
          canvasPixel: pixel
        };
      })()
    `);
    console.log(JSON.stringify(stateSecondScroll, null, 2));

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);

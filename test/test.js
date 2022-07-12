import { createRequire } from 'module';
// eslint-disable-next-line import/extensions
import process from 'process';
import EventEmitter from 'eventemitter3';
import { IterableEmitter } from '../index.js';

process.on('beforeExit', (code) => { console.log('about to exit with code:', code); });
process.on('exit', (code) => { console.log('exiting with code:', code); });

async function sleep(ms) {

    const start = (new Date()).getTime();
    return new Promise((res) => {

        const to = setInterval(() => {

            const now = (new Date()).getTime();
            if (now - start >= ms) { clearInterval(to); res(); }

        }, 1);

    });

}

const require = createRequire(import.meta.url);

// const EventEmitter = require('eventemitter3');

class NumberStream extends EventEmitter {

    constructor(options) {

        super();

        if (options?.max) {

            this.max = options?.max;

        }

    }

    paused = false;

    max = Infinity;

    count = 0;

    Interval;

    pause() { this.paused = true; }

    resume() { this.paused = false; }

    next() { this.data(); if (this.count < this.max) { this.Interval = setImmediate(() => { this.next(); }); } }

    start() { this.next(); }

    data() {

        if (!this.paused) {

            this.count += 1;
            super.emit('data', this.count);
            if (this.count >= this.max) {

                super.emit('done'); clearImmediate(this.Interval);

            }

        }

    }

}

const a = new NumberStream({ max: 13 });

a.on('data', (data) => { console.log('data', data); });

const b = new IterableEmitter(a, {
    initializeBuffer: true,
    dataEvent: 'data',
    resolutionEvent: 'done',
    pauseMethod: 'pause',
    //  pauseFunction: () => true,
    resumeMethod: 'resume',
    highWaterMark: 175,
    lowWaterMark: 50,
    preFilter: (r) => !(r % 3),
    transform: (r) => r * 13,
    logLevel: 'DEBUG',
    logger: (logEntry) => { console.log(logEntry); },
    timeout: 0,

});

// await sleep(1000);

a.start();

await sleep(10000);

const ai = b.iterator();
const bi = b.iterator();

await ai.next();
await bi.next();
await ai.next();
await bi.next();

/*
try {

    for await (const val of b) {

        console.log('a', val);

        break;

    }

} catch (e) { console.log(e); }

try {

    for await (const val of b) {

        console.log('a', val);

    }

} catch (e) { console.log(e); }
*/
console.log('out of here');

console.log(b.totalLength, b.totalReturned, b.totalFiltered, b.length);

/**
 * @typedef {import('./index.js').iterableEmitterOptionBase} iterableEmitterOptions
 * @typedef {import('./index.js').iterableEmitterValidatedOptions} iterableEmitterValidatedOptions
 */

import { klona } from 'klona/json';
import { createRequire } from 'module';
import { pEvent } from 'p-event';

const require = createRequire(import.meta.url);

const EventEmitter = require('eventemitter3');
const Denque = require('denque');

const optionDefaults = {
    highWaterMark: 1000,
    lowWaterMark: 500,
    initializeBuffer: true,
};

const cachedOptions = new WeakMap();

/**
* @param {iterableEmitterOptions} options
*/
function validateOptions(options) {

    /**
     * @type {iterableEmitterValidatedOptions}
     */
    let validatedOptions = cachedOptions.get(options);

    if (!validatedOptions) {

        if ((typeof options !== 'object') || options === null || Array.isArray(options)) { throw new Error('options parameter must be an object.'); }

        validatedOptions = (({
            initializeBuffer,
            highWaterMark,
            lowWaterMark,
            dataEvent,
            transform,
            preFilter,
            pauseFunction,
            resumeFunction,
            pauseMethod,
            resumeMethod,
            resolutionEvent,
            rejectionEvent,
        }) => ({
            initializeBuffer: initializeBuffer ?? optionDefaults.initializeBuffer,
            highWaterMark: highWaterMark ?? optionDefaults.highWaterMark,
            lowWaterMark: lowWaterMark ?? optionDefaults.lowWaterMark,
            dataEvent,
            transform,
            preFilter,
            pauseFunction,
            resumeFunction,
            pauseMethod,
            resumeMethod,
            resolutionEvent: [].concat(resolutionEvent),
            rejectionEvent: [].concat(rejectionEvent),
        }))(klona(options));

        if (!(Number.isInteger(validatedOptions.highWaterMark) && validatedOptions.highWaterMark > 0)) {

            throw new Error('The `highWaterMark` option should be an integer greater than 0');

        }

        if (!(Number.isInteger(validatedOptions.lowWaterMark) && validatedOptions.lowWaterMark > 0)) {

            throw new Error('The `lowWaterMark` option should be an integer greater than 0');

        }

        if (typeof validatedOptions.initializeBuffer !== 'boolean') {

            throw new Error('The `initializeBuffer` option should be a boolean');

        }

        if (!(typeof validatedOptions.dataEvent === 'string')) {

            throw new Error('The `dataEvent` option should be a string that represents a new data event');

        }

        if (validatedOptions.transform && (typeof validatedOptions.transform !== 'function')) {

            // eslint-disable-next-line max-len
            throw new Error('The `transform` option, if specified, should be a function that will transform the results of the data event prior to the results being pushed on the buffer.');

        }

        if (validatedOptions.preFilter && (typeof validatedOptions.preFilter !== 'function')) {

            // eslint-disable-next-line max-len
            throw new Error('The `preFilter` option, if specified, should be a function that when passed the results of data event, returns a boolean indicating if this data should be passed to the buffer.');

        }

        if (validatedOptions.resolutionEvent.find((d) => typeof d !== 'string')) {

            // eslint-disable-next-line max-len
            throw new Error('The `resolutionEvent` option should be a string or array of strings that represent an event signalling the emitter is done');

        }

        if (validatedOptions.rejectionEvent.find((d) => typeof d !== 'string')) {

            // eslint-disable-next-line max-len
            throw new Error('The `rejectionEvent` option should be a string or array of strings that represent an event signalling the emitter has errored or rejected. Defaults to `error`');

        }

        if (validatedOptions.pauseFunction && typeof validatedOptions.pauseFunction !== 'function') {

            throw new Error('The `pauseFunction` option should be a function that will pause the data events');

        }

        if (validatedOptions.resumeFunction && typeof validatedOptions.resumeFunction !== 'function') {

            throw new Error('The `resumeFunction` option should be a function that will resume the data events');

        }

        if (validatedOptions.pauseMethod && typeof validatedOptions.pauseMethod !== 'string') {

            // eslint-disable-next-line max-len
            throw new Error('The `pauseMethod` option should be a string representing the method name on the emitter that will pause the data events');

        }

        if (validatedOptions.resumeMethod && typeof validatedOptions.resumeMethod !== 'string') {

            // eslint-disable-next-line max-len
            throw new Error('The `resumeMethod` option should be a string representing the method name on the emitter that will resume the data events');

        }

        if (!(!validatedOptions.resumeMethod !== !validatedOptions.resumeFunction)) {

            // eslint-disable-next-line max-len
            throw new Error('You must specify either `resumeMethod` or `resumeFunction` but not both');

        }

        if (!(!validatedOptions.pauseMethod !== !validatedOptions.pauseFunction)) {

            // eslint-disable-next-line max-len
            throw new Error('You must specify either `pauseMethod` or `pauseFunction` but not both');

        }

        cachedOptions.set(options, validatedOptions);

    }

    return validatedOptions;

}

class IterableEmitter extends EventEmitter {

    #continueEvent = Symbol('continue');

    #done = false;

    #error = false;

    #errorObject = undefined;

    #length = 0;

    #totalLength = 0;

    #totalReturned = 0;

    #totalFiltered = 0;

    #paused = false;

    #boundHandlers = {
        data: undefined,
        resolved: undefined,
        rejected: undefined,
    };

    /**
    * @type {import('./index.js').iterableEmitterValidatedOptions}
    */
    #options;

    #emitterControl = {
        pause: undefined,
        resume: undefined,
    };

    /**
     * @type Denque
     */

    #buffer;

    #listeners = [];

    get done() { return this.#done; }

    get error() {

        return {
            error: this.#error,
            errorObject: this.#errorObject,
        };

    }

    get length() { return this.#length; }

    get totalLength() { return this.#totalLength; }

    get totalReturned() { return this.#totalReturned; }

    get totalFiltered() { return this.#totalFiltered; }

    get paused() { return this.#paused; }

    /**
     *
    * @param {*} emitter  This must be an emitter type object, i.e. has an 'on', etc. methods.
    * @param {import('./index.js').iterableEmitterOptions} options
    */

    constructor(emitter, options) {

        super();

        // this.#boundHandlers

        this.#options = validateOptions(options);

        if (this.#options.initializeBuffer) {

            this.#buffer = new Denque([], { capacity: this.#options.highWaterMark });

        } else { this.#buffer = new Denque(); }

        if (this.#options.pauseMethod) {

            if (typeof emitter[this.#options.pauseMethod] !== 'function') {

                throw new Error('Property specified for `pauseMethod` is not a function.');

            }

            this.#emitterControl.pause = emitter[this.#options.pauseMethod].bind(emitter);

        } else {

            this.#emitterControl.pause = this.#options.pauseFunction.bind(emitter);

        }

        if (this.#options.resumeMethod) {

            if (typeof emitter[this.#options.resumeMethod] !== 'function') {

                throw new Error('Property specified for `resumeMethod` is not a function.');

            }

            this.#emitterControl.resume = emitter[this.#options.resumeMethod].bind(emitter);

        } else {

            this.#emitterControl.resume = this.#options.resumeFunction.bind(emitter);

        }

        this.#boundHandlers.data = this.#data.bind(this);
        this.#boundHandlers.rejected = this.#rejected.bind(this);
        this.#boundHandlers.resolved = this.#resolved.bind(this);

        emitter.on(this.#options.dataEvent, this.#boundHandlers.data);

        this.#listeners.push({
            emitter,
            event: this.#options.dataEvent,
            handler: this.#boundHandlers.data,
        });

        this.#options.resolutionEvent.forEach((event) => {

            emitter.on(event, this.#boundHandlers.resolved);

            this.#listeners.push({
                emitter,
                event,
                handler: this.#boundHandlers.resolved,
            });

        });

        this.#options.rejectionEvent.forEach((event) => {

            emitter.on(event, this.#boundHandlers.rejected);

            this.#listeners.push({
                emitter,
                event,
                handler: this.#boundHandlers.rejected,
            });

        });

    }

    #pause() {

        this.#paused = true;
        this.#emitterControl.pause();

    }

    #resume() {

        this.#paused = false;
        this.#emitterControl.resume();

    }

    #continue() {

        this.emit(this.#continueEvent);

    }

    #data(...args) {

        if (!this.#options.preFilter || this.#options.preFilter(...args)) {

            if (this.#options.transform) {

                this.#push(this.#options.transform(...args));

            } else if (args.length === 1) {

                this.#push(args[0]);

            } else {

                this.#push(args);

            }

            this.#continue();

        } else {

            this.#totalFiltered += 1;

        }

    }

    #rejected(error) {

        this.#error = true;
        this.#errorObject = error;
        this.#length = 0;
        this.#buffer.clear();

        this.#resolved();

    }

    #resolved() {

        this.#done = true;
        this.#dropListeners();
        this.#continue();

    }

    #dropListeners() {

        this.#listeners.forEach((event) => {

            event.emitter.removeListener(event.event, event.handler);

        });

    }

    #push(item) {

        this.#length = this.#buffer.push(item);
        if (this.#length >= this.#options.highWaterMark) {

            this.#pause();

        }
        this.#totalLength += 1;
        this.#continue();

    }

    #shift() {

        if (this.#paused && this.#length <= this.#options.lowWaterMark) {

            this.#resume();

        }

        if (this.#length > 0) {

            this.#length -= 1;
            this.#totalReturned += 1;

            return this.#buffer.shift();

        }

        return undefined;

    }

    async* [Symbol.asyncIterator]() {

        while (this.#error === false && (this.#done === false || (this.#done && this.#length > 0))) {

            if (this.#length === 0) {

                try {

                    // eslint-disable-next-line no-await-in-loop
                    await pEvent(this, this.#continueEvent, { timeout: 5000 });

                } catch (e) { this.#error = true; this.#errorObject = new Error('Timeout waiting for `dataEvent`'); }

            }

            if (this.#length > 0) {

                yield this.#shift();

            }

        }

        if (this.#error) {

            throw (this.#errorObject);

        }

    }

}

export { IterableEmitter };
export default IterableEmitter;

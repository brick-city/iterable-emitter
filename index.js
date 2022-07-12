/**
 * @typedef {import('./index.js').iterableEmitterOptionBase} iterableEmitterOptions
 * @typedef {import('./index.js').iterableEmitterValidatedOptions} iterableEmitterValidatedOptions
 */

// TODO: We need to handle timeouts
// TODO: We need to handle data events that occur after resolutionEvent or rejectionEvent, right now rethrow if its iterating
// TODO: Advance statistics ?
// TODO: Logger integration

import { klona } from 'klona/json';
import { pEvent } from 'p-event';
import { v4 as uuid } from '@lukeed/uuid';
import ow from 'ow';
import EventEmitter from 'eventemitter3';
import Denque from 'denque';
// const EventEmitter = require('eventemitter3');
// const Denque = require('denque');

const optionDefaults = {
    highWaterMark: 1000,
    lowWaterMark: 500,
    initializeBuffer: true,
    rejectionEvent: 'error',
};

const argValidation = {
    initializeBuffer: ow.boolean,
    highWaterMark: ow.number.integerOrInfinite.not.negative,
    lowWaterMark: ow.number.integerOrInfinite.not.negative,
    dataEvent: ow.string,
    transform: ow.optional.function,
    preFilter: ow.optional.function,
    pauseFunction: ow.optional.function,
    resumeFunction: ow.optional.function,
    pauseMethod: ow.optional.string,
    resumeMethod: ow.optional.string,
    resolutionEvent: ow.array.ofType(ow.string),
    rejectionEvent: ow.array.ofType(ow.string),
    logger: ow.optional.function,
    logLevel: ow.optional.string.oneOf(['INFO', 'DEBUG', 'WARN', 'ERROR']),
    timeout: ow.optional.number.integerOrInfinite.not.negative,
    logDebug: ow.boolean,
    logInfo: ow.boolean,
    logWarn: ow.boolean,
    logError: ow.boolean,
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
            logger,
            logLevel,
            timeout,
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
            rejectionEvent: [].concat(rejectionEvent ?? optionDefaults.rejectionEvent),
            logger,
            logLevel,
            logDebug: false,
            logInfo: false,
            logWarn: false,
            logError: false,
            timeout,
        }))(klona(options));

        ow(validatedOptions, ow.object.exactShape(argValidation));

        if (!(!validatedOptions.resumeMethod !== !validatedOptions.resumeFunction)) {

            // eslint-disable-next-line max-len
            throw new Error('You must specify either `resumeMethod` or `resumeFunction` but not both');

        }

        if (!(!validatedOptions.pauseMethod !== !validatedOptions.pauseFunction)) {

            // eslint-disable-next-line max-len
            throw new Error('You must specify either `pauseMethod` or `pauseFunction` but not both');

        }

        if (validatedOptions.logLevel && validatedOptions.logger) {

            switch (validatedOptions.logLevel) {

            case 'DEBUG':
                validatedOptions.logDebug = true;
            // eslint-disable-next-line no-fallthrough
            case 'INFO':
                validatedOptions.logInfo = true;
            // eslint-disable-next-line no-fallthrough
            case 'WARN':
                validatedOptions.logWarn = true;
            // eslint-disable-next-line no-fallthrough
            default:
                validatedOptions.logError = true;

            }

        }

        cachedOptions.set(options, Object.freeze(validatedOptions));

    }

    return validatedOptions;

}

class IterableEmitter extends EventEmitter {

    #active = false;

    #continueEvent = Symbol('continue');

    #done = false;

    #error = false;

    #errorObject = undefined;

    #length = 0;

    #totalLength = 0;

    #totalReturned = 0;

    #totalFiltered = 0;

    #paused = false;

    #iterators = 0;

    #id;

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

    get options() { return this.#options; }

    get active() { return this.#active; }

    get stats() {

        return {
            done: this.#done,
            length: this.#length,
            paused: this.#paused,
            totalLength: this.#totalLength,
            totalFiltered: this.#totalFiltered,
            totalReturned: this.#totalReturned,
            error: this.error,
            active: this.#active,
        };

    }

    /**
     *
    * @param {*} emitter  This must be an emitter type object, i.e. has an 'on', etc. methods.
    * @param {import('./index.js').iterableEmitterOptions} options
    */

    constructor(emitter, options) {

        super();

        this.#id = uuid();

        this.#options = validateOptions(options);

        this.#logInfo('Options validated', this.#options);

        if (this.#options.initializeBuffer) {

            this.#buffer = new Denque([], { capacity: this.#options.highWaterMark });

        } else { this.#buffer = new Denque(); }

        this.#logDebug('Buffer Initialized');

        if (this.#options.pauseMethod) {

            if (typeof emitter[this.#options.pauseMethod] !== 'function') {

                throw new Error('Property specified for `pauseMethod` is not a function.');

            }

            this.#emitterControl.pause = emitter[this.#options.pauseMethod].bind(emitter);

        } else {

            this.#emitterControl.pause = this.#options.pauseFunction.bind(emitter);

        }

        this.#logDebug('pauseMethod initialized');

        if (this.#options.resumeMethod) {

            if (typeof emitter[this.#options.resumeMethod] !== 'function') {

                throw new Error('Property specified for `resumeMethod` is not a function.');

            }

            this.#emitterControl.resume = emitter[this.#options.resumeMethod].bind(emitter);

        } else {

            this.#emitterControl.resume = this.#options.resumeFunction.bind(emitter);

        }

        this.#logDebug('resumeMethod initialized');

        this.#boundHandlers.data = this.#data.bind(this);
        this.#boundHandlers.rejected = this.#rejected.bind(this);
        this.#boundHandlers.resolved = this.#resolved.bind(this);

        this.#logDebug('handlers bound');

        emitter.on(this.#options.dataEvent, this.#boundHandlers.data);

        this.#listeners.push({
            emitter,
            event: this.#options.dataEvent,
            handler: this.#boundHandlers.data,
        });

        this.#logDebug('dataEvent listener attached', {
            event: this.#options.dataEvent,
            handler: this.#boundHandlers.data.name,
        });

        this.#logDebug('dataEvent listener listening');

        this.#options.resolutionEvent.forEach((event) => {

            this.#boundHandlers.resolved[event] = this.#resolved.bind(this, event);

            emitter.on(event, this.#boundHandlers.resolved[event]);

            this.#listeners.push({
                emitter,
                event,
                handler: this.#boundHandlers.resolved[event],
            });

            this.#logDebug('resolutionEvent listener attached', {
                event,
                handler: this.#boundHandlers.resolved[event],
            });

        });

        this.#logDebug('resolutionEvent listener(s) listening');

        this.#options.rejectionEvent.forEach((event) => {

            emitter.on(event, this.#boundHandlers.rejected);

            this.#listeners.push({
                emitter,
                event,
                handler: this.#boundHandlers.rejected,
            });

            this.#logDebug('rejectionEvent listener attached', {
                event,
                handler: this.#boundHandlers.rejected.name,
            });

        });

        this.#logDebug('rejectionEvent listener(s) listening');

        if (this.#options.timeout) {

            setTimeout(this.#checkTimeout.bind(this), this.#options.timeout);

            this.#logDebug('Timeout Set');

        }

    }

    #checkTimeout() {

        this.#logDebug('Timer Event');

        if (!this.#active && !this.done) {

            this.#errored('Timeout error waiting for emitter.', new Error('Timeout error waiting for emitter.'));

        } else if (!this.done) {

            this.#active = false;
            setTimeout(this.#checkTimeout.bind(this), this.#options.timeout);

        }

    }

    #pause() {

        this.#paused = true;
        this.#emitterControl.pause();

        this.#logDebug('Emitter Paused.');

    }

    #resume() {

        this.#paused = false;
        this.#emitterControl.resume();

        this.#logDebug('Emitter Resumed.');

    }

    #continue() {

        this.emit(this.#continueEvent);

    }

    #data(...args) {

        this.#logDebug('Data event', args);

        this.#active = true;

        if (this.#paused) {

            this.#logWarn('Data event from paused iterator');

        }

        if (this.#done) {

            // We should never get here as the listeners are dropped when 'done'
            this.#errored('dataEvent received while emitter in `done` state.');

        } else
        if (!this.#options.preFilter || this.#options.preFilter(...args)) {

            if (this.#options.transform) {

                const transformed = this.#options.transform(...args);

                this.#push(transformed);

            } else if (args.length === 1) {

                this.#push(args[0]);

            } else {

                this.#push(args);

            }

            this.#continue();

        } else {

            this.#totalFiltered += 1;

            this.#logDebug('Data filtered');

        }

    }

    #errored(message, error) {

        const errorObject = error ?? new Error(message);

        this.#logError(message, errorObject);
        this.#error = true;
        this.#errorObject = errorObject;
        this.#length = 0;
        this.#buffer.clear();

        this.#resolve();

        super.emit('error', this.#errorObject);

    }

    #rejected(error) {

        this.#errored('rejectionEvent received', error);

    }

    #resolved(...resolution) {

        this.#logInfo('resolutionEvent received', {
            resolution,
            stat: this.stats,
        });

        this.#resolve();

    }

    #resolve() {

        this.#done = true;
        this.#dropListeners();
        this.#continue();

    }

    #dropListeners() {

        this.#listeners.forEach((event) => {

            event.emitter.removeListener(event.event, event.handler);

            this.#logDebug('Listener Dropped', { event: event.event });

        });

    }

    #push(item) {

        this.#length = this.#buffer.push(item);

        this.#logDebug('Data pushed on buffer', item);

        if (this.#length >= this.#options.highWaterMark) {

            this.#pause();

        }
        this.#totalLength += 1;
        this.#continue();

    }

    #shift(iteratorId) {

        if (this.#paused && this.#length <= this.#options.lowWaterMark) {

            this.#resume();

        }

        if (this.#length > 0) {

            this.#length -= 1;
            this.#totalReturned += 1;

            const event = this.#buffer.shift();

            this.#logDebug('Event Shifted', {
                event,
                iteratorId,
            });

            return event;

        }

        return undefined;

    }

    #logBase(logLevel, message, payload) {

        const logEntry = {
            logLevel,
            message,
            dateTime: new Date(),
            id: this.#id,
        };

        if (payload) logEntry.payload = klona(payload);

        return logEntry;

    }

    #logDebug(message, payload) {

        if (!this.#options.logDebug) return;

        const logEntry = this.#logBase('DEBUG', message, payload);

        logEntry.stats = this.stats;

        this.#options.logger(logEntry);

    }

    #logInfo(message, payload) {

        if (!this.#options.logInfo) return;

        const logEntry = this.#logBase('INFO', message, payload);

        this.#options.logger(logEntry);

    }

    #logWarn(message, payload) {

        if (!this.#options.logError) return;

        const logEntry = this.#logBase('WARN', message, payload);

        this.#options.logger(logEntry);

    }

    #logError(message, error, payload) {

        if (!this.#options.logError) return;

        const logEntry = this.#logBase('ERROR', message, payload);

        logEntry.error = error;

        this.#options.logger(logEntry);

    }

    iterator() {

        return this[Symbol.asyncIterator]();

    }

    async* [Symbol.asyncIterator]() {

        // TODO: Send a warning if iterating a done iterator with zero length

        const iteratorId = uuid();

        this.#iterators += 1;

        this.#logInfo('Begin Iteration', { iteratorId });
        try {

            while (this.#error === false && (this.#done === false || (this.#done && this.#length > 0))) {

                if (this.#length === 0) {

                    // eslint-disable-next-line no-await-in-loop
                    await pEvent(this, this.#continueEvent);

                }

                if (this.#length > 0) {

                    yield this.#shift(iteratorId);

                }

            }

        } finally {

            this.#iterators -= 1;

            this.#logInfo('End Iteration', { iteratorId });

        }
        if (this.#error) {

            throw (this.#errorObject);

        }

    }

}

export { IterableEmitter };
export default IterableEmitter;

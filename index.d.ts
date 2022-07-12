import { EventEmitter } from "eventemitter3";
/**
 * 
 *  IterableEmitter is an async iterable buffer
 * 
 *  It can convert an emitter type stream of data to an iterable
 * 
 * ```
 * 
 * const options = { highWaterMark:
 *                      }
 * 
 * const e2i = new IterableEmitter(emitter, options)
 * ```
 * 
 */

export declare class IterableEmitter extends EventEmitter {

    constructor (Emitter:typeof EventEmitter, options:iterableEmitterOptions);

    options:iterableEmitterOptions;

    /**
     * Is the buffer in the paused state (not expecting any more items to be added)
     */

    paused:boolean;

    /**
     * Is the buffer in the done state (not expecting any more items to be added)
     */

    done:boolean;

    /**
     * Current length of the buffer
     */
    length:number;

    /**
     * Total number of items added to the buffer
     */
    totalLength:number;

    /**
     * Total number of items returned from the buffer
     */
    totalReturned:number;

    /**
     * Total data elements filtered
     */
    totalFiltered:number;

    /**
     * Error object
     */
    error:{error:boolean, errorObject:Error}


    [Symbol.asyncIterator]() : Promise<any>;

}


type iterableEmitterEvent = string;

type iterableEmitterOptionBase = {
    /**
     * 
     *  Once the buffer reaches the highWaterMark in size, the 'pause' method on the emitter will be called for every subsequent 'dataEvent'.
     * 
     *  Default value of 1000
     * 
     */
    highWaterMark?:number;

    /**
     * When a paused buffer has been drained to the lowWaterMark, the 'resume' method on the emitter will be called.
     * 
     * Default value of 500
     * 
     */

    lowWaterMark?:number;

    /**
     * If set to true, the buffer will be initialized in size to the highWaterMark
     * 
     * Default value of true
     * 
     */

    initializeBuffer?:boolean;

    /**
     * The buffer will listen for 'dataEvents'  and push the arguments onto the stack, 
     * if multiple arguments are supplied, they will be converted to an array
     */
  
    dataEvent:iterableEmitterEvent;
  
    /**
     * A single event, or an array of events that result in the buffer considered 'resolved'.
     * Any further data events, or attempts to add to the buffer will result in an error.
     */
  
    resolutionEvent:iterableEmitterEvent | iterableEmitterEvent[];
  
    /**
     * Rejection event(s) to listen for, defaults to 'error'
     */
    rejectionEvent:iterableEmitterEvent | iterableEmitterEvent[];
    
    /**
     * You can pass a method to transform the data returned from the 'dataEvent'  prior to having
     * it pushed on the buffer. all arguments passed to the 'data' event will be passed to the transform method.
     */
  
    transform?:{(...args:any[]):any};

    /**
     * 
     * 
     * 
     */
    preFilter?:{(...args:any[]):boolean};

    /**
     * 
     * The pause function will be called when a data event results in the number of items in the buffer to meet
     * or exceed the high water mark. It will be bound to the emitter
     * 
     */
    pauseFunction:{():void};
  
    /**
     * 
     * The resume function will be called when the buffer has been drained to the low water mark. It will be bound to the emitter
     * 
     */
  
    resumeFunction:{():void};

    /**
     * 
     * The pause method, is a string representing the name of a method on the emitter that will be called when a data event results in the number of items in the buffer to meet
     * or exceed the high water mark.
     * 
     */
     pauseMethod:string;
  
     /**
      * 
      * The resume method, is a string representing the name of a method on the emitter that will be called when the buffer has been drained to the low water mark
      * 
      */
   
     resumeMethod:string;

     /**
      * 
      * Logging level, should be one of "DEBUG"|"INFO"|"WARN"|"ERROR"
      * 
      */

     logLevel?:"DEBUG" | "INFO" | "WARN" | "ERROR";

     /**
      * 
      * Logger to pass the log messages to
      * 
      */

    logger?:{(arg0: iterableEmitterLogEntryObject):void};

    /**
     * 
     * Time in milliseconds before timing out waiting for emitter
     * 
     */
    timeout?:number

    /**
     * 
     * 
     * 
     */

}

 export interface iterableEmitterOptions extends iterableEmitterOptionBase {}



  

   

    export interface iterableEmitterValidatedOptions extends iterableEmitterOptionBase {
      
      
        /**
         * A single event, or an array of events that result in the buffer considered 'resolved'.
         * Any further data events, or attempts to add to the buffer will result in an error.
         */
      
        resolutionEvent: iterableEmitterEvent[];
      
        /**
         * Rejection event(s) to listen for, defaults to 'error'
         */
        rejectionEvent: iterableEmitterEvent[];
        
        /**
         * If set to true, the buffer will be initialized in size to the highWaterMark
         * 
         * Default value of true
         * 
         */

        initializeBuffer:boolean;


        /**
         * Internal logging levels
         */
        logDebug:boolean;
        logInfo:boolean;
        logWarn:boolean;
        logError:boolean;


       }

/**
 * 
 * Log Entry Object, will be sent to the function handling logging
 * 
 */
export interface iterableEmitterLogEntryObject {

    logLevel:"DEBUG" | "INFO" | "WARN" | "ERROR";
    message:string;
    dateTime:Date;
    id:string;
    error?:Error;
    payload?:object;
    stats?:object;

}



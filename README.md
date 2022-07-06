# iterable-emitter

Use this class to create an object that monitors an emitter and allows the events of the emitter to be asynchronously iterated. 

Events are queued so they can be iterated at a different rate than what they are emitted at. For instance an ETL process that extracts data faster than it can be loaded asynchronously to a remote destination.

The queue has a high water mark that can limit memory requirements for the queued events. Once the high water mark is reached, the emitter will be paused to stop the flow of events. Once the events have been drained to the low water mark, the emitter will be resumed.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Support](#support)
- [Contributing](#contributing)
- [License](#license)

## Installation

```
npm install --save @brick-city/iterable-emitter
```

## Usage

### General


### `new IterableEmitter (emitter:Emitter, options:iterableEmitterOptions)`

**Returns:`IterableEmitter`**

```javascript
import IterableEmitter from '@brick-city/iterable-emitter'
import Request from 'tedious';

request = new Request("select i.item, i.description from dbo.item i", function(err, rowCount) {
  ...
});

const options = {
    dataEvent: 'row',
    resolutionEvent: ['done', 'doneInProc', 'doneProc'],
    pauseMethod: 'pause',
    resumeMethod: 'resume',
}

const iterableRequest = new IterableEmitter (request, options )

connection.execSql(request);

try {

    for await (const row of iterableRequest) {

      .....
        Do something awesome!
      .....

    }

} catch (e) { console.log(e); }

```

### Options

- dataEvent: 'row' (string, required) - The name of the event that provides the stream of data.

- resolutionEvent: 'done' (string | array[string], required) - An emission of the resolutionEvent(s) will end the iterable once the queue is drained.
- rejectionEvent: 'error' (string | array[string], defaults to 'error') An emission of the rejectionEvent(s) will end the iterable immediately (queued events are cleared) and the iterable rethrows the caught error.
- highWaterMark:1000 (integer, defaults to 1000) - The number of events to queue prior to pausing the emitter.
- lowWaterMark: 500 (integer, defaults to 500) - Once a paused iterable has been drained to this level the emitter will be resumed.
- initializeBuffer:true (boolean, defaults to true) Initialize the buffer for highWaterMark entries.
- pauseMethod: (string, conditionally optional) - method on the emitter that will pause the stream of dataEvents. It will be called without arguments when the total queued events have reached the highWaterMark. It will be called repeatedly if the stream continues. Either pauseMethod or pauseFunction must be specified, but not both.
- pauseFunction: (function\<void\>, conditionally optional) - A function to be called to pause the stream of dataEvents. It will be called without arguments when the total queued events have reached the highWaterMark. It will be called repeatedly if the stream continues. Either pauseMethod or pauseFunction must be specified, but not both.
- resumeMethod: (string, conditionally optional) - method on the emitter that will resume the stream of dataEvents after being paused. It will be called without arguments on a paused emitter once the buffer has been drained to the lowWaterMark. Either resumeMethod or resumeFunction must be specified, but not both.
- resumeFunction: (function\<void\>, conditionally optional) - A function to be called to resume the stream of dataEvents on a pause emitter. It will be called without arguments on a paused emitter once the buffer has been drained to the lowWaterMark. Either resumeMethod or resumeFunction must be specified, but not both.
- preFilter: ()=>{} (function\<boolean\>, optional) - The arguments supplied to the dataEvent event handler will be pass on to the preFilter function. Returning true will push the event results on the buffer, false and it will be ignored
- transform: ()=>{} (function\<any\>, optional) - The arguments supplied to the dataEvent event handler will be passed to the transform function, the results of which will be pushed on the buffer.

## Support

Please [open an issue](https://github.com/brick-city/iterable-emitter/issues/new) for support.

## Contributing

Please contribute using [Github Flow](https://guides.github.com/introduction/flow/). Create a branch, add commits, and [open a pull request](https://github.com/brick-city/iterable-emitter/compare/).

## License
MIT License
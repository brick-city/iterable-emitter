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

```
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



## Support

Please [open an issue](https://github.com/brick-city/iterable-emitter/issues/new) for support.

## Contributing

Please contribute using [Github Flow](https://guides.github.com/introduction/flow/). Create a branch, add commits, and [open a pull request](https://github.com/brick-city/iterable-emitter/compare/).

## License
MIT License
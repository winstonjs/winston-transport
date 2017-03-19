# winston-transport

The base `TransportStream` implementation for `winston >= 3`. Use these to write ecosystem Transports for `winston`.

## Usage

``` js
const Transport = require('winston-transport');
const util = require('util');

const YourCustomTransport = module.exports = function YourCustomTransport(opts) {
  // Consume any custom options here. e.g.:
  // - Connection information for databases
  // - Authentication information for APIs (e.g. loggly, papertrail, logentries, etc.)
};

YourCustomTransport.prototype.log = function (info, callback) {
  // Perform the writing to the remote service
  this.emit('logged');
  callback();
};
```

## Tests

Tests are written with `mocha`, `nyc`, `assume`, and `abstract-winston-transport`. They can be run with `npm`:

``` bash
npm test
```

##### Author: [Charlie Robbins](https://github.com/indexzero)
##### LICENSE: MIT

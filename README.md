# async-event-channel

English | [简体中文](./README.zh-CN.md)

> Two-way communication asynchronous event channel

## Install

```bash
npm install async-event-channel
```

## Quick Comprehension

```javascript
// event communication instance
const dom = document.querySelector('.ctx');

// register event
dom.addEventListener('click', function(event) {
  console.log('event received');
});
// register event again
dom.addEventListener('click', function(event) {
  console.log('event received again');
});

// dispatch event
dom.dispatchEvent(new Event('click'));
// dispatch event again
dom.dispatchEvent(new Event('click'));
```

### Contrast

```javascript
import AsyncEventChannel from 'async-event-channel';
// or
// const { default: AsyncEventChannel } = require('async-event-channel');
// or
// import AsyncEventChannel from 'async-event-channel/es5';

// event communication instance
const channel = new AsyncEventChannel();

// register event
channel.on('click', function(...args) {
  console.log('event received', args);
});
// register event again
channel.on('click', function(...args) {
  console.log('event received again', args);
});

// dispatch event
channel.emit('click', 'event data1', 'event data2');
// dispatch event again
channel.emit('click', 'event data3', 'event data4');
```

## Async Communication

```javascript
import AsyncEventChannel from 'async-event-channel';

const channel = new AsyncEventChannel();

// Emit events first(Only when the event is not registered, will it wait asynchronously to send the event)
channel.emit('timeout', 'timeout event');

// Register events later
setTimeout(() => {
  channel.on('timeout', function(data) {
    console.log(data); // timeout event
  });
}, 1000);
```

## Get event return value (two-way communication)

```javascript
channel.on('get', function(data) {
  console.log(data); // event data
  return 'return value';
});

const result = channel.emit('get', 'event data');
console.log(result.values[0]); // return value
```

## Get event return value asynchronously (two-way communication)

```javascript
channel.asyncEmit('get', 'event data').promise.then(result => {
  console.log(result.values[0]); // return value
});

setTimeout(() => {
  channel.on('get', function(data) {
    console.log(data); // event data
    return 'return value';
  });
}, 1000);
```

## Get event return value synchronously (two-way communication)

```javascript
channel.on('get', function(data) {
  console.log(data); // event data
  return 'return value';
});

// If the event is not registered, undefined will be obtained
const values = channel.syncEmit('get', 'event data');
console.log(values[0]); // return value
```

## Cancel listening events

```javascript
const { cancel } = channel.on('cancel', function() {
  return 'cancel event';
});

// Cancel listening events
cancel();

const values = channel.syncEmit('cancel');
console.log(values); // []
```

## Cancel the triggering event in waiting

```javascript
const { cancel } = channel.emit('cancel', 'cancel event');

// Cancel the triggering event in waiting
cancel();

// Unable to receive events
channel.on('cancel', function(data) {
  console.log(data);
});
```

## Cancel listening events and triggering events on the specified channel

```javascript
channel.on('cancel', function() {
  return 'cancel event';
});
channel.on('cancel', function() {
  return 'cancel event again';
});

channel.off('cancel');

const values = channel.syncEmit('cancel');
console.log(values); // []
```

## Listening process

```javascript
// Listening process, from registering events to triggering events and canceling events, only listening events, not triggering events
channel.watch('watch', function(data) {
  // Note: The execution order of the listening process cannot be guaranteed
  console.log(data); // { "id": 1, "event": "on", "progress": "register", "type": "watch", "value": function() {...} }
  if (data.id === id) {
    console.log('match success');
  }
});

const { id } = channel.on('watch', function() {
  return 'watch event';
});
```

## Query whether it still exists

```javascript
const { id } = channel.on('exists', function() {});

console.log(channel.hasId(id)); // true
console.log(channel.hasType('exists')); // true
```

## Import and export

```javascript
const channel_old = new AsyncEventChannel();
const channel_new = new AsyncEventChannel();

channel_old.on('import', function() {
  return 'import event';
});

// Export event channel data
const data = channel_old.export();

// Import event channel data
channel_new.import(...data);

// Equivalent to copy, does not affect the original event channel data
const values_new = channel_new.syncEmit('import');
console.log(values_new[0]); // import event

// Equivalent to copy, does not affect the original event channel data
const values_old = channel_old.syncEmit('import');
console.log(values_old[0]); // import event
```

## Listening events and microtasks

```javascript
let current = 0;

channel.on('microtask', function() {
  // Like Promise.resolve().then(), the callback function is executed in the microtask queue of the current event loop
  console.log('execute time', current); // 1
});

// Trigger events immediately
channel.emit('microtask');

current = 1;
```

## Listen to events only once (two-way communication)

```javascript
channel.once('once', function() {
  return 'once event';
});

const values = channel.syncEmit('once');
console.log(values[0]); // once event

const valuesAgain = channel.syncEmit('once');
console.log(valuesAgain); // []
```

## Unified collection of cancel events

```javascript
import AsyncEventChannel, { asyncEventChannelScope } from 'async-event-channel';

const channel = new AsyncEventChannel();
const { ctx, cancel } = asyncEventChannelScope(channel);

ctx.on('cancel', function() {
  return 'cancel event';
});
channel.once('cancel', function() {
  return 'cancel event again';
});

// Cancel all events
cancel();

const values = ctx.syncEmit('cancel');
console.log(values); // []

// Only events on the proxy instance will be canceled
const valuesAgain = channel.syncEmit('cancel');
console.log(valuesAgain); // ["cancel event again"]
```

## Disable asynchronous triggering events

```javascript
const channel = new AsyncEventChannel({ isEmitCache: false });

channel.emit('disable', 'disable event');

// Unable to receive events
setTimeout(() => {
  channel.on('disable', function(data) {
    console.log(data);
  });
}, 1000);
```

## The same channel can only register one event

```javascript
const channel = new AsyncEventChannel({ isOnOnce: true });

channel.on('once', function() {
  return 'once event';
});

// Overwrite the previous event
channel.on('once', function() {
  return 'once event again';
});

const values = channel.syncEmit('once');
console.log(values[0]); // once event again
```

## The same channel can only trigger one event

```javascript
const channel = new AsyncEventChannel({ isEmitOnce: true });

channel.emit('once', 'once event');

// Overwrite the previous waiting event
channel.emit('once', 'once event again');

// Only the last event can be received
channel.on('once', function(data) {
  console.log(data); // once event again
});
```

## Only set the specified event type

```javascript
const options = new Map();
options.set('only', { isEmitCache: false });
const channel = new AsyncEventChannel(null, options);

channel.emit('only', 'only event');

// Unable to receive events
setTimeout(() => {
  channel.on('only', function(data) {
    console.log(data);
  });
}, 1000);

channel.emit('other', 'other event');

// Can receive events
setTimeout(() => {
  channel.on('other', function(data) {
    console.log(data); // other event
  });
}, 1000);
```

## Modify global default configuration

```javascript
import AsyncEventChannel from 'async-event-channel';

AsyncEventChannel.defaultOptions.isEmitCache = false;
```

## Priority of configuration items

```javascript
// specify
new AsyncEventChannel(null, new Map([ ['only', { isEmitCache: true }] ]))

// current
new AsyncEventChannel({ isEmitCache: true })

// global
AsyncEventChannel.defaultOptions.isEmitCache

// specify > current > global
```

## Values that can be used as event types

> Any type of value can be used, including strings, numbers, objects, arrays, symbols, null, etc.

```javascript
const channel = new AsyncEventChannel();

channel.on('string', function() {});
channel.on(1, function() {});
channel.on({}, function() {});
channel.on([], function() {});
channel.on(Symbol('symbol'), function() {});
channel.on(null, function() {});
channel.on(function() {}, function() {});
```

# Asynchronous task queue

> unrelated to event channels

```javascript
import { AsyncTaskQueue } from 'async-event-channel';

// Event types can be any type of value
const types = ['a', 1, null, ''];
// Whether to execute automatically after ready
const oneAuto = false;

// Create an asynchronous task queue
const queue = new AsyncTaskQueue(types, oneAuto);

// Add tasks to the queue
queue.on('a', function(state) {
  console.log(1)
  return 'a';
});
queue.on(null, async function(state) {
  console.log(3)
  await new Promise(resolve => setTimeout(resolve, 1000));
  return null;
});
setTimeout(() => {
  queue.on(1, function(state) {
    console.log(2)
    queue.cancel(); // Cancel the execution of this task queue
    return 1;
  });
}, 1000);
queue.on('', function(state) {
  console.log(4)
  return '';
});

// Ready to execute
queue.onLoad(function() {
  console.log('queue ready');
  queue.start(0).then(result => {
    // This queue execution result
    console.log(result);
  }).catch(error => {
    // This queue execution error
    console.error(error);
  });
});

// Whether the task queue is running
console.log(queue.isRunning)
```
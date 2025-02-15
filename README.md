# async-event-channel

English | [简体中文](./README.zh-CN.md)

> Two-way communication asynchronous event channel

## Install

```bash
npm install async-event-channel
```

## Core concepts

- `on` Register event

- `emit` Trigger event

- `off` Remove event

## Default communication

> Synchronous, many-to-many communication

- `on` can register multiple events with the same name

- `emit` can trigger the same event multiple times; Synchronous trigger (will not wait for `on` registration)

## Advanced

> Add special characters to the event name to achieve more event communication methods

- `on_ignore` The same event can only be registered once, and subsequent registrations will be ignored

- The difference between `on_cover` and `on_ignore` is that ignoring becomes covering

- `emit_wait` Make `emit` trigger asynchronously (wait for `on` registration)

- `emit_ignore` The same event can only have one pending `emit`, and subsequent triggers will be ignored

- The difference between `emit_cover` and `emit_ignore` is that ignoring becomes covering

- `emit_ignore` or `emit_cover` will also make `emit` trigger asynchronously

## Two-way communication

- The return values of multiple registered `on` callback functions are combined into an array, which is used as the `resolve` parameter of the `Promise` return value of `emit` (microtask) and the parameter of the `onResolved` callback function (callback function)

## Auxiliary methods

- `useScope` Event communication scope

  - Introduction: Record the cancellation method of the event through the proxy instance

  - Function: Destroy the proxy instance, cancel all recorded events, support multi-level nesting, and filter intercept events

- `useEvent` Fixed event name

  - Introduction: Generate a proxy instance with a fixed event name through the proxy instance

  - Function: Same as `useScope`, with the scope of event communication

  - Note: You cannot call the `useEvent` method again on a proxy instance with a fixed event name. Of course, calling `useScope` again is not affected by whether the event name is fixed

## Other methods

- `once` `on` that listens only once

- `size` Get the number of currently registered `on` or pending `emit`

- `has` Determine whether the specified event name has been registered

- `hook.all` Global hook: Register global hook functions, which can be executed

- `hook.beforeOn` Hook function: Register the `on` hook function of the specified event name, which can be executed before `on`

- `hook.beforeEmit` Hook function: Register the `emit` hook function of the specified event name, which can be executed before `emit`

- `hook.beforeOff` Hook function: Register the `off` hook function of the specified event name, which can be executed before `off`

- The difference between `hook.afterOn` and `hook.beforeOn` is that it is executed after `on`

- The difference between `hook.afterEmit` and `hook.beforeEmit` is that it is executed after `emit`

- The difference between `hook.afterOff` and `hook.beforeOff` is that it is executed after `off`

## Example

- Default communication

```typescript
import AsyncEventChannel from 'async-event-channel'
const instance = new AsyncEventChannel()

instance.on('click', (...args) => {
  console.log('Received event', args)
})

instance.on('click', (...args) => {
  console.log('Received event again', args)
})

instance.emit('click', 'click event', 'more parameters')

// Print:
// Received event [ 'click event', 'more parameters' ]
// Received event again [ 'click event', 'more parameters' ]
```

- Bidirectional communication

```typescript
instance.on('click', (a, b) => {
  return a + b
})

instance.on('click', (a, b) => {
  return a - b
})

const result = instance.emit('click', 1, 1)

// Callback function
result.onResolved((values) => {
  console.log('onResolved', values)
})

// Promise
result.then((values) => {
  console.log('Promise', values)
})

// Print:
// onResolved [ 2, 0 ]
// Promise [ 2, 0 ]
```

- Asynchronous communication

```typescript
const event = AsyncEventChannel.emit_wait + 'timeout'

instance.emit(event, 'asynchronous event').then(([data]) => {
  console.log(data)
})

instance.on(event, (data) => {
  console.log(data)
  return 'return value'
})

// Print:
// asynchronous event
// return value
```

- Event communication scope

```typescript
const scope = instance.useScope()

instance.on('click', () => {
  console.log('click-1')
})

scope.on('click', () => {
  console.log('click-2')
})

instance.emit('click')

// Print:
// click-1
// click-2

// clear events on scope
scope.$clear()
instance.emit('click')

// Print:
// click-1

// Destroy the proxy
scope.$destroy()
instance.emit // Error: The event has been destroyed
```

- Event communication scope filter

```typescript
const scope = instance.useScope(({ type, payload }) => {
  if (type === 'off' && payload[0] === 'click') {
    return false
  }
})

scope.on('click', () => {
  console.log('Not removed')
})

scope.off('click', 'on')

instance.emit('click')

// Print:
// Not removed
```

- Fixed event name

```typescript
const click = instance.useEvent()

click.on((data) => {
  console.log(data)
})

click.emit('click event')

// Print:
// click event
```

- Nested fixed event names and scopes

```typescript
// Nested levels: useScope > useEvent > useScope
const scope1 = instance.useScope()
const click1 = scope1.useEvent()
const scope2 = click1.useScope()

// Error: Cannot call the `useEvent` method again on a proxy instance with a fixed event name
// const click2 = scope2.useEvent()

scope1.on(scope2.$event, () => {
  console.log('First layer')
})
click1.on(() => {
  console.log('Second layer')
})
scope2.on(() => {
  console.log('Third layer')
})

scope2.emit()

// Print:
// First layer
// Second layer
// Third layer
```

- Generic return value of parameters

```typescript
instance.emit<[string]>('click').then((res) => {
  type T = typeof res // [string]
})

const click = instance.useEvent<[number], [string]>()

click.on((res) => {
  type T = typeof res // number
})

type T = Parameters<typeof click.emit> // [number]

click.emit(1).then((res) => {
  type T = typeof res // [string]
})
```

- Listening only once

```typescript
instance.once('click', () => {
  console.log('Only listen once')
})

instance.emit('click')
instance.emit('click')

// Print:
// Only listen once
```

- Get the number of currently registered `on` or pending `emit`

```typescript
instance.on('click', () => {})
instance.on('click', () => {})

console.log(instance.size('click', 'on')) // 2

instance.emit(AsyncEventChannel.emit_ignore + 'click')
instance.emit(AsyncEventChannel.emit_ignore + 'click')

// Because emit_ignore will ignore the same event triggered repeatedly, there is only one pending emit
console.log(instance.size('click', 'emit')) // 1
```

- Determine whether the specified event name has been registered

```typescript
instance.on('click', () => {})

const listener = () => {}
instance.on('click', listener)

console.log(instance.has('click', 'on')) // true

console.log(instance.has('click', listener)) // true
```

- Global hook

```typescript
instance.hook.all((result) => {
  console.log(result)
})

instance.emit('click', 1, 2)

// Print:
// { type: 'emit', position: 'before', payload: [ 'click', 1, 2 ] }
// { type: 'emit', position: 'after', payload: [ 'click', 1, 2 ], result: Promise }
```

- Hook function

```typescript
instance.hook.beforeOn('click', (result) => {
  console.log(result)
})

// Same as (global hook) example...
```

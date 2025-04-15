# async-event-channel

English | [简体中文](./README.zh-CN.md)

> Event channel, supports many-to-many communication, bidirectional communication, bidirectional asynchronous communication, hook listening, agent instance unified logout and other functions.

> Tries to cover most of the unit test cases, supports `ts` and `js`, supports `node` and `browser`.

## Install

```bash
# npm
npm install async-event-channel

# yarn
yarn add async-event-channel

# pnpm
pnpm add async-event-channel
```

## API

### `on` Register event

```ts
import AsyncEventChannel from 'async-event-channel'
const ctx = new AsyncEventChannel()

type Result = Readonly<{
  id: number // Result ID
  has: () => boolean // Whether it has not been removed
  off: () => void // Remove
}>

const result: Result = ctx.on(
  event: string, // Event name
  listener: (params: unknown, result: Result) => unknown, // Event callback function
  options?: {
    wait?: boolean // Whether to wait for the event callback function to complete
    once?: boolean // Whether to execute only once
  },
)
```

### `emit` Trigger event

```ts
const result: Result = ctx.emit(
  event: string, // Event name
  params?: unknown, // Transmit parameters
  options?: {
    wait?: boolean // Whether to wait for the corresponding registration event
    once?: boolean // Whether to wait only once for the corresponding registration event
    onReply?: (params: Map<number, unknown>, result: Result) => void // Receive the return value of a registered event
  },
)
```

### `off` Remove event

```ts
ctx.off(
  target: string | number | RegExp, // Event ID, Event Name, Regular Expression
  type?: 'all' | 'on' | 'emit' // Remove type, default all, invalid when id is passed.
)
```

### `hook` Hook function

```ts
const result: Result = ctx.hook(
  target: string | number | RegExp, // Event ID, Event Name, Regular Expression
  listener: (params: HookParams, result: Result) => void, // Listener Functions
  options?: {
    type?: 'on' | 'emit' | 'off' | 'trigger' | 'reply' | 'all' // Type of listener, default all
    once?: boolean // Whether to execute the listener function only once
  }
)
```

### `size` Gets the number of currently registered `on` or waiting `emit`s.

```ts
const {
  on, // Number of registered events
  emit, // Number of events waiting
  count, // Number of registered events + number of events waiting
} = ctx.size(
  target: string | number | RegExp // Event ID, Event Name, Regular Expression
)
```

### `emit_sync` Synchronised triggering of events and return of results

```ts
// Syntactic Sugar: shorthand for emit(event, params, { onReply })
const value = ctx.emit_sync(
  event: string, // Event name
  params: unknown, // Transmit parameters
)
```

### `emit_post` Trigger events asynchronously and return results

```ts
// Syntactic Sugar: Shorthand for emit(event, params, { wait: true, once: true, onReply })
const value = await ctx.emit_post(
  event: string, // Event name
  params: unknown, // Transmit parameters
)
```

### `effectScope` Collecting registered and cached events

```ts
const ctx_scope = ctx.effectScope()
ctx_scope.clear() // Clear events registered and cached on ctx_scope
ctx_scope.destroy() // Clears events registered and cached on ctx_scope and destroys the ctx_scope proxy object

ctx_scope.on
ctx_scope.emit
// ...
```

## Example

### Asynchronous communication

```ts
ctx.emit('test', 'Transmit parameters', { wait: true, once: true })

setTimeout(() => {
  ctx.on('test', (params) => {
    console.log('Receive parameters:', params) // Receive parameters: Transmit parameters
  })
}, 1000)
```

### Two-way communication

```ts
ctx.on('test', (params) => {
  console.log('Receive parameters:', params) // Receive parameters: Transmit parameters
  return 'Return parameter'
})

ctx.emit('test', 'Transmit parameters', {
  onReply(params) {
    console.log('Receives the return parameters:', params) // Receives the return parameters: Map(1) { 1 => 'Return parameter' }
  },
})
```

### Multiple registered/triggered events

```ts
ctx.emit('test', 'Transmit parameters-1', { wait: true })
ctx.emit('test', 'Transmit parameters-2', { wait: true, once: true })

setTimeout(() => {
  ctx.on('test', (params) => {
    console.log('Receive parameters-1：', params)
  })
  ctx.on('test', (params) => {
    console.log('Receive parameters-2：', params)
  })
}, 1000)

// Print results:
// Receive parameters-1： Transmit parameters-1
// Receive parameters-1： Transmit parameters-2
// Receive parameters-2： Transmit parameters-1
```

### Wait for the event callback function to execute asynchronously

```ts
ctx.on(
  'test',
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return 'Return parameter'
  },
  { wait: true }
)

ctx.emit('test', null, {
  onReply(params) {
    console.log('Receives the return parameters:', params) // Receives the return parameters: Map(1) { 1 => 'Return parameter' }
  },
})
```

### Monitor

```ts
ctx.hook('test', (params) => {
  console.log('type：', params.type)
})

ctx.on('test', () => {})

ctx.emit('test', null, {
  onReply() {},
})

// Print results:
// type： on
// type： emit
// type： trigger
// type： reply
// type： off
```

### Collecting registered and cached events

```ts
// Can be nested
const ctx_scope = ctx.effectScope()
const ctx_scope_child = ctx_scope.effectScope()

ctx.on('test', () => {})
ctx_scope.on('test', () => {})
ctx_scope_child.on('test', () => {})

console.log(ctx.size('test')) // { on: 3, emit: 0, count: 3 }

ctx_scope.destroy()

console.log(ctx.size('test')) // { on: 1, emit: 0, count: 1 }
```

### Syntactic sugar emit_sync

```ts
console.log(ctx.emit_sync('test')) // undefined

ctx.on('test', () => 'Return parameter-1')
ctx.on('test', () => 'Return parameter-2')

console.log(ctx.emit_sync('test')) // Return parameter-1
```

### Syntactic sugar emit_post

```ts
ctx.emit_post('test').then((value) => {
  console.log(value) // Return parameter-1
})

ctx.on('test', () => 'Return parameter-1')
ctx.on('test', () => 'Return parameter-2')
```

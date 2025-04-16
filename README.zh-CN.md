# async-event-channel

[English](./README.md) | 简体中文

**双向异步通信**

> 特点：emit 能等待多个 on 注册，并且能接收到 on 们的回调函数的返回值，还能等待返回值 Promise 的结果再接收。

> 轻量级、无依赖、支持 `ts` 和 `js`、支持 `node` 和 `浏览器`、支持多对多通信、双向异步通信、钩子监听、代理实例统一注销等功能。尽量覆盖了大部分单元测试用例。

## 安装

```bash
# npm
npm install async-event-channel

# yarn
yarn add async-event-channel

# pnpm
pnpm add async-event-channel
```

## API

### `on` 注册事件

```ts
import AsyncEventChannel from 'async-event-channel'
const ctx = new AsyncEventChannel()

type Result = Readonly<{
  id: number // 结果 ID
  has: () => boolean // 是否还未被移除
  off: () => void // 移除
}>

const result: Result = ctx.on(
  event: string, // 事件名
  listener: (params: unknown, result: Result) => unknown, // 事件回调函数
  options?: {
    wait?: boolean // 是否等待事件回调函数执行完成
    once?: boolean // 是否只执行一次
  },
)
```

### `emit` 触发事件

```ts
const result: Result = ctx.emit(
  event: string, // 事件名
  params?: unknown, // 传递参数
  options?: {
    wait?: boolean // 是否等待对应的注册事件
    once?: boolean // 是否只等待一次对应的注册事件
    onReply?: (params: Map<number, unknown>, result: Result) => void // 接收注册事件的返回值
  },
)
```

### `off` 移除事件

```ts
ctx.off(
  target: string | number | RegExp, // 事件 ID、事件名、正则表达式
  type?: 'all' | 'on' | 'emit' // 移除类型，默认 all，传入 id 时无效
)
```

### `hook` 钩子函数

```ts
const result: Result = ctx.hook(
  target: string | number | RegExp, // 事件 ID、事件名、正则表达式
  listener: (params: HookParams, result: Result) => void, // 监听函数
  options?: {
    type?: 'on' | 'emit' | 'off' | 'trigger' | 'reply' | 'all' // 监听的类型，默认 all
    once?: boolean // 是否只执行一次监听函数
  }
)
```

### `size` 获取当前注册的 `on` 或 等待的 `emit` 的数量

```ts
const {
  on, // 注册的事件数量
  emit, // 等待的事件数量
  count, // 注册的事件数量 + 等待的事件数量
} = ctx.size(
  target: string | number | RegExp // 事件 ID、事件名、正则表达式
)
```

### `emit_sync` 同步触发事件并返回结果

```ts
// 语法糖：emit(event, params, { onReply }) 的简写
const value = ctx.emit_sync(
  event: string, // 事件名
  params: unknown, // 传递参数
)
```

### `emit_post` 异步触发事件并返回结果

```ts
// 语法糖：emit(event, params, { wait: true, once: true, onReply }) 的简写
const value = await ctx.emit_post(
  event: string, // 事件名
  params: unknown, // 传递参数
)
```

### `effectScope` 收集注册和缓存的事件

```ts
const ctx_scope = ctx.effectScope()
ctx_scope.clear() // 清除在 ctx_scope 上注册和缓存的事件
ctx_scope.destroy() // 清除在 ctx_scope 上注册和缓存的事件，并销毁 ctx_scope 代理对象

ctx_scope.on
ctx_scope.emit
// ...
```

## 示例

### 异步通信

```ts
ctx.emit('test', '传递参数', { wait: true, once: true })

setTimeout(() => {
  ctx.on('test', (params) => {
    console.log('接收参数：', params) // 接收参数： 传递参数
  })
}, 1000)
```

### 双向通信

```ts
ctx.on('test', (params) => {
  console.log('接收参数：', params) // 接收参数： 传递参数
  return '返回参数'
})

ctx.emit('test', '传递参数', {
  onReply(params) {
    console.log('接收返回参数：', params) // 接收返回参数： Map(1) { 1 => '返回参数' }
  },
})
```

### 多个注册/触发事件

```ts
ctx.emit('test', '传递参数-1', { wait: true })
ctx.emit('test', '传递参数-2', { wait: true, once: true })

setTimeout(() => {
  ctx.on('test', (params) => {
    console.log('接收参数-1：', params)
  })
  ctx.on('test', (params) => {
    console.log('接收参数-2：', params)
  })
}, 1000)

// 打印结果：
// 接收参数-1： 传递参数-1
// 接收参数-1： 传递参数-2
// 接收参数-2： 传递参数-1
```

### 等待事件回调函数异步执行

```ts
ctx.on(
  'test',
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return '返回参数'
  },
  { wait: true }
)

ctx.emit('test', null, {
  onReply(params) {
    console.log('接收返回参数：', params) // 接收返回参数： Map(1) { 1 => '返回参数' }
  },
})
```

### 监听执行

```ts
ctx.hook('test', (params) => {
  console.log('type：', params.type)
})

ctx.on('test', () => {})

ctx.emit('test', null, {
  onReply() {},
})

// 打印结果：
// type： on
// type： emit
// type： trigger
// type： reply
// type： off
```

### 收集注册和缓存的事件

```ts
// 可以嵌套使用
const ctx_scope = ctx.effectScope()
const ctx_scope_child = ctx_scope.effectScope()

ctx.on('test', () => {})
ctx_scope.on('test', () => {})
ctx_scope_child.on('test', () => {})

console.log(ctx.size('test')) // { on: 3, emit: 0, count: 3 }

ctx_scope.destroy()

console.log(ctx.size('test')) // { on: 1, emit: 0, count: 1 }
```

### 语法糖 emit_sync

```ts
console.log(ctx.emit_sync('test')) // undefined

ctx.on('test', () => '返回参数-1')
ctx.on('test', () => '返回参数-2')

console.log(ctx.emit_sync('test')) // 返回参数-1
```

### 语法糖 emit_post

```ts
ctx.emit_post('test').then((value) => {
  console.log(value) // 返回参数-1
})

ctx.on('test', () => '返回参数-1')
ctx.on('test', () => '返回参数-2')
```

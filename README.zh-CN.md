# async-event-channel

[English](./README.md) | 简体中文

> 双向通信异步事件通道

## 安装

```bash
npm install async-event-channel
```

## 核心概念

- `on` 注册事件

- `emit` 触发事件

- `off` 移除事件

## 默认通信

> 同步，多对多通信

- `on` 可以注册多个同名事件

- `emit` 可以多次触发同名事件；同步触发（不会等待 `on` 的注册）

## 进阶

> 事件名称中添加特殊字符，实现更多的事件通信方式

- `on_ignore` 同名事件只能注册一次，再次注册会被忽略

- `on_cover` 和 `on_ignore` 的区别是忽略变为覆盖

- `emit_wait` 让 `emit` 变为异步触发（会等待 `on` 的注册）

- `emit_ignore` 同名事件只能存在一个等待中的 `emit`，再次触发会被忽略

- `emit_cover` 和 `emit_ignore` 的区别是忽略变为覆盖

- `emit_ignore` 或 `emit_cover` 也会让 `emit` 变为异步触发

## 双向通信

- 注册的多个 `on` 的回调函数的返回值组成一个数组，作为 `emit` 的返回值 `Promise` 的 `resolve` 参数（微队列）和 `onResolved` 回调函数参数（回调函数）

## 辅助方法

- `useScope` 事件通信的作用域：通过代理实例记录事件的取消方法；销毁代理实例，取消记录的所有事件

- `useEvent` 固定事件名称：生成固定了事件名称的代理实例，可以直接使用方法不用传事件名称

## 其他方法

- `once` 只监听一次的 `on`

- `size` 获取当前注册的 `on` 或 等待的 `emit` 的数量

- `has` 判断事件名称对应的 注册的 `on`，或 等待的 `emit` 是否存在

- `hook.all` 全局钩子：注册全局钩子函数，可以在 `on`、`emit`、`off` 的时候执行

- `hook.beforeOn` 钩子函数：注册指定事件名称的 `on` 钩子函数，可以在 `on` 之前执行

- `hook.beforeEmit` 钩子函数：注册指定事件名称的 `emit` 钩子函数，可以在 `emit` 之前执行

- `hook.beforeOff` 钩子函数：注册指定事件名称的 `off` 钩子函数，可以在 `off` 之前执行

- `hook.afterOn` 和 `hook.beforeOn` 的区别是在 `on` 之后执行

- `hook.afterEmit` 和 `hook.beforeEmit` 的区别是在 `emit` 之后执行

- `hook.afterOff` 和 `hook.beforeOff` 的区别是在 `off` 之后执行

## 示例

- 默认通信

```typescript
import AsyncEventChannel from 'async-event-channel'
const instance = new AsyncEventChannel()

instance.on('click', (...args) => {
  console.log('收到的事件', args)
})

instance.on('click', (...args) => {
  console.log('再次收到事件', args)
})

instance.emit('click', '点击事件', '更多参数')

// 打印：
// 收到的事件 [ '点击事件', '更多参数' ]
// 再次收到事件 [ '点击事件', '更多参数' ]
```

- 双向通信

```typescript
instance.on('click', (a, b) => {
  return a + b
})

instance.on('click', (a, b) => {
  return a - b
})

const result = instance.emit('click', 1, 1)

// 回调函数
result.onResolved((values) => {
  console.log('onResolved', values)
})

// 微队列
result.then((values) => {
  console.log('Promise', values)
})

// 打印：
// onResolved [ 2, 0 ]
// Promise [ 2, 0 ]
```

- 异步通信

```typescript
const event = AsyncEventChannel.emit_wait + 'timeout'

instance.emit(event, '异步事件').then(([data]) => {
  console.log(data)
})

instance.on(event, (data) => {
  console.log(data)
  return '返回值'
})

// 打印：
// 异步事件
// 返回值
```

- 事件通信的作用域

```typescript
const scope = instance.useScope()

instance.on('click', () => {
  console.log('click-1')
})

scope.on('click', () => {
  console.log('click-2')
})

instance.emit('click')

// 打印：
// click-1
// click-2

// 清空作用域上的事件
scope.$clear()
instance.emit('click')

// 打印：
// click-1

// 销毁代理
scope.$destroy()
instance.emit // Error: The event has been destroyed
```

- 固定事件名称

```typescript
const click = instance.useEvent()

click.on((data) => {
  console.log(data)
})

click.emit('点击事件')

// 打印：
// 点击事件
```

- 参数返回值的泛型

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

- 只监听一次

```typescript
instance.once('click', () => {
  console.log('只监听一次')
})

instance.emit('click')
instance.emit('click')

// 打印：
// 只监听一次
```

- 获取当前注册或等待的事件数量

```typescript
instance.on('click', () => {})
instance.on('click', () => {})

console.log(instance.size('click', 'on')) // 2

instance.emit(AsyncEventChannel.emit_ignore + 'click')
instance.emit(AsyncEventChannel.emit_ignore + 'click')

// 因为 emit_ignore 会忽略重复触发的同名事件，所以只有一个等待中的 emit
console.log(instance.size('click', 'emit')) // 1
```

- 判断事件名称对应的注册或等待的事件是否存在

```typescript
instance.on('click', () => {})

const listener = () => {}
instance.on('click', listener)

console.log(instance.has('click', 'on')) // true

console.log(instance.has('click', listener)) // true
```

- 全局钩子

```typescript
instance.hook.all((result) => {
  console.log(result)
})

instance.emit('click', 1, 2)

// 打印：
// { type: 'emit', position: 'before', payload: [ 'click', 1, 2 ] }
// { type: 'emit', position: 'after', payload: [ 'click', 1, 2 ], result: Promise }
```

- 钩子函数

```typescript
instance.hook.beforeOn('click', (result) => {
  console.log(result)
})

// 同（全局钩子）示例一样...
```

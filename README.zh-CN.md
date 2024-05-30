# async-event-channel

[English](./README.zh-CN.md) | 简体中文

> 异步事件通道

## 安装

```bash
npm install async-event-channel
```

## 快速理解

```javascript
// 事件通信实例
const dom = document.querySelector('.ctx');

// 注册事件
dom.addEventListener('click', function(event) {
  console.log('收到的事件');
});
// 再次注册事件
dom.addEventListener('click', function(event) {
  console.log('再次收到事件');
});

// 触发事件
dom.dispatchEvent(new Event('click'));
// 再次触发事件
dom.dispatchEvent(new Event('click'));
```

### 对比

```javascript
import AsyncEventChannel from 'async-event-channel';

// 事件通信实例
const channel = new AsyncEventChannel();

// 注册事件
channel.on('click', function(...args) {
  console.log('收到的事件', args);
});
// 再次注册事件
channel.on('click', function(...args) {
  console.log('再次收到事件', args);
});

// 触发事件
channel.emit('click', '事件数据1', '事件数据2');
// 再次触发事件
channel.emit('click', '事件数据3', '事件数据4');
```

## 异步通信

```javascript
import AsyncEventChannel from 'async-event-channel';

const channel = new AsyncEventChannel();

// 首先发出事件 (仅当事件未注册时，才会异步等待发送事件)
channel.emit('timeout', '异步事件');

// 稍后注册事件
setTimeout(() => {
  channel.on('timeout', function(data) {
    console.log(data); // 异步事件
  });
}, 1000);
```

## 获取事件返回值

```javascript
channel.on('get', function(data) {
  console.log(data); // 事件数据
  return '返回值';
});

const result = channel.emit('get', '事件数据');
console.log(result.values[0]); // 返回值
```

## 异步获取事件返回值

```javascript
channel.asyncEmit('get', '事件数据').then(result => {
  console.log(result.values[0]); // 返回值
});

setTimeout(() => {
  channel.on('get', function(data) {
    console.log(data); // 事件数据
    return '返回值';
  });
}, 1000);
```

## 同步获取事件返回值

```javascript
channel.on('get', function(data) {
  console.log(data); // 事件数据
  return '返回值';
});

// 如果未注册事件，将获得 undefined
const values = channel.syncEmit('get', '事件数据');
console.log(values[0]); // 返回值
```

## 取消侦听事件

```javascript
const { cancel } = channel.on('cancel', function() {
  return '取消事件';
});

// 取消侦听事件
cancel();

const values = channel.syncEmit('cancel');
console.log(values); // []
```

## 取消等待中的触发事件

```javascript
const { cancel } = channel.emit('cancel', '取消事件');

// 取消等待中的触发事件
cancel();

// 无法接收事件
channel.on('cancel', function(data) {
  console.log(data);
});
```

## 取消指定通道上的监听事件和触发事件

```javascript
channel.on('cancel', function() {
  return '取消事件';
});
channel.on('cancel', function() {
  return '再次取消事件';
});

channel.off('cancel');

const values = channel.syncEmit('cancel');
console.log(values); // []
```

## 监听过程

```javascript
// 监听过程，从注册事件到触发事件和取消事件，只监听事件，不触发事件
channel.watch('watch', function(data) {
  console.log(data); // { "event": "on", "progress": "register", "type": "watch", "value": function() { return "监听过程"; } }
});

channel.on('watch', function() {
  return '监听过程';
});
```

## 只监听一次事件

```javascript
channel.once('once', function() {
  return '一次事件';
});

const values = channel.syncEmit('once');
console.log(values[0]); // 一次事件

const valuesAgain = channel.syncEmit('once');
console.log(valuesAgain); // []
```

## 取消事件的统一收集

```javascript
import AsyncEventChannel, { asyncEventChannelScope } from 'async-event-channel';

const channel = new AsyncEventChannel();
const { ctx, cancel } = asyncEventChannelScope(channel);

ctx.on('cancel', function() {
  return '取消事件';
});
channel.once('cancel', function() {
  return '再次取消事件';
});

// 取消所有事件
cancel();

const values = ctx.syncEmit('cancel');
console.log(values); // []

// 仅取消代理实例上的事件
const valuesAgain = channel.syncEmit('cancel');
console.log(valuesAgain); // ["再次取消事件"]
```

## 设置禁用异步触发事件

```javascript
const channel = new AsyncEventChannel({ isEmitCache: false });

channel.emit('disable', '禁用事件');

// 无法接收事件
setTimeout(() => {
  channel.on('disable', function(data) {
    console.log(data);
  });
}, 1000);
```

## 设置同一通道只能注册一个事件

```javascript
const channel = new AsyncEventChannel({ isOnOnce: true });

channel.on('once', function() {
  return '一次事件';
});

// 覆盖上一个事件
channel.on('once', function() {
  return '第二次一次事件';
});

const values = channel.syncEmit('once');
console.log(values[0]); // 第二次一次事件
```

## 设置同一通道只能触发一个事件

```javascript
const channel = new AsyncEventChannel({ isEmitOnce: true });

channel.emit('once', '一次事件');

// 覆盖上一个等待事件
channel.emit('once', '第二次一次事件');

// 只能接收最后一个事件
channel.on('once', function(data) {
  console.log(data); // 第二次一次事件
});
```

## 仅设置指定的事件类型

```javascript
const options = new Map();
options.set('only', { isEmitCache: false });
const channel = new AsyncEventChannel(null, options);

channel.emit('only', '指定事件');

// 无法接收事件
setTimeout(() => {
  channel.on('only', function(data) {
    console.log(data);
  });
}, 1000);

channel.emit('other', '其他事件');

// 可以接收事件
setTimeout(() => {
  channel.on('other', function(data) {
    console.log(data); // 其他事件
  });
}, 1000);
```

## 修改全局默认配置

```javascript
import AsyncEventChannel from 'async-event-channel';

AsyncEventChannel.defaultOptions.isEmitCache = false;
```

## 配置项的优先级

```javascript
// 指定
new AsyncEventChannel(null, new Map([ ['only', { isEmitCache: true }] ]))

// 当前
new AsyncEventChannel({ isEmitCache: true })

// 全局
AsyncEventChannel.defaultOptions.isEmitCache

// 指定 > 当前 > 全局
```

## 可用作事件类型的值

> 可以使用任何类型的值，包括字符串，数字，对象，数组，符号，null等

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

# 异步任务队列

> 与事件通道无关

```javascript
import { AsyncTaskQueue } from 'async-event-channel';

// 事件类型可以是任何类型的值
const types = ['a', 1, null, ''];
// 就绪后是否自动执行
const oneAuto = false;

// 创建异步任务队列
const queue = new AsyncTaskQueue(types, oneAuto);

// 将任务添加到队列
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
    queue.cancel(); // 取消本次任务队列的执行
    return 1;
  });
}, 1000);
queue.on('', function(state) {
  console.log(4)
  return '';
});

// 准备就绪
queue.onLoad(function() {
  console.log('准备就绪');
  queue.start(0).then(result => {
    // 本次任务队列执行结果
    console.log(result);
  }).catch(error => {
    // 本次任务队列执行错误
    console.error(error);
  });
});

// 任务队列是否正在运行
console.log(queue.isRunning)
```
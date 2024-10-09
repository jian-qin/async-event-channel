# async-event-channel

[English](./README.md) | 简体中文

> 双向通信异步事件通道

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
// 或
// const { default: AsyncEventChannel } = require('async-event-channel');
// 或
// import AsyncEventChannel from 'async-event-channel/es5';

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

## 获取事件返回值（双向通信）

```javascript
channel.on('get', function(data) {
  console.log(data); // 事件数据
  return '返回值';
});

const result = channel.emit('get', '事件数据');
console.log(result.values[0]); // 返回值
```

## 异步获取事件返回值（双向通信）

```javascript
channel.asyncEmit('get', '事件数据').promise.then(result => {
  console.log(result.values[0]); // 返回值
});

setTimeout(() => {
  channel.on('get', function(data) {
    console.log(data); // 事件数据
    return '返回值';
  });
}, 1000);
```

## 同步获取事件返回值（双向通信）

```javascript
channel.on('get', function(data) {
  console.log(data); // 事件数据
  return '返回值';
});

// 如果未注册事件，将获得 undefined
const values = channel.immedEmit('get', '事件数据');
console.log(values[0]); // 返回值
```

## 取消侦听事件

```javascript
const { cancel } = channel.on('cancel', function() {
  return '取消事件';
});

// 取消侦听事件
cancel();

const values = channel.immedEmit('cancel');
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

const values = channel.immedEmit('cancel');
console.log(values); // []
```

## 监听过程

```javascript
// 监听过程，从注册事件到触发事件和取消事件，只监听事件，不触发事件
channel.watch('watch', function(data) {
  // 注意：无法保证监听过程的执行顺序
  console.log(data); // { "id": 1, "event": "on", "progress": "register", "type": "watch", "value": function() {...} }
  if (data.id === id) {
    console.log('匹配成功');
  }
});

const { id } = channel.on('watch', function() {
  return '监听过程';
});
```

## 查询是否还存在

```javascript
const { id } = channel.on('exists', function() {});

console.log(channel.hasId(id)); // true
console.log(channel.hasType('exists')); // true
```

## 导入导出

```javascript
const channel_old = new AsyncEventChannel();
const channel_new = new AsyncEventChannel();

channel_old.on('import', function() {
  return '导入事件';
});

// 导出事件通道数据
const data = channel_old.export();

// 导入事件通道数据
channel_new.import(...data);

// 导入事件通道数据后，可以使用导入的事件通道数据
const values_new = channel_new.immedEmit('import');
console.log(values_new[0]); // 导入事件

// 相当于复制，不会影响原事件通道数据
const values_old = channel_old.immedEmit('import');
console.log(values_old[0]); // 导入事件
```

## 监听事件和微任务

```javascript
let current = 0;

channel.on('microtask', function() {
  // 和Promise.resolve().then()一样，回调函数在当前事件循环的微任务队列中执行
  console.log('执行时刻', current); // 1
});

// 立刻触发事件
channel.emit('microtask');

current = 1;
```

## 只监听一次事件（双向通信）

```javascript
channel.once('once', function() {
  return '一次事件';
});

const values = channel.immedEmit('once');
console.log(values[0]); // 一次事件

const valuesAgain = channel.immedEmit('once');
console.log(valuesAgain); // []
```

## 立即监听事件一次（双向通信）

```javascript
// 永远不会触发事件
channel.immedOnce('immedOnce', function() {
  console.log('之前');
});

channel.emit('immedOnce');

channel.immedOnce('immedOnce', function() {
  console.log('之后'); // 之后
});
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

const values = ctx.immedEmit('cancel');
console.log(values); // []

// 仅取消代理实例上的事件
const valuesAgain = channel.immedEmit('cancel');
console.log(valuesAgain); // ["再次取消事件"]
```

## 配置事件类型名单进行作用域隔离

```javascript
import AsyncEventChannel, { asyncEventChannelScope } from 'async-event-channel';

const channel = new AsyncEventChannel();
const { ctx } = asyncEventChannelScope(channel, {
  include: [
    {
      type: 'only',
      handlers: ['emit']
    }
  ]
});

ctx.emit('only', '仅支持触发事件');

// 注册或取消事件会报错
// ctx.on('only', function() {});
// ctx.off('only');

// 只能在原事件通道上注册事件
channel.on('only', function(res) {
  console.log(res); // 仅支持触发事件
});

// 名单外的事件类型不受影响
ctx.on('other', function() {
  return '其他事件';
});

const values = ctx.immedEmit('other');
console.log(values[0]); // 其他事件
```

## 生成固定的事件类型

```javascript
import AsyncEventChannel, { useCreateEventChannel } from 'async-event-channel';

const channel = new AsyncEventChannel();
const createEventChannel = useCreateEventChannel(channel);

const fixed = createEventChannel();

fixed.on(function() {
  return '固定事件';
});

const values = fixed.immedEmit();
console.log(values[0]); // 固定事件
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

const values = channel.immedEmit('once');
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

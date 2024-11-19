import { expect, test } from '@jest/globals'
import AsyncEventChannel, { asyncEventChannelScope, useCreateEventChannel } from '../src/index'

// 比较两个对象是否相等
function jsonEquals(a: any, b: any) {
  expect(JSON.stringify(a)).toBe(JSON.stringify(b))
}

test('快速理解', async () => {
  // 事件通信实例
  const channel = new AsyncEventChannel()
  const result1: string[][] = []
  const result2: string[][] = []

  // 注册事件
  channel.on('click', function (...args) {
    console.log('收到的事件', args)
    result1.push(args)
  })
  // 再次注册事件
  channel.on('click', function (...args) {
    console.log('再次收到事件', args)
    result2.push(args)
  })

  // 触发事件
  channel.emit('click', '事件数据1', '事件数据2')
  // 再次触发事件
  channel.emit('click', '事件数据3', '事件数据4')

  await Promise.resolve()
  jsonEquals(result1, result2)
  jsonEquals(result2, [
    ['事件数据1', '事件数据2'],
    ['事件数据3', '事件数据4'],
  ])
})

test('异步通信', async () => {
  const channel = new AsyncEventChannel()

  // 首先发出事件 (仅当事件未注册时，才会异步等待发送事件)
  channel.emit('timeout', '异步事件')

  // 稍后注册事件
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const result: string[] = []
  channel.on('timeout', function (data) {
    console.log(data) // 异步事件
    result.push(data)
  })
  await Promise.resolve()
  jsonEquals(result, ['异步事件'])
})

test('获取事件返回值（双向通信）', async () => {
  const channel = new AsyncEventChannel()

  channel.on('get', function (data) {
    console.log(data) // 事件数据
    return '返回值'
  })
  const result = channel.emit('get', '事件数据')
  console.log(result.values[0]) // 返回值

  jsonEquals(result.values, ['返回值'])
})

test('异步获取事件返回值（双向通信）', async () => {
  const channel = new AsyncEventChannel()
  const resultVal: string[][] = []

  channel.asyncEmit('get', '事件数据').promise.then((result) => {
    console.log(result[0]) // 返回值
    resultVal.push(result)
  })

  await new Promise((resolve) => setTimeout(resolve, 1000))
  channel.on('get', function (data) {
    console.log(data) // 事件数据
    return '返回值'
  })

  await new Promise((resolve) => setTimeout(resolve, 0))
  jsonEquals(resultVal, [['返回值']])
})

test('同步获取事件返回值（双向通信）', async () => {
  const channel = new AsyncEventChannel()

  channel.on('get', function (data) {
    console.log(data) // 事件数据
    return '返回值'
  })

  // 如果未注册事件，将获得 undefined
  const values = channel.immedEmit('get', '事件数据').values
  console.log(values[0]) // 返回值

  jsonEquals(values, ['返回值'])
})

test('取消侦听事件', async () => {
  const channel = new AsyncEventChannel()

  const { cancel } = channel.on('cancel', function () {
    return '取消事件'
  })

  // 取消侦听事件
  cancel()

  const values = channel.immedEmit('cancel').values
  console.log(values) // []

  jsonEquals(values, [])
})

test('取消等待中的触发事件', async () => {
  const channel = new AsyncEventChannel()
  const result: string[] = []

  const { cancel } = channel.emit('cancel', '取消事件')

  // 取消等待中的触发事件
  cancel()

  // 无法接收事件
  channel.on('cancel', function (data) {
    console.log(data)
    result.push(data)
  })

  await new Promise((resolve) => setTimeout(resolve, 1000))
  jsonEquals(result, [])
})

test('取消指定通道上的监听事件和触发事件', async () => {
  const channel = new AsyncEventChannel()

  channel.on('cancel', function () {
    return '取消事件'
  })
  channel.on('cancel', function () {
    return '再次取消事件'
  })

  channel.off('cancel')

  const values = channel.immedEmit('cancel').values
  console.log(values) // []

  jsonEquals(values, [])
})

test('监听过程', async () => {
  const channel = new AsyncEventChannel()
  let result: any = null

  // 监听过程，从注册事件到触发事件和取消事件，只监听事件，不触发事件
  channel.watch('watch', function (data) {
    // 注意：无法保证监听过程的执行顺序
    console.log(data) // { "id": "1:1", "event": "on", "progress": "register", "type": "watch", "value": function() {...} }
    result = data
  })

  const { id } = channel.on('watch', function () {
    return '监听过程'
  })

  console.log(result?.id === id) // true

  expect(result?.id === id).toBeTruthy()
})

test('查询是否还存在', async () => {
  const channel = new AsyncEventChannel()

  const { id } = channel.on('exists', function () {})

  console.log(channel.hasId(id)) // true
  console.log(channel.hasType('exists').has) // true

  expect(channel.hasId(id)).toBeTruthy()
  expect(channel.hasType('exists').has).toBeTruthy()
})

test('导入导出', async () => {
  const channel_old = new AsyncEventChannel()
  const channel_new = new AsyncEventChannel()

  channel_old.on('import', function () {
    return '导入事件'
  })

  // 导出事件通道数据
  const data = channel_old.export()

  // 导入事件通道数据
  channel_new.import(...data)

  // 导入事件通道数据后，可以使用导入的事件通道数据
  const values_new = channel_new.immedEmit('import').values
  console.log(values_new[0]) // 导入事件

  // 相当于复制，不会影响原事件通道数据
  const values_old = channel_old.immedEmit('import').values
  console.log(values_old[0]) // 导入事件

  jsonEquals(values_new, ['导入事件'])
  jsonEquals(values_old, ['导入事件'])
})

test('监听事件和微任务', async () => {
  // const channel = new AsyncEventChannel()
  // let current = 0
  // const result: number[] = []
  // channel.on('microtask', function () {
  //   // 和Promise.resolve().then()一样，回调函数在当前事件循环的微任务队列中执行
  //   console.log('执行时刻', current) // 1
  //   result.push(current)
  // })
  // // 立刻触发事件
  // channel.emit('microtask')
  // current = 1
  // jsonEquals(result, [1])
})

test('只监听一次事件（双向通信）', async () => {
  const channel = new AsyncEventChannel()

  channel.once('once', function () {
    return '一次事件'
  })

  const values = channel.immedEmit('once').values
  console.log(values[0]) // 一次事件

  const valuesAgain = channel.immedEmit('once').values
  console.log(valuesAgain) // []

  jsonEquals(values, ['一次事件'])
  jsonEquals(valuesAgain, [])
})

test('立即监听事件一次（双向通信）', async () => {
  const channel = new AsyncEventChannel()
  const result1: string[] = []
  const result2: string[] = []

  // 永远不会触发事件
  channel.immedOnce('immedOnce', function () {
    console.log('之前')
    result1.push('之前')
  })

  channel.emit('immedOnce')

  channel.immedOnce('immedOnce', function () {
    console.log('之后') // 之后
    result2.push('之后')
  })

  await new Promise((resolve) => setTimeout(resolve, 1000))
  jsonEquals(result1, [])
  jsonEquals(result2, ['之后'])
})

test('取消事件的统一收集', async () => {
  const channel = new AsyncEventChannel()
  const { ctx, cancel } = asyncEventChannelScope(channel)

  ctx.on('cancel', function () {
    return '取消事件'
  })
  ctx.on('cancel-again', function () {
    return '再次取消事件'
  })

  // 取消所有事件
  cancel()

  const values = ctx.immedEmit('cancel').values
  console.log(values) // []

  const valuesAgain = channel.immedEmit('cancel-again').values
  console.log(valuesAgain) // []

  jsonEquals(values, [])
  jsonEquals(valuesAgain, [])
})

test('配置事件类型名单进行作用域隔离', async () => {
  const channel = new AsyncEventChannel()
  const { ctx } = asyncEventChannelScope(channel, {
    include: [
      {
        type: 'only',
        handlers: ['emit'],
      },
    ],
  })

  ctx.emit('only', '仅支持触发事件')

  expect(() => {
    // 注册或取消事件会报错
    ctx.on('only', function () {})
    ctx.off('only')
  }).toThrow('The event type is not included or excluded')

  // 只能在原事件通道上注册事件
  channel.on('only', function (res) {
    console.log(res) // 仅支持触发事件
  })

  // 名单外的事件类型不受影响
  ctx.on('other', function () {
    return '其他事件'
  })

  const values = ctx.immedEmit('other').values
  console.log(values[0]) // 其他事件

  jsonEquals(values, ['其他事件'])
})

test('生成固定的事件类型', async () => {
  const channel = new AsyncEventChannel()
  const createEventChannel = useCreateEventChannel(channel)

  const fixed = createEventChannel()

  fixed.on(function () {
    return '固定事件'
  })

  const values = fixed.immedEmit().values
  console.log(values[0]) // 固定事件

  jsonEquals(values, ['固定事件'])
})

test('设置禁用异步触发事件', async () => {
  const channel = new AsyncEventChannel({ isEmitCache: false })
  const result: string[] = []

  channel.emit('disable', '禁用事件')

  // 无法接收事件
  channel.on('disable', function (data) {
    console.log(data)
    result.push(data)
  })

  await new Promise((resolve) => setTimeout(resolve, 0))
  jsonEquals(result, [])
})

test('设置同一通道只能注册一个事件', async () => {
  const channel = new AsyncEventChannel({ isOnOnce: true })

  channel.on('once', function () {
    return '一次事件'
  })

  // 覆盖上一个事件
  channel.on('once', function () {
    return '第二次一次事件'
  })

  const values = channel.immedEmit('once').values
  console.log(values[0]) // 第二次一次事件

  jsonEquals(values, ['第二次一次事件'])
})

test('设置同一通道只能触发一个事件', async () => {
  // const channel = new AsyncEventChannel({ isEmitOnce: true })
  // const result: string[] = []
  // channel.emit('once', '一次事件')
  // // 覆盖上一个等待事件
  // channel.emit('once', '第二次一次事件')
  // // 只能接收最后一个事件
  // channel.on('once', function (data) {
  //   console.log(data) // 第二次一次事件
  //   result.push(data)
  // })
  // await new Promise((resolve) => setTimeout(resolve, 0))
  // await Promise.resolve()
  // jsonEquals(result, ['第二次一次事件'])
})

test('仅设置指定的事件类型', async () => {
  const options = new Map()
  options.set('only', { isEmitCache: false })
  const channel = new AsyncEventChannel(null, options)
  const result1: string[] = []
  const result2: string[] = []

  channel.emit('only', '指定事件')

  // 无法接收事件
  setTimeout(() => {
    channel.on('only', function (data) {
      console.log(data)
      result1.push(data)
    })
  }, 500)

  channel.emit('other', '其他事件')

  // 可以接收事件
  setTimeout(() => {
    channel.on('other', function (data) {
      console.log(data) // 其他事件
      result2.push(data)
    })
  }, 500)

  await new Promise((resolve) => setTimeout(resolve, 1000))

  jsonEquals(result1, [])
  jsonEquals(result2, ['其他事件'])
})

test('配置项的优先级', async () => {
  const channel = new AsyncEventChannel(
    { isEmitCache: true },
    new Map([['only', { isEmitCache: false }]])
  )
  const result: string[] = []

  channel.emit('only', '指定事件')

  // 无法接收事件
  setTimeout(() => {
    channel.on('only', function (data) {
      console.log(data)
      result.push(data)
    })
  }, 500)

  await new Promise((resolve) => setTimeout(resolve, 1000))

  jsonEquals(result, [])
})

test('配置项的优先级', async () => {
  const channel = new AsyncEventChannel()
  const key1 = []
  const key2 = 2
  const key3 = Symbol()

  const result1: string[] = []
  const result2: string[] = []
  const result3: string[] = []

  channel.on(key1, (data) => {
    result1.push(data)
  })
  channel.on(key2, (data) => {
    result2.push(data)
  })
  channel.on(key3, (data) => {
    result3.push(data)
  })

  channel.emit(key1, 'Array')
  channel.emit(key2, 'Number')
  channel.emit(key3, 'Symbol')

  await Promise.resolve()
  jsonEquals(result1, ['Array'])
  jsonEquals(result2, ['Number'])
  jsonEquals(result3, ['Symbol'])
})

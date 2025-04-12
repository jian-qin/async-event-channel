import { expect, test } from '@jest/globals'
import AsyncEventChannel, { type HooksValue } from '../src/index'

const jsonEq = (one: unknown, ...arr: unknown[]) => {
  const _one = JSON.stringify(one)
  expect(arr.every((item) => JSON.stringify(item) === _one)).toBeTruthy()
}

const sleep = (time = 100) => new Promise((resolve) => setTimeout(resolve, time))

test('同步执行的on和emit、多个on、双向通信', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      return '1-on-返回参数'
    }).id,
  ])
  res.push([
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      onReply(params, { id }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  res.push([
    '2-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['2-on-接收:params,id', params, id])
      return '2-on-返回参数'
    }).id,
  ])
  res.push([
    '2-emit-触发:id',
    ctx.emit('a', '2-emit-参数', {
      onReply(params, { id }) {
        res.push(['2-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  res.push(['3-emit-触发:id', ctx.emit('a', '3-emit-参数').id])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['1-on-接收:params,id', '1-emit-参数', 1],
    ['1-emit-接收返回参数,id', [[1, '1-on-返回参数']], 2],
    ['1-emit-触发:id', 2],

    ['2-on-注册:id', 3],
    ['1-on-接收:params,id', '2-emit-参数', 1],
    ['2-emit-接收返回参数,id', [[1, '1-on-返回参数']], 4],
    ['2-on-接收:params,id', '2-emit-参数', 3],
    [
      '2-emit-接收返回参数,id',
      [
        [1, '1-on-返回参数'],
        [3, '2-on-返回参数'],
      ],
      4,
    ],
    ['2-emit-触发:id', 4],

    ['1-on-接收:params,id', '3-emit-参数', 1],
    ['2-on-接收:params,id', '3-emit-参数', 3],
    ['3-emit-触发:id', 5],
  ])
})

test('异步和同步执行的on、同步执行的emit、off注销on', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-on-注册:id',
    ctx.on(
      'a',
      async (params, { id, off }) => {
        res.push(['1-on-接收:params,id', params, id])
        if (params === '2-emit-参数') {
          off()
          res.push(['1-on-注销:id', id])
        }
        await sleep()
        return '1-on-返回参数-异步'
      },
      { wait: true }
    ).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on('a', (params, { id, off }) => {
      res.push(['2-on-接收:params,id', params, id])
      if (params === '2-emit-参数') {
        off()
        res.push(['2-on-注销:id', id])
      }
      return '2-on-返回参数-同步'
    }).id,
  ])
  res.push([
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      onReply(params, { id }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  await sleep(200)

  res.push([
    '2-emit-触发:id',
    ctx.emit('a', '2-emit-参数', {
      onReply(params, { id }) {
        res.push(['2-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  await sleep(1000)

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['2-on-注册:id', 2],
    ['1-on-接收:params,id', '1-emit-参数', 1],
    ['2-on-接收:params,id', '1-emit-参数', 2],

    ['1-emit-接收返回参数,id', [[2, '2-on-返回参数-同步']], 3],
    ['1-emit-触发:id', 3],
    [
      '1-emit-接收返回参数,id',
      [
        [2, '2-on-返回参数-同步'],
        [1, '1-on-返回参数-异步'],
      ],
      3,
    ],

    ['1-on-接收:params,id', '2-emit-参数', 1],
    ['1-on-注销:id', 1],
    ['2-on-接收:params,id', '2-emit-参数', 2],
    ['2-on-注销:id', 2],
    ['2-emit-触发:id', 4],
  ])
})

test('异步执行的emit、off注销emit', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      wait: true,
      onReply(params, { id, off }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
        off()
        res.push(['1-emit-注销:id', id])
      },
    }).id,
  ])
  res.push([
    '2-emit-触发:id',
    ctx.emit('a', '2-emit-参数', {
      wait: true,
      onReply(params, { id }) {
        res.push(['2-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  res.push([
    '1-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      return '1-on-返回参数'
    }).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['2-on-接收:params,id', params, id])
      return '2-on-返回参数'
    }).id,
  ])

  jsonEq(res, [
    ['1-emit-触发:id', 1],
    ['2-emit-触发:id', 2],
    ['1-on-接收:params,id', '1-emit-参数', 3],
    ['1-emit-接收返回参数,id', [[3, '1-on-返回参数']], 1],
    ['1-emit-注销:id', 1],
    ['1-on-接收:params,id', '2-emit-参数', 3],
    ['2-emit-接收返回参数,id', [[3, '1-on-返回参数']], 2],
    ['1-on-注册:id', 3],
    ['2-on-接收:params,id', '2-emit-参数', 4],
    [
      '2-emit-接收返回参数,id',
      [
        [3, '1-on-返回参数'],
        [4, '2-on-返回参数'],
      ],
      2,
    ],
    ['2-on-注册:id', 4],
  ])
})

test('只执行一次的异步emit、只执行一次的同步和异步的on', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      wait: true,
      once: true,
      onReply(params, { id }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])
  res.push([
    '1-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      return '1-on-返回参数'
    }).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['2-on-接收:params,id', params, id])
      return '2-on-返回参数'
    }).id,
  ])

  res.push([
    '3-on-注册:id',
    ctx.on(
      'b',
      (params, { id }) => {
        res.push(['3-on-接收:params,id', params, id])
        return '3-on-返回参数'
      },
      { once: true, wait: true }
    ).id,
  ])
  res.push([
    '4-on-注册:id',
    ctx.on(
      'b',
      (params, { id }) => {
        res.push(['4-on-接收:params,id', params, id])
        return '4-on-返回参数'
      },
      { once: true }
    ).id,
  ])
  res.push([
    '2-emit-触发:id',
    ctx.emit('b', '2-emit-参数', {
      onReply(params, { id }) {
        res.push(['2-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  await sleep()

  res.push(['3-emit-触发:id', ctx.emit('b', '3-emit-参数').id])

  await sleep(1000)

  jsonEq(res, [
    ['1-emit-触发:id', 1],
    ['1-on-接收:params,id', '1-emit-参数', 2],
    ['1-emit-接收返回参数,id', [[2, '1-on-返回参数']], 1],
    ['1-on-注册:id', 2],
    ['2-on-注册:id', 3],

    ['3-on-注册:id', 4],
    ['4-on-注册:id', 5],
    ['3-on-接收:params,id', '2-emit-参数', 4],
    ['4-on-接收:params,id', '2-emit-参数', 5],
    ['2-emit-接收返回参数,id', [[5, '4-on-返回参数']], 6],
    ['2-emit-触发:id', 6],
    [
      '2-emit-接收返回参数,id',
      [
        [5, '4-on-返回参数'],
        [4, '3-on-返回参数'],
      ],
      6,
    ],

    ['3-emit-触发:id', 7],
  ])
})

test('当前on和emit的数量siez、off批量注销on和emit', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push(['1-on-注册:id', ctx.on('a', () => {}).id])
  res.push(['2-on-注册:id', ctx.on('a', () => {}).id])
  res.push(['3-on-注册:id', ctx.on('b', () => {}).id])
  res.push(['1-emit-触发:id', ctx.emit('a', null, { wait: true }).id])
  res.push(['2-emit-触发:id', ctx.emit('a', null, { wait: true }).id])
  res.push(['3-emit-触发:id', ctx.emit('b', null, { wait: true }).id])

  res.push(['1-size:事件,数量', 'a', ctx.size('a'), 'b', ctx.size('b')])
  res.push(['1-off-注销:事件,类型', 'a', 'on', ctx.off('a', 'on')])

  res.push(['1-size:事件,数量', 'a', ctx.size('a'), 'b', ctx.size('b')])
  res.push(['1-off-注销:事件,类型', '/.+/', 'all', ctx.off(/.+/)])
  res.push(['1-size:事件,数量', 'a', ctx.size('a'), 'b', ctx.size('b')])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['2-on-注册:id', 2],
    ['3-on-注册:id', 3],
    ['1-emit-触发:id', 4],
    ['2-emit-触发:id', 5],
    ['3-emit-触发:id', 6],
    ['1-size:事件,数量', 'a', { on: 2, emit: 2 }, 'b', { on: 1, emit: 1 }],
    ['1-off-注销:事件,类型', 'a', 'on', undefined],
    ['1-size:事件,数量', 'a', { on: 0, emit: 2 }, 'b', { on: 1, emit: 1 }],
    ['1-off-注销:事件,类型', '/.+/', 'all', undefined],
    ['1-size:事件,数量', 'a', { on: 0, emit: 0 }, 'b', { on: 0, emit: 0 }],
  ])
})

test('hook监听单个/批量/全部、只监听一次', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  const simplify = (params: Parameters<HooksValue['listener']>[0]) => {
    const { on, emit } = params
    return {
      ...params,
      event: on?.event ?? emit?.event,
      on: on?.result.id,
      emit: emit?.result.id,
    }
  }

  res.push([
    '1-hook-注册:id',
    ctx.hook(/.+/, (params, { id }) => {
      res.push(['1-hook监听:params,id', simplify(params), id])
    }).id,
  ])
  res.push([
    '2-hook-注册:id',
    ctx.hook(
      'a',
      (params, { id }) => {
        res.push(['2-hook监听:params,id', simplify(params), id])
      },
      { once: true, type: 'on' }
    ).id,
  ])

  res.push([
    '1-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      return '1-on-返回参数-同步'
    }).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on(
      'a',
      (params, { id }) => {
        res.push(['2-on-接收:params,id', params, id])
        return '2-on-返回参数-异步'
      },
      { once: true, wait: true }
    ).id,
  ])
  const result = ctx.emit('a', '1-emit-参数', {
    onReply(params, { id }) {
      res.push(['1-emit-接收返回参数,id', Array.from(params), id])
    },
  })
  res.push(['1-emit-触发:id', result.id])

  await sleep()

  result.off()

  await sleep(1000)

  jsonEq(res, [
    ['1-hook-注册:id', 1],
    ['2-hook-注册:id', 2],
    ['1-hook监听:params,id', { on: 3, emit: undefined, type: 'on', event: 'a' }, 1],
    ['2-hook监听:params,id', { on: 3, emit: undefined, type: 'on', event: 'a' }, 2],
    ['1-on-注册:id', 3],
    ['1-hook监听:params,id', { on: 4, emit: undefined, type: 'on', event: 'a' }, 1],
    ['2-on-注册:id', 4],

    ['1-hook监听:params,id', { on: undefined, emit: 5, type: 'emit', event: 'a' }, 1],
    ['1-hook监听:params,id', { on: 3, emit: 5, type: 'trigger', event: 'a' }, 1],
    ['1-on-接收:params,id', '1-emit-参数', 3],
    ['1-hook监听:params,id', { on: 3, emit: 5, type: 'reply', event: 'a' }, 1],
    ['1-emit-接收返回参数,id', [[3, '1-on-返回参数-同步']], 5],
    ['1-hook监听:params,id', { on: 4, emit: 5, type: 'trigger', event: 'a' }, 1],
    ['2-on-接收:params,id', '1-emit-参数', 4],
    ['1-emit-触发:id', 5],
    ['1-hook监听:params,id', { on: 4, emit: 5, type: 'reply', event: 'a' }, 1],

    ['1-hook监听:params,id', { on: 4, emit: undefined, type: 'off', event: 'a' }, 1],
    [
      '1-emit-接收返回参数,id',
      [
        [3, '1-on-返回参数-同步'],
        [4, '2-on-返回参数-异步'],
      ],
      5,
    ],
    ['1-hook监听:params,id', { on: undefined, emit: 5, type: 'off', event: 'a' }, 1],
  ])
})

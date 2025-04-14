import { expect, test } from '@jest/globals'
import AsyncEventChannel, { type HooksValue } from '../src/index'

const jsonEq = (one: unknown, ...arr: unknown[]) => {
  const _one = JSON.stringify(one)
  expect(arr.every((item) => JSON.stringify(item) === _one)).toBeTruthy()
}

const sleep = (time = 100) => new Promise((resolve) => setTimeout(resolve, time))

const hookParamsSimplify = (params: Parameters<HooksValue['listener']>[0]) => {
  const { on, emit } = params
  return {
    ...params,
    event: on?.event ?? emit?.event,
    on: on && on.result.id,
    emit: emit && emit.result.id,
  }
}

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
    ['2-emit-接收返回参数,id', [[2, '2-on-返回参数-同步']], 4],
    ['2-emit-触发:id', 4],

    [
      '2-emit-接收返回参数,id',
      [
        [2, '2-on-返回参数-同步'],
        [1, '1-on-返回参数-异步'],
      ],
      4,
    ],
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

test('当前on和emit的数量siez、off单个注销和批量注销on和emit', async () => {
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

  res.push(['2-size:事件,数量', 'a', ctx.size('a'), 'b', ctx.size('b')])
  res.push(['2-off-注销:事件,类型', '/.*/', 'all', ctx.off(/.*/)])
  res.push(['3-size:事件,数量', 'a', ctx.size('a'), 'b', ctx.size('b')])

  res.push(['4-on-注册:id', ctx.on('a', () => {}).id])
  res.push(['4-size:id', ctx.size(7)])
  res.push(['3-off-注销:id', ctx.off(7)])
  res.push(['5-size:事件,数量', '/.*/', ctx.size(/.*/)])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['2-on-注册:id', 2],
    ['3-on-注册:id', 3],
    ['1-emit-触发:id', 4],
    ['2-emit-触发:id', 5],
    ['3-emit-触发:id', 6],
    ['1-size:事件,数量', 'a', { on: 2, emit: 2, count: 4 }, 'b', { on: 1, emit: 1, count: 2 }],
    ['1-off-注销:事件,类型', 'a', 'on', undefined],
    ['2-size:事件,数量', 'a', { on: 0, emit: 2, count: 2 }, 'b', { on: 1, emit: 1, count: 2 }],
    ['2-off-注销:事件,类型', '/.*/', 'all', undefined],
    ['3-size:事件,数量', 'a', { on: 0, emit: 0, count: 0 }, 'b', { on: 0, emit: 0, count: 0 }],

    ['4-on-注册:id', 7],
    ['4-size:id', { on: 1, emit: 0, count: 1 }],
    ['3-off-注销:id', undefined],
    ['5-size:事件,数量', '/.*/', { on: 0, emit: 0, count: 0 }],
  ])
})

test('hook监听单个/批量/全部、只监听一次', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-hook-注册:id',
    ctx.hook(/.*/, (params, { id }) => {
      res.push(['1-hook监听:params,id', hookParamsSimplify(params), id])
    }).id,
  ])
  res.push([
    '2-hook-注册:id',
    ctx.hook(
      'a',
      (params, { id }) => {
        res.push(['2-hook监听:params,id', hookParamsSimplify(params), id])
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
  const emit_1_result = ctx.emit('a', '1-emit-参数', {
    onReply(params, { id }) {
      res.push(['1-emit-接收返回参数,id', Array.from(params), id])
    },
  })
  res.push(['1-emit-触发:id', emit_1_result.id])

  await sleep()

  emit_1_result.off()

  await sleep(1000)

  jsonEq(res, [
    ['1-hook-注册:id', 1],
    ['2-hook-注册:id', 2],
    ['1-hook监听:params,id', { type: 'on', on: 3, emit: null, event: 'a' }, 1],
    ['2-hook监听:params,id', { type: 'on', on: 3, emit: null, event: 'a' }, 2],
    ['1-on-注册:id', 3],
    ['1-hook监听:params,id', { type: 'on', on: 4, emit: null, event: 'a' }, 1],
    ['2-on-注册:id', 4],

    ['1-hook监听:params,id', { type: 'emit', on: null, emit: 5, event: 'a' }, 1],
    ['1-hook监听:params,id', { type: 'trigger', on: 3, emit: 5, event: 'a' }, 1],
    ['1-on-接收:params,id', '1-emit-参数', 3],
    ['1-hook监听:params,id', { type: 'reply', on: 3, emit: 5, event: 'a' }, 1],
    ['1-emit-接收返回参数,id', [[3, '1-on-返回参数-同步']], 5],
    ['1-hook监听:params,id', { type: 'trigger', on: 4, emit: 5, event: 'a' }, 1],
    ['2-on-接收:params,id', '1-emit-参数', 4],
    ['1-hook监听:params,id', { type: 'off', on: 4, emit: null, event: 'a' }, 1],
    ['1-emit-触发:id', 5],

    ['1-hook监听:params,id', { type: 'reply', on: 4, emit: 5, event: 'a' }, 1],
    [
      '1-emit-接收返回参数,id',
      [
        [3, '1-on-返回参数-同步'],
        [4, '2-on-返回参数-异步'],
      ],
      5,
    ],

    ['1-hook监听:params,id', { type: 'off', on: null, emit: 5, event: 'a' }, 1],
  ])
})

test('emit_sync同步获取单个返回参数', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push(['1-emit_sync-触发:返回参数', ctx.emit_sync('a', '1-emit_sync-参数')])
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
  res.push(['2-emit_sync-触发:返回参数', ctx.emit_sync('a', '2-emit_sync-参数')])
  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  jsonEq(res, [
    ['1-emit_sync-触发:返回参数', undefined],
    ['1-on-注册:id', 2],
    ['2-on-注册:id', 3],
    ['1-on-接收:params,id', '2-emit_sync-参数', 2],
    ['2-on-接收:params,id', '2-emit_sync-参数', 3],
    ['2-emit_sync-触发:返回参数', '1-on-返回参数'],
    ['1-size:事件,数量', 'a', { on: 2, emit: 0, count: 2 }],
  ])
})

test('emit_post异步获取单个返回参数', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  ctx.emit_post('a', '1-emit_post-参数').then((params) => {
    res.push(['1-emit_post-接收返回参数', params])
  })

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

  await sleep()

  ctx.emit_post('a', '2-emit_post-参数').then((params) => {
    res.push(['2-emit_post-接收返回参数', params])
  })

  await sleep()

  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  await sleep(1000)

  jsonEq(res, [
    ['1-on-接收:params,id', '1-emit_post-参数', 2],
    ['1-on-注册:id', 2],
    ['2-on-注册:id', 3],
    ['1-emit_post-接收返回参数', '1-on-返回参数'],

    ['1-on-接收:params,id', '2-emit_post-参数', 2],
    ['2-on-接收:params,id', '2-emit_post-参数', 3],
    ['2-emit_post-接收返回参数', '1-on-返回参数'],

    ['1-size:事件,数量', 'a', { on: 2, emit: 0, count: 2 }],
  ])
})

test('effectScope收集off、多层嵌套', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  const scope1 = ctx.effectScope()
  const scope2 = scope1.effectScope()

  res.push([
    '1-hook-注册:id',
    ctx.hook('a', (params, { id }) => {
      res.push(['1-hook监听:params,id', hookParamsSimplify(params), id])
    }).id,
  ])

  res.push(['1-on-注册:id', ctx.on('a', () => {}).id])
  res.push(['2-on-注册:id', scope1.on('a', () => {}).id])
  res.push(['3-on-注册:id', scope2.on('a', () => {}).id])
  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  res.push(['1-clear-清空', 'scope2', scope2.clear()])
  res.push(['2-size:事件,数量', 'a', ctx.size('a')])
  res.push(['4-on-注册:id', scope2.on('a', () => {}).id])
  res.push(['3-size:事件,数量', 'a', ctx.size('a')])

  res.push(['1-destroy-销毁', 'scope1', scope1.destroy()])
  res.push(['4-size:事件,数量', 'a', ctx.size('a')])

  jsonEq(res, [
    ['1-hook-注册:id', 1],
    ['1-hook监听:params,id', { type: 'on', on: 2, emit: null, event: 'a' }, 1],
    ['1-on-注册:id', 2],
    ['1-hook监听:params,id', { type: 'on', on: 3, emit: null, event: 'a' }, 1],
    ['2-on-注册:id', 3],
    ['1-hook监听:params,id', { type: 'on', on: 4, emit: null, event: 'a' }, 1],
    ['3-on-注册:id', 4],
    ['1-size:事件,数量', 'a', { on: 3, emit: 0, count: 3 }],

    ['1-hook监听:params,id', { type: 'off', on: 4, emit: null, event: 'a' }, 1],
    ['1-clear-清空', 'scope2', undefined],
    ['2-size:事件,数量', 'a', { on: 2, emit: 0, count: 2 }],
    ['1-hook监听:params,id', { type: 'on', on: 5, emit: null, event: 'a' }, 1],
    ['4-on-注册:id', 5],
    ['3-size:事件,数量', 'a', { on: 3, emit: 0, count: 3 }],

    ['1-hook监听:params,id', { type: 'off', on: 3, emit: null, event: 'a' }, 1],
    ['1-hook监听:params,id', { type: 'off', on: 5, emit: null, event: 'a' }, 1],
    ['1-destroy-销毁', 'scope1', undefined],
    ['4-size:事件,数量', 'a', { on: 1, emit: 0, count: 1 }],
  ])
})

test('effectScope中的emit_sync和emit_post', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  const scope = ctx.effectScope()

  res.push([
    '1-on-注册:id',
    scope.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      return '1-on-返回参数'
    }).id,
  ])
  res.push(['1-emit_sync-触发:返回参数', scope.emit_sync('a', '1-emit_sync-参数')])
  // @ts-expect-error
  res.push(['1-scope:ids', [...scope._ids]])

  scope.emit_post('a', '2-emit_post-参数').then((params) => {
    res.push(['2-emit_post-接收返回参数', params])
  })

  await sleep()

  // @ts-expect-error
  res.push(['1-scope:ids', [...scope._ids]])
  res.push(['1-size:事件,数量', 'a', ctx.size('a')])
  res.push(['1-clear-清空', 'scope2', scope.clear()])
  // @ts-expect-error
  res.push(['1-scope:ids', [...scope._ids]])
  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['1-on-接收:params,id', '1-emit_sync-参数', 1],
    ['1-emit_sync-触发:返回参数', '1-on-返回参数'],
    ['1-scope:ids', [1, 2]],

    ['1-on-接收:params,id', '2-emit_post-参数', 1],
    ['2-emit_post-接收返回参数', '1-on-返回参数'],

    ['1-scope:ids', [1, 2, 3]],
    ['1-size:事件,数量', 'a', { on: 1, emit: 0, count: 1 }],
    ['1-clear-清空', 'scope2', undefined],
    ['1-scope:ids', []],
    ['1-size:事件,数量', 'a', { on: 0, emit: 0, count: 0 }],
  ])
})

test('on/emit的once执行顺序', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-hook-注册:id',
    ctx.hook('a', (params, { id }) => {
      res.push(['1-hook监听:params,id', hookParamsSimplify(params), id])
    }).id,
  ])

  res.push([
    '1-on-注册:id',
    ctx.on(
      'a',
      (params, { id }) => {
        res.push(['1-on-接收:params,id', params, id])
        return '1-on-返回参数'
      },
      { once: true }
    ).id,
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
    '2-emit-触发:id',
    ctx.emit('a', '2-emit-参数', {
      once: true,
      wait: true,
      onReply(params, { id }) {
        res.push(['2-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on(
      'a',
      async (params, { id }) => {
        res.push(['2-on-接收:params,id', params, id])
        await sleep()
        return '2-on-返回参数'
      },
      { once: true, wait: true }
    ).id,
  ])

  await sleep(1000)

  jsonEq(res, [
    ['1-hook-注册:id', 1],
    ['1-hook监听:params,id', { type: 'on', on: 2, emit: null, event: 'a' }, 1],
    ['1-on-注册:id', 2],
    ['1-hook监听:params,id', { type: 'emit', on: null, emit: 3, event: 'a' }, 1],
    ['1-hook监听:params,id', { type: 'trigger', on: 2, emit: 3, event: 'a' }, 1],
    ['1-on-接收:params,id', '1-emit-参数', 2],
    ['1-hook监听:params,id', { type: 'off', on: 2, emit: null, event: 'a' }, 1],
    ['1-hook监听:params,id', { type: 'reply', on: 2, emit: 3, event: 'a' }, 1],
    ['1-emit-接收返回参数,id', [[2, '1-on-返回参数']], 3],
    ['1-hook监听:params,id', { type: 'off', on: null, emit: 3, event: 'a' }, 1],
    ['1-emit-触发:id', 3],

    ['1-hook监听:params,id', { type: 'emit', on: null, emit: 4, event: 'a' }, 1],
    ['2-emit-触发:id', 4],
    ['1-hook监听:params,id', { type: 'on', on: 5, emit: null, event: 'a' }, 1],
    ['1-hook监听:params,id', { type: 'trigger', on: 5, emit: 4, event: 'a' }, 1],
    ['2-on-接收:params,id', '2-emit-参数', 5],
    ['1-hook监听:params,id', { type: 'off', on: 5, emit: null, event: 'a' }, 1],
    ['2-on-注册:id', 5],

    ['1-hook监听:params,id', { type: 'reply', on: 5, emit: 4, event: 'a' }, 1],
    ['2-emit-接收返回参数,id', [[5, '2-on-返回参数']], 4],
    ['1-hook监听:params,id', { type: 'off', on: null, emit: 4, event: 'a' }, 1],
  ])
})

test('emit同步执行、hook监听id', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-hook-注册:id',
    ctx.hook(
      2,
      (params, { id }) => {
        res.push(['1-hook监听:params,id', hookParamsSimplify(params), id])
      },
      { type: 'off' }
    ).id,
  ])
  res.push([
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      onReply(params, { id }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  jsonEq(res, [
    ['1-hook-注册:id', 1],
    ['1-hook监听:params,id', { type: 'off', on: null, emit: 2, event: 'a' }, 1],
    ['1-emit-触发:id', 2],
  ])
})

test('同步on返回throw', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['1-on-接收:params,id', params, id])
      throw new Error('1-on-返回参数-throw')
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
    '1-emit-触发:id',
    ctx.emit('a', '1-emit-参数', {
      onReply(params, { id }) {
        res.push(['1-emit-接收返回参数,id', Array.from(params), id])
      },
    }).id,
  ])

  await sleep()

  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['2-on-注册:id', 2],
    ['1-on-接收:params,id', '1-emit-参数', 1],
    ['2-on-接收:params,id', '1-emit-参数', 2],
    ['1-emit-接收返回参数,id', [[2, '2-on-返回参数']], 3],
    ['1-emit-触发:id', 3],
    ['1-size:事件,数量', 'a', { on: 2, emit: 0, count: 2 }],
  ])
})

test('异步on返回reject', async () => {
  const ctx = new AsyncEventChannel()
  const res: unknown[] = []

  res.push([
    '1-on-注册:id',
    ctx.on(
      'a',
      async (params, { id }) => {
        res.push(['1-on-接收:params,id', params, id])
        return Promise.reject('1-on-返回参数-异步-reject')
      },
      { wait: true }
    ).id,
  ])
  res.push([
    '2-on-注册:id',
    ctx.on('a', (params, { id }) => {
      res.push(['2-on-接收:params,id', params, id])
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

  await sleep()

  res.push(['1-size:事件,数量', 'a', ctx.size('a')])

  jsonEq(res, [
    ['1-on-注册:id', 1],
    ['2-on-注册:id', 2],
    ['1-on-接收:params,id', '1-emit-参数', 1],
    ['2-on-接收:params,id', '1-emit-参数', 2],
    ['1-emit-接收返回参数,id', [[2, '2-on-返回参数-同步']], 3],
    ['1-emit-触发:id', 3],
    ['1-size:事件,数量', 'a', { on: 2, emit: 0, count: 2 }],
  ])
})

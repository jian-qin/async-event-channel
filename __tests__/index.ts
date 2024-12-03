import { expect, test } from '@jest/globals'
import AsyncEventChannel from '../src/index'

function jsonEq(...args: unknown[][]) {
  expect(
    args.every(([one, ...arr]) => {
      const _one = JSON.stringify(one)
      return arr.every((item) => JSON.stringify(item) === _one)
    })
  ).toBeTruthy()
}

test('默认通信-同步', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[][] = []
  const emit1: string[] = []

  instance.emit('click', 1, 2).catch((err) => {
    emit1.push(err)
  })

  instance.on('click', (...args) => {
    on1.push(args)
  })

  await Promise.resolve()

  const eq1: (typeof on1)[] = [on1, []]
  const eq2: (typeof emit1)[] = [emit1, ['not registered']]
  jsonEq(eq1, eq2)
})

test('默认通信-多对多', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[][] = []
  const on2: number[][] = []

  instance.on('click', (...args) => {
    on1.push(args)
  })
  instance.on('click', (...args) => {
    on2.push(args)
  })

  instance.emit('click', 1, 2)
  instance.emit('click', 3, 4)

  const eq1: (typeof on1)[] = [
    on1,
    on2,
    [
      [1, 2],
      [3, 4],
    ],
  ]
  jsonEq(eq1)
})

test('双向通信', async () => {
  const instance = new AsyncEventChannel()
  const emit1: any[][] = []

  instance.on('click', (a, b) => {
    return a + b
  })

  instance.on('click', (a, b) => {
    return a - b
  })

  const result = instance.emit<number[]>('click', 1, 1)

  result.then((values) => {
    emit1.push(['Promise', values])
  })

  result.onResolve((values) => {
    emit1.push(['onResolve', values])
  })

  await Promise.resolve()

  const eq1: (typeof emit1)[] = [
    emit1,
    [
      ['onResolve', [2, 0]],
      ['Promise', [2, 0]],
    ],
  ]
  jsonEq(eq1)
})

test('异步通信-多对多', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[][] = []
  const emit1: number[][] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  const e1 = instance.emit<number[]>(event, 1, 2)
  const e2 = instance.emit<number[]>(event, 3, 4)

  instance.on(event, (...args) => {
    on1.push(args)
    return 1
  })

  await Promise.resolve()
  e1.onResolve((res) => {
    emit1.push(res)
  })
  e2.onResolve((res) => {
    emit1.push(res)
  })
  await Promise.resolve()

  const eq1: (typeof on1)[] = [
    on1,
    [
      [1, 2],
      [3, 4],
    ],
  ]
  const eq2: (typeof emit1)[] = [emit1, [[1], [1]]]
  jsonEq(eq1, eq2)
})

test('移除事件-返回的取消函数', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[][] = []
  const on2: number[][] = []
  const emit1: string[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  const e = instance.emit(event, 1, 2)
  e.catch((err) => {
    emit1.push(err)
  })
  e.cancel!()
  instance.on(event, (...args) => {
    on1.push(args)
  })

  instance.on('test', (...args) => {
    on2.push(args)
  })!()
  instance.emit('test', 1, 2).catch(() => {})

  await Promise.resolve()
  e.onResolve((res) => {
    on1.push(res)
  })
  e.onReject!((err) => {
    emit1.push(err)
  })

  const eq1: (typeof on1)[] = [on1, []]
  const eq2: (typeof on2)[] = [on2, []]
  const eq3: (typeof emit1)[] = [emit1, ['cancel', 'cancel']]
  jsonEq(eq1, eq2, eq3)
})

test('移除事件-off-单个', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[][] = []
  const on2: number[][] = []
  const emit1: string[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  const e = instance.emit(event, 1, 2)
  e.catch((err) => {
    emit1.push(err)
  })
  instance.off(event, e)
  instance.on(event, (...args) => {
    on1.push(args)
  })

  const listener2 = (...args: number[]) => {
    on2.push(args)
  }
  instance.on('test', listener2)
  instance.off('test', listener2)
  instance.emit('test', 1, 2).catch(() => {})

  await Promise.resolve()
  e.onReject!((err) => {
    emit1.push(err)
  })

  const eq1: (typeof on1)[] = [on1, []]
  const eq2: (typeof on2)[] = [on2, []]
  const eq3: (typeof emit1)[] = [emit1, ['cancel', 'cancel']]
  jsonEq(eq1, eq2, eq3)
})

test('移除事件-off-全部', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const emit1: string[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  instance.on('click', () => {})
  instance.on('click', () => {})

  instance.emit(event).catch(() => {})
  instance.emit(event).catch(() => {})

  instance.off('click', 'all')
  instance.off(event, 'all')

  instance.emit('click').catch((err) => {
    emit1.push(err)
  })
  instance.on(event, () => {
    on1.push(1)
  })

  await Promise.resolve()

  const eq1: (typeof on1)[] = [on1, []]
  const eq2: (typeof emit1)[] = [emit1, ['not registered']]
  jsonEq(eq1, eq2)
})

test('移除事件-off-全部on或emit', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const emit1: string[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  instance.on('click', () => {})
  instance.on('click', () => {})

  instance.emit(event).catch(() => {})
  instance.emit(event).catch(() => {})

  instance.off('click', 'on')
  instance.off(event, 'emit')

  instance.emit('click').catch((err) => {
    emit1.push(err)
  })
  instance.on(event, () => {
    on1.push(1)
  })

  await Promise.resolve()

  const eq1: (typeof on1)[] = [on1, []]
  const eq2: (typeof emit1)[] = [emit1, ['not registered']]
  jsonEq(eq1, eq2)
})

test('只注册一次-忽略', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const event = AsyncEventChannel.on_ignore + 'click'

  instance.on(event, () => {
    on1.push(1)
  })
  instance.on(event, () => {
    on1.push(2)
  })

  instance.emit(event)

  const eq1: (typeof on1)[] = [on1, [1]]
  jsonEq(eq1)
})

test('只注册一次-覆盖', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const event = AsyncEventChannel.on_cover + 'click'

  instance.on(event, () => {
    on1.push(1)
  })
  instance.on(event, () => {
    on1.push(2)
  })

  instance.emit(event)

  const eq1: (typeof on1)[] = [on1, [2]]
  jsonEq(eq1)
})

test('只异步触发一次-忽略', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const emit1: number[] = []
  const emit2: string[] = []
  const event = AsyncEventChannel.emit_ignore + 'click'

  instance.emit(event).onResolve(() => {
    emit1.push(1)
  })
  instance.emit(event).catch((err) => {
    emit2.push(err)
  })

  instance.on(event, () => {
    on1.push(1)
  })

  await Promise.resolve()

  const eq1: (typeof on1)[] = [on1, [1]]
  const eq2: (typeof emit1)[] = [emit1, [1]]
  const eq3: (typeof emit2)[] = [emit2, ['ignore']]
  jsonEq(eq1, eq2, eq3)
})

test('只异步触发一次-覆盖', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []
  const emit1: string[] = []
  const emit2: number[] = []
  const event = AsyncEventChannel.emit_cover + 'click'

  instance.emit(event).catch((err) => {
    emit1.push(err)
  })
  instance.emit(event).onResolve(() => {
    emit2.push(1)
  })

  instance.on(event, () => {
    on1.push(1)
  })

  await Promise.resolve()

  const eq1: (typeof on1)[] = [on1, [1]]
  const eq2: (typeof emit1)[] = [emit1, ['cancel']]
  const eq3: (typeof emit2)[] = [emit2, [1]]
  jsonEq(eq1, eq2, eq3)
})

test('其他方法-once', async () => {
  const instance = new AsyncEventChannel()
  const on1: number[] = []

  instance.once('click', () => {
    on1.push(1)
  })

  instance.emit('click')
  instance.emit('click').catch(() => {})

  const eq1: (typeof on1)[] = [on1, [1]]
  jsonEq(eq1)
})

test('其他方法-size', async () => {
  const instance = new AsyncEventChannel()
  const size1: number[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  instance.on('click', () => {})
  instance.on('click', () => {})

  instance.emit(event)
  instance.emit(event)
  instance.emit(event)

  size1.push(instance.size('click', 'on'))
  size1.push(instance.size('click', 'emit'))
  size1.push(instance.size(event, 'on'))
  size1.push(instance.size(event, 'emit'))

  const eq1: (typeof size1)[] = [size1, [2, 0, 0, 3]]
  jsonEq(eq1)
})

test('其他方法-has', async () => {
  const instance = new AsyncEventChannel()
  const has1: boolean[] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  const listener = () => {}
  const listener2 = () => {}
  instance.on('click', listener)
  instance.on('click', listener2)!()

  const e1 = instance.emit(event)
  instance.emit(event)
  instance.emit(event)

  has1.push(instance.has('click', listener))
  has1.push(instance.has('click', listener2))
  has1.push(instance.has('click', 'on'))
  has1.push(instance.has('click', 'emit'))
  has1.push(instance.has(event, e1))
  has1.push(instance.has(event, 'on'))
  has1.push(instance.has(event, 'emit'))

  const eq1: (typeof has1)[] = [has1, [true, false, true, false, true, false, true]]
  jsonEq(eq1)
})

const testHook = (key: keyof AsyncEventChannel['hook'], result: any[]) => () => {
  const instance = new AsyncEventChannel()
  const hook1: any[] = []

  const hook = (res: any) => {
    if (typeof res.payload[1] === 'function') {
      res.payload[1] = 'FN'
    }
    if (typeof res.result === 'function') {
      res.result = 'FN'
    } else if (typeof res.result?.then === 'function') {
      res.result = 'Promise'
    }
    hook1.push(res)
  }
  key === 'all' ? instance.hook[key](hook) : instance.hook[key]('click', hook)

  const cancel = instance.on('click', () => {
    return 2
  })
  instance.emit('click', 1)
  cancel!()

  const eq1: (typeof hook1)[] = [hook1, result]
  jsonEq(eq1)
}

test(
  '全局钩子',
  testHook('all', [
    {
      type: 'on',
      position: 'before',
      payload: ['click', 'FN'],
    },
    {
      type: 'on',
      position: 'after',
      payload: ['click', 'FN'],
      result: 'FN',
    },
    { type: 'emit', position: 'before', payload: ['click', 1] },
    {
      type: 'emit',
      position: 'after',
      payload: ['click', 1],
      result: 'Promise',
    },
    {
      type: 'off',
      position: 'before',
      payload: ['click', 'FN'],
    },
    {
      type: 'off',
      position: 'after',
      payload: ['click', 'FN'],
    },
  ])
)

test(
  '钩子-beforeOn',
  testHook('beforeOn', [{ type: 'on', position: 'before', payload: ['click', 'FN'] }])
)

test(
  '钩子-afterOn',
  testHook('afterOn', [{ type: 'on', position: 'after', payload: ['click', 'FN'], result: 'FN' }])
)

test(
  '钩子-beforeEmit',
  testHook('beforeEmit', [{ type: 'emit', position: 'before', payload: ['click', 1] }])
)

test(
  '钩子-afterEmit',
  testHook('afterEmit', [
    { type: 'emit', position: 'after', payload: ['click', 1], result: 'Promise' },
  ])
)

test(
  '钩子-beforeOff',
  testHook('beforeOff', [{ type: 'off', position: 'before', payload: ['click', 'FN'] }])
)

test(
  '钩子-afterOff',
  testHook('afterOff', [{ type: 'off', position: 'after', payload: ['click', 'FN'] }])
)

test('事件通信的作用域', async () => {
  const instance = new AsyncEventChannel()
  const scope = instance.useScope()
  const size1: number[][] = []
  const event = AsyncEventChannel.emit_wait + 'click'

  instance.on('click', () => {})
  scope.on('click', () => {})

  instance.emit(event).catch(() => {})
  scope.emit(event).catch(() => {})

  size1.push([instance.size('click', 'on'), instance.size(event, 'emit')])

  scope.$clear()

  size1.push([instance.size('click', 'on'), instance.size(event, 'emit')])

  const eq1: (typeof size1)[] = [
    size1,
    [
      [2, 2],
      [1, 1],
    ],
  ]
  jsonEq(eq1)
})

test('固定事件名称-默认通信', async () => {
  const instance = new AsyncEventChannel()
  const click = instance.useEvent<number[], [string]>()
  const on1: number[] = []
  const size1: number[] = []

  click.on((res) => {
    on1.push(res)
    return 'on'
  })

  click.emit(1)

  size1.push(click.size('on'))
  click.off('on')
  size1.push(click.size('on'))

  click.emit(2).catch(() => {})

  const eq1: (typeof on1)[] = [on1, [1]]
  const eq2: (typeof size1)[] = [size1, [1, 0]]
  jsonEq(eq1, eq2)
})

test('固定事件名称-异步通信', async () => {
  const instance = new AsyncEventChannel()
  const click = instance.useEvent(AsyncEventChannel.emit_wait)
  const on1: number[] = []

  click.emit(1)

  click.on((res) => {
    on1.push(res)
  })

  const eq1: (typeof on1)[] = [on1, [1]]
  jsonEq(eq1)
})

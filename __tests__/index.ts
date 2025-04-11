import { expect, test } from '@jest/globals'
import AsyncEventChannel from '../src/index'

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
    ctx.on('a', (params, { id, off }) => {
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

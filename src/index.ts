function createSet<T extends any[]>() {
  type Cb = (...args: any[]) => void
  type Item = ([Cb] | [any, Cb]) & { _one?: boolean }
  const _set = new Set() as Set<T> & {
    _add_cbs: Set<Item>
    _delete_cbs: Set<Item>
    watch_add: (...args: Item) => () => void
    watch_delete: (...args: Item) => () => void
    watch_add_one: (...args: Item) => () => void
    watch_delete_one: (...args: Item) => () => void
  }
  _set._add_cbs = new Set()
  _set._delete_cbs = new Set()
  _set.add = new Proxy(_set.add, {
    apply(target, thisArg, argArray: [T]) {
      const run = Reflect.apply(target, thisArg, argArray)
      const [type] = argArray[0]
      _set._add_cbs.forEach((item) => {
        if (item.length === 1) {
          const [_cb] = item
          _cb(argArray[0])
        } else {
          const [_type, _cb] = item
          if (_type !== type) return
          _cb(argArray[0])
        }
        item._one && _set._add_cbs.delete(item)
      })
      return run
    }
  })
  _set.delete = new Proxy(_set.delete, {
    apply(target, thisArg, argArray: [T]) {
      const run = Reflect.apply(target, thisArg, argArray)
      if (run) {
        const [type] = argArray[0]
        _set._delete_cbs.forEach((item) => {
          const [_type, _cb] = item
          if (_type !== type) return
          _cb(argArray[0])
          _set._delete_cbs.delete(item)
        })
      }
      return run
    }
  })
  _set.clear = () => {
    _set.forEach(_set.delete)
  }
  _set.watch_add = (...args) => {
    _set._add_cbs.add(args)
    return () => _set._add_cbs.delete(args)
  }
  _set.watch_delete = (...args) => {
    _set._delete_cbs.add(args)
    return () => _set._delete_cbs.delete(args)
  }
  _set.watch_add_one = (...args) => {
    args._one = true
    _set._add_cbs.add(args)
    return () => _set._add_cbs.delete(args)
  }
  _set.watch_delete_one = (...args) => {
    args._one = true
    _set._delete_cbs.add(args)
    return () => _set._delete_cbs.delete(args)
  }
  return _set
}

export type AsyncEventChannelCtx = InstanceType<typeof AsyncEventChannel>
export type AsyncEventChannelOptions = typeof AsyncEventChannel['defaultOptions']
type ListenerItem = [any, (...args: any[]) => any] & { id: number }
type EmitCacheItem = any[] & { id: number }
type WatchCb = (data: {
  id?: number
  event: 'on' | 'emit' | 'off'
  progress: 'register' | 'run' | 'cancel'
  type: any
  value: any
}) => void

/**
 * Async event channel 异步事件通道
 * @description Event channel support for asynchronous events support for event caching support for event listening once support for synchronous triggering events support for asynchronous triggering events support for event listening processes 事件通道，支持异步事件，支持事件缓存，支持事件监听一次，支持同步触发事件，支持异步触发事件，支持事件监听流程
 */
export default class AsyncEventChannel {
  static defaultOptions = {
    isEmitCache: true,
    isEmitOnce: false,
    isOnOnce: false,
  }
  static #id = 0;
  #processId = 0;
  #options
  #optionsMap
  #listener = createSet<ListenerItem>()
  #emitCache = createSet<EmitCacheItem>()
  #watchCbs = new Set<WatchCb>()

  /**
   * @param options Current instance configuration 当前实例配置
   * @param options.isEmitCache Whether to cache unmonitored events 是否缓存未监听的事件
   * @param options.isEmitOnce Whether to trigger the event only once 是否只触发一次事件
   * @param options.isOnOnce Whether to listen to the event only once 是否只监听一次事件
   * @param optionsMap Specify events to use separate configurations 指定事件使用单独配置
   */
  constructor(
    options?: Partial<AsyncEventChannelOptions> | null,
    optionsMap?: Map<any, Partial<AsyncEventChannelOptions>>
  ) {
    if (options && typeof options !== 'object') {
      throw new Error('options must be an object')
    }
    if (optionsMap && !(optionsMap instanceof Map)) {
      throw new Error('optionsMap must be an instance of Map')
    }
    Object.defineProperty(this, 'id', { value: ++AsyncEventChannel.#id })
    this.#options = options || {}
    this.#optionsMap = optionsMap || new Map()
  }

  #getOption(
    type: any,
    key: keyof AsyncEventChannelOptions
  ) {
    const level0 = AsyncEventChannel.defaultOptions
    const level1 = this.#options
    const level2 = this.#optionsMap.get(type) || {}
    if (Object.prototype.hasOwnProperty.call(level2, key)) {
      return level2[key]
    }
    if (Object.prototype.hasOwnProperty.call(level1, key)) {
      return level1[key]
    }
    return level0[key]
  }

  #on(type: ListenerItem[0], cb: ListenerItem[1]) {
    if (this.#getOption(type, 'isOnOnce')) {
      this.#listener.forEach((item) => {
        item[0] === type && this.#listener.delete(item)
      })
    }
    const item = [type, cb] as ListenerItem
    item.id = ++this.#processId
    this.#listener.add(item)
    return {
      id: item.id,
      cancel: () => this.#listener.delete(item)
    }
  }

  /**
   * Listen for events 监听事件
   * @param type Event type 事件类型
   * @param cb Callback function 回调函数
   * @returns Cancel listening function 取消监听函数
   */
  on = (type: ListenerItem[0], cb: ListenerItem[1]) => {
    if (typeof cb !== 'function') {
      throw new Error('The callback function must be passed')
    }
    const run = this.#on(type, (...args: Parameters<typeof cb>) => {
      const _run = cb(...args)
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'on',
        progress: 'run',
        type,
        value: _run,
      }))
      return _run
    })
    this.#watchCbs.forEach((watchCb) => watchCb({
      id: run.id,
      event: 'on',
      progress: 'register',
      type,
      value: cb,
    }))
    const unwatch = this.#listener.watch_delete(type, (item) => {
      if (item.id !== run.id) return
      unwatch()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'on',
        progress: 'cancel',
        type,
        value: true,
      }))
    })
    return run
  }

  #emit(..._args: any[]) {
    const args = _args as EmitCacheItem
    args.id = ++this.#processId
    const run: {
      id: number
      cancel: () => boolean
      values: any[]
      async: boolean
      done?: (args: any[]) => void
    } = {
      id: args.id,
      cancel: () => false,
      values: [],
      async: false,
    }
    const [type, ...params] = args
    this.#listener.forEach((item) => {
      const [_type, _cb] = item
      if (_type !== type) return
      run.values.push(_cb(...params))
    })
    if (run.values.length === 0 && this.#getOption(type, 'isEmitCache')) {
      if (this.#getOption(type, 'isEmitOnce')) {
        this.#emitCache.forEach((item) => {
          item[0] === type && this.#emitCache.delete(item)
        })
      }
      this.#emitCache.add(args)
      const cancel = this.#listener.watch_add_one(type, ([, cb]) => {
        this.#emitCache.delete(args)
        Promise.resolve().then(() => {
          run.values.push(cb(...params))
          typeof run.done === 'function' && run.done(run.values)
        })
      })
      run.async = true
      run.cancel = () => {
        cancel()
        return this.#emitCache.delete(args)
      }
    }
    return run
  }

  /**
   * Trigger events 触发事件
   * @param args Event type, event parameter 1, event parameter 2, ... 事件类型, 事件参数1, 事件参数2, ...
   * @returns Cancel trigger function, return value of listener function, whether asynchronous, asynchronous completion function 取消触发函数、监听函数的返回值、是否异步、异步完成函数
   */
  emit = (...args: any[]) => {
    if (args.length === 0) {
      throw new Error('The event type must be passed')
    }
    const [type, ...params] = args
    const run = this.#emit(...args)
    this.#watchCbs.forEach((watchCb) => watchCb({
      id: run.id,
      event: 'emit',
      progress: 'register',
      type,
      value: params,
    }))
    const unwatch = this.#emitCache.watch_delete(type, (item) => {
      if (item.id !== run.id) return
      unwatch()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'emit',
        progress: 'cancel',
        type,
        value: true,
      }))
    })
    if (run.async) {
      run.done = (values) => {
        this.#watchCbs.forEach((watchCb) => watchCb({
          id: run.id,
          event: 'emit',
          progress: 'run',
          type,
          value: values,
        }))
      }
    } else {
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'emit',
        progress: 'run',
        type,
        value: run.values,
      }))
    }
    return run
  }

  #off(...types: any[]) {
    const totals = {
      listener: [] as number[],
      emitCache: [] as number[],
    }
    types.forEach((type) => {
      this.#listener.forEach((item) => {
        if (item[0] !== type) return
        totals.listener.push(item.id)
        this.#listener.delete(item)
      })
      this.#emitCache.forEach((item) => {
        if (item[0] !== type) return
        totals.emitCache.push(item.id)
        this.#emitCache.delete(item)
      })
    })
    return totals
  }

  /**
   * Cancel listening events and clear cache events 取消监听事件并清除缓存事件
   * @param types Event type 1, event type 2, ... 事件类型1, 事件类型2, ...
   * @returns The total number of events canceled and the total number of cache events canceled 取消监听的事件总数、取消缓存的事件总数
   */
  off = (...types: any[]) => {
    if (types.length === 0) {
      throw new Error('At least one event type is required')
    }
    const totals = this.#off(...types)
    types.forEach((type) => this.#watchCbs.forEach((watchCb) => watchCb({
      event: 'off',
      progress: 'run',
      type,
      value: totals,
    })))
    return totals
  }

  /**
   * Listen to events only once 只监听一次事件
   * @param type Event type 事件类型
   * @param cb Callback function 回调函数
   * @returns Cancel listening function 取消监听函数
   */
  once = (type: ListenerItem[0], cb: ListenerItem[1]) => {
    const run = this.on(type, (...args) => {
      const _run = cb(...args)
      run.cancel()
      return _run
    })
    return run
  }

  /**
   * Trigger events and return the return value of the listener function 触发事件并返回监听函数的返回值
   * @param args Event type, event parameter 1, event parameter 2, ... 事件类型, 事件参数1, 事件参数2, ...
   * @returns The return value of the listener function 监听函数的返回值
   */
  syncEmit = (...args: EmitCacheItem) => {
    if (args.length === 0) {
      throw new Error('The event type must be passed')
    }
    const run = this.emit(...args)
    run.cancel()
    return run.values
  }

  /**
   * Trigger events and return Promise 触发事件并返回Promise
   * @param args Event type, event parameter 1, event parameter 2, ... 事件类型, 事件参数1, 事件参数2, ...
   * @returns Cancel trigger function, Promise 取消触发函数、Promise
   */
  asyncEmit = (...args: EmitCacheItem) => {
    if (args.length === 0) {
      throw new Error('The event type must be passed')
    }
    let id, cancel
    const promise = new Promise((resolve, reject) => {
      const run = this.emit(...args)
      id = run.id
      cancel = (reason?: any) => {
        run.cancel()
        reject(reason)
      }
      if (run.async) {
        run.done = resolve
      } else {
        resolve(run.values)
      }
    })
    return {
      id,
      cancel,
      promise,
    } as unknown as {
      id: number
      cancel: (reason?: any) => void
      promise: Promise<any[]>
    }
  }

  /**
   * Monitoring process 监听流程
   * @param args Event type, callback function, do not pass event type to listen to all events 事件类型, 回调函数，不传事件类型则监听所有事件
   * @returns Cancel listening function 取消监听函数
   */
  watch = (...args: [WatchCb] | [any, WatchCb]) => {
    const _args = args.slice(0, 2)
    const cb = _args[_args.length - 1]
    if (typeof cb !== 'function') {
      throw new Error('The callback function must be passed')
    }
    let _cb = cb as WatchCb
    if (_args.length > 1) {
      _cb = (data) => data.type === _args[0] && cb(data)
    }
    this.#watchCbs.add(_cb)
    return () => this.#watchCbs.delete(_cb)
  }
}

/**
 * Cancel function scope for asynchronous event channels 异步事件通道的取消函数作用域
 * @description Proxy asynchronous event channel instances, listen to events of asynchronous event channel instances, cancel all event listeners 代理异步事件通道实例，监听异步事件通道实例的事件，取消所有事件监听
 * @param ctx Asynchronous event channel instance 异步事件通道实例
 * @returns Proxy instance, cancel function 代理实例、取消函数
 */
export function asyncEventChannelScope(ctx: AsyncEventChannelCtx) {
  const watchiInclude = ['on', 'emit', 'once', 'asyncEmit']
  const cancels = new Set<() => void>()
  return {
    ctx: new Proxy(ctx, {
      get(target, propKey) {
        let origin = Reflect.get.call(ctx, target, propKey)
        if (typeof origin === 'function') {
          origin = origin.bind(ctx)
        }
        if (!watchiInclude.includes(propKey as string)) return origin
        return (...args: any[]) => {
          const run = origin.call(ctx, ...args)
          cancels.add(run.cancel)
          return run
        }
      }
    }),
    cancel() {
      cancels.forEach((cancel) => cancel.call(ctx))
      cancels.clear()
    },
  }
}

/**
 * Async task queue 异步任务队列
 * @description Task queue, support asynchronous registration of tasks, support asynchronous execution of tasks, support cancellation of tasks 任务队列，支持异步注册任务，支持异步执行任务，支持取消任务
 */
export class AsyncTaskQueue {
  #types
  #oneAuto
  #tasks = new Map()
  #load = false
  #isCancel = false
  #loadCb = () => {}
  #isRunning = false
  get isRunning() {
    return this.#isRunning
  }

  /**
   * @param types Event type list 事件类型列表
   * @param oneAuto Whether to automatically execute the first task 是否自动执行
   */
  constructor(types: any[], oneAuto = true) {
    if (types.length === 0) {
      throw new Error('At least one event type is required')
    }
    this.#types = types
    this.#oneAuto = oneAuto
  }

  /**
   * Listen for events 监听事件
   * @param type Event type 事件类型
   * @param cb Callback function 回调函数
   */
  on = (type: any, cb: (res: any) => any) => {
    if (!this.#types.includes(type)) {
      throw new Error('Unregistered type')
    }
    if (typeof cb !== 'function') {
      throw new Error('The callback function must be passed')
    }
    if (this.#tasks.has(type)) return
    this.#tasks.set(type, cb)
    if (this.#types.length === this.#tasks.size) {
      this.#load = true
      this.#oneAuto && this.start()
      this.#loadCb()
    }
  }

  /**
   * Monitor the completion of the task queue 监听加载完成
   * @param cb Callback function 回调函数
   */
  onLoad = (cb: () => void) => {
    this.#loadCb = cb
  }

  /**
   * Start the task 开始执行任务
   * @param res The parameters of the first task 第一个任务的参数
   * @returns The result of the task queue execution 任务队列执行结果
   */
  start = async (res?: any) => {
    if (this.#isRunning || !this.#load) return
    this.#isRunning = true
    this.#isCancel = false
    let i = 0
    while (i < this.#tasks.size) {
      if (this.#isCancel) {
        this.#isRunning = false
        this.#isCancel = false
        return Promise.reject({
          status: 'cancel',
          data: 'Task canceled',
        })
      }
      res = await Promise.resolve(this.#tasks.get(this.#types[i])(res)).catch((err) => {
        this.#isRunning = false
        return Promise.reject({
          status: 'error',
          data: err,
        })
      })
      ++i
    }
    this.#isRunning = false
    return res
  }

  /**
   * Cancel the task 取消任务
   */
  cancel = () => {
    this.#isCancel = true
  }
}
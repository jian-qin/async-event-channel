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
          if (item.length === 1) {
            const [_cb] = item
            _cb(argArray[0])
          } else {
            const [_type, _cb] = item
            if (_type !== type) return
            _cb(argArray[0])
          }
          item._one && _set._delete_cbs.delete(item)
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

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type AsyncEventChannelCtx = InstanceType<typeof AsyncEventChannel>
export type AsyncEventChannelOptions = typeof AsyncEventChannel['defaultOptions']
export type CurrentDataItem = {
  id: number
  event: 'on' | 'emit' | 'once' | 'asyncEmit' | 'watch'
  value: Parameters<
    | AsyncEventChannel['on']
    | AsyncEventChannel['emit']
    | AsyncEventChannel['once']
    | AsyncEventChannel['asyncEmit']
    | AsyncEventChannel['watch']
  >
}
export type WatchDataItem = {
  id?: number
  event: 'on' | 'emit' | 'once' | 'immedEmit' | 'asyncEmit' | 'off'
  progress: 'register' | 'run' | 'cancel' | 'delete'
  type: any
  value: any
}

type ListenerItem = [any, (...args: any[]) => any]
type EmitCacheItem = any[]
type WatchCb = (data: WatchDataItem) => void

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
  #listener = createSet<ListenerItem & { id: number }>()
  #emitCache = createSet<EmitCacheItem & { id: number }>()
  #watchCbs = new Set<WatchCb & { id: number }>()
  #currentData = new Map<number, CurrentDataItem>()

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
    this.#handleCurrentData()
  }

  #handleCurrentData() {
    this.#listener.watch_delete(item => this.#currentData.delete(item.id))
    this.#emitCache.watch_delete(item => this.#currentData.delete(item.id))
    this.#watchCbs.delete = new Proxy(this.#watchCbs.delete, {
      apply: (target, thisArg, argArray) => {
        this.#currentData.delete(argArray[0].id)
        return Reflect.apply(target, thisArg, argArray)
      }
    })
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
    const item = [type, cb] as ListenerItem & { id: number }
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
    const _cb = (...args: Parameters<typeof cb>) => {
      const _run = cb(...args)
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'on',
        progress: 'run',
        type,
        value: _run,
      }))
      return _run
    }
    const run = this.#on(type, _cb)
    this.#watchCbs.forEach((watchCb) => watchCb({
      id: run.id,
      event: 'on',
      progress: 'register',
      type,
      value: _cb,
    }))
    const _cancel = run.cancel
    run.cancel = () => {
      const _run = _cancel()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'on',
        progress: 'cancel',
        type,
        value: _run,
      }))
      return _run
    }
    const unwatch = this.#listener.watch_delete(type, (item) => {
      if (item.id !== run.id) return
      unwatch()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'on',
        progress: 'delete',
        type,
        value: true,
      }))
    })
    this.#currentData.set(run.id, {
      id: run.id,
      event: 'on',
      value: [type, cb]
    })
    return run
  }

  #emit(..._args: EmitCacheItem) {
    const args = _args as EmitCacheItem & { id: number }
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
        Promise.resolve().then(() => {
          run.values.push(cb(...params))
          typeof run.done === 'function' && run.done(run.values)
          this.#emitCache.delete(args)
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
  emit = (...args: EmitCacheItem) => {
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
    const _cancel = run.cancel
    run.cancel = () => {
      const _run = _cancel()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'emit',
        progress: 'cancel',
        type,
        value: _run,
      }))
      return _run
    }
    const unwatch = this.#emitCache.watch_delete(type, (item) => {
      if (item.id !== run.id) return
      unwatch()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'emit',
        progress: 'delete',
        type,
        value: true,
      }))
    })
    const _done = () => {
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'emit',
        progress: 'run',
        type,
        value: run.values,
      }))
    }
    if (run.async) {
      run.done = _done
    } else {
      _done()
    }
    run.async && this.#currentData.set(run.id, {
      id: run.id,
      event: 'emit',
      value: args
    })
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
    types.forEach((type) => {
      this.#watchCbs.forEach((watchCb) => watchCb({
        event: 'off',
        progress: 'run',
        type,
        value: totals,
      }))
    })
    return totals
  }

  #once(type: ListenerItem[0], cb: ListenerItem[1]) {
    const run = this.on(type, (...args) => {
      const _run = cb(...args)
      _cancel()
      return _run
    })
    const _cancel = run.cancel
    run.cancel = () => _cancel()
    return run
  }

  /**
   * Listen to events only once 只监听一次事件
   * @param type Event type 事件类型
   * @param cb Callback function 回调函数
   * @returns Cancel listening function 取消监听函数
   */
  once = (type: ListenerItem[0], cb: ListenerItem[1]) => {
    if (typeof cb !== 'function') {
      throw new Error('The callback function must be passed')
    }
    const _cb = (...args: Parameters<typeof cb>) => {
      const _run = cb(...args)
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'once',
        progress: 'run',
        type,
        value: _run,
      }))
      return _run
    }
    const run = this.#once(type, _cb)
    this.#watchCbs.forEach((watchCb) => watchCb({
      id: run.id,
      event: 'once',
      progress: 'register',
      type,
      value: _cb,
    }))
    const _cancel = run.cancel
    run.cancel = () => {
      const _run = _cancel()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id: run.id,
        event: 'once',
        progress: 'cancel',
        type,
        value: _run,
      }))
      return _run
    }
    this.#currentData.set(run.id, {
      id: run.id,
      event: 'once',
      value: [type, cb]
    })
    return run
  }

  #immedEmit(...args: EmitCacheItem) {
    const run = this.emit(...args)
    run.async && run.cancel()
    return run.values
  }

  /**
   * Trigger events and return the return value of the listener function 触发事件并返回监听函数的返回值
   * @param args Event type, event parameter 1, event parameter 2, ... 事件类型, 事件参数1, 事件参数2, ...
   * @returns The return value of the listener function 监听函数的返回值
   */
  immedEmit = (...args: EmitCacheItem) => {
    if (args.length === 0) {
      throw new Error('The event type must be passed')
    }
    const [type, ...params] = args
    this.#watchCbs.forEach((watchCb) => watchCb({
      event: 'immedEmit',
      progress: 'register',
      type,
      value: params,
    }))
    const run = this.#immedEmit(...args)
    this.#watchCbs.forEach((watchCb) => watchCb({
      event: 'immedEmit',
      progress: 'run',
      type,
      value: run.values,
    }))
    return run
  }

  #asyncEmit(...args: EmitCacheItem) {
    let id, cancel
    const promise = new Promise<any[]>((resolve, reject) => {
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
    id = id as unknown as number
    cancel = cancel as unknown as (reason?: any) => void
    return {
      id,
      promise,
      cancel,
    }
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
    const [type, ...params] = args
    const { id, promise, cancel } = this.#asyncEmit(...args)
    this.#watchCbs.forEach((watchCb) => watchCb({
      id,
      event: 'asyncEmit',
      progress: 'register',
      type,
      value: params,
    }))
    const _promise = promise.then((res) => {
      this.#watchCbs.forEach((watchCb) => watchCb({
        id,
        event: 'asyncEmit',
        progress: 'run',
        type,
        value: res,
      }))
      return res
    })
    const _cancel = () => {
      const _run = cancel()
      this.#watchCbs.forEach((watchCb) => watchCb({
        id,
        event: 'asyncEmit',
        progress: 'cancel',
        type,
        value: _run,
      }))
      return _run
    }
    this.#currentData.set(id, {
      id,
      event: 'asyncEmit',
      value: args
    })
    _promise.finally(() => this.#currentData.delete(id))
    return {
      id,
      promise: _promise,
      cancel: _cancel,
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
    let _cb = cb as WatchCb & { id: number }
    if (_args.length > 1) {
      _cb = ((data) => data.type === _args[0] && cb(data)) as typeof _cb
    }
    _cb.id = ++this.#processId
    this.#watchCbs.add(_cb)
    this.#currentData.set(_cb.id, {
      id: _cb.id,
      event: 'watch',
      value: args
    })
    return {
      id: _cb.id,
      cancel: () => this.#watchCbs.delete(_cb)
    }
  }

  /**
   * Query whether the id still exists 查询id是否还存在
   * @param id Event listener id, trigger id, monitoring process id 事件监听器的id、触发器的id、监听流程的id
   * @returns Whether it exists 是否存在
   */
  hasId = (id: number) => {
    for (const set of [this.#listener, this.#emitCache, this.#watchCbs]) {
      for (const item of set) {
        if (item.id === id) return true
      }
    }
    return false
  }

  /**
   * Query whether the event type still exists 查询事件类型是否还存在
   * @param type Event type 事件类型
   * @returns Whether it exists 是否存在
   */
  hasType = (type: any) => {
    for (const set of [this.#listener, this.#emitCache]) {
      for (const item of set) {
        if (item[0] === type) return true
      }
    }
    return false
  }

  /**
   * data export 数据导出
   * @returns Event listener data, event cache data, monitoring process data 事件监听器数据、事件缓存数据、监听流程数据
   */
  export = () => Array.from(this.#currentData.values())

  /**
   * data import 数据导入
   * @param data Event listener data, event cache data, monitoring process data 事件监听器数据、事件缓存数据、监听流程数据
   */
  import = (...data: Optional<CurrentDataItem, 'id'>[]) => {
    const events = ['on', 'emit', 'once', 'asyncEmit', 'watch']
    data.sort((a, b) => (a.id || 0) - (b.id || 0))
    return data.map((item) => {
      if (!events.includes(item.event)) {
        throw new Error('Unsupported operation type')
      }
      if (item.event === 'watch') {
        const value = item.value
        const _cb = value[value.length - 1]
        let _watch_ready = false
        Promise.resolve().then(() => _watch_ready = true)
        value[value.length - 1] = (data: WatchCb) => _watch_ready && _cb(data)
        // @ts-ignore
        return this.watch(...value)
      }
      // @ts-ignore
      return this[item.event](...item.value)
    })
  }
}

/**
 * Cancel function scope for asynchronous event channels 异步事件通道的取消函数作用域
 * @description Proxy asynchronous event channel instances, listen to events of asynchronous event channel instances, cancel all event listeners 代理异步事件通道实例，监听异步事件通道实例的事件，取消所有事件监听
 * @param ctx Asynchronous event channel instance 异步事件通道实例
 * @returns Proxy instance, cancel function 代理实例、取消函数
 */
export function asyncEventChannelScope(ctx: AsyncEventChannelCtx) {
  const watchiInclude = ['on', 'emit', 'once', 'asyncEmit', 'watch']
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
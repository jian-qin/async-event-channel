/**
 * Remove the first item of the tuple 元组去掉第一项
 */
type TupleShift<T extends any[]> = T extends [any?, ...infer U] ? U : never

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
  id: string
  event: 'on' | 'emit' | 'once' | 'asyncEmit' | 'watch'
  type?: any
  value: Parameters<
    | AsyncEventChannel['on']
    | AsyncEventChannel['emit']
    | AsyncEventChannel['once']
    | AsyncEventChannel['asyncEmit']
    | AsyncEventChannel['watch']
  >
}
export type WatchDataItem = {
  id?: string
  event: 'on' | 'emit' | 'once' | 'immedOnce' | 'immedEmit' | 'asyncEmit' | 'off'
  progress: 'register' | 'run' | 'cancel' | 'delete'
  type: any
  value: any
}

type ListenerItem = [any, (...args: any[]) => any]
type EmitCacheItem = any[]
type WatchCb = (data: WatchDataItem) => void

const optionsCtxMap = new WeakMap<AsyncEventChannelCtx, ConstructorParameters<typeof AsyncEventChannel>>()

function asserts_on(cb: unknown): asserts cb is ListenerItem[1] {
  if (typeof cb !== 'function')
    throw new Error('The callback function must be passed')
}
function asserts_emit(args: EmitCacheItem): asserts args is [EmitCacheItem[0], ...EmitCacheItem] {
  if (args.length === 0)
    throw new Error('The event type must be passed')
}
function asserts_off(types: any[]): asserts types is [any, ...any[]] {
  if (types.length === 0)
    throw new Error('At least one event type is required')
}
function asserts_watch(args: any[]): asserts args is [WatchCb] | [any, WatchCb] {
  if (typeof args[0] !== 'function' && typeof args[1] !== 'function')
    throw new Error('The callback function must be passed')
}
function asserts_hasId(id: unknown): asserts id is string {
  if (typeof id !== 'string')
    throw new Error('The id must be a string')
}

function asserts_ctx(ctx: any): asserts ctx is AsyncEventChannelCtx {
  if (!ctx) {
    throw new Error('The instance must be passed')
  }
  if (!optionsCtxMap.has(ctx)) {
    throw new Error('The instance is not an instance of AsyncEventChannel')
  }
}

function importParamSsort(datas: Optional<CurrentDataItem, 'id'>[]) {
  datas.sort((a, b) => {
    const _a = a.id ? a.id.split(':')[1] : '0'
    const _b = b.id ? b.id.split(':')[1] : '0'
    return +_a - +_b
  })
}

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
  static #id = 0
  #_id = ++AsyncEventChannel.#id
  get id() {
    return this.#_id
  }
  #processId = ''
  #options
  #optionsMap
  #listener = createSet<ListenerItem & { id: string }>()
  #emitCache = createSet<EmitCacheItem & { id: string }>()
  #watchCbs = new Set<WatchCb & { id: string }>()
  #currentData = new Map<string, CurrentDataItem>()

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
    optionsCtxMap.set(this, [options, optionsMap])
    this.#processId = `${AsyncEventChannel.#id}:0`
    this.#options = options || {}
    this.#optionsMap = optionsMap || new Map()
    this.#handleCurrentData()
  }

  #processIdInc() {
    const [id, processId] = this.#processId.split(':')
    this.#processId = `${id}:${+processId + 1}`
    return this.#processId
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
    const item = [type, cb] as ListenerItem & { id: string }
    item.id = this.#processIdInc()
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
    asserts_on(cb)
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
      type,
      value: [type, cb]
    })
    return run
  }

  #emit(..._args: EmitCacheItem) {
    const args = _args as EmitCacheItem & { id: string }
    args.id = this.#processIdInc()
    const run: {
      id: string
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
    asserts_emit(args)
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
      type,
      value: args
    })
    return run
  }

  #off(...types: any[]) {
    const totals = {
      listener: [] as string[],
      emitCache: [] as string[],
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
    asserts_off(types)
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
    asserts_on(cb)
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
      type,
      value: [type, cb]
    })
    return run
  }

  #immedOnce(type: ListenerItem[0], cb: ListenerItem[1]) {
    const valid = Array.from(this.#emitCache).some((item) => item[0] === type)
    valid && this.once(type, cb)
    return valid
  }

  /**
   * 立即监听事件一次
   * @description Determine whether there is a cache event, if so, immediately listen to the event once, otherwise do not register the listening event 判断是否有缓存事件，有则立即监听一次事件，没有则不注册监听事件
   * @param type Event type 事件类型
   * @param cb Callback function 回调函数
   * @returns Whether to listen 是否监听
   */
  immedOnce = (type: ListenerItem[0], cb: ListenerItem[1]) => {
    asserts_on(cb)
    const run = this.#immedOnce(type, cb)
    this.#watchCbs.forEach((watchCb) => watchCb({
      event: 'immedOnce',
      progress: 'register',
      type,
      value: cb,
    }))
    run && this.#watchCbs.forEach((watchCb) => watchCb({
      event: 'immedOnce',
      progress: 'run',
      type,
      value: run,
    }))
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
    asserts_emit(args)
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
        reject(reason)
        return run.cancel()
      }
      if (run.async) {
        run.done = resolve
      } else {
        resolve(run.values)
      }
    })
    id = id as unknown as string
    cancel = cancel as unknown as (reason?: any) => boolean
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
    asserts_emit(args)
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
      type,
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
    asserts_watch(args)
    const _args = args.slice(0, 2)
    const cb = _args[_args.length - 1]
    let _cb = cb as WatchCb & { id: string }
    if (_args.length > 1) {
      _cb = ((data) => data.type === _args[0] && cb(data)) as typeof _cb
    }
    _cb.id = this.#processIdInc()
    this.#watchCbs.add(_cb)
    this.#currentData.set(_cb.id, {
      id: _cb.id,
      event: 'watch',
      value: args,
      ...(args.length > 1 ? { type: args[0] } : {})
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
  hasId = (id: string) => {
    asserts_hasId(id)
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
    const onIds = Array.from(this.#listener).filter((item) => item[0] === type).map((item) => item.id)
    const emitIds = Array.from(this.#emitCache).filter((item) => item[0] === type).map((item) => item.id)
    return {
      onIds,
      emitIds,
      has: onIds.length > 0 || emitIds.length > 0,
    }
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
  import = (...datas: Optional<CurrentDataItem, 'id'>[]) => {
    const events = ['on', 'emit', 'once', 'asyncEmit', 'watch']
    importParamSsort(datas)
    return datas.map((item) => {
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

type ECHandler = 'on' | 'emit' | 'off' | 'watch'
/**
 * 异步事件通道作用域
 * @description Proxy asynchronous event channel instance, automatically collect the returned cancel event, configure the list of included or excluded event types for scope isolation 代理异步事件通道实例，自动收集返回的取消事件，配置包含或排除的事件类型名单进行作用域隔离
 * @param ctx Asynchronous event channel instance 异步事件通道实例
 * @param options Configuration options 配置选项
 * @returns Proxy instance, cancel function 代理实例、取消函数
 */
export function asyncEventChannelScope(
  ctx: AsyncEventChannelCtx,
  options: {
    include?: {
      type: any
      handlers: boolean | ECHandler[]
    }[]
    exclude?: {
      type: any
      handlers: boolean | ECHandler[]
    }[]
  } = {}
) {
  asserts_ctx(ctx)
  if (options.include && options.exclude) {
    throw new Error('include and exclude cannot be passed at the same time')
  }
  let _ctx: AsyncEventChannelCtx | null = null
  if (options.include || options.exclude) {
    _ctx = new AsyncEventChannel(...optionsCtxMap.get(ctx)!)
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let getCtx = (_type: any) => ctx
  if (options.include) {
    getCtx = (type) => {
      const valid = options.include!.some((item) => item.type === type)
      return valid ? ctx : _ctx!
    }
  } else if (options.exclude) {
    getCtx = (type) => {
      const valid = options.exclude!.some((item) => item.type === type)
      return valid ? _ctx! : ctx
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let getCtxAndAsserts = (_type: any, _handler: ECHandler) => ctx
  function asserts(
    list: NonNullable<typeof options.include | typeof options.exclude>,
    y_ctx: AsyncEventChannelCtx,
    n_ctx: AsyncEventChannelCtx
  ) {
    return function (type, handler) {
      const err = new Error('The event type is not included or excluded')
      return list.some((item) => {
        if (item.type !== type) return false
        if (typeof item.handlers === 'boolean') {
          if (item.handlers === true) return true
          throw err
        }
        if (item.handlers.includes(handler)) return true
        throw err
      }) ? y_ctx : n_ctx
    } as typeof getCtxAndAsserts
  }
  if (options.include) {
    getCtxAndAsserts = asserts(options.include, ctx, _ctx!)
  } else if (options.exclude) {
    getCtxAndAsserts = asserts(options.exclude, _ctx!, ctx)
  }
  const runs = new Map<string, () => boolean>()
  const recordRun = <T extends {
    id: string
    cancel(): boolean
  }>(run: T) => {
    runs.set(run.id, run.cancel)
    return run
  }
  const ctxProxy: {
    [key in keyof AsyncEventChannelCtx as key extends `#${string}` ? never : key]: AsyncEventChannelCtx[key]
  } = {
    get id() {
      return ctx.id
    },
    on(type, cb) {
      asserts_on(cb)
      return recordRun(
        getCtxAndAsserts(type, 'on').on(type, cb)
      )
    },
    emit(...args) {
      asserts_emit(args)
      return recordRun(
        getCtxAndAsserts(args[0], 'emit').emit(...args)
      )
    },
    off(...types) {
      asserts_off(types)
      const totals = {
        listener: [] as string[],
        emitCache: [] as string[],
      }
      types.forEach((type) => {
        const _totals = getCtxAndAsserts(type, 'off').off(type)
        totals.emitCache.push(..._totals.emitCache)
        totals.listener.push(..._totals.listener)
      })
      return totals
    },
    once(type, cb) {
      asserts_on(cb)
      return recordRun(
        getCtxAndAsserts(type, 'on').once(type, cb)
      )
    },
    immedOnce(type, cb) {
      asserts_on(cb)
      return getCtxAndAsserts(type, 'on').immedOnce(type, cb)
    },
    immedEmit(...args) {
      asserts_emit(args)
      return getCtxAndAsserts(args[0], 'emit').immedEmit(...args)
    },
    asyncEmit(...args) {
      asserts_emit(args)
      return recordRun(
        getCtxAndAsserts(args[0], 'emit').asyncEmit(...args)
      )
    },
    watch(...args) {
      asserts_watch(args)
      const _args = args.slice(0, 2)
      const cb = _args[_args.length - 1]
      const _cb = (data: WatchDataItem) => {
        if (options.include) {
          const valid = options.include.some((item) => item.type === data.type)
          if (!valid) return
        } else if (options.exclude) {
          const valid = options.exclude.some((item) => item.type === data.type)
          if (valid) return
        }
        cb(data)
      }
      if (_args.length > 1) {
        return recordRun(
          getCtxAndAsserts(args[0], 'watch').watch(args[0], cb)
        )
      }
      const run = ctx.watch(_cb)
      if (_ctx) {
        const { cancel } = _ctx.watch(_cb)
        const _cancel = run.cancel
        run.cancel = () => {
          cancel()
          return _cancel()
        }
      }
      return recordRun(run)
    },
    hasId(id) {
      asserts_hasId(id)
      return ctx.hasId(id) || (_ctx ? _ctx.hasId(id) : false)
    },
    hasType(type) {
      return getCtx(type).hasType(type)
    },
    export() {
      return ctx.export().concat(_ctx ? _ctx.export() : []).filter((item) => runs.has(item.id))
    },
    import(...datas) {
      const runList: ReturnType<AsyncEventChannelCtx['import']> = []
      const datas1: typeof datas = []
      const datas2: typeof datas = []
      const datas_watch: typeof datas = []
      datas.forEach((data) => {
        if (data.event === 'watch' && data.value.length === 1) {
          datas_watch.push(data)
          return
        }
        if (options.include) {
          const valid = options.include.some((item) => item.type === data.type)
          valid ? datas1.push(data) : datas2.push(data)
        } else if (options.exclude) {
          const valid = options.exclude.some((item) => item.type === data.type)
          valid ? datas2.push(data) : datas1.push(data)
        } else {
          datas1.push(data)
        }
      })
      if (_ctx) {
        const _datas = datas_watch.map((data) => {
          const cb: WatchCb = data.value[0]
          const _cb: WatchCb = (_data) => {
            if (options.include) {
              const valid = options.include.some((item) => item.type === _data.type)
              if (!valid) return
            } else if (options.exclude) {
              const valid = options.exclude.some((item) => item.type === _data.type)
              if (valid) return
            }
            cb(_data)
          }
          return {
            ...data,
            value: [_cb]
          }
        })
        datas1.push(..._datas)
        datas2.push(..._datas)
      } else {
        datas1.push(...datas_watch)
      }
      importParamSsort(datas1)
      importParamSsort(datas2)
      runList.push(...ctx.import(...datas1))
      if (_ctx) {
        const _runList = _ctx.import(...datas2)
        datas1.forEach((item, index) => {
          if (item.event === 'watch' && item.value.length === 1) {
            const subIndex = datas2.indexOf(item)
            const subCancel = _runList[subIndex].cancel
            const _cancel = runList[index].cancel
            runList[index].cancel = () => {
              subCancel()
              return _cancel()
            }
            _runList.splice(subIndex, 1)
          }
        })
        runList.push(..._runList)
      }
      return runList
    }
  }
  return {
    ctx: new Proxy(ctx, {
      get(_, propKey: keyof AsyncEventChannelCtx) {
        return ctxProxy[propKey]
      }
    }),
    cancel() {
      runs.forEach((cancel) => cancel())
      runs.clear()
    },
  }
}

/**
 * Generate fixed event types 生成固定的事件类型
 * @param ctx Asynchronous event channel instance 异步事件通道实例
 * @returns Event type generator 事件类型生成器
 */
export function useCreateEventChannel(ctx: AsyncEventChannelCtx) {
  asserts_ctx(ctx)
  const types = new WeakSet<any>()
  const yesParams = ['on', 'emit', 'once', 'immedOnce', 'immedEmit', 'asyncEmit', 'watch'] as const
  const noParams = ['off', 'hasType'] as const
  return (type: any = Symbol()) => {
    if (types.has(type)) {
      throw new Error('The event type already exists')
    }
    types.add(type)
    const _target = { $type: type }
    return new Proxy(_target, {
      get(target, propKey) {
        // @ts-ignore
        if (yesParams.includes(propKey)) {
          // @ts-ignore
          return (...args) => ctx[propKey](type, ...args)
        }
        // @ts-ignore
        if (noParams.includes(propKey)) {
          // @ts-ignore
          return () => ctx[propKey](type)
        }
        return Reflect.get(target, propKey)
      }
    }) as {
      [K in Exclude<typeof yesParams[number], 'watch'>]: (...args: TupleShift<Parameters<AsyncEventChannelCtx[K]>>) => ReturnType<AsyncEventChannelCtx[K]>
    } & {
      watch(cb: WatchCb): ReturnType<AsyncEventChannelCtx['watch']>
    } & {
      [K in typeof noParams[number]]: () => ReturnType<AsyncEventChannelCtx[K]>
    } & typeof _target
  }
}

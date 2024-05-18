function createSet<T extends any[]>() {
  const _set = new Set() as Set<T> & {
    _watch_add: Set<T>
    _watch_delete: Set<T>
    listener_add: (args: T) => () => void
    listener_delete: (args: T) => () => void
  }
  _set._watch_add = new Set()
  _set._watch_delete = new Set()
  _set.add = new Proxy(_set.add, {
    apply(target, thisArg, argArray: [T]) {
      const run = Reflect.apply(target, thisArg, argArray)
      const [type, ...args] = argArray[0]
      _set._watch_add.forEach((item) => {
        if (item[0] !== type) return
        item[1](...args)
        _set._watch_add.delete(item)
      })
      return run
    }
  })
  _set.delete = new Proxy(_set.delete, {
    apply(target, thisArg, argArray: [T]) {
      const run = Reflect.apply(target, thisArg, argArray)
      if (run) {
        const [type, ...args] = argArray[0]
        _set._watch_delete.forEach((item) => {
          if (item[0] !== type) return
          item[1](...args)
          _set._watch_delete.delete(item)
        })
      }
      return run
    }
  })
  _set.clear = () => {
    _set.forEach(_set.delete)
  }
  _set.listener_add = (args) => {
    _set._watch_add.add(args)
    return () => _set._watch_add.delete(args)
  }
  _set.listener_delete = (args) => {
    _set._watch_delete.add(args)
    return () => _set._watch_delete.delete(args)
  }
  return _set
}

export type AsyncEventChannelCtx = InstanceType<typeof AsyncEventChannel>
export type AsyncEventChannelOptions = typeof AsyncEventChannel['defaultOptions']
type ListenerItem = [any, (...args: any[]) => any]
type EmitCacheItem = any[]

export default class AsyncEventChannel {
  static id = 0
  static defaultOptions = {
    isEmitCache: true,
    isEmitOnce: false,
    isOnOnce: false,
  }
  #options
  #optionsMap
  #listener = createSet<ListenerItem>()
  #emitCache = createSet<EmitCacheItem>()

  /**
   * @param options 当前实例配置
   * @param options.isEmitCache 是否缓存未监听的事件
   * @param options.isEmitOnce 是否只触发一次事件
   * @param options.isOnOnce 是否只监听一次事件
   * @param optionsMap 指定事件使用单独配置
   */
  constructor(
    options?: Partial<AsyncEventChannelOptions> | null,
    optionsMap?: Map<any, Partial<AsyncEventChannelOptions>>
  ) {
    if (options && typeof options !== 'object') {
      throw new Error('options必须是对象类型')
    }
    if (optionsMap && !(optionsMap instanceof Map)) {
      throw new Error('optionsMap必须是Map类型')
    }
    Object.defineProperty(this, 'id', { value: ++AsyncEventChannel.id })
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

  on(type: ListenerItem[0], cb: ListenerItem[1]) {
    if (typeof cb !== 'function') {
      throw new Error('必须传入回调函数')
    }
    if (this.#getOption(type, 'isOnOnce')) {
      this.#listener.forEach((item) => {
        item[0] === type && this.#listener.delete(item)
      })
    }
    const item: ListenerItem = [type, cb]
    this.#listener.add(item)
    return {
      cancel: () => this.#listener.delete(item)
    }
  }

  emit(...args: EmitCacheItem) {
    if (args.length === 0) {
      throw new Error('必须传入事件名称')
    }
    const run: {
      cancel: () => boolean
      values: any[]
      async: boolean
      done?: (args: any[]) => void
    } = {
      cancel: () => false,
      values: [],
      async: false,
    }
    const [type, ...params] = args
    this.#listener.forEach((item) => {
      if (item[0] !== type) return
      run.values.push(item[1](...params))
    })
    if (run.values.length === 0 && this.#getOption(type, 'isEmitCache')) {
      if (this.#getOption(type, 'isEmitOnce')) {
        this.#emitCache.forEach((item) => {
          item[0] === type && this.#emitCache.delete(item)
        })
      }
      this.#emitCache.add(args)
      const cancel = this.#listener.listener_add([type, (cb) => {
        this.#emitCache.delete(args)
        Promise.resolve().then(() => {
          run.values.push(cb(...params))
          typeof run.done === 'function' && run.done(run.values)
        })
      }])
      run.async = true
      run.cancel = () => {
        cancel()
        return this.#emitCache.delete(args)
      }
    }
    return run
  }

  off(...types: any[]) {
    if (types.length === 0) {
      throw new Error('至少需要一个参数')
    }
    const totals = {
      listener: 0,
      emitCache: 0,
    }
    types.forEach((type) => {
      this.#listener.forEach((item) => {
        if (item[0] !== type) return
        this.#listener.delete(item)
        ++totals.listener
      })
      this.#emitCache.forEach((item) => {
        if (item[0] !== type) return
        this.#emitCache.delete(item)
        ++totals.emitCache
      })
    })
    return totals
  }

  once(type: ListenerItem[0], cb: ListenerItem[1]) {
    const run = this.on(type, (...args) => {
      const _run = cb(...args)
      run.cancel()
      return _run
    })
    return run
  }

  syncEmit(...args: EmitCacheItem) {
    if (args.length === 0) {
      throw new Error('至少需要一个参数')
    }
    const run = this.emit(...args)
    run.cancel()
    return run.values
  }

  asyncEmit(...args: EmitCacheItem) {
    if (args.length === 0) {
      throw new Error('至少需要一个参数')
    }
    let cancel
    const promise = new Promise((resolve, reject) => {
      const run = this.emit(...args)
      if (run.async) {
        run.done = resolve
        cancel = (reason?: any) => {
          run.cancel()
          reject(reason)
        }
      } else {
        resolve(run.values)
      }
    })
    return {
      cancel,
      promise,
    } as unknown as {
      cancel: (reason?: any) => void
      promise: Promise<any[]>
    }
  }
}

export function createScoped(ctx: AsyncEventChannelCtx) {
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
      cancels.forEach((cancel) => cancel())
      cancels.clear()
    },
  }
}

export class TasksQueue {
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

  constructor(types: any[], oneAuto = true) {
    if (types.length === 0) {
      throw new Error('至少需要一个参数')
    }
    this.#types = types
    this.#oneAuto = oneAuto
  }

  on(type: any, cb: (res: any) => any) {
    if (!this.#types.includes(type)) {
      throw new Error('未知的类型')
    }
    if (typeof cb !== 'function') {
      throw new Error('必须传入回调函数')
    }
    if (this.#tasks.has(type)) return
    this.#tasks.set(type, cb)
    if (this.#types.length === this.#tasks.size) {
      this.#load = true
      this.#oneAuto && this.start()
      this.#loadCb()
    }
  }

  onLoad(cb: () => void) {
    this.#loadCb = cb
  }

  async start(res?: any) {
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
          data: '任务被取消',
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

  cancel() {
    this.#isCancel = true
  }
}
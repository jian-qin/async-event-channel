type Listener = (...args: any[]) => any
type ListenerReturns = ReturnType<Listener>[]

type HookType = 'on' | 'emit' | 'off'
type HookPosition = 'before' | 'after'
type BaseHookResult<T extends HookType> =
  | {
      type: T
      position: 'before'
      payload: Parameters<Base[T]>
    }
  | ({
      type: T
      position: 'after'
      payload: Parameters<Base[T]>
    } & {
      [K in T extends 'on' | 'emit' ? 'result' : never]: ReturnType<Base[T]>
    })
type Hook = <T extends HookType>(result: BaseHookResult<T>) => void

type EmitReturn<R extends ListenerReturns> = Promise<R> & {
  onResolve: (cb: (value: R) => void) => void
  onReject?: (cb: (reason: 'cancel') => void) => void
  cancel?: () => void
}

class Base {
  static on_ignore = '@o_i;'
  static on_cover = '@o_c;'
  static emit_wait = '@e_w;'
  static emit_ignore = '@e_i;'
  static emit_cover = '@e_c;'

  protected _events = new Map<string, Set<Listener>>()
  protected _emits = new Map<string, Set<ReturnType<EventChannel['emit']>>>()
  protected _hooks = new Set<Hook>()

  protected _events_item(event: string) {
    let item = this._events.get(event)
    item || this._events.set(event, (item = new Set()))
    return item
  }
  protected _emits_item(event: string) {
    let item = this._emits.get(event)
    item || this._emits.set(event, (item = new Set()))
    return item
  }

  on(event: string, listener: Listener) {
    const listeners = this._events_item(event)
    if (event.includes(Base.on_ignore) && this._events.has(event)) {
      return
    }
    if (event.includes(Base.on_cover)) {
      listeners.clear()
    }
    listeners.add(listener)
    return () => this.off(event, listener)
  }

  emit<R extends ListenerReturns = ListenerReturns>(
    event: string,
    ...args: Parameters<Listener>
  ): EmitReturn<R> {
    type Resolve = Parameters<EmitReturn<R>['onResolve']>[0]
    type Reject = Parameters<NonNullable<EmitReturn<R>['onReject']>>[0]

    const syncResolve = (result: any = []): any =>
      Object.defineProperty(Promise.resolve(result), 'onResolve', {
        value: (cb: Resolve) => cb(result),
      })

    if (this._events.has(event)) {
      return syncResolve([...this._events.get(event)!].map((listener) => listener(...args)))
    }

    const isWait =
      event.includes(Base.emit_wait) ||
      event.includes(Base.emit_ignore) ||
      event.includes(Base.emit_cover)
    if (!isWait) {
      return syncResolve()
    }

    if (this._emits.has(event)) {
      if (event.includes(Base.emit_ignore)) {
        return syncResolve()
      }
      if (event.includes(Base.emit_cover)) {
        this.off(event, 'emit')
      }
    }

    const resolves: Resolve[] = []
    const rejects: Reject[] = []
    const result: any = new Promise((resolve, reject) => {
      resolves.push(resolve)
      rejects.push(reject)
    })

    const unhook = this.hook.afterOn(event, ({ payload }) => {
      end()
      const _result = payload[1](...args)
      resolves.forEach((resolve) => resolve(_result))
    })

    let cancel = () => {
      end()
      rejects.forEach((reject) => reject('cancel'))
    }
    const end = () => {
      unhook()
      cancel = () => {}
      this.off(event, result)
    }
    Object.defineProperties(result, {
      onResolve: { value: (cb: Resolve) => resolves.push(cb) },
      onReject: { value: (cb: Reject) => rejects.push(cb) },
      cancel: { value: () => cancel() },
    })
    this._emits_item(event).add(result)

    return result
  }

  off(event: string, value: Listener | ReturnType<EventChannel['emit']> | 'all' | 'on' | 'emit') {
    if (value === 'all') {
      this._events.delete(event)
      this._emits.get(event)?.forEach(({ cancel }) => cancel?.())
      this._emits.delete(event)
    } else if (value === 'on') {
      this._events.delete(event)
    } else if (value === 'emit') {
      this._emits.get(event)?.forEach(({ cancel }) => cancel?.())
      this._emits.delete(event)
    } else if (typeof value === 'function') {
      this._events.get(event)?.delete(value)
    } else {
      value.cancel?.()
      this._emits.get(event)?.delete(value)
    }
    this._events.get(event)?.size === 0 && this._events.delete(event)
    this._emits.get(event)?.size === 0 && this._emits.delete(event)
  }

  protected _createHook =
    (type: HookType, position: HookPosition) => (event: string, listener: Hook) =>
      this.hook.all((result) => {
        result.type === type &&
          result.position === position &&
          result.payload[0] === event &&
          listener(result)
      })

  hook = {
    all: (callBack: Hook) => {
      this._hooks.add(callBack)
      return () => this._hooks.delete(callBack)
    },
    beforeOn: this._createHook('on', 'before'),
    afterOn: this._createHook('on', 'after'),
    beforeEmit: this._createHook('emit', 'before'),
    afterEmit: this._createHook('emit', 'after'),
    beforeOff: this._createHook('off', 'before'),
    afterOff: this._createHook('off', 'after'),
  }
}

export default class EventChannel extends Base {
  constructor() {
    super()
  }

  on: Base['on'] = (event, listener) => {
    this._hooks.forEach((hook) =>
      hook({ type: 'on', position: 'before', payload: [event, listener] })
    )
    const result = super.on(event, listener)
    this._hooks.forEach((hook) =>
      hook({ type: 'on', position: 'after', payload: [event, listener], result })
    )
    return result
  }

  emit = <R extends ListenerReturns = ListenerReturns>(
    event: Parameters<Base['emit']>[0],
    ...args: Parameters<Base['emit']>[1]
  ) => {
    this._hooks.forEach((hook) =>
      hook({ type: 'emit', position: 'before', payload: [event, ...args] })
    )
    const result = super.emit<R>(event, ...args)
    this._hooks.forEach((hook) =>
      hook({ type: 'emit', position: 'after', payload: [event, ...args], result })
    )
    return result
  }

  off: Base['off'] = (event, listener) => {
    this._hooks.forEach((hook) =>
      hook({ type: 'off', position: 'before', payload: [event, listener] })
    )
    super.off(event, listener)
    this._hooks.forEach((hook) =>
      hook({ type: 'off', position: 'after', payload: [event, listener] })
    )
  }

  once: Base['on'] = (event, listener) => {
    const _listener = (...args: Parameters<Listener>) => {
      listener(...args)
      this.off(event, _listener)
    }
    return this.on(event, _listener)
  }

  size = (event: string, value: 'on' | 'emit') =>
    this[value === 'on' ? '_events' : '_emits'].get(event)?.size || 0

  has = (event: string, value: Listener | ReturnType<EventChannel['emit']> | 'on' | 'emit') => {
    if (value === 'on') {
      return this._events.has(event)
    }
    if (value === 'emit') {
      return this._emits.has(event)
    }
    if (typeof value === 'function') {
      return !!this._events.get(event)?.has(value)
    }
    return !!this._emits.get(event)?.has(value)
  }

  useScope = () => useScope(this)
  useEvent = useEvent(this)
}

const useScope = (instance: EventChannel) => {
  type Instance = typeof instance
  type OffItem = [string, Listener | ReturnType<Instance['emit']>]
  type ProxyCtx = Instance & {
    _offs: typeof _offs
    $clear: typeof clear
    $destroy: typeof destroy
  }

  const _offs = new Set<OffItem>()
  const { proxy, revoke } = Proxy.revocable(instance, {
    get<R extends ListenerReturns = ListenerReturns>(target: ProxyCtx, key: keyof ProxyCtx) {
      if (key === '_offs') {
        return _offs
      }
      if (key === '$clear') {
        return clear
      }
      if (key === '$destroy') {
        return destroy
      }
      if (key === 'on' || key === 'once') {
        const proxy: Instance['on'] = (event, listener) => {
          const result = instance[key](event, listener)
          result && _offs.add([event, listener])
          return result
        }
        return proxy
      }
      if (key === 'emit') {
        const proxy = (
          event: Parameters<Instance['emit']>[0],
          ...args: Parameters<Instance['emit']>[1]
        ) => {
          const result = instance[key]<R>(event, ...args)
          result.cancel && _offs.add([event, result])
          return result
        }
        return proxy
      }
      return Reflect.get(target, key)
    },
  })

  const clear = () => {
    _offs.forEach(([event, value]) => instance.off(event, value))
    _offs.clear()
  }
  const destroy = () => {
    clear()
    unhook()
    revoke()
  }

  const unhook = instance.hook.all((result) => {
    if (result.type === 'off' && result.position === 'after') {
      _offs.forEach((off) => {
        result.payload[0] === off[0] && result.payload[1] === off[1] && _offs.delete(off)
      })
    }
  })

  return proxy as ProxyCtx
}

const randomString = (
  length: number,
  chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) => Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

const useEvent =
  (instance: EventChannel) =>
  <P extends Parameters<Listener>, R extends ListenerReturns = ListenerReturns>(base = '') => {
    type Instance = typeof instance
    type ProxyHookType = Exclude<keyof Instance['hook'], 'all'>
    type ProxyHook<T extends ProxyHookType = ProxyHookType> = {
      [K in T]: (listener: Parameters<Instance['hook'][K]>[1]) => ReturnType<Instance['hook'][K]>
    }
    type ProxyCtx = Omit<Instance, 'on' | 'once' | 'emit' | 'off' | 'size' | 'has' | 'hook'> & {
      $event: typeof _event
      $destroy: typeof revoke
      on: (listener: (...args: P) => R[number]) => ReturnType<Instance['on']>
      once: (listener: (...args: P) => R[number]) => ReturnType<Instance['once']>
      emit: (...args: P) => EmitReturn<R>
      off: (value: Parameters<Instance['off']>[1]) => ReturnType<Instance['off']>
      size: (value: Parameters<Instance['size']>[1]) => ReturnType<Instance['size']>
      has: (value: Parameters<Instance['has']>[1]) => ReturnType<Instance['has']>
      hook: {
        all: Instance['hook']['all']
      } & ProxyHook
    }

    const _event = base + randomString(16)
    const keys = ['on', 'once', 'off', 'size', 'has'] as const
    const hook: ProxyCtx['hook'] = {
      all: instance.hook.all,
      beforeOn: (listener) => instance.hook.beforeOn(_event, listener),
      afterOn: (listener) => instance.hook.afterOn(_event, listener),
      beforeEmit: (listener) => instance.hook.beforeEmit(_event, listener),
      afterEmit: (listener) => instance.hook.afterEmit(_event, listener),
      beforeOff: (listener) => instance.hook.beforeOff(_event, listener),
      afterOff: (listener) => instance.hook.afterOff(_event, listener),
    }
    const { proxy, revoke } = Proxy.revocable(instance, {
      get(target, key: keyof ProxyCtx) {
        if (key === '$event') {
          return _event
        }
        if (key === '$destroy') {
          return revoke
        }
        if (key === 'emit') {
          return (...args: Parameters<ProxyCtx['emit']>) => instance.emit(_event, ...args)
        }
        if (keys.includes(key as (typeof keys)[number])) {
          return (value: any) => instance[key as (typeof keys)[number]](_event, value)
        }
        if (key === 'hook') {
          return hook
        }
        return Reflect.get(target, key)
      },
    })
    return proxy as unknown as ProxyCtx
  }

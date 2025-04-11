type Listener = (...args: any[]) => any
type ListenerReturns = ReturnType<Listener>[]

type HookType = 'on' | 'emit' | 'off'
type HookPosition = 'before' | 'after'
export type HookResult<T extends HookType = HookType> = {
  type: T
  position: 'before' | 'after'
  payload: Parameters<Base[T]>
  result?: ReturnType<Base[T]>
}
type Hook = <T extends HookType>(result: HookResult<T>) => void

type EmitRejctReason = 'not registered' | 'ignore' | 'cancel'
export type EmitReturn<R extends ListenerReturns = ListenerReturns> = UsePromiseResult<
  R,
  EmitRejctReason
> & { readonly cancel?: () => void }

type Listener_or_emitReturn = Listener | ReturnType<Base['emit']>

type UseScope_Result = EventChannel & {
  $clear: () => void
  $destroy: () => void
}
type UseEventScope_Result = Omit<ReturnType<EventChannel['useEvent']>, 'useEvent'>
type UseScope_Listener = (result: Pick<HookResult, 'type' | 'payload'>) => false | void

class Base {
  static readonly on_ignore = '@o_i;'
  static readonly on_cover = '@o_c;'
  static readonly emit_wait = '@e_w;'
  static readonly emit_ignore = '@e_i;'
  static readonly emit_cover = '@e_c;'

  protected _events = new Map<string, Set<Listener>>()
  protected _emits = new Map<string, Set<ReturnType<EventChannel['emit']>>>()
  protected _hooks = new Set<Hook>()

  on(event: string, listener: Listener) {
    if (this._events.has(event)) {
      if (event.includes(Base.on_ignore)) {
        return
      }
      if (event.includes(Base.on_cover)) {
        this.off(event, 'on')
        this._events.set(event, new Set())
      }
    } else {
      this._events.set(event, new Set())
    }
    this._events.get(event)!.add(listener)
    return () => this.off(event, listener)
  }

  emit<R extends ListenerReturns = ListenerReturns>(
    event: string,
    ...args: Parameters<Listener>
  ): EmitReturn<R> {
    const [promise, resolve, reject] = usePromise<R, EmitRejctReason>()

    if (this._events.has(event)) {
      return resolve([...this._events.get(event)!].map((listener) => listener(...args)) as R)
    }

    const isWait =
      event.includes(Base.emit_wait) ||
      event.includes(Base.emit_ignore) ||
      event.includes(Base.emit_cover)
    if (!isWait) {
      return reject('not registered')
    }
    if (this._emits.has(event) && event.includes(Base.emit_ignore)) {
      return reject('ignore')
    }

    if (this._emits.has(event) && event.includes(Base.emit_cover)) {
      this.off(event, 'emit')
    }

    Object.defineProperty(promise, 'cancel', {
      value: () => {
        reject('cancel')
      },
    })

    promise.onFinally(
      this.hook.afterOn(event, ({ payload }) => resolve([payload[1](...args)] as R))
    )

    this._emits.has(event)
      ? this._emits.get(event)!.add(promise)
      : this._emits.set(event, new Set([promise]))
    promise.onFinally(() => this.off(event, promise))

    return promise
  }

  off(event: string, value: Listener_or_emitReturn | 'all' | 'on' | 'emit') {
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
    (type: HookType, position: HookPosition) => (event: string, listener: Hook) => {
      assert.event(event)
      assert.listener(listener)

      return this.hook.all((result) => {
        result.type === type &&
          result.position === position &&
          result.payload[0] === event &&
          listener(result)
      })
    }

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
  on: Base['on'] = (event, listener) => {
    assert.event(event)
    assert.listener(listener)

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
    assert.event(event)

    this._hooks.forEach((hook) =>
      hook({ type: 'emit', position: 'before', payload: [event, ...args] })
    )
    const result = super.emit<R>(event, ...args)
    this._hooks.forEach((hook) =>
      hook({ type: 'emit', position: 'after', payload: [event, ...args], result })
    )
    return result
  }

  off: Base['off'] = (event, value) => {
    assert.event(event)
    assert.off_value(value)

    const invalid =
      value === 'all' ? this._events.size === 0 && this._emits.size === 0 : !this.has(event, value)
    if (invalid) return

    this._hooks.forEach((hook) =>
      hook({ type: 'off', position: 'before', payload: [event, value] })
    )
    super.off(event, value)
    this._hooks.forEach((hook) => hook({ type: 'off', position: 'after', payload: [event, value] }))
  }

  once: Base['on'] = (event, listener) => {
    assert.event(event)
    assert.listener(listener)

    const _listener = (...args: Parameters<Listener>) => {
      listener(...args)
      this.off(event, _listener)
    }
    return this.on(event, _listener)
  }

  size = (event: string, value: 'on' | 'emit') => {
    assert.event(event)
    assert.size_value(value)

    return this[value === 'on' ? '_events' : '_emits'].get(event)?.size || 0
  }

  has = (event: string, value: Listener_or_emitReturn | 'on' | 'emit') => {
    assert.event(event)
    assert.has_value(value)

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

  useScope(this: EventChannel, listener?: UseScope_Listener): UseScope_Result
  useScope(this: UseScope_Result, listener?: UseScope_Listener): UseScope_Result
  useScope(this: UseEventScope_Result, listener?: UseScope_Listener): UseEventScope_Result
  useScope(filter?: UseScope_Listener) {
    typeof filter !== 'undefined' && assert.listener(filter)

    const _offs = new Set<[string, Listener | ReturnType<EventChannel['emit']>]>()
    const clear = () => {
      _offs.forEach(([event, value]) => this.off(event, value))
      _offs.clear()
    }
    const destroy = () => {
      clear()
      unhook()
      revoke()
    }
    const unhook = this.hook.all((result) => {
      result.type === 'off' &&
        result.position === 'after' &&
        _offs.forEach(
          (off) => result.payload[0] === off[0] && result.payload[1] === off[1] && _offs.delete(off)
        )
    })

    const { proxy, revoke } = Proxy.revocable(this, {
      get: (target: any, key: any) => {
        if (key === '_offs') {
          return _offs
        }
        if (key === '$clear') {
          return clear
        }
        if (key === '$destroy') {
          return destroy
        }
        if (key === 'useEvent' && target.$event) {
          return
        }
        if (key === 'on' || key === 'once') {
          return ((event, listener) => {
            if (filter?.({ type: 'on', payload: [event, listener] }) === false) {
              return
            }
            const result = target[key](event, listener)
            result && _offs.add([event, listener])
            return result
          }) as EventChannel['on']
        }
        if (key === 'emit') {
          return ((event, ...args) => {
            if (filter?.({ type: 'emit', payload: [event, ...args] }) === false) {
              return usePromise()[2]('filter')
            }
            const result = target[key](event, ...args)
            result.cancel && _offs.add([event, result])
            return result
          }) as EventChannel['emit']
        }
        if (key === 'off') {
          return ((event, value) => {
            if (filter?.({ type: 'off', payload: [event, value] }) === false) {
              return
            }
            return target[key](event, value)
          }) as EventChannel['off']
        }
        return Reflect.get(target, key)
      },
    })
    return proxy as any
  }

  useEvent<P extends Parameters<Listener>, R extends ListenerReturns = ListenerReturns>(base = '') {
    if (typeof base !== 'string') throw Error('base must be a string')

    type ProxyHookType = Exclude<keyof EventChannel['hook'], 'all'>
    type ProxyHook<T extends ProxyHookType = ProxyHookType> = {
      [K in T]: (
        listener: Parameters<EventChannel['hook'][K]>[1]
      ) => ReturnType<EventChannel['hook'][K]>
    }
    type ProxyCtx = Omit<
      EventChannel,
      'on' | 'once' | 'emit' | 'off' | 'size' | 'has' | 'hook' | 'useEvent'
    > & {
      $event: string
      $destroy: () => void
      on: (listener: (...args: P) => R[number]) => ReturnType<EventChannel['on']>
      once: (listener: (...args: P) => R[number]) => ReturnType<EventChannel['once']>
      emit: (...args: P) => EmitReturn<R>
      off: (value: Parameters<EventChannel['off']>[1]) => ReturnType<EventChannel['off']>
      size: (value: Parameters<EventChannel['size']>[1]) => ReturnType<EventChannel['size']>
      has: (value: Parameters<EventChannel['has']>[1]) => ReturnType<EventChannel['has']>
      hook: { all: EventChannel['hook']['all'] } & ProxyHook
    }

    const scope = this.useScope()
    const _event = base + randomString()
    const keys = ['on', 'once', 'off', 'size', 'has'] as const
    const hook: ProxyCtx['hook'] = {
      all: (listener) =>
        scope.hook.all((result) => result.payload[0] === _event && listener(result)),
      beforeOn: (listener) => scope.hook.beforeOn(_event, listener),
      afterOn: (listener) => scope.hook.afterOn(_event, listener),
      beforeEmit: (listener) => scope.hook.beforeEmit(_event, listener),
      afterEmit: (listener) => scope.hook.afterEmit(_event, listener),
      beforeOff: (listener) => scope.hook.beforeOff(_event, listener),
      afterOff: (listener) => scope.hook.afterOff(_event, listener),
    }
    const emit: ProxyCtx['emit'] = (...args) => scope.emit(_event, ...args)

    return new Proxy(scope, {
      get: (target: any, key: any) => {
        if (key === '$event') {
          return _event
        }
        if (key === 'emit') {
          return emit
        }
        if (keys.includes(key)) {
          return (value: any) => target[key](_event, value)
        }
        if (key === 'hook') {
          return hook
        }
        if (key === 'useEvent') {
          return
        }
        return Reflect.get(target, key)
      },
    }) as ProxyCtx
  }
}

export const randomString = (
  length = 16,
  chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) => {
  if (typeof length !== 'number') throw Error('length must be a number')
  if (typeof chars !== 'string') throw Error('chars must be a string')
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export type UsePromiseResult<T = unknown, E = any> = Promise<T> & {
  readonly onResolved: (cb: (value: T) => void) => void
  readonly onRejected: (cb: (reason: E) => void) => void
  readonly onFinally: (cb: () => void) => void
}

export const usePromise = <T = unknown, E = any>() => {
  const resolves = new Set<(value: T) => void>()
  const rejects = new Set<(reason: E) => void>()
  const finallys = new Set<() => void>()
  const result = {
    state: 'pending' as 'pending' | 'resolved' | 'rejected',
    value: null as T,
    reason: null as E,
  }

  const promise = Object.defineProperties(
    new Promise<T>((_resolve, _reject) => {
      resolves.add(_resolve)
      rejects.add(_reject)
    }),
    {
      onResolved: {
        value: (cb: Parameters<typeof resolves.add>[0]) => {
          assert.listener(cb)
          if (result.state === 'pending') {
            resolves.add(cb)
          } else if (result.state === 'resolved') {
            cb(result.value)
          }
        },
      },
      onRejected: {
        value: (cb: Parameters<typeof rejects.add>[0]) => {
          assert.listener(cb)
          if (result.state === 'pending') {
            rejects.add(cb)
          } else if (result.state === 'rejected') {
            cb(result.reason)
          }
        },
      },
      onFinally: {
        value: (cb: Parameters<typeof finallys.add>[0]) => {
          assert.listener(cb)
          if (result.state === 'pending') {
            finallys.add(cb)
          } else {
            cb()
          }
        },
      },
    }
  ) as UsePromiseResult<T, E>

  const finallyd = () => {
    finallys.forEach((cb) => cb())
    resolves.clear()
    rejects.clear()
    finallys.clear()
    return promise
  }
  const resolve = (value: T) => {
    if (result.state !== 'pending') {
      return promise
    }
    result.state = 'resolved'
    result.value = value
    resolves.forEach((cb) => cb(value))
    return finallyd()
  }
  const reject = (reason: E) => {
    if (result.state !== 'pending') {
      return promise
    }
    result.state = 'rejected'
    result.reason = reason
    rejects.forEach((cb) => cb(reason))
    return finallyd()
  }

  return [promise, resolve, reject] as const
}

const assert: {
  listener_or_emitReturn: (value: unknown) => boolean
  event: (event: unknown) => asserts event is Parameters<EventChannel['on']>[0]
  listener: (listener: unknown) => asserts listener is Parameters<EventChannel['on']>[1]
  off_value: (value: unknown) => asserts value is Parameters<EventChannel['off']>[1]
  size_value: (value: unknown) => asserts value is Parameters<EventChannel['size']>[1]
  has_value: (value: unknown) => asserts value is Parameters<EventChannel['has']>[1]
} = {
  listener_or_emitReturn: (value) => {
    if (typeof value === 'function') {
      return true
    }
    return (
      typeof value === 'object' &&
      typeof (value as ReturnType<EventChannel['emit']>).then === 'function' &&
      typeof (value as ReturnType<EventChannel['emit']>).onResolved === 'function' &&
      typeof (value as ReturnType<EventChannel['emit']>).onResolved === 'function' &&
      typeof (value as ReturnType<EventChannel['emit']>).onFinally === 'function'
    )
  },
  event: (event) => {
    if (typeof event !== 'string') throw Error('event must be a string')
  },
  listener: (listener) => {
    if (typeof listener !== 'function') throw Error('listener must be a function')
  },
  off_value: (value) => {
    if (value === 'all' || value === 'on' || value === 'emit') return
    if (assert.listener_or_emitReturn(value)) return
    throw Error('value must be "all" | "on" | "emit" | function | emit return value')
  },
  size_value: (value) => {
    if (value !== 'on' && value !== 'emit') throw Error('value must be "on" | "emit"')
  },
  has_value: (value) => {
    if (value === 'on' || value === 'emit') return
    if (assert.listener_or_emitReturn(value)) return
    throw Error('value must be "on" | "emit" | function | emit return value')
  },
}

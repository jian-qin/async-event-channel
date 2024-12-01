type Listener = (...args: any[]) => any
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

class Base {
  static on_ignore = '@o_i;'
  static on_cover = '@o_c;'
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

  emit(
    event: string,
    ...args: Parameters<Listener>
  ): Promise<ReturnType<Listener>[]> & { cancel?: () => void } {
    if (this._events.has(event)) {
      const _result: ReturnType<Listener>[] = []
      this._events.get(event)!.forEach((listener) => _result.push(listener(...args)))
      return Promise.resolve(_result)
    }

    if (!event.includes(Base.emit_ignore) && !event.includes(Base.emit_cover)) {
      return Promise.resolve([])
    }

    if (this._emits.has(event)) {
      if (event.includes(Base.emit_ignore)) {
        return Promise.resolve([])
      }
      if (event.includes(Base.emit_cover)) {
        this.off(event, 'all_emit')
      }
    }

    let _resolve: (value: ReturnType<Listener>[]) => void
    let _reject: (reason: string) => void
    const result = new Promise((resolve, reject) => {
      _resolve = resolve
      _reject = reject
    }) as ReturnType<EventChannel['emit']>

    const unhook = this.hook.afterOn(event, () => {
      const _result: ReturnType<Listener>[] = []
      this._events.get(event)!.forEach((listener) => _result.push(listener(...args)))
      end()
      _resolve(_result)
    })

    let cancel = () => {
      end()
      _reject('cancel')
    }
    const end = () => {
      unhook()
      cancel = () => {}
      this.off(event, result)
    }
    Object.defineProperty(result, 'cancel', { value: () => cancel() })
    this._emits_item(event).add(result)

    return result
  }

  off(
    event: string,
    value: Listener | ReturnType<EventChannel['emit']> | 'all' | 'all_on' | 'all_emit'
  ) {
    if (value === 'all') {
      this._events.delete(event)
      this._emits.get(event)?.forEach(({ cancel }) => cancel?.())
      this._emits.delete(event)
    } else if (value === 'all_on') {
      this._events.delete(event)
    } else if (value === 'all_emit') {
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

  emit: Base['emit'] = (event, ...args) => {
    this._hooks.forEach((hook) =>
      hook({ type: 'emit', position: 'before', payload: [event, ...args] })
    )
    const result = super.emit(event, ...args)
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

  size = (event: string, type: 'on' | 'emit') =>
    this[type === 'on' ? '_events' : '_emits'].get(event)?.size || 0

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
}

export const useScope = (instance: EventChannel) => {
  const { proxy, revoke } = Proxy.revocable(instance, {
    get(target, key) {
      if (key === 'on' || key === 'once') {
        const proxy: EventChannel['on'] = (event, listener) => {
          const result = instance[key](event, listener)
          result && scope._offs.add([event, listener])
          return result
        }
        return proxy
      }
      if (key === 'emit') {
        const proxy: EventChannel['emit'] = (event, ...args) => {
          const result = instance[key](event, ...args)
          result.cancel && scope._offs.add([event, result])
          return result
        }
        return proxy
      }
      return Reflect.get(target, key)
    },
  })
  const scope = [
    proxy,
    () => {
      scope._offs.forEach(([event, value]) => instance.off(event, value))
      scope._offs.clear()
      unhook()
      revoke()
    },
  ] as [EventChannel, () => void] & {
    _offs: Set<[string, Listener | ReturnType<EventChannel['emit']>]>
  }
  Object.defineProperty(scope, '_offs', {
    value: new Set<[string, Listener | ReturnType<EventChannel['emit']>]>(),
  })
  const unhook = instance.hook.all((result) => {
    if (result.type === 'off' && result.position === 'after') {
      scope._offs.forEach((off) => {
        result.payload[0] === off[0] && result.payload[1] === off[1] && scope._offs.delete(off)
      })
    }
  })
  return scope
}

const randomString = (
  length: number,
  chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) => Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

export const useEvent =
  (instance: EventChannel, base = '') =>
  <P extends Parameters<Listener>, R = undefined>(event = randomString(16)) => {
    const _event = base + event
    return [
      new Proxy(instance, {
        get(target, key) {
          if (key === 'on' || key === 'once') {
            return (listener: Listener) => instance[key](_event, listener)
          }
          if (key === 'emit') {
            return (...args: Parameters<Listener>) => instance.emit(_event, ...args)
          }
          return Reflect.get(target, key)
        },
      }) as unknown as Omit<EventChannel, 'on' | 'once' | 'emit'> & {
        on: (listener: (...args: P) => R) => ReturnType<EventChannel['on']>
        once: (listener: (...args: P) => R) => ReturnType<EventChannel['once']>
        emit: (...args: P) => ReturnType<EventChannel['emit']>
      },
      _event,
    ] as const
  }

type Maps = Map<number, ListenersValue> | Map<number, TriggersValue> | Map<number, HooksValue>

export type Target = string | number | RegExp
export type HookType = 'on' | 'emit' | 'off' | 'trigger' | 'reply'

export type Result = Readonly<{
  id: number
  has: () => boolean
  off: () => void
}>

export type ListenersValue = {
  event: string
  result: Result
  listener: (params: unknown, result: Result) => unknown
  options?: {
    wait?: boolean
    once?: boolean
  }
}

export type TriggersValue = {
  event: string
  params: unknown
  result: Result
  replys: Map<number, unknown>
  options?: {
    wait?: boolean
    once?: boolean
    onReply?: (params: TriggersValue['replys'], result: Result) => void
  }
}

export type HooksValue = {
  target: Target
  result: Result
  listener: (
    params: {
      type: HookType
      on: ListenersValue | null
      emit: TriggersValue | null
    },
    result: Result
  ) => void
  options?: {
    type?: HookType | 'all'
    once?: boolean
  }
}

export type ScopeOptions = {
  on?: (...params: Parameters<AsyncEventChannel['on']>) => void
  emit?: (...params: Parameters<AsyncEventChannel['emit']>) => void
  off?: (params: { type: 'on' | 'emit'; on: ListenersValue | null; emit: TriggersValue | null }) => void
}

export default class AsyncEventChannel {
  private _id = 0
  private _listeners = new Map<number, ListenersValue>()
  private _triggers = new Map<number, TriggersValue>()
  private _hooks = new Map<number, HooksValue>()

  private _result_gen(map: Maps) {
    const id = ++this._id
    return Object.freeze({
      id,
      has: () => map.has(id),
      off: () => this.off(id),
    })
  }

  private _map_get<T extends ListenersValue | TriggersValue>(map: Map<number, T>, target: string | RegExp) {
    const has = typeof target === 'string' ? (event: string) => event === target : (event: string) => target.test(event)
    return [...map.values()].filter(({ event }) => has(event))
  }

  private _listeners_add(value: Pick<ListenersValue, 'event' | 'listener' | 'options'>) {
    const result = this._result_gen(this._listeners)
    this._listeners.set(result.id, { ...value, result })
    this._hook_run('on', result.id)
    return result
  }

  private _triggers_add(value: Pick<TriggersValue, 'event' | 'params' | 'options'>) {
    const result = this._result_gen(this._triggers)
    this._triggers.set(result.id, { ...value, result, replys: new Map() })
    this._hook_run('emit', result.id)
    return result
  }

  private async _run(listener: ListenersValue, trigger: TriggersValue) {
    this._hook_run('trigger', listener.result.id, trigger.result.id)
    let _result = listener.listener(trigger.params, listener.result)
    if (listener.options?.wait) {
      _result = await Promise.resolve(_result)
    }
    if (this._listeners.has(listener.result.id)) {
      const onReply = trigger.options?.onReply
      if (onReply) {
        trigger.replys.set(listener.result.id, _result)
        this._hook_run('reply', trigger.result.id, listener.result.id)
        if (listener.options?.once) {
          listener.result.off()
        }
        onReply(trigger.replys, trigger.result)
      }
    }
    if (listener.options?.once) {
      listener.result.off()
    }
    if (trigger.options?.once) {
      trigger.result.off()
    }
  }

  private async _on_run(id: number) {
    const trigger = this._triggers.get(id)!
    const listeners = this._map_get(this._listeners, trigger.event)
    if (listeners.length === 0) return
    const listeners_wait = listeners.some(({ options }) => options?.wait)
    const results = listeners.map((listener) => this._run(listener, trigger))
    if (trigger.options?.wait) return
    if (listeners_wait) {
      await Promise.allSettled(results)
    }
    this.off(trigger.result.id)
  }

  private _emit_run(id: number) {
    const listener = this._listeners.get(id)!
    const triggers = this._map_get(this._triggers, listener.event)
    if (triggers.length === 0) return
    triggers.forEach((trigger) => this._run(listener, trigger))
  }

  private _hook_get(target: HooksValue['target'], targetId: number, sourceId?: number) {
    const on = this._listeners.get(targetId) || (sourceId && this._listeners.get(sourceId)) || null
    const emit = this._triggers.get(targetId) || (sourceId && this._triggers.get(sourceId)) || null
    if (!on && !emit) return
    const event = (on || emit)!.event
    if (typeof target === 'number') {
      if (targetId !== target) return
    } else if (typeof target === 'string') {
      if (event !== target) return
    } else {
      if (!target.test(event)) return
    }
    return { on, emit }
  }

  private _hook_run(type: HookType, targetId: number, sourceId?: number) {
    this._hooks.forEach(({ target, listener, options, result }) => {
      const _type = options?.type || 'all'
      if (_type !== type && _type !== 'all') return
      const params = this._hook_get(target, targetId, sourceId)
      if (!params) return
      listener({ ...params, type }, result)
      if (options?.once) {
        result.off()
      }
    })
  }

  private _off_run(id: number) {
    this._hook_run('off', id)
    this._listeners.delete(id)
    this._triggers.delete(id)
    this._hooks.delete(id)
  }

  on(event: string, listener: ListenersValue['listener'], options?: ListenersValue['options']) {
    const result = this._listeners_add({ event, listener, options })
    this._emit_run(result.id)
    return result
  }

  emit(event: string, params: TriggersValue['params'], options?: TriggersValue['options']) {
    const result = this._triggers_add({ event, params, options })
    this._on_run(result.id)
    return result
  }

  off(target: Target, type: 'all' | 'on' | 'emit' = 'all') {
    if (typeof target === 'number') {
      this._off_run(target)
    } else {
      if (type === 'on' || type === 'all') {
        this._map_get(this._listeners, target).forEach(({ result }) => this._off_run(result.id))
      }
      if (type === 'emit' || type === 'all') {
        this._map_get(this._triggers, target).forEach(({ result }) => this._off_run(result.id))
      }
    }
  }

  hook(target: Target, listener: HooksValue['listener'], options?: HooksValue['options']) {
    const result = this._result_gen(this._hooks)
    this._hooks.set(result.id, { target, listener, options, result })
    return result
  }

  size(target: Target) {
    if (typeof target === 'number') {
      const on = this._listeners.has(target) ? 1 : 0
      const emit = this._triggers.has(target) ? 1 : 0
      return { on, emit, count: on + emit }
    }
    const on = this._map_get(this._listeners, target).length
    const emit = this._map_get(this._triggers, target).length
    return { on, emit, count: on + emit }
  }

  useScope(options?: ScopeOptions) {
    const ids = new Set<number>()
    const { proxy, revoke } = Proxy.revocable(this, {
      get: (target, prop, receiver) => {
        if (prop === 'on') {
          return (...params: Parameters<AsyncEventChannel['on']>) => {
            options?.on?.(...params)
            const result = target.on(...params)
            ids.add(result.id)
            return result
          }
        }
        if (prop === 'emit') {
          return (...params: Parameters<AsyncEventChannel['emit']>) => {
            options?.emit?.(...params)
            const result = target.emit(...params)
            ids.add(result.id)
            return result
          }
        }
        if (prop === '_off_run') {
          return (id: number) => {
            const on = target._listeners.get(id) || null
            const emit = target._triggers.get(id) || null
            if (on || emit) {
              options?.off?.({ type: on ? 'on' : 'emit', on, emit })
              ids.delete(id)
            }
            target._off_run(id)
          }
        }
        if (prop === 'clear') {
          return () => ids.forEach((id) => target.off(id))
        }
        if (prop === 'destroy') {
          return () => {
            ids.forEach((id) => target.off(id))
            revoke()
          }
        }
        return Reflect.get(target, prop, receiver)
      },
    })
    return proxy as unknown as AsyncEventChannel & {
      clear: () => void
      destroy: () => void
    }
  }
}

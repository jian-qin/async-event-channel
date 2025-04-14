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

export type HookParams = {
  type: HookType
  on: ListenersValue | null
  emit: TriggersValue | null
}

export type HooksValue = {
  target: Target
  result: Result
  listener: (params: HookParams, result: Result) => void
  options?: {
    type?: HookType | 'all'
    once?: boolean
  }
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
      off: () => this._off_run(id),
    })
  }

  private _map_get<T extends ListenersValue | TriggersValue>(map: Map<number, T>, target: string | RegExp) {
    const has = typeof target === 'string' ? (event: string) => event === target : (event: string) => target.test(event)
    return [...map.values()].filter(({ event }) => has(event))
  }

  private _listeners_add(value: Pick<ListenersValue, 'event' | 'listener' | 'options'>) {
    const result = this._result_gen(this._listeners)
    const on = { ...value, result }
    this._listeners.set(result.id, on)
    this._hook_run({ type: 'on', on, emit: null })
    return result
  }

  private _triggers_add(value: Pick<TriggersValue, 'event' | 'params' | 'options'>) {
    const result = this._result_gen(this._triggers)
    const emit = { ...value, result, replys: new Map() }
    this._triggers.set(result.id, emit)
    this._hook_run({ type: 'emit', on: null, emit })
    return result
  }

  private async _run(listener: ListenersValue, trigger: TriggersValue) {
    const results = this._run_trigger(listener, trigger)
    if (!results.length) return
    let [result] = results
    if (listener.options?.wait) {
      try {
        result = await Promise.resolve(result)
      } catch (err) {
        console.error(err)
        return
      }
    }
    this._run_reply(listener, trigger, result)
  }

  private _run_trigger(listener: ListenersValue, trigger: TriggersValue) {
    this._hook_run({ type: 'trigger', on: listener, emit: trigger })
    const results = []
    try {
      results.push(listener.listener(trigger.params, listener.result))
    } catch (err) {
      console.error(err)
    }
    if (listener.options?.once) {
      listener.result.off()
    }
    return results
  }

  private _run_reply(listener: ListenersValue, trigger: TriggersValue, result: unknown) {
    trigger.replys.set(listener.result.id, result)
    const onReply = trigger.options?.onReply
    if (onReply) {
      this._hook_run({ type: 'reply', on: listener, emit: trigger })
      onReply(trigger.replys, trigger.result)
    }
    if (trigger.options?.once) {
      trigger.result.off()
    }
  }

  private async _on_run(id: number) {
    const trigger = this._triggers.get(id)!
    const listeners = this._map_get(this._listeners, trigger.event)
    const listeners_wait = listeners.some(({ options }) => options?.wait)
    const results = listeners.map((listener) => this._run(listener, trigger))
    if (trigger.options?.wait) return
    if (listeners_wait) {
      await Promise.allSettled(results)
    }
    trigger.result.off()
  }

  private _emit_run(id: number) {
    const listener = this._listeners.get(id)!
    const triggers = this._map_get(this._triggers, listener.event)
    triggers.forEach((trigger) => this._run(listener, trigger))
  }

  private _hook_has(target: HooksValue['target'], { type, on, emit }: HookParams) {
    const value = { on, emit, off: on || emit, trigger: on, reply: emit }[type]
    if (!value) {
      return false
    }
    if (typeof target === 'number') {
      return value.result.id === target
    } else if (typeof target === 'string') {
      return value.event === target
    } else {
      return target.test(value.event)
    }
  }

  private _hook_run(params: HookParams) {
    this._hooks.forEach(({ target, listener, options, result }) => {
      const _type = options?.type || 'all'
      if (_type !== params.type && _type !== 'all') return
      if (!this._hook_has(target, params)) return
      listener({ ...params }, result)
      if (options?.once) {
        result.off()
      }
    })
  }

  private _off_run(id: number) {
    this._hook_run({
      type: 'off',
      on: this._listeners.get(id) || null,
      emit: this._triggers.get(id) || null,
    })
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

  emit_sync(event: string, params: TriggersValue['params']) {
    let result: unknown
    this.emit(event, params, {
      onReply: (replys) => {
        result = [...replys.values()][0]
      },
    })
    return result
  }

  emit_post(event: string, params: TriggersValue['params']) {
    return new Promise((resolve) => {
      this.emit(event, params, {
        wait: true,
        once: true,
        onReply: (replys) => resolve([...replys.values()][0]),
      })
    })
  }

  effectScope() {
    const ids = new Set<number>()
    const { proxy, revoke } = Proxy.revocable(this, {
      get: (target, prop, receiver) => {
        if (prop === 'on' || prop === 'emit') {
          return (...params: Parameters<AsyncEventChannel[typeof prop]>) => {
            const result: ReturnType<AsyncEventChannel[typeof prop]> = Reflect.apply(target[prop], target, params)
            ids.add(result.id)
            return result
          }
        }
        if (prop === 'clear') {
          return () => {
            ids.forEach((id) => target.off(id))
            ids.clear()
          }
        }
        if (prop === 'destroy') {
          return () => {
            ids.forEach((id) => target.off(id))
            ids.clear()
            revoke()
          }
        }
        if (prop === '_ids') {
          return ids
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

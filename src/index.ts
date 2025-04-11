type Listener = (params: unknown, result: Result) => unknown
type Target = string | RegExp
type HookType = 'on' | 'emit' | 'off' | 'reply'

export type Result = Readonly<{
  id: number
  has: () => boolean
  off: () => void
}>

export type ListenersValue = {
  event: string
  listener: Listener
  result: Result
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

type HooksValue = {
  target: Target | number
  has: (id: number) => boolean
  listener: (params: ListenersValue | TriggersValue, result: Result) => void
  result: Result
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

  private _result_gen(map: Map<number, ListenersValue> | Map<number, TriggersValue> | Map<number, HooksValue>) {
    const id = ++this._id
    let off: Result['off']
    if (map === this._listeners || map === this._triggers) {
      off = () => this._map_del(map, id)
    } else {
      off = () => {
        map.delete(id)
      }
    }
    return Object.freeze({ id, off, has: () => map.has(id) })
  }

  private _map_get<T extends ListenersValue | TriggersValue>(map: Map<number, T>, target: Target) {
    const has = typeof target === 'string' ? (event: string) => event === target : (event: string) => target.test(event)
    return [...map.values()].filter(({ event }) => has(event))
  }

  private _map_del(map: Map<number, ListenersValue> | Map<number, TriggersValue>, id: number) {
    if (!map.has(id)) return
    this._hook_run(id, 'off')
    map.delete(id)
  }

  private _listeners_add(value: Pick<ListenersValue, 'event' | 'listener' | 'options'>) {
    const result = this._result_gen(this._listeners)
    this._listeners.set(result.id, { ...value, result })
    this._hook_run(result.id, 'on')
    return result
  }

  private _triggers_add(value: Pick<TriggersValue, 'event' | 'params' | 'options'>) {
    const result = this._result_gen(this._triggers)
    this._triggers.set(result.id, { ...value, result, replys: new Map() })
    this._hook_run(result.id, 'emit')
    return result
  }

  private async _run(listener: ListenersValue, trigger: TriggersValue) {
    let _result = listener.listener(trigger.params, listener.result)
    const onReply = trigger.options?.onReply
    if (!onReply) return
    if (listener.options?.wait) {
      _result = await Promise.resolve(_result)
    }
    if (!this._listeners.has(listener.result.id)) return
    trigger.replys.set(listener.result.id, _result)
    this._hook_run(trigger.result.id, 'reply')
    onReply(trigger.replys, trigger.result)
    if (listener.options?.once) {
      listener.result.off()
    }
    if (trigger.options?.once) {
      trigger.result.off()
    }
  }

  private _on_run(id: number) {
    const trigger = this._triggers.get(id)!
    const listeners = this._map_get(this._listeners, trigger.event)
    if (listeners.length === 0) return
    listeners.forEach((listener) => this._run(listener, trigger))
  }

  private _emit_run(id: number) {
    const listener = this._listeners.get(id)!
    const triggers = this._map_get(this._triggers, listener.event)
    if (triggers.length === 0) return
    triggers.forEach((trigger) => this._run(listener, trigger))
  }

  private _hook_has(target: HooksValue['target']) {
    let _has: (value: ListenersValue | TriggersValue) => boolean
    if (typeof target === 'number') {
      _has = ({ result }) => result.id === target
    } else if (typeof target === 'string') {
      _has = ({ event }) => event === target
    } else {
      _has = ({ event }) => target.test(event)
    }
    return (id: number) => {
      const value = this._listeners.get(id) || this._triggers.get(id)
      return value ? _has(value) : false
    }
  }

  private _hook_run(id: number, type: HookType) {
    const params = (this._listeners.get(id) || this._triggers.get(id))!
    this._hooks.forEach(({ has, listener, options, result }) => {
      const _type = options?.type || 'all'
      if (_type !== type && _type !== 'all') return
      if (!has(id)) return
      listener({ ...params }, result)
      if (options?.once) {
        result.off()
      }
    })
  }

  on(event: string, listener: Listener, options?: ListenersValue['options']) {
    const result = this._listeners_add({ event, listener, options })
    this._emit_run(result.id)
    return result
  }

  emit(event: string, params: unknown, options?: TriggersValue['options']) {
    const result = this._triggers_add({ event, params, options })
    this._on_run(result.id)
    if (!options?.wait) {
      this._map_del(this._triggers, result.id)
    }
    return result
  }

  off(target: Target, type: 'all' | 'on' | 'emit' = 'all') {
    if (type === 'on' || type === 'all') {
      this._map_get(this._listeners, target).forEach(({ result }) => result.off())
    }
    if (type === 'emit' || type === 'all') {
      this._map_get(this._triggers, target).forEach(({ result }) => result.off())
    }
  }

  hook(target: HooksValue['target'], listener: HooksValue['listener'], options?: HooksValue['options']) {
    const result = this._result_gen(this._hooks)
    this._hooks.set(result.id, { target, listener, options, result, has: this._hook_has(target) })
    return result
  }

  size(target: Target) {
    return {
      on: this._map_get(this._listeners, target).length,
      emit: this._map_get(this._triggers, target).length,
    }
  }
}

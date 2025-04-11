type Listener = (params: unknown, result: Result) => unknown
type Result = Readonly<{
  id: number
  has: () => boolean
  off: () => void
}>
type ListenersValue = {
  event: string
  listener: Listener
  result: Result
  options?: {
    wait?: boolean
    once?: boolean
  }
}
type TriggersValue = {
  event: string
  params: unknown
  result: Result
  options?: {
    wait?: boolean
    once?: boolean
    onReply?: (params: Map<number, unknown>, result: Result) => void
  }
  replys: Map<number, unknown>
}

export default class AsyncEventChannel {
  private _id = 0
  private _listeners = new Map<number, ListenersValue>()
  private _triggers = new Map<number, TriggersValue>()

  private _map_get<T extends ListenersValue | TriggersValue>(map: Map<number, T>, target: string | RegExp) {
    const has = typeof target === 'string' ? (event: string) => event === target : (event: string) => target.test(event)
    return [...map.values()].filter(({ event }) => has(event))
  }

  private _listeners_add(value: Pick<ListenersValue, 'event' | 'listener' | 'options'>) {
    const id = ++this._id
    const result = Object.freeze({
      id,
      has: () => this._listeners.has(id),
      off: () => this._listeners_del(id),
    })
    this._listeners.set(id, { ...value, result })
    return result
  }

  private _triggers_add(value: Pick<TriggersValue, 'event' | 'params' | 'options'>) {
    const id = ++this._id
    const result = Object.freeze({
      id,
      has: () => this._triggers.has(id),
      off: () => this._triggers_del(id),
    })
    this._triggers.set(id, { ...value, result, replys: new Map() })
    return result
  }

  private _listeners_del(id: number) {
    const item = this._listeners.get(id)
    if (!item) return
    this._listeners.delete(id)
  }

  private _triggers_del(id: number) {
    const item = this._triggers.get(id)
    if (!item) return
    this._triggers.delete(id)
  }

  private async _run(listener: ListenersValue, trigger: TriggersValue) {
    let _result = listener.listener(trigger.params, listener.result)
    const onReply = trigger.options?.onReply
    if (!onReply) return
    if (listener.options?.wait) {
      _result = await Promise.resolve(_result)
    }
    trigger.replys.set(listener.result.id, _result)
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

  on(event: string, listener: Listener, options?: ListenersValue['options']) {
    const result = this._listeners_add({ event, listener, options })
    this._emit_run(result.id)
    return result
  }

  emit(event: string, params: unknown, options?: TriggersValue['options']) {
    const result = this._triggers_add({ event, params, options })
    this._on_run(result.id)
    if (!options?.wait) {
      this._triggers_del(result.id)
    }
    return result
  }

  off(target: string | RegExp, type: 'all' | 'on' | 'emit' = 'all') {
    if (type === 'on' || type === 'all') {
      this._map_get(this._listeners, target).forEach(({ result }) => result.off())
    }
    if (type === 'emit' || type === 'all') {
      this._map_get(this._triggers, target).forEach(({ result }) => result.off())
    }
  }

  has(target: string | RegExp) {}
}

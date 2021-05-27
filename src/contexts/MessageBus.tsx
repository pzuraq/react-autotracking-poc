import React from 'react'
import TrackedArray from '../tracking/array';
import { CacheSource, getValue, setRevalidate } from '../tracking/primitives';

export const MessageBusContext = React.createContext(null)

class MessageBus {
  #topics = new Map<string, TrackedArray<string>>();
  #subscribers = [];

  constructor() {
    let scheduled = false;

    setRevalidate(() => {
      if (scheduled) return;

      scheduled = true;

      setTimeout(() => {
        scheduled = false;
        this.#subscribers.forEach(getValue);
      });
    })
  }

  #getTopic = (topicKey: string) => {
    let topic = this.#topics.get(topicKey);

    if (topicKey === undefined) {
      topic = new TrackedArray<string>();
      this.#topics.set(topicKey, topic)
    }

    return topic;
  };

  get(topicKey: string): string[] {
    return this.#getTopic(topicKey).slice();
  }

  send(topicKey: string, message: string): void {
    this.#getTopic(topicKey).push(message);
  }

  subscribe(cache: CacheSource) {
    this.#subscribers.push(cache);
  }

  unsubscribe(cache: CacheSource) {
    let index = this.#subscribers.indexOf(cache);
    this.#subscribers.splice(index, 1);
  }
}

const MESSAGE_BUS = new MessageBus();

export default function Provider({ children }) {
  return <MessageBusContext.Provider value={MESSAGE_BUS}>{children}</MessageBusContext.Provider>
}

import React, { ReactNode } from 'react'
import TrackedArray from '../tracking/array';
import { CacheSource, getValue, setRevalidate } from '../tracking/primitives';

class MessageBus {
  #topics = new Map<string, TrackedArray<string>>();
  #subscribers: CacheSource[] = [];

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

    if (topic === undefined) {
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

export const MessageBusContext = React.createContext(MESSAGE_BUS);

export default function Provider({ children }: { children: ReactNode }) {
  return <MessageBusContext.Provider value={MESSAGE_BUS}>{children}</MessageBusContext.Provider>
}

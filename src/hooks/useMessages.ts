import { useReducer, useContext, useLayoutEffect } from 'react';
import { MessageBusContext } from '../contexts/MessageBus';
import { createCache, getValue } from '../tracking/primitives';

export function useMessages(topic: string): string[] {
  const messageBus = useContext(MessageBusContext);

  const [, forceRender] = useReducer((s) => s + 1, 0);

  let didRender = false;
  let cache = createCache(() => {
    if (didRender) {
      forceRender();
      return [];
    } else {
      didRender = true;
      return messageBus.get(topic);
    }
  });

  useLayoutEffect(() => {
    messageBus.subscribe(cache);

    return () => messageBus.unsubscribe(cache);
  });

  return getValue(cache);
}

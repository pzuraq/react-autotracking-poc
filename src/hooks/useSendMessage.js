import { useContext } from 'react';
import { MessageBusContext } from '../contexts/MessageBus';

export function useSendMessage(topic) {
  const messageBus = useContext(MessageBusContext);

  return (message) => {
    messageBus.send(topic, message);
  }
}

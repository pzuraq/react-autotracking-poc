import { useState } from "react";
import { useMessages } from "./hooks/useMessages";
import { useSendMessage } from "./hooks/useSendMessage";

export default function Messages({ topic }: { topic: string }) {
  let messages = useMessages(topic);
  let send = useSendMessage(topic);

  let [message, setMessage] = useState('');

  return <div>
    <ul>
      {messages.map((m) => <li>{m}</li>)}
    </ul>

    <input value={message} onChange={e => setMessage(e.target.value)} />

    <button onClick={() => send(message)}>Send</button>
  </div>
}

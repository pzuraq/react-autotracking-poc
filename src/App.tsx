import './App.css';
import Provider from './contexts/MessageBus';
import Messages from './Messages';

function App() {
  return (
    <Provider>
      <Messages topic="foo"/>
      <Messages topic="bar"/>
    </Provider>
  );
}

export default App;

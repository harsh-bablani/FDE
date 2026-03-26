import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function ChatPanel() {
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! You can ask me to trace documents, find top products, or check incomplete orders.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/query`, { query: userMessage });
      setMessages(prev => [...prev, { role: 'bot', text: response.data.answer }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', text: 'Error connecting to the query service. Please ensure the backend is running.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-panel card">
      <div className="panel-header">
        <h2>AI Graph Assistant</h2>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-bubble typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

export default ChatPanel;

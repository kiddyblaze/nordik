import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Conversation, Message } from './types';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import VoiceInput from './components/VoiceInput';
import SettingsModal from './components/SettingsModal';
import { Send, Menu, Loader2, Sparkles } from 'lucide-react';

// --- MOCK DATA GENERATORS FOR PREVIEW ---
const MOCK_USER: UserProfile = {
  id: 'user-123',
  name: 'Nordik Staff',
  email: 'staff@nordikrecovery.com',
  avatar_url: 'https://picsum.photos/seed/nordik/200'
};

const INITIAL_MESSAGE: Message = {
  id: 'msg-0',
  role: 'assistant',
  content: 'Hello! I am the Nordik Assistant. How can I help you with our protocols or products today?',
  created_at: new Date().toISOString()
};

// --- MAIN APP COMPONENT ---

export default function App() {
  // State: Auth
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // State: Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // State: Theme & Settings
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [versionId, setVersionId] = useState('production');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Apply Dark Mode Class to HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- ACTIONS ---

  const handleLogin = () => {
    setIsLoginLoading(true);
    // Simulate Google Auth Delay
    setTimeout(() => {
      setUser(MOCK_USER);
      setIsLoginLoading(false);
      // Load initial mock conversation
      setConversations([
        { id: 'conv-1', title: 'Cold Plunge Specs', updated_at: new Date().toISOString() }
      ]);
    }, 1500);
  };

  const handleLogout = () => {
    setUser(null);
    setConversations([]);
    setMessages([]);
    setActiveConversationId(null);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([INITIAL_MESSAGE]);
    setIsSidebarOpen(false); // Close mobile sidebar
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    // In a real app, fetch messages here. Simulating switch:
    setMessages([
      { id: `hist-${id}-1`, role: 'user', content: 'Previous question about durability...', created_at: new Date().toISOString() },
      { id: `hist-${id}-2`, role: 'assistant', content: 'The durability standards for Nordik tubs are...', created_at: new Date().toISOString() }
    ]);
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    // 1. Prepare User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      created_at: new Date().toISOString()
    };

    // 2. Optimistic UI Update
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    // 3. Determine Context (Conversation ID)
    // If we don't have an active conversation, create a stable ID now so it persists for the next turn.
    let currentConversationId = activeConversationId;
    if (!currentConversationId) {
        currentConversationId = `conv-${Date.now()}`;
    }
    
    // This User ID must be consistent across multiple turns for context to work
    const vfUserId = `user-${currentConversationId}`;

    try {
      let assistantContent = '';

      if (apiKey) {
        // --- REAL VOICEFLOW API CALL ---
        const cleanApiKey = apiKey.trim();
        const cleanVersion = versionId?.trim() || 'production';

        const response = await fetch(
          `https://general-runtime.voiceflow.com/state/user/${encodeURIComponent(vfUserId)}/interact`,
          {
            method: 'POST',
            headers: {
              Authorization: cleanApiKey,
              versionID: cleanVersion,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              request: {
                type: 'text',
                payload: userMsg.content
              }
            })
          }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`VF API Error (${response.status}): ${errorText}`);
        }

        const traces = await response.json();
        
        // Parse Traces
        traces.forEach((trace: any) => {
            if (trace.type === 'text' || trace.type === 'speak') {
                assistantContent += trace.payload.message + '\n';
            }
        });
        
        if (!assistantContent) {
            // If no text, check if there were other traces (debug info)
            console.log("Voiceflow Traces:", traces);
            assistantContent = "I received a response, but it contained no text. (Check console for traces)";
        }

      } else {
        // --- MOCK RESPONSE ---
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        assistantContent = `[MOCK MODE] You asked: "${userMsg.content}". \n\nTo test your real agent, click the Settings gear in the sidebar and enter your Voiceflow API Key.`;
      }

      // 4. Add Assistant Message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent.trim(),
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);

      // 5. If this was a new conversation, ensure it's saved to the sidebar state
      if (!activeConversationId) {
        setActiveConversationId(currentConversationId);
        setConversations(prev => [{
          id: currentConversationId!,
          title: userMsg.content.substring(0, 30) + '...',
          updated_at: new Date().toISOString()
        }, ...prev]);
      }

    } catch (e: any) {
      console.error("Voiceflow Error:", e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error connecting to Voiceflow: ${e.message || 'Unknown error'}. \n\nPlease check your API Key in Settings.`,
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveSettings = (key: string, ver: string) => {
    setApiKey(key);
    setVersionId(ver);
    setIsSettingsOpen(false);
    // Reset chat to clean state to avoid context mismatches
    if (!activeConversationId) {
        setMessages([INITIAL_MESSAGE]);
    }
  };

  // --- RENDER: LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-nordik-ivory dark:bg-nordik-dark p-4 relative overflow-hidden transition-colors duration-500">
        
        {/* Animated Blobs Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-nordik-taupe/20 dark:bg-nordik-taupe/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-nordik-clay/20 dark:bg-nordik-clay/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-20 w-96 h-96 bg-gray-300/30 dark:bg-white/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="z-10 w-full max-w-md text-center relative">
          
          {/* Brand Entrance */}
          <div className="mb-10 animate-fade-in-up">
             <div className="relative inline-block">
                <h1 className="text-7xl font-semibold text-nordik-dark dark:text-nordik-ivory tracking-tighter mb-2 transition-colors relative z-10">nordik</h1>
                <div className="absolute -bottom-2 left-0 w-full h-4 bg-nordik-taupe/10 dark:bg-nordik-taupe/20 -skew-x-12 z-0 rounded-sm"></div>
             </div>
             <p className="text-sm font-bold text-nordik-clay dark:text-nordik-taupe uppercase tracking-[0.4em] transition-colors pl-1">Recovery Assistant</p>
          </div>

          {/* Card Entrance */}
          <div className="bg-white/60 dark:bg-nordik-dark-surface/60 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-white/60 dark:border-white/5 transition-all duration-300 hover:shadow-soft animate-fade-in-up animation-delay-2000">
            
            <div className="mb-8 space-y-3">
               <h2 className="text-xl font-semibold text-nordik-dark dark:text-white">Smart support for Nordik staff.</h2>
               <p className="text-gray-600 dark:text-nordik-light/70 font-medium leading-relaxed text-sm">
                 Fast and accurate answers to customer questions.
               </p>
            </div>
            
            <button 
              onClick={handleLogin}
              disabled={isLoginLoading}
              className="w-full group relative bg-nordik-dark hover:bg-black dark:bg-nordik-ivory dark:text-nordik-dark dark:hover:bg-white text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              
              {isLoginLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12.61C5,8.85 8.38,5.78 12.23,5.78C14.61,5.78 16.28,6.81 17.15,7.65L19.16,5.66C17.31,3.92 14.76,2.92 12.18,2.92C6.85,2.92 2.5,7.26 2.5,12.61C2.5,17.96 6.85,22.3 12.18,22.3C16.91,22.3 21.5,18.35 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          </div>
          
          <div className="mt-12 flex items-center justify-center gap-2 text-nordik-taupe/60 dark:text-nordik-taupe/40 animate-fade-in animation-delay-4000">
             <Sparkles size={12} />
             <p className="text-[10px] uppercase tracking-widest">Powered by ARTEL AI</p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: APP SCREEN ---
  return (
    <div className="flex h-screen bg-nordik-ivory dark:bg-nordik-dark overflow-hidden transition-colors duration-500">
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        currentApiKey={apiKey}
        currentVersionId={versionId}
      />

      {/* Sidebar (Desktop & Mobile) */}
      <Sidebar 
        isOpen={isSidebarOpen}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        user={user}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasApiKey={!!apiKey}
      />

      {/* Overlay for Mobile Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-nordik-dark/80 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Mobile Header */}
        <div className="md:hidden h-16 flex items-center justify-between px-4 bg-nordik-light/90 dark:bg-nordik-dark-surface/90 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shrink-0 transition-colors duration-300 z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="text-nordik-dark dark:text-nordik-ivory p-2 active:scale-95 transition-transform">
            <Menu size={24} />
          </button>
          <span className="font-semibold text-nordik-dark dark:text-nordik-ivory tracking-tight">Nordik AI</span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-0 animate-fade-in" style={{ animationFillMode: 'forwards', animationDuration: '0.7s' }}>
                <div className="w-20 h-20 rounded-2xl bg-nordik-taupe/10 dark:bg-nordik-taupe/20 flex items-center justify-center mb-6 rotate-3">
                    <Sparkles className="text-nordik-taupe" size={32} />
                </div>
                <h2 className="text-3xl font-semibold text-nordik-dark dark:text-nordik-ivory mb-3">Nordik Assistant</h2>
                <p className="text-nordik-clay dark:text-nordik-taupe max-w-md leading-relaxed">
                  {apiKey 
                    ? "Connected to Voiceflow API. Ask me anything!" 
                    : "I can help you answer quickly customer questions about Nordik Recovery's products and services confidently."}
                </p>
              </div>
            ) : (
              <>
                <div className="h-4 md:h-8"></div>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} userProfile={user} />
                ))}
                {isSending && (
                  <div className="flex justify-start mb-8 animate-pulse">
                    <div className="bg-white dark:bg-nordik-dark-surface px-5 py-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 dark:border-white/5">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-nordik-taupe rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-nordik-taupe rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-nordik-taupe rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 md:p-6 bg-gradient-to-t from-nordik-ivory via-nordik-ivory/95 to-transparent dark:from-nordik-dark dark:via-nordik-dark/95 transition-colors duration-500">
          <div className="max-w-3xl mx-auto bg-white dark:bg-nordik-dark-surface rounded-[20px] shadow-none p-2 pl-4 flex items-end gap-3 relative transition-colors duration-300">
            
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={apiKey ? "Ask your agent..." : "Ask anything..."}
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-3.5 px-0 max-h-32 text-nordik-dark dark:text-nordik-ivory placeholder-gray-400 dark:placeholder-gray-500 text-base"
              rows={1}
              style={{ minHeight: '52px' }}
            />

            <div className="flex gap-2 pb-2 pr-2">
              <VoiceInput onTranscript={(text) => setInputText(prev => prev + (prev ? ' ' : '') + text)} />
              
              <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isSending}
                className={`p-3 rounded-xl transition-all duration-200 transform ${
                  inputText.trim() && !isSending
                    ? 'bg-nordik-dark text-white hover:bg-nordik-taupe active:scale-95 dark:bg-nordik-taupe dark:hover:bg-nordik-clay'
                    : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-600'
                }`}
              >
                <Send size={20} className={inputText.trim() && !isSending ? "ml-0.5" : ""} />
              </button>
            </div>
          </div>
          <div className="text-center mt-3">
             <p className="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-widest transition-colors">
                {apiKey ? "• Live API Mode •" : "Nordik Recovery • Internal V1.0"}
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  disableAnimation?: boolean; // New property to control streaming effect
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

// For Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

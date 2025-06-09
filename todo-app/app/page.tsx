'use client';

import { useState, FormEvent, useEffect } from 'react'; // Removed ReactNode as it's not directly used in this file anymore
import { useTheme } from './theme-provider';
import SettingsModal from './components/SettingsModal';

// --- localStorage Keys (consistent with SettingsModal) ---
const TODOS_LOCAL_STORAGE_KEY = 'nextjs-ai-todo-app-todos'; // Renamed for clarity
const USER_PROFILE_KEY = 'ai-todo-user-profile';
const API_CONFIG_KEY = 'ai-todo-api-config';
const DELETED_TODOS_LOCAL_STORAGE_KEY = 'nextjs-ai-todo-app-deleted-todos';

// --- Interfaces ---
interface SubTask {
  id: number;
  text: string;
  completed: boolean;
}

interface Enrichment {
  type: 'link' | 'note' | 'file';
  data: any;
  displayText: string;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category?: string;
  enrichment?: Enrichment;
  subTasks?: SubTask[];
}

// Interfaces from SettingsModal for API and User Profile
type ApiProvider = 'gemini' | 'openrouter';

interface UserProfile { // Added UserProfile interface
  background: string;
  interests: string;
  shortTermGoals: string;
  midTermGoals: string;
  longTermGoals: string;
}

interface ApiConfig { // Added ApiConfig interface
  apiKey: string;
  apiProvider?: ApiProvider;
  selectedModelId?: string;
}

interface AiActionLoadingState { // Added AiActionLoadingState interface
  [todoId: number]: {
    category?: boolean;
    enrichment?: boolean;
    subtasks?: boolean;
  };
}




export default function TodoAppPage() {
  const { theme, toggleTheme } = useTheme();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState<string>('');
  const [deletedTodos, setDeletedTodos] = useState<Todo[]>([]); // New state for deleted todos
  const [activeTab, setActiveTab] = useState<'active' | 'deleted' | 'completed'>('active'); // State for active tab
  const [isMounted, setIsMounted] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for Settings Modal
  const [aiActionLoading, setAiActionLoading] = useState<AiActionLoadingState>({});
  const [expandedTodoIds, setExpandedTodoIds] = useState<Record<number, boolean>>({});

  const toggleTodoDetails = (todoId: number) => {
    setExpandedTodoIds(prev => ({
      ...prev,
      [todoId]: !prev[todoId] // Toggle: undefined -> true, true -> false, false -> true
    }));
  };

  useEffect(() => {
    setIsMounted(true);
    const storedTodos = localStorage.getItem(TODOS_LOCAL_STORAGE_KEY);
    if (storedTodos) {
      setTodos(JSON.parse(storedTodos));
    }
    const storedDeletedTodos = localStorage.getItem(DELETED_TODOS_LOCAL_STORAGE_KEY);
    if (storedDeletedTodos) {
      setDeletedTodos(JSON.parse(storedDeletedTodos));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(TODOS_LOCAL_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos, isMounted]);

  useEffect(() => { // Save deleted todos to localStorage
    if (isMounted) {
      localStorage.setItem(DELETED_TODOS_LOCAL_STORAGE_KEY, JSON.stringify(deletedTodos));
    }
  }, [deletedTodos, isMounted]);

  const getApiConfig = (): ApiConfig | null => {
    if (typeof window === 'undefined') return null;
    const configStr = localStorage.getItem(API_CONFIG_KEY);
    return configStr ? JSON.parse(configStr) : null;
  };

  const getUserProfile = (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    const profileStr = localStorage.getItem(USER_PROFILE_KEY);
    return profileStr ? JSON.parse(profileStr) : null;
  };

  const setActionLoading = (todoId: number, action: 'category' | 'enrichment' | 'subtasks', isLoading: boolean) => {
    setAiActionLoading(prev => ({
      ...prev,
      [todoId]: {
        ...prev[todoId],
        [action]: isLoading,
      },
    }));
  };

  // --- AI Integration Functions ---

  const callAI = async (
    prompt: string,
    systemPrompt?: string
  ): Promise<string | null> => {
    const apiConfig = getApiConfig();
    if (!apiConfig?.apiKey || !apiConfig.apiProvider || !apiConfig.selectedModelId) {
      alert('Please configure API Provider, Model, and API Key in Settings.');
      return null;
    }

    const { apiKey, apiProvider, selectedModelId } = apiConfig;
    let endpoint = '';
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });


    if (apiProvider === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'; // Using OpenAI-compatible
    } else if (apiProvider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.href : 'http://localhost:51976'; // Or your app's domain
      headers['X-Title'] = 'AI To-Do App'; // Or your app's name
    } else {
      alert('Invalid API provider configured.');
      return null;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: selectedModelId,
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
        console.error('API Error:', errorData);
        alert(`API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Failed to fetch from AI. Check console.'}`);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error: any) {
      console.error('Network or other error calling AI:', error);
      alert(`Error calling AI: ${error.message}. Check console.`);
      return null;
    }
  };
  
  const generateSystemPrompt = (): string => {
    const userProfile = getUserProfile();
    return `You are a helpful AI assistant integrated into a To-Do list application.
The user has provided the following personal context:
- Background: ${userProfile?.background || 'Not provided'}
- Interests: ${userProfile?.interests || 'Not provided'}
- Short-term Goals: ${userProfile?.shortTermGoals || 'Not provided'}
- Mid-term Goals: ${userProfile?.midTermGoals || 'Not provided'}
- Long-term Goals: ${userProfile?.longTermGoals || 'Not provided'}
Please use this context to provide relevant and personalized assistance. Keep responses concise and directly usable.`;
  };



  const handleAddTodo = (e: FormEvent) => {
    e.preventDefault();
    if (newTodo.trim() === '') return;
    const newId = Date.now();
    // No initial AI processing on add anymore, user triggers it.
    setTodos([
      ...todos,
      {
        id: newId,
        text: newTodo,
        completed: false,
        // category: initialCategory, // Removed
        subTasks: [],
      },
    ]);
    setNewTodo('');
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    const todoToDelete = todos.find(todo => todo.id === id);
    if (todoToDelete) {
      setDeletedTodos(prevDeletedTodos => [...prevDeletedTodos, todoToDelete]);
    }
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const restoreTodo = (id: number) => {
    const todoToRestore = deletedTodos.find(todo => todo.id === id);
    if (todoToRestore) {
      // Add to active todos (ensure it's not marked as completed if that's desired on restore)
      // For now, restore with its current completed status.
      setTodos(prevTodos => [...prevTodos, todoToRestore]);
      // Remove from deleted todos
      setDeletedTodos(prevDeletedTodos => prevDeletedTodos.filter(todo => todo.id !== id));
    }
  };

  const permanentlyDeleteTodo = (id: number) => {
    setDeletedTodos(prevDeletedTodos => prevDeletedTodos.filter(todo => todo.id !== id));
  };

  const handleSuggestCategory = async (todoId: number) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    setActionLoading(todoId, 'category', true);
    const systemPrompt = generateSystemPrompt();
    const userPrompt = `Given the task "${todo.text}", suggest a concise category (1-3 words). Respond with only the category name.`;
    
    const category = await callAI(userPrompt, systemPrompt);

    if (category) {
      setTodos(prevTodos =>
        prevTodos.map(t => (t.id === todoId ? { ...t, category: category } : t))
      );
    }
    setActionLoading(todoId, 'category', false);
  };

  const handleFindInfo = async (todoId: number) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    setActionLoading(todoId, 'enrichment', true);
    const systemPrompt = generateSystemPrompt();
    const userPrompt = `For the task "${todo.text}", provide a brief piece of relevant information, a helpful tip, or a related web link.
If providing a link, try to format it as: [Link Text](URL). Otherwise, just provide the information.
Keep it concise.`;

    const info = await callAI(userPrompt, systemPrompt);

    if (info) {
      const linkMatch = info.match(/\[(.*?)\]\((.*?)\)/);
      let enrichment: Enrichment;
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        enrichment = { type: 'link', displayText: linkMatch[1], data: linkMatch[2] };
      } else if (info.startsWith('http://') || info.startsWith('https://')) {
        enrichment = { type: 'link', displayText: info, data: info };
      } else {
        enrichment = { type: 'note', displayText: info, data: info };
      }
      setTodos(prevTodos =>
        prevTodos.map(t => (t.id === todoId ? { ...t, enrichment } : t))
      );
    }
    setActionLoading(todoId, 'enrichment', false);
  };

  const handleSuggestSubtasks = async (todoId: number) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    setActionLoading(todoId, 'subtasks', true);
    const systemPrompt = generateSystemPrompt();
    const userPrompt = `For the task "${todo.text}", break it down into 2-4 actionable sub-tasks.
Respond with each sub-task on a new line. Do not use numbering or bullet points (like '-' or '*'). Just the sub-task text on each line.`;
    
    const responseText = await callAI(userPrompt, systemPrompt);

    if (responseText) {
      const newSubTasks: SubTask[] = responseText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => ({ id: Date.now() + Math.random(), text: s, completed: false }));
      
      if (newSubTasks.length > 0) {
        setTodos(prevTodos =>
          prevTodos.map(t => {
            if (t.id === todoId) {
              const existingSubTasks = t.subTasks || [];
              const uniqueNewSubTasks = newSubTasks.filter(nst => !existingSubTasks.find(est => est.text === nst.text));
              return { ...t, subTasks: [...existingSubTasks, ...uniqueNewSubTasks] };
            }
            return t;
          })
        );
      }
    }
    setActionLoading(todoId, 'subtasks', false);
  };
  
  const toggleSubTask = (todoId: number, subTaskId: number) => {
    setTodos(todos.map(todo => {
      if (todo.id === todoId) {
        return {
          ...todo,
          subTasks: (todo.subTasks || []).map(sub => 
            sub.id === subTaskId ? { ...sub, completed: !sub.completed } : sub
          ),
        };
      }
      return todo;
    }));
  };


  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white dark:bg-gray-900">
        <p className="text-gray-900 dark:text-gray-100">Loading...</p>
      </div>
    );
  }

  const tasksToDisplay =
    activeTab === 'active'
      ? todos.filter(t => !t.completed)
      : activeTab === 'completed'
      ? todos.filter(t => t.completed)
      : deletedTodos;
  const emptyListTitle =
    activeTab === 'active'
      ? 'No active tasks'
      : activeTab === 'completed'
      ? 'No completed tasks'
      : 'No deleted tasks';
  const emptyListMessage =
    activeTab === 'active'
      ? 'Add a new task to get started.'
      : activeTab === 'completed'
      ? 'Completed tasks will appear here.'
      : 'Deleted tasks will appear here.';

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-2xl min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <header className="flex justify-between items-center mb-6 sm:mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">Donezo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Task management AI agent</p>
        </div>
        <div className="flex items-center space-x-2"> {/* Group for buttons */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
            aria-label="Open settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )}
          </button>
        </div>
      </header>
      
      <form onSubmit={handleAddTodo} className="flex mb-6 sm:mb-8 shadow-sm rounded-lg">
        <input
          type="text"
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          placeholder="Add a new AI-powered to-do..."
          className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium p-3 rounded-r-lg transition-colors"
        >
          Add Task
        </button>
      </form>

      {/* Tab Navigation */}
      <div className="mb-6 flex justify-center space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('active')}
          className={`py-2 px-4 font-medium text-sm rounded-t-md focus:outline-none transition-colors duration-150 ease-in-out ${
            activeTab === 'active'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-slate-50 dark:bg-slate-800'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          Active Tasks
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          className={`py-2 px-4 font-medium text-sm rounded-t-md focus:outline-none transition-colors duration-150 ease-in-out ${
            activeTab === 'deleted'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-slate-50 dark:bg-slate-800'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          Deleted Tasks
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`py-2 px-4 font-medium text-sm rounded-t-md focus:outline-none transition-colors duration-150 ease-in-out ${
            activeTab === 'completed'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-gray-100 dark:bg-gray-800'
              : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
          }`}
        >
          Completed Tasks
        </button>
      </div>
      
      
      {/* Determine which tasks to display based on activeTab */}

      {tasksToDisplay.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{emptyListTitle}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{emptyListMessage}</p>
        </div>
      )}

      <ul className="space-y-4">
        {tasksToDisplay.map(todo => (
          <li
            key={todo.id}
            className={`p-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out
                        ${todo.completed ? 'bg-green-100 dark:bg-green-900/30 opacity-75' : 'bg-white'}
                        border border-gray-200 dark:border-gray-700`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start flex-grow pt-1">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  className={`mr-3 mt-1 h-5 w-5 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 ${activeTab === 'deleted' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  disabled={activeTab === 'deleted'}
                />
                <span className={`flex-grow text-base ${todo.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {todo.text}
                </span>
              </div>
              {activeTab === 'active' ? (
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="ml-3 bg-red-500 hover:bg-red-600 text-white p-1.5 px-3 rounded-md text-xs font-medium transition-colors"
                >
                  Delete
                </button>
              ) : (
                <>
                  <button
                    onClick={() => restoreTodo(todo.id)}
                    className="ml-3 bg-green-500 hover:bg-green-600 text-white p-1.5 px-3 rounded-md text-xs font-medium transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => permanentlyDeleteTodo(todo.id)}
                    className="ml-2 bg-red-600 hover:bg-red-700 text-white p-1.5 px-3 rounded-md text-xs font-medium transition-colors"
                  >
                    Delete Permanently
                  </button>
                </>
              )}
            </div>

            {activeTab === 'active' && (<>
            {/* Toggle Details Button */}
            <div className="mt-2 mb-1 flex justify-end">
              <button
                onClick={() => toggleTodoDetails(todo.id)}
                className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
              >
                {expandedTodoIds[todo.id] ? 'Hide AI Details' : 'Show AI Details'}
                {expandedTodoIds[todo.id] ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* AI Details Section - Conditionally Rendered */}
            {expandedTodoIds[todo.id] && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-4">
              {/* Category Section */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">Category:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${aiActionLoading[todo.id]?.category ? 'bg-yellow-100 dark:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300 animate-pulse' : 'bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300'}`}>
                    {aiActionLoading[todo.id]?.category ? 'Working...' : (todo.category || 'N/A')}
                  </span>
                </div>
                <button 
                  onClick={() => handleSuggestCategory(todo.id)}
                  disabled={aiActionLoading[todo.id]?.category}
                  className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  {aiActionLoading[todo.id]?.category ? 'Loading...' : 'Suggest Category (AI)'}
                </button>
              </div>

              {/* Enrichment Section */}
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Related Info:</span>
                    <button 
                        onClick={() => handleFindInfo(todo.id)}
                        disabled={aiActionLoading[todo.id]?.enrichment}
                        className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors disabled:opacity-50"
                    >
                        {aiActionLoading[todo.id]?.enrichment ? 'Loading...' : 'Find Info (AI)'}
                    </button>
                </div>
                {aiActionLoading[todo.id]?.enrichment ? <p className="text-xs text-yellow-500 dark:text-yellow-400 animate-pulse">Fetching info...</p> : (
                    todo.enrichment ? (
                        <div>
                        {todo.enrichment.type === 'link' ? (
                            <a href={todo.enrichment.data} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400 break-all">
                            {todo.enrichment.displayText}
                            </a>
                        ) : (
                            <span className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{todo.enrichment.displayText}</span>
                        )}
                        </div>
                    ) : <p className="text-xs text-gray-500 dark:text-gray-400">No related info found yet.</p>
                )}
              </div>
              
              {/* Sub-tasks Section */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sub-tasks:</h4>
                  <button 
                    onClick={() => handleSuggestSubtasks(todo.id)}
                    disabled={aiActionLoading[todo.id]?.subtasks}
                    className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors disabled:opacity-50"
                  >
                    {aiActionLoading[todo.id]?.subtasks ? 'Loading...' : 'Suggest Sub-tasks (AI)'}
                  </button>
                </div>
                {aiActionLoading[todo.id]?.subtasks && <p className="text-xs text-yellow-500 dark:text-yellow-400 animate-pulse">Generating subtasks...</p>}
                {(todo.subTasks && todo.subTasks.length > 0) ? (
                  <ul className="space-y-1.5 pl-1">
                    {todo.subTasks.map(sub => (
                      <li key={sub.id} className="text-sm flex items-center bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubTask(todo.id, sub.id)}
                          className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 cursor-pointer"
                        />
                        <span className={`${sub.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'} text-xs`}>
                          {sub.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !aiActionLoading[todo.id]?.subtasks && <p className="text-xs text-gray-500 dark:text-gray-400">No sub-tasks yet. Try the "Suggest" button!</p>
                )}
              </div>
            </div>
            )}
            </>)} {/* Closing for activeTab === 'active' wrapper */}
          </li>
        ))}
      </ul>

      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Settings, 
  ArrowLeft, 
  Pause,
  Sparkles,
  MessageCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { blink } from '../blink/client'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  model?: string
  timestamp: Date
  audioUrl?: string
  isStreaming?: boolean
}

interface VoiceState {
  isRecording: boolean
  isProcessing: boolean
  isPlaying: boolean
  audioLevel: number
  isListening: boolean
  conversationMode: boolean // New: tracks if conversation mode is active
}

interface ChatInterfaceProps {
  user: any
  onBackToLanding: () => void
  onConversationComplete: () => void
  conversationCount: number
  maxFreeConversations: number
}

const ChatInterface = ({ 
  user, 
  onBackToLanding, 
  onConversationComplete, 
  conversationCount, 
  maxFreeConversations 
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isProcessing: false,
    isPlaying: false,
    audioLevel: 0,
    isListening: false,
    conversationMode: false
  })
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const [showSettings, setShowSettings] = useState(false)
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [hasStartedConversation, setHasStartedConversation] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const continuousStreamRef = useRef<MediaStream | null>(null)
  const voiceDetectionRef = useRef<boolean>(false)
  const speechStartTimeRef = useRef<number>(0)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (continuousStreamRef.current) {
        continuousStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Check if user has reached free limit
  const hasReachedLimit = conversationCount >= maxFreeConversations

  const determineOptimalModel = useCallback((prompt: string): string => {
    if (selectedModel !== 'auto') return selectedModel

    const lowerPrompt = prompt.toLowerCase()

    // Code-related queries
    if (lowerPrompt.includes('code') || lowerPrompt.includes('programming') || 
        lowerPrompt.includes('function') || lowerPrompt.includes('debug')) {
      return 'gpt-4o'
    }

    // Creative writing
    if (lowerPrompt.includes('write') || lowerPrompt.includes('story') || 
        lowerPrompt.includes('creative') || lowerPrompt.includes('poem')) {
      return 'claude-3-5-sonnet-20241022'
    }

    // Analysis and reasoning
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('explain') || 
        lowerPrompt.includes('compare') || lowerPrompt.includes('why')) {
      return 'gpt-4o'
    }

    // Default for conversational queries
    return 'gpt-4o-mini'
  }, [selectedModel])

  const processRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('❌ No audio chunks to process')
      return
    }

    console.log('🎤 Processing recording with', audioChunksRef.current.length, 'chunks')
    setVoiceState(prev => ({ ...prev, isProcessing: true }))

    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      console.log('🎵 Audio blob created, size:', audioBlob.size, 'bytes')

      if (audioBlob.size < 500) {
        console.log('❌ Audio blob too small, skipping')
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      // Transcribe audio
      let text = ''
      try {
        const arrayBuffer = await audioBlob.arrayBuffer()
        const result = await blink.ai.transcribeAudio({
          audio: arrayBuffer,
          language: 'en',
          model: 'whisper-1'
        })
        text = result.text?.trim() || ''
      } catch (error) {
        console.error('❌ Transcription failed:', error)
        setShowTextFallback(true)
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'Sorry, I had trouble understanding your audio. Please try the text input below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      if (!text || text.length < 2) {
        setShowTextFallback(true)
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'I couldn\'t hear you clearly. Please try speaking again or use the text input below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      // Mark conversation as started
      if (!hasStartedConversation) {
        setHasStartedConversation(true)
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])

      // Determine best model and generate response
      const model = determineOptimalModel(text)
      console.log('🤖 Selected model:', model)

      let responseText = ''
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '',
        model,
        timestamp: new Date(),
        isStreaming: true
      }

      setMessages(prev => [...prev, assistantMessage])

      // Build conversation context
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))

      conversationHistory.push({ role: 'user', content: text })

      try {
        await blink.ai.streamText(
          { 
            messages: conversationHistory,
            model: model === 'auto' ? 'gpt-4o-mini' : model,
            maxTokens: 300
          },
          (chunk) => {
            responseText += chunk
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: responseText }
                : msg
            ))
          }
        )
      } catch (error) {
        console.error('❌ AI generation error:', error)
        responseText = 'Sorry, I encountered an error processing your request. Please try again.'
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: responseText }
            : msg
        ))
      }

      // Mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, isStreaming: false }
          : msg
      ))

      // Generate and play speech response
      try {
        const result = await blink.ai.generateSpeech({
          text: responseText,
          voice: 'nova'
        })

        const audioUrl = result.url

        // Update message with audio URL
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, audioUrl }
            : msg
        ))

        // Auto-play the response
        await playAudio(audioUrl)

      } catch (error) {
        console.error('❌ Speech generation error:', error)
      }

      // Mark conversation as complete
      onConversationComplete()

    } catch (error) {
      console.error('❌ Error processing audio:', error)
    } finally {
      setVoiceState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [messages, determineOptimalModel, hasStartedConversation, onConversationComplete])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setVoiceState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }))
    }
  }, [])

  const startAutomaticRecording = useCallback(async () => {
    if (voiceState.isRecording || voiceState.isProcessing || !continuousStreamRef.current) return

    try {
      const stream = continuousStreamRef.current
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      speechStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        await processRecording()
      }

      mediaRecorder.start()
      setVoiceState(prev => ({ ...prev, isRecording: true }))

      // Set maximum recording time (15 seconds)
      const timeout = setTimeout(() => {
        stopRecording()
      }, 15000)

      mediaRecorder.addEventListener('stop', () => {
        clearTimeout(timeout)
      }, { once: true })
    } catch (error) {
      console.error('❌ Error starting automatic recording:', error)
    }
  }, [voiceState.isRecording, voiceState.isProcessing, processRecording, stopRecording])

  const setupContinuousVoiceDetection = useCallback((stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioContext = audioContextRef.current

      analyserRef.current = audioContext.createAnalyser()
      const analyser = analyserRef.current
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.8

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let speechStartTime = 0
      let lastSpeechTime = 0
      let isCurrentlyRecording = false

      const SPEECH_THRESHOLD = 15
      const SPEECH_START_DURATION = 200
      const SPEECH_END_DURATION = 1200
      const MIN_RECORDING_TIME = 600

      const monitorVoiceActivity = () => {
        if (!analyser) return

        analyser.getByteFrequencyData(dataArray)

        let sum = 0
        const speechStart = Math.floor(bufferLength * 0.1)
        const speechEnd = Math.floor(bufferLength * 0.4)

        for (let i = speechStart; i < speechEnd; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / (speechEnd - speechStart))

        setVoiceState(prev => ({ ...prev, audioLevel: rms }))

        const now = Date.now()

        if (rms > SPEECH_THRESHOLD) {
          if (!voiceDetectionRef.current) {
            speechStartTime = now
            voiceDetectionRef.current = true
          }
          lastSpeechTime = now

          if (!isCurrentlyRecording && (now - speechStartTime) > SPEECH_START_DURATION) {
            isCurrentlyRecording = true
            startAutomaticRecording()
          }
        } else {
          if (voiceDetectionRef.current && isCurrentlyRecording) {
            const silenceDuration = now - lastSpeechTime
            const recordingDuration = now - speechStartTimeRef.current

            if (silenceDuration > SPEECH_END_DURATION && recordingDuration > MIN_RECORDING_TIME) {
              isCurrentlyRecording = false
              stopRecording()
              voiceDetectionRef.current = false
            }
          } else if (!isCurrentlyRecording) {
            voiceDetectionRef.current = false
          }
        }

        if (continuousStreamRef.current) {
          requestAnimationFrame(monitorVoiceActivity)
        }
      }

      voiceDetectionRef.current = false
      monitorVoiceActivity()

    } catch (error) {
      console.error('❌ Error setting up continuous voice detection:', error)
    }
  }, [startAutomaticRecording, stopRecording])

  const startContinuousListening = useCallback(async () => {
    if (hasReachedLimit) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
          sampleSize: 16
        }
      })

      continuousStreamRef.current = stream
      setVoiceState(prev => ({ ...prev, isListening: true }))

      setupContinuousVoiceDetection(stream)

    } catch (error) {
      console.error('❌ Error starting continuous listening:', error)
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.')
      }
    }
  }, [setupContinuousVoiceDetection, hasReachedLimit])

  const stopContinuousListening = useCallback(() => {
    if (continuousStreamRef.current) {
      continuousStreamRef.current.getTracks().forEach(track => track.stop())
      continuousStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setVoiceState(prev => ({ ...prev, isListening: false, audioLevel: 0, conversationMode: false }))
    voiceDetectionRef.current = false
  }, [])

  // New function to toggle conversation mode
  const toggleConversationMode = useCallback(async () => {
    if (hasReachedLimit) return

    if (voiceState.conversationMode) {
      // Stop conversation mode
      stopContinuousListening()
      stopAudio()
    } else {
      // Start conversation mode
      await startContinuousListening()
      setVoiceState(prev => ({ ...prev, conversationMode: true }))
    }
  }, [voiceState.conversationMode, hasReachedLimit, startContinuousListening, stopContinuousListening, stopAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousListening()
    }
  }, [stopContinuousListening])

  const playAudio = async (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }

      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio

      audio.onloadstart = () => {
        setVoiceState(prev => ({ ...prev, isPlaying: true }))
      }

      audio.onended = () => {
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      }

      audio.onerror = () => {
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      }

      audio.play().catch(() => {
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      })
    })
  }

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setVoiceState(prev => ({ ...prev, isPlaying: false }))
    }
  }, [])

  const handleTextSubmit = useCallback(async (text: string) => {
    if (!text.trim() || hasReachedLimit) return

    setVoiceState(prev => ({ ...prev, isProcessing: true }))

    try {
      // Mark conversation as started
      if (!hasStartedConversation) {
        setHasStartedConversation(true)
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])

      // Generate AI response
      const model = determineOptimalModel(text)
      let responseText = ''
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '',
        model,
        timestamp: new Date(),
        isStreaming: true
      }

      setMessages(prev => [...prev, assistantMessage])

      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))

      conversationHistory.push({ role: 'user', content: text })

      await blink.ai.streamText(
        { 
          messages: conversationHistory,
          model: model === 'auto' ? 'gpt-4o-mini' : model,
          maxTokens: 300
        },
        (chunk) => {
          responseText += chunk
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: responseText }
              : msg
          ))
        }
      )

      // Mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, isStreaming: false }
          : msg
      ))

      // Generate speech
      try {
        const result = await blink.ai.generateSpeech({
          text: responseText,
          voice: 'nova'
        })

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, audioUrl: result.url }
            : msg
        ))

        await playAudio(result.url)
      } catch (error) {
        console.error('❌ Speech generation error:', error)
      }

      setTextInput('')
      setShowTextFallback(false)
      onConversationComplete()

    } catch (error) {
      console.error('❌ Error processing text input:', error)
    } finally {
      setVoiceState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [messages, determineOptimalModel, hasStartedConversation, hasReachedLimit, onConversationComplete])

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="p-8 text-center bg-slate-800 border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-4">Please Sign In</h1>
          <p className="text-slate-400 mb-6">Sign in to start your AI conversation</p>
          <Button onClick={() => blink.auth.login()} className="bg-indigo-600 hover:bg-indigo-700">
            Sign In
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToLanding}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Orkestra AI</h1>
                <div className="flex items-center gap-2">
                  {voiceState.conversationMode && !voiceState.isRecording && !voiceState.isProcessing && !voiceState.isPlaying && !hasReachedLimit && (
                    <Badge variant="secondary" className="bg-blue-600 text-white animate-pulse text-xs">
                      Active
                    </Badge>
                  )}
                  {voiceState.isRecording && (
                    <Badge variant="secondary" className="bg-red-600 text-white animate-pulse text-xs">
                      Recording
                    </Badge>
                  )}
                  {voiceState.isProcessing && (
                    <Badge variant="secondary" className="bg-amber-600 text-white animate-pulse text-xs">
                      Processing
                    </Badge>
                  )}
                  {voiceState.isPlaying && (
                    <Badge variant="secondary" className="bg-green-600 text-white animate-pulse text-xs">
                      Playing
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
              {conversationCount}/{maxFreeConversations} conversations
            </Badge>
            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
              Model: {selectedModel}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-slate-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-700 bg-slate-800"
          >
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-400">AI Model:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm"
                  disabled={voiceState.isRecording || voiceState.isProcessing}
                >
                  <option value="auto">Auto-Select (Recommended)</option>
                  <option value="gpt-4o-mini">GPT-4O Mini (Fast)</option>
                  <option value="gpt-4o">GPT-4O (Balanced)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Creative)</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && !hasReachedLimit && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Ready for Conversation</h2>
              <p className="text-slate-400 mb-4">Press the microphone button to activate conversation mode</p>
              <p className="text-sm text-slate-500">
                • Press once to start listening and responding<br/>
                • Press again to pause conversation mode<br/>
                • AI will respond with both text and voice<br/>
                • Intelligent model routing for optimal responses
              </p>
            </div>
          )}

          {hasReachedLimit && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Free Conversations Used</h2>
              <p className="text-slate-400 mb-4">You've used all {maxFreeConversations} free conversations.</p>
              <p className="text-sm text-slate-500 mb-6">
                Upgrade to Pro for unlimited conversations or use a referral code for lifetime access.
              </p>
              <Button onClick={onBackToLanding} className="bg-indigo-600 hover:bg-indigo-700">
                View Pricing
              </Button>
            </div>
          )}

          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.type === 'user' ? 'bg-indigo-600' : 'bg-slate-700'} rounded-2xl p-4 relative`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {message.type === 'assistant' && message.model && (
                      <Badge variant="outline" className="mb-2 text-xs border-slate-500 text-slate-400">
                        {message.model}
                      </Badge>
                    )}
                    <p className="text-white whitespace-pre-wrap">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-5 bg-white ml-1 animate-pulse" />
                      )}
                    </p>
                    <p className="text-xs text-slate-300 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {message.type === 'assistant' && message.audioUrl && !message.isStreaming && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(message.audioUrl!)}
                      className="text-slate-400 hover:text-white p-1"
                      disabled={voiceState.isPlaying}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Main Control Button */}
      {!hasReachedLimit && (
        <div className="border-t border-slate-700 p-8">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            {/* Status Text */}
            <div className="text-center mb-6 h-8">
              {voiceState.isProcessing && (
                <p className="text-amber-400 font-medium animate-pulse text-lg">⚡ Processing your voice...</p>
              )}
              {voiceState.isPlaying && !voiceState.isProcessing && (
                <p className="text-green-400 font-medium animate-pulse text-lg">🤖 AI is speaking...</p>
              )}
              {voiceState.isRecording && !voiceState.isProcessing && (
                <p className="text-red-400 font-medium animate-pulse text-lg">🎤 Recording... (will auto-stop when you finish)</p>
              )}
              {voiceState.conversationMode && voiceState.isListening && !voiceState.isRecording && !voiceState.isProcessing && !voiceState.isPlaying && (
                <p className="text-blue-400 font-medium text-lg">👂 Conversation active - listening for your voice...</p>
              )}
              {!voiceState.conversationMode && !voiceState.isRecording && !voiceState.isProcessing && !voiceState.isPlaying && (
                <p className="text-slate-400 text-lg">Press to activate conversation mode</p>
              )}
            </div>

            {/* Large Control Button */}
            <div className="relative mb-6">
              {voiceState.isListening && (
                <>
                  <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-pulse" />
                  <div 
                    className="absolute inset-0 rounded-full bg-blue-400 opacity-30 transition-transform duration-100"
                    style={{
                      transform: `scale(${1 + (voiceState.audioLevel / 100) * 0.3})`
                    }}
                  />
                </>
              )}
              {voiceState.isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-pulse" />
                  <div 
                    className="absolute inset-0 rounded-full bg-red-400 opacity-40 transition-transform duration-100"
                    style={{
                      transform: `scale(${1 + (voiceState.audioLevel / 100) * 0.4})`
                    }}
                  />
                </>
              )}
              
              <Button
                onClick={toggleConversationMode}
                disabled={voiceState.isProcessing}
                className={`w-32 h-32 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 text-white font-semibold text-lg shadow-2xl ${
                  voiceState.isProcessing
                    ? 'bg-amber-600 cursor-not-allowed'
                    : voiceState.conversationMode
                    ? 'bg-red-600 hover:bg-red-700 scale-105'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                }`}
              >
                {voiceState.isProcessing ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                ) : voiceState.conversationMode ? (
                  <div className="flex flex-col items-center">
                    <MicOff className="w-8 h-8 mb-1" />
                    <span className="text-sm">Pause</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Mic className="w-8 h-8 mb-1" />
                    <span className="text-sm">Start</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Audio Control */}
            {voiceState.isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="mb-4"
              >
                <Button
                  onClick={stopAudio}
                  variant="outline"
                  className="border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Audio
                </Button>
              </motion.div>
            )}

            {/* Instructions */}
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-400">
                {voiceState.conversationMode 
                  ? "Conversation mode active • AI listens and responds automatically"
                  : "Press the button to activate conversation mode"
                }
              </p>
              <p className="text-xs text-slate-600">
                {voiceState.conversationMode 
                  ? "Press again to pause • Intelligent model routing for optimal responses"
                  : "Intelligent model routing for optimal responses"
                }
              </p>
            </div>

            {/* Text Input Fallback */}
            <AnimatePresence>
              {showTextFallback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-6 w-full max-w-md"
                >
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-white mb-3">Text Input Fallback</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit(textInput)}
                        placeholder="Type your message here..."
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        disabled={voiceState.isProcessing}
                      />
                      <Button
                        onClick={() => handleTextSubmit(textInput)}
                        disabled={!textInput.trim() || voiceState.isProcessing}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Send
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Use this when voice transcription isn't working
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface
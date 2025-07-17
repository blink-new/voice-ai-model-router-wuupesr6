import { useState, useEffect, useRef, useCallback } from 'react'
import { blink } from './blink/client'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Mic, MicOff, Volume2, Settings, MessageCircle, Pause, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LandingPage from './components/LandingPage'

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
  conversationMode: 'manual' | 'continuous' | 'push-to-talk'
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)
  const [conversationCount, setConversationCount] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isProcessing: false,
    isPlaying: false,
    audioLevel: 0,
    isListening: false,
    conversationMode: 'continuous'
  })
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const [showSettings, setShowSettings] = useState(false)
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [textInput, setTextInput] = useState('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const continuousStreamRef = useRef<MediaStream | null>(null)
  const voiceDetectionRef = useRef<boolean>(false)
  const speechStartTimeRef = useRef<number>(0)

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    
    return unsubscribe
  }, [])

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

  // Define playAudio first to avoid dependency issues
  const playAudio = useCallback(async (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      console.log('🎵 Starting audio playback:', audioUrl)
      
      // Stop any currently playing audio
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
        console.log('⏹️ Audio playback ended')
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      }
      
      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error)
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      }
      
      audio.play().catch((error) => {
        console.error('❌ Audio play failed:', error)
        setVoiceState(prev => ({ ...prev, isPlaying: false }))
        currentAudioRef.current = null
        resolve()
      })
    })
  }, [])

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
      // Create audio blob with better format compatibility
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      console.log('🎵 Audio blob created, size:', audioBlob.size, 'bytes')
      
      if (audioBlob.size < 100) {
        console.log('❌ Audio blob too small, skipping')
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }
      
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        console.log('❌ Invalid audio blob, skipping')
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      // Check authentication before transcription
      if (!user) {
        console.error('❌ User not authenticated')
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      // Transcribe audio with improved error handling
      let text = ''
      
      try {
        console.log('🎯 Starting transcription...')
        
        // Use ArrayBuffer method (most reliable)
        const arrayBuffer = await audioBlob.arrayBuffer()
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Empty audio buffer')
        }

        const result = await blink.ai.transcribeAudio({
          audio: arrayBuffer,
          language: 'en',
          model: 'whisper-1'
        })
        
        text = result.text?.trim() || ''
        console.log('✅ Transcription result:', text)
        
      } catch (transcriptionError) {
        console.error('❌ Transcription failed:', transcriptionError)
        
        // Show user-friendly error message and enable text fallback
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'I\'m having trouble processing your audio right now. This could be due to:\n\n• Network connectivity issues\n• Audio format compatibility\n• Server overload\n\nPlease try again in a moment, or use the text input option below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setShowTextFallback(true)
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }
      
      // If transcription returned empty or very short text
      if (!text || text.length < 2) {
        console.log('❌ Transcription returned empty or very short text')
        
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'I couldn\'t hear you clearly. Please try:\n\n• Speaking louder and more clearly\n• Getting closer to your microphone\n• Reducing background noise\n• Speaking for at least 1-2 seconds\n\nOr use the text input option below.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setShowTextFallback(true)
        setVoiceState(prev => ({ ...prev, isProcessing: false }))
        return
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: text,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])
      console.log('💬 User message added:', text)

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
        console.log('🧠 Generating AI response...')
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
        console.log('✅ AI response generated')
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
        console.log('🔊 Generating speech...')
        const result = await blink.ai.generateSpeech({
          text: responseText,
          voice: 'nova'
        })
        
        const audioUrl = result.url
        console.log('✅ Speech generated:', audioUrl)
        
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

    } catch (error) {
      console.error('❌ Error processing audio:', error)
    } finally {
      setVoiceState(prev => ({ ...prev, isProcessing: false }))
      console.log('✅ Processing complete')
    }
  }, [user, messages, determineOptimalModel, playAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('🛑 Stopping recording...')
      mediaRecorderRef.current.stop()
      setVoiceState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }))
    }
  }, [])

  const startAutomaticRecording = useCallback(async () => {
    if (voiceState.isRecording || voiceState.isProcessing || !continuousStreamRef.current) return
    
    try {
      const stream = continuousStreamRef.current
      
      // Try different audio formats for better compatibility
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }
      
      console.log('🎤 Using audio format:', mimeType)
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      speechStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🎤 Automatic recording stopped, processing...')
        await processRecording()
      }

      mediaRecorder.start()
      setVoiceState(prev => ({ ...prev, isRecording: true }))
      
      // Set maximum recording time (15 seconds for automatic mode)
      const timeout = setTimeout(() => {
        console.log('⏰ Maximum automatic recording time reached, stopping...')
        stopRecording()
      }, 15000)
      
      // Store timeout for cleanup
      mediaRecorder.addEventListener('stop', () => {
        clearTimeout(timeout)
      }, { once: true })
      
    } catch (error) {
      console.error('❌ Error starting automatic recording:', error)
    }
  }, [voiceState.isRecording, voiceState.isProcessing, processRecording, stopRecording])

  const setupContinuousVoiceDetection = useCallback((stream: MediaStream) => {
    try {
      // Create audio context for voice activity detection
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioContext = audioContextRef.current
      
      // Create analyser node
      analyserRef.current = audioContext.createAnalyser()
      const analyser = analyserRef.current
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.8
      
      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      let speechStartTime = 0
      let lastSpeechTime = 0
      let isCurrentlyRecording = false
      
      // More sensitive thresholds for better detection
      const SPEECH_THRESHOLD = 15 // Lower threshold for more sensitivity
      const SPEECH_START_DURATION = 200 // 200ms of speech to start recording
      const SPEECH_END_DURATION = 1200 // 1.2s of silence to stop recording
      const MIN_RECORDING_TIME = 600 // Minimum 600ms recording
      
      const monitorVoiceActivity = () => {
        if (!analyser) return
        
        analyser.getByteFrequencyData(dataArray)
        
        // Calculate RMS (Root Mean Square) for better voice detection
        let sum = 0
        const speechStart = Math.floor(bufferLength * 0.1) // Skip very low frequencies
        const speechEnd = Math.floor(bufferLength * 0.4) // Focus on speech frequencies
        
        for (let i = speechStart; i < speechEnd; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / (speechEnd - speechStart))
        
        // Update audio level for visual feedback
        setVoiceState(prev => ({ ...prev, audioLevel: rms }))
        
        const now = Date.now()
        
        // Check for voice activity
        if (rms > SPEECH_THRESHOLD) {
          if (!voiceDetectionRef.current) {
            // First detection of speech
            speechStartTime = now
            voiceDetectionRef.current = true
            console.log('🗣️ Speech detected, monitoring...')
          }
          lastSpeechTime = now
          
          // Start recording if we've had continuous speech for the threshold duration
          if (!isCurrentlyRecording && (now - speechStartTime) > SPEECH_START_DURATION) {
            console.log('🎤 Starting automatic recording...')
            isCurrentlyRecording = true
            startAutomaticRecording()
          }
        } else {
          // Silence detected
          if (voiceDetectionRef.current && isCurrentlyRecording) {
            const silenceDuration = now - lastSpeechTime
            const recordingDuration = now - speechStartTimeRef.current
            
            // Stop recording if we've had enough silence and minimum recording time
            if (silenceDuration > SPEECH_END_DURATION && recordingDuration > MIN_RECORDING_TIME) {
              console.log('🔇 Silence detected, stopping automatic recording...')
              isCurrentlyRecording = false
              stopRecording()
              voiceDetectionRef.current = false
            }
          } else if (!isCurrentlyRecording) {
            // Reset speech detection if not recording and no speech
            voiceDetectionRef.current = false
          }
        }
        
        // Continue monitoring if still listening
        if (continuousStreamRef.current) {
          requestAnimationFrame(monitorVoiceActivity)
        }
      }
      
      // Start monitoring
      voiceDetectionRef.current = false
      monitorVoiceActivity()
      
    } catch (error) {
      console.error('❌ Error setting up continuous voice detection:', error)
    }
  }, [startAutomaticRecording, stopRecording])

  const startContinuousListening = useCallback(async () => {
    try {
      console.log('🎧 Starting continuous listening mode...')
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support voice recording. Please use a modern browser.')
        return
      }

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
      
      // Set up continuous voice activity detection
      setupContinuousVoiceDetection(stream)
      
      console.log('✅ Continuous listening started')
      
    } catch (error) {
      console.error('❌ Error starting continuous listening:', error)
      
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.')
      } else {
        alert('Error accessing microphone: ' + error.message)
      }
    }
  }, [setupContinuousVoiceDetection])

  const stopContinuousListening = useCallback(() => {
    console.log('🛑 Stopping continuous listening...')
    
    if (continuousStreamRef.current) {
      continuousStreamRef.current.getTracks().forEach(track => track.stop())
      continuousStreamRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setVoiceState(prev => ({ 
      ...prev, 
      isListening: false, 
      audioLevel: 0 
    }))
    
    voiceDetectionRef.current = false
  }, [])

  // Initialize continuous listening when user is available and in chat mode
  useEffect(() => {
    if (user && showChat && voiceState.conversationMode === 'continuous' && !voiceState.isListening) {
      startContinuousListening()
    } else if ((!showChat || voiceState.conversationMode !== 'continuous') && voiceState.isListening) {
      stopContinuousListening()
    }
  }, [user, showChat, voiceState.conversationMode, voiceState.isListening, startContinuousListening, stopContinuousListening])

  const handleStartChat = () => {
    if (conversationCount >= 8) {
      // Show subscription modal or limit message
      return
    }
    setShowChat(true)
    setConversationCount(prev => prev + 1)
  }

  const handleBackToLanding = () => {
    setShowChat(false)
    stopContinuousListening()
  }

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setVoiceState(prev => ({ ...prev, isPlaying: false }))
    }
  }

  const handleTextSubmit = useCallback(async (text: string) => {
    if (!text.trim() || !user) return

    setVoiceState(prev => ({ ...prev, isProcessing: true }))

    try {
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
      setConversationCount(prev => prev + 1)

    } catch (error) {
      console.error('❌ Error processing text input:', error)
    } finally {
      setVoiceState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [user, messages, determineOptimalModel, playAudio])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Orkestra AI...</p>
        </div>
      </div>
    )
  }

  // Show landing page if not in chat mode
  if (!showChat) {
    return (
      <LandingPage 
        user={user} 
        onStartChat={handleStartChat}
        conversationCount={conversationCount}
      />
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
              onClick={handleBackToLanding}
              className="text-slate-400 hover:text-white p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white">Orkestra AI</h1>
            {voiceState.isListening && !voiceState.isRecording && (
              <Badge variant="secondary" className="bg-blue-600 text-white animate-pulse">
                Listening
              </Badge>
            )}
            {voiceState.isRecording && (
              <Badge variant="secondary" className="bg-red-600 text-white animate-pulse">
                Recording
              </Badge>
            )}
            {voiceState.isProcessing && (
              <Badge variant="secondary" className="bg-amber-600 text-white animate-pulse">
                Processing
              </Badge>
            )}
            {voiceState.isPlaying && (
              <Badge variant="secondary" className="bg-green-600 text-white animate-pulse">
                Playing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
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
                  <option value="auto">Auto-Select</option>
                  <option value="gpt-4o-mini">GPT-4O Mini (Fast)</option>
                  <option value="gpt-4o">GPT-4O (Balanced)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Creative)</option>
                </select>
                {(voiceState.isRecording || voiceState.isProcessing) && (
                  <span className="text-xs text-amber-400">Settings locked during processing</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Voice AI is Listening</h2>
              <p className="text-slate-400 mb-4">Just start speaking - no need to click anything!</p>
              <p className="text-sm text-slate-500">
                • Speak naturally - it will automatically detect when you start and stop<br/>
                • AI will respond with both text and voice<br/>
                • Works just like ChatGPT Advanced Voice Mode
              </p>
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

      {/* Voice Status */}
      <div className="border-t border-slate-700 p-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Status Text */}
          <div className="text-center mb-4 h-6">
            {voiceState.isProcessing && (
              <p className="text-amber-400 font-medium animate-pulse">⚡ Processing your voice...</p>
            )}
            {voiceState.isPlaying && !voiceState.isProcessing && (
              <p className="text-green-400 font-medium animate-pulse">🤖 AI is speaking...</p>
            )}
            {voiceState.isRecording && !voiceState.isProcessing && (
              <p className="text-red-400 font-medium animate-pulse">🎤 Recording... (will auto-stop when you finish)</p>
            )}
            {voiceState.isListening && !voiceState.isRecording && !voiceState.isProcessing && !voiceState.isPlaying && (
              <p className="text-blue-400 font-medium">👂 Listening for your voice...</p>
            )}
            {!voiceState.isListening && !voiceState.isRecording && !voiceState.isProcessing && !voiceState.isPlaying && (
              <p className="text-slate-400">Starting continuous listening...</p>
            )}
          </div>

          {/* Visual Indicator */}
          <div className="relative mb-4">
            {voiceState.isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-pulse" />
                {/* Audio level visualization */}
                <div 
                  className="absolute inset-0 rounded-full bg-blue-400 opacity-30 transition-transform duration-100"
                  style={{
                    transform: `scale(${1 + (voiceState.audioLevel / 100) * 0.5})`
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
                    transform: `scale(${1 + (voiceState.audioLevel / 100) * 0.6})`
                  }}
                />
              </>
            )}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
              voiceState.isRecording
                ? 'bg-red-600 scale-110'
                : voiceState.isListening
                ? 'bg-blue-600'
                : 'bg-slate-600'
            }`}>
              {voiceState.isProcessing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : voiceState.isRecording ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </div>
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
            <p className="text-xs text-slate-500">
              Continuous listening active • Just start speaking naturally
            </p>
            <p className="text-xs text-slate-600">
              Works like ChatGPT Advanced Voice Mode - no buttons needed!
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
    </div>
  )
}

export default App
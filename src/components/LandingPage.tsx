import { useState } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { 
  Mic, 
  Brain, 
  Zap, 
  MessageCircle, 
  Star, 
  ArrowRight, 
  Check,
  Sparkles,
  Bot,
  Users,
  Shield
} from 'lucide-react'
import { motion } from 'framer-motion'
import { blink } from '../blink/client'

interface LandingPageProps {
  user: any
  onStartChat: () => void
  conversationCount: number
}

const LandingPage = ({ user, onStartChat, conversationCount }: LandingPageProps) => {
  const [hoveredModel, setHoveredModel] = useState<string | null>(null)

  const models = [
    {
      id: 'gpt-4o',
      name: 'GPT-4O',
      description: 'Best for strategic thinking, decision-making, and complex analysis',
      color: 'from-green-500 to-emerald-600',
      icon: '🧠',
      examples: ['Analyze market trends', 'Strategic planning advice', 'Complex problem solving']
    },
    {
      id: 'claude',
      name: 'Claude 3.5 Sonnet',
      description: 'Excels at communication, presentations, and nuanced discussions',
      color: 'from-purple-500 to-violet-600',
      icon: '✍️',
      examples: ['Draft important emails', 'Presentation feedback', 'Negotiation strategies']
    },
    {
      id: 'gemini',
      name: 'Gemini Pro',
      description: 'Real-time Google data access for flights, news, and current information',
      color: 'from-blue-500 to-cyan-600',
      icon: '🔍',
      examples: ['Find flight prices', 'Latest industry news', 'Real-time market data']
    }
  ]

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: 'Intelligent Routing',
      description: 'AI automatically selects the best model for your specific question'
    },
    {
      icon: <Mic className="w-6 h-6" />,
      title: 'Voice-First Experience',
      description: 'Natural conversations with voice-to-text and text-to-speech'
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: 'Conversation Memory',
      description: 'Save and revisit your important AI conversations'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description: 'Optimized routing delivers faster responses than single models'
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Product Manager',
      content: 'Orkestra AI has transformed how I work. The intelligent routing means I always get the best response.',
      avatar: '👩‍💼'
    },
    {
      name: 'Marcus Rodriguez',
      role: 'Software Engineer',
      content: 'The voice interface is incredible. It feels like having a conversation with the smartest AI assistant.',
      avatar: '👨‍💻'
    },
    {
      name: 'Dr. Emily Watson',
      role: 'Researcher',
      content: 'Finally, an AI that knows which model to use for different types of questions. Game-changer.',
      avatar: '👩‍🔬'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Orkestra AI</h1>
                <p className="text-xs text-slate-400">Intelligent Conversations</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                    {conversationCount}/8 free conversations
                  </Badge>
                  <Button 
                    onClick={onStartChat}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Start Conversation
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => blink.auth.login()}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-600/10 blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-indigo-600/20 text-indigo-300 border-indigo-500/30">
                <Sparkles className="w-4 h-4 mr-2" />
                Next-Generation AI Platform
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                Human Conversations
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  with AI
                </span>
              </h1>
              
              <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Orkestra AI intelligently routes your prompts to the most suitable large language model, 
                delivering faster and more accurate responses through natural voice conversations.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {user ? (
                  <Button 
                    onClick={onStartChat}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-4 h-auto"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Voice Conversation
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => blink.auth.login()}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-4 h-auto"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Try Free Now
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                )}
                
                <div className="flex items-center gap-2 text-slate-400">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">8 free conversations • No credit card required</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Model Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                Intelligent Model Routing
              </h2>
              <p className="text-slate-400 text-lg">
                Our AI automatically selects the best model for your specific question
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {models.map((model, index) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                  onHoverStart={() => setHoveredModel(model.id)}
                  onHoverEnd={() => setHoveredModel(null)}
                >
                  <Card className={`p-6 bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 ${
                    hoveredModel === model.id ? 'transform scale-105' : ''
                  }`}>
                    <div className={`w-12 h-12 bg-gradient-to-r ${model.color} rounded-lg flex items-center justify-center mb-4 text-2xl`}>
                      {model.icon}
                    </div>
                    
                    <h3 className="text-xl font-semibold text-white mb-2">{model.name}</h3>
                    <p className="text-slate-400 mb-4">{model.description}</p>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-300">Perfect for:</p>
                      {model.examples.map((example, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                          <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                          "{example}"
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Choose Orkestra AI?
            </h2>
            <p className="text-xl text-slate-400">
              Experience the future of AI conversations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                viewport={{ once: true }}
              >
                <Card className="p-6 bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 hover:transform hover:scale-105">
                  <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-4 text-indigo-400">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Loved by Professionals
            </h2>
            <p className="text-xl text-slate-400">
              See what our users are saying
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                viewport={{ once: true }}
              >
                <Card className="p-6 bg-slate-800/50 border-slate-700">
                  <div className="flex items-center gap-2 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  <p className="text-slate-300 mb-4 italic">"{testimonial.content}"</p>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{testimonial.avatar}</div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-sm text-slate-400">{testimonial.role}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-400">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className="p-8 bg-slate-800/50 border-slate-700">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Free Trial</h3>
                <div className="text-4xl font-bold text-white mb-2">$0</div>
                <p className="text-slate-400">Perfect for trying out Orkestra AI</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">8 free conversations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">All AI models included</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Voice-to-text & text-to-speech</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Conversation saving</span>
                </li>
              </ul>
              
              {user ? (
                <Button 
                  onClick={onStartChat}
                  className="w-full bg-slate-700 hover:bg-slate-600"
                  disabled={conversationCount >= 8}
                >
                  {conversationCount >= 8 ? 'Free Limit Reached' : 'Start Free Trial'}
                </Button>
              ) : (
                <Button 
                  onClick={() => blink.auth.login()}
                  className="w-full bg-slate-700 hover:bg-slate-600"
                >
                  Start Free Trial
                </Button>
              )}
            </Card>

            {/* Pro Plan */}
            <Card className="p-8 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/50 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-indigo-600 text-white">Most Popular</Badge>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                <div className="text-4xl font-bold text-white mb-2">$99<span className="text-lg text-slate-400">/month</span></div>
                <p className="text-slate-400">Unlimited conversations for professionals</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Unlimited conversations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Priority model access</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Advanced conversation history</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">Premium support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-slate-300">API access (coming soon)</span>
                </li>
              </ul>
              
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                Upgrade to Pro
              </Button>
            </Card>
          </div>


        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Experience the Future of AI?
            </h2>
            <p className="text-xl text-slate-400 mb-8">
              Join thousands of professionals who trust Orkestra AI for their most important conversations.
            </p>
            
            {user ? (
              <Button 
                onClick={onStartChat}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-4 h-auto"
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Your First Conversation
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => blink.auth.login()}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-4 h-auto"
              >
                <Mic className="w-5 h-5 mr-2" />
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Orkestra AI</h3>
                <p className="text-xs text-slate-400">Intelligent Conversations</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>© 2024 Orkestra AI</span>
              <span>•</span>
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
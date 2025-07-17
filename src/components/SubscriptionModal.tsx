import { useState } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { 
  X, 
  Check, 
  Sparkles, 
  Crown,
  Gift
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  conversationCount: number
}

const SubscriptionModal = ({ isOpen, onClose, conversationCount }: SubscriptionModalProps) => {
  const [referralCode, setReferralCode] = useState('')
  const [isValidatingCode, setIsValidatingCode] = useState(false)
  const [codeError, setCodeError] = useState('')

  const validateReferralCode = async () => {
    if (!referralCode.trim()) return

    setIsValidatingCode(true)
    setCodeError('')

    // Check if code is in ORKES1-ORKES100 range
    const codeMatch = referralCode.match(/^ORKES(\d+)$/i)
    
    if (codeMatch) {
      const codeNumber = parseInt(codeMatch[1])
      if (codeNumber >= 1 && codeNumber <= 100) {
        // Valid code - grant lifetime free access
        setTimeout(() => {
          alert('🎉 Congratulations! Your referral code is valid. You now have lifetime free access to Orkestra AI!')
          localStorage.setItem('orkestra_lifetime_access', 'true')
          localStorage.setItem('orkestra_referral_code', referralCode)
          setIsValidatingCode(false)
          onClose()
          // Reload to apply changes
          window.location.reload()
        }, 1500)
        return
      }
    }

    // Invalid code
    setTimeout(() => {
      setCodeError('Invalid referral code. Please check and try again.')
      setIsValidatingCode(false)
    }, 1500)
  }

  const handleUpgrade = () => {
    // In a real app, this would integrate with Stripe
    alert('Stripe integration would be implemented here for $99/month subscription.')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-2xl"
          >
            <Card className="bg-slate-800 border-slate-700 p-8 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  You've Used All Free Conversations
                </h2>
                <p className="text-slate-400">
                  You've completed {conversationCount} conversations. Choose how to continue:
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Referral Code Option */}
                <Card className="p-6 bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/50">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Have a Referral Code?</h3>
                    <p className="text-slate-400 text-sm">
                      Use codes ORKES1-ORKES100 for lifetime free access
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Enter referral code (e.g., ORKES42)"
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
                        disabled={isValidatingCode}
                      />
                      {codeError && (
                        <p className="text-red-400 text-sm mt-2">{codeError}</p>
                      )}
                    </div>

                    <Button
                      onClick={validateReferralCode}
                      disabled={!referralCode.trim() || isValidatingCode}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {isValidatingCode ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Validating...
                        </>
                      ) : (
                        'Activate Lifetime Access'
                      )}
                    </Button>

                    <div className="text-center">
                      <Badge className="bg-green-600/20 text-green-300 border-green-500/30">
                        <Gift className="w-3 h-3 mr-1" />
                        Lifetime Free Access
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* Pro Subscription Option */}
                <Card className="p-6 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/50">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Crown className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h3>
                    <div className="text-3xl font-bold text-white mb-1">
                      $99<span className="text-lg text-slate-400">/month</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      Unlimited conversations for professionals
                    </p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">Unlimited conversations</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">Priority model access</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">Advanced conversation history</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">Premium support</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">API access (coming soon)</span>
                    </li>
                  </ul>

                  <Button
                    onClick={handleUpgrade}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Button>

                  <div className="text-center mt-3">
                    <Badge className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30">
                      Most Popular
                    </Badge>
                  </div>
                </Card>
              </div>

              <div className="text-center">
                <p className="text-slate-500 text-sm">
                  Questions? Contact us at{' '}
                  <a href="mailto:support@orkestra.ai" className="text-indigo-400 hover:text-indigo-300">
                    support@orkestra.ai
                  </a>
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default SubscriptionModal
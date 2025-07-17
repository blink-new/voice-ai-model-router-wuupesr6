import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'voice-ai-model-router-wuupesr6',
  authRequired: true
})

// Disable analytics to prevent network errors
if (blink.analytics && blink.analytics.disable) {
  blink.analytics.disable()
}
import { ref, onUnmounted } from 'vue'

export function useVoiceInput() {
  const isListening = ref(false)
  const transcript = ref('')
  const isSupported = ref(false)
  const error = ref(null)

  let recognition = null

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  isSupported.value = !!SpeechRecognition

  if (SpeechRecognition) {
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      transcript.value = final + interim
    }

    recognition.onerror = (event) => {
      error.value = event.error
      isListening.value = false
    }

    recognition.onend = () => {
      isListening.value = false
    }
  }

  function start() {
    if (!recognition) return
    transcript.value = ''
    error.value = null
    isListening.value = true
    recognition.start()
  }

  function stop() {
    if (!recognition) return
    recognition.stop()
    isListening.value = false
  }

  onUnmounted(() => {
    if (recognition) {
      recognition.abort()
    }
  })

  return { isListening, transcript, isSupported, error, start, stop }
}

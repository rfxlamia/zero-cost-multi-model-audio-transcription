'use client'

import { useState } from 'react'

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787')

  const handleStartRecording = () => {
    setIsRecording(!isRecording)
    // TODO: Implement recording functionality
    console.log('Recording toggled:', !isRecording)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      console.log('File selected:', file.name)
      // TODO: Implement file upload
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            TranscriptorAI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Transkripsi suara ke teks Bahasa Indonesia dengan AI correction
          </p>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            ✨ Zero-cost • Free tier providers
          </div>
        </div>

        {/* Main Features */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-16">
          {/* Recorder Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🎤 Rekam Audio
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Rekam langsung dari browser Anda, maksimal 10 menit
            </p>
            <button
              onClick={handleStartRecording}
              className={`w-full py-4 px-6 rounded-xl font-medium transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </button>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Shortcut: Tekan R untuk toggle recording
            </div>
          </div>

          {/* Uploader Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              📁 Upload Audio
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Drag & drop atau pilih file audio (max 100MB)
            </p>
            <label className="block w-full">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-full py-4 px-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer text-center transition-colors">
                <span className="text-gray-600 dark:text-gray-300">
                  📤 Click to upload atau drag file di sini
                </span>
              </div>
            </label>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Format: MP3, WAV, M4A, FLAC
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-16">
          <div className="text-center p-6">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Progressive Enhancement
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Quick correction → Enhanced correction secara bertahap
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-3xl mb-4">🔄</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Multi-Provider Fallback
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Groq → HuggingFace → Together → Cohere → Local
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Smart Batching
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              5 segments per request untuk efisiensi quota
            </p>
          </div>
        </div>

        {/* API Status */}
        <div className="max-w-2xl mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🔗 API Status
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Worker API:</span>
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm">
              {apiBase}
            </code>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Status akan ditampilkan real-time di dashboard
          </div>
        </div>
      </div>
    </div>
  )
}

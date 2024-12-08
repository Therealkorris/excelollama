/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434'
  }
}

module.exports = nextConfig 
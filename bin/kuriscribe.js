#!/usr/bin/env node

import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const port = process.env.PORT || '3000'

console.log('\x1b[36m%s\x1b[0m', '⚡ Iniciando KuriScribe...')
console.log('\x1b[33m%s\x1b[0m', `🌐 Servidor disponible en: http://localhost:${port}`)

// Spawn python backend with PORT environment variable
const serverProcess = spawn('python', ['server.py'], {
  cwd: rootDir,
  env: { ...process.env, PORT: port },
  stdio: 'inherit',
})

serverProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error ejecutando Python:', err.message)
  console.log('Asegúrate de tener Python 3 instalado en tu sistema con "pip install -r requirements.txt".')
  process.exit(1)
})

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.log(`Proceso terminado con código ${code}`)
  }
})

// Graceful exit
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM')
  process.exit(0)
})

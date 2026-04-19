process.env.APP_RUNTIME = process.env.APP_RUNTIME || 'cloudfunction'
process.env.PORT = process.env.PORT || process.env.HTTP_FUNCTION_PORT || '9000'

const { bootstrapHttpServer, getHttpPort } = require('./dist/bootstrap')

async function start() {
  const port = getHttpPort()

  console.log(
    `[backend-http] starting Nest HTTP function on port ${port}, env=${process.env.NODE_ENV || 'production'}`,
  )

  await bootstrapHttpServer(port)

  console.log(`[backend-http] Nest HTTP function is ready on port ${port}.`)
}

void start().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error'
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[backend-http] failed to start: ${message}`)

  if (stack) {
    console.error(stack)
  }

  process.exit(1)
})

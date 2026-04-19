import { Logger } from '@nestjs/common'
import { bootstrapHttpServer, getHttpPort } from './bootstrap'

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap')
  const port = getHttpPort()

  bootstrapLogger.log(
    `Starting backend service (runtime=local, env=${process.env.NODE_ENV || 'development'}, port=${port})`,
  )

  await bootstrapHttpServer(port)
  bootstrapLogger.log(`Backend service is listening on port ${port}.`)
}

void bootstrap().catch((error: unknown) => {
  const bootstrapLogger = new Logger('Bootstrap')
  const message = error instanceof Error ? error.message : 'Unknown startup error'
  const stack = error instanceof Error ? error.stack : undefined

  bootstrapLogger.error(`Backend service failed to start: ${message}`, stack)
  process.exit(1)
})

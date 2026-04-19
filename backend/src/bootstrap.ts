import 'reflect-metadata'
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const DEFAULT_HTTP_FUNCTION_PORT = 9000
const DEFAULT_LOCAL_PORT = 3000

type BootstrapState = {
  appPromise?: Promise<INestApplication>
  listenPort?: number
  listenPromise?: Promise<INestApplication>
}

const bootstrapStateHolder = globalThis as typeof globalThis & {
  __pokerBookkeepingBootstrapState__?: BootstrapState
}

const readPositiveInt = (rawValue: string | undefined, fallback: number) => {
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.floor(parsedValue)
}

const getBootstrapState = () => {
  if (!bootstrapStateHolder.__pokerBookkeepingBootstrapState__) {
    bootstrapStateHolder.__pokerBookkeepingBootstrapState__ = {}
  }

  return bootstrapStateHolder.__pokerBookkeepingBootstrapState__
}

const configureApp = (app: INestApplication) => {
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
}

export const getAppRuntime = () => process.env.APP_RUNTIME || 'local'

export const getHttpPort = () => {
  const runtimeDefaultPort =
    getAppRuntime() === 'cloudfunction' ? DEFAULT_HTTP_FUNCTION_PORT : DEFAULT_LOCAL_PORT

  return readPositiveInt(
    process.env.PORT,
    readPositiveInt(process.env.HTTP_FUNCTION_PORT, runtimeDefaultPort),
  )
}

export async function createApp() {
  const bootstrapState = getBootstrapState()

  if (!bootstrapState.appPromise) {
    bootstrapState.appPromise = (async () => {
      const bootstrapLogger = new Logger('Bootstrap')
      const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
      })

      configureApp(app)

      bootstrapLogger.log(
        `Nest application created (runtime=${getAppRuntime()}, env=${process.env.NODE_ENV || 'development'})`,
      )

      return app
    })().catch((error: unknown) => {
      bootstrapState.appPromise = undefined
      throw error
    })
  }

  return bootstrapState.appPromise
}

export async function bootstrapHttpServer(port = getHttpPort()) {
  const bootstrapLogger = new Logger('Bootstrap')
  const bootstrapState = getBootstrapState()

  if (bootstrapState.listenPromise) {
    if (bootstrapState.listenPort && bootstrapState.listenPort !== port) {
      bootstrapLogger.warn(
        `Nest application is already listening on port ${bootstrapState.listenPort}, ignoring requested port ${port}.`,
      )
    }

    return bootstrapState.listenPromise
  }

  bootstrapState.listenPort = port
  bootstrapState.listenPromise = (async () => {
    const app = await createApp()

    await app.listen(port, '0.0.0.0')

    bootstrapLogger.log(
      `Nest application is listening on port ${port} (runtime=${getAppRuntime()}, env=${process.env.NODE_ENV || 'development'}).`,
    )

    return app
  })().catch((error: unknown) => {
    bootstrapState.listenPromise = undefined
    bootstrapState.listenPort = undefined
    throw error
  })

  return bootstrapState.listenPromise
}

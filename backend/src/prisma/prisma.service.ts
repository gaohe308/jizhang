import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '../../generated/client/index'

const DEFAULT_MYSQL_PORT = '3306'
const DEFAULT_CONNECT_TIMEOUT_MS = 8000
const DEFAULT_CONNECT_MAX_RETRIES = 5
const DEFAULT_CONNECT_RETRY_DELAY_MS = 3000

type DatabaseTarget = {
  database: string
  host: string
  port: string
  protocol: string
}

type SharedConnectionState = {
  connected: boolean
  connectPromise: Promise<void> | null
  lastConnectionError: string | null
}

const RETRYABLE_PRISMA_ERROR_CODES = new Set(['P1001', 'P1017'])

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error'
}

const getPrismaErrorCode = (error: unknown) => {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return null
}

const isRetryablePrismaConnectivityError = (error: unknown) => {
  const code = getPrismaErrorCode(error)
  if (code && RETRYABLE_PRISMA_ERROR_CODES.has(code)) {
    return true
  }

  const message = toErrorMessage(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('Server has closed the connection') ||
    message.includes('Connection terminated unexpectedly')
  )
}

const normalizeDatabaseUrl = (databaseUrl?: string) => {
  if (!databaseUrl) {
    return undefined
  }

  try {
    const parsedUrl = new URL(databaseUrl)
    parsedUrl.searchParams.delete('sslaccept')
    return parsedUrl.toString()
  } catch {
    return databaseUrl
  }
}

const parseDatabaseTarget = (databaseUrl?: string): DatabaseTarget | null => {
  if (!databaseUrl) {
    return null
  }

  try {
    const url = new URL(databaseUrl)

    return {
      protocol: url.protocol.replace(/:$/, ''),
      host: url.hostname || 'unknown-host',
      port: url.port || DEFAULT_MYSQL_PORT,
      database: url.pathname.replace(/^\//, '') || 'unknown-database',
    }
  } catch {
    return null
  }
}

const prismaStateHolder = globalThis as typeof globalThis & {
  __pokerBookkeepingPrismaState__?: SharedConnectionState
}

const getSharedConnectionState = () => {
  if (!prismaStateHolder.__pokerBookkeepingPrismaState__) {
    prismaStateHolder.__pokerBookkeepingPrismaState__ = {
      connected: false,
      connectPromise: null,
      lastConnectionError: null,
    }
  }

  return prismaStateHolder.__pokerBookkeepingPrismaState__
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private readonly runtime = process.env.APP_RUNTIME || 'local'
  private readonly normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)
  private readonly connectTimeoutMs = this.readPositiveInt(
    process.env.PRISMA_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
  )
  private readonly connectMaxRetries = this.readPositiveInt(
    process.env.PRISMA_CONNECT_MAX_RETRIES,
    DEFAULT_CONNECT_MAX_RETRIES,
  )
  private readonly connectRetryDelayMs = this.readPositiveInt(
    process.env.PRISMA_CONNECT_RETRY_DELAY_MS,
    DEFAULT_CONNECT_RETRY_DELAY_MS,
  )
  private readonly databaseTarget = parseDatabaseTarget(this.normalizedDatabaseUrl)
  private readonly sharedConnectionState = getSharedConnectionState()

  private connected = false
  private lastConnectionError: string | null = null

  constructor() {
    super(
      process.env.DATABASE_URL
        ? {
            datasources: {
              db: {
                url: normalizeDatabaseUrl(process.env.DATABASE_URL),
              },
            },
          }
        : undefined,
    )
  }

  async onModuleInit() {
    if (!this.normalizedDatabaseUrl) {
      this.lastConnectionError = 'DATABASE_URL is not set'
      this.sharedConnectionState.lastConnectionError = this.lastConnectionError
      this.logger.error('DATABASE_URL is not set. Refusing to start without a database target.')
      throw new Error(this.lastConnectionError)
    }

    if (this.sharedConnectionState.connected) {
      this.connected = true
      this.lastConnectionError = this.sharedConnectionState.lastConnectionError

      this.logger.log(
        `Reusing existing Prisma connection state for ${this.formatDatabaseTarget()} (runtime=${this.runtime}).`,
      )
      return
    }

    this.logger.log(
      `Connecting to database ${this.formatDatabaseTarget()} (runtime=${this.runtime}, timeout=${this.connectTimeoutMs}ms, retries=${this.connectMaxRetries}, retryDelay=${this.connectRetryDelayMs}ms)`,
    )

    if (!this.sharedConnectionState.connectPromise) {
      this.sharedConnectionState.connectPromise = this.establishConnection().catch((error: unknown) => {
        this.sharedConnectionState.connectPromise = null
        throw error
      })
    }

    try {
      await this.sharedConnectionState.connectPromise
      this.connected = true
      this.lastConnectionError = this.sharedConnectionState.lastConnectionError
    } catch (error) {
      this.connected = false
      this.lastConnectionError = toErrorMessage(error)
      this.sharedConnectionState.lastConnectionError = this.lastConnectionError
      throw error
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect()
      this.connected = false
      this.sharedConnectionState.connected = false
      this.sharedConnectionState.connectPromise = null
    }
  }

  getDiagnostics() {
    return {
      connected: this.connected,
      runtime: this.runtime,
      target: this.formatDatabaseTarget(),
      connectTimeoutMs: this.connectTimeoutMs,
      connectMaxRetries: this.connectMaxRetries,
      connectRetryDelayMs: this.connectRetryDelayMs,
      lastConnectionError: this.lastConnectionError,
    }
  }

  async runWithReconnect<T>(operationName: string, operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      if (!isRetryablePrismaConnectivityError(error)) {
        throw error
      }

      const errorMessage = toErrorMessage(error)
      this.logger.warn(
        `Prisma operation ${operationName} failed with a retryable connectivity error. Retrying once after reconnect. Error: ${errorMessage}`,
      )

      await this.forceReconnect(operationName, errorMessage)
      return operation()
    }
  }

  private async connectWithTimeout() {
    let timeoutHandle: NodeJS.Timeout | undefined

    try {
      await Promise.race([
        this.$connect(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new Error(
                `Timed out after ${this.connectTimeoutMs}ms while connecting to ${this.formatDatabaseTarget()}`,
              ),
            )
          }, this.connectTimeoutMs)
        }),
      ])
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }
  }

  private async establishConnection() {
    for (let attempt = 1; attempt <= this.connectMaxRetries; attempt += 1) {
      try {
        await this.connectWithTimeout()
        this.connected = true
        this.lastConnectionError = null
        this.sharedConnectionState.connected = true
        this.sharedConnectionState.lastConnectionError = null

        this.logger.log(
          `Connected to database ${this.formatDatabaseTarget()} on attempt ${attempt}/${this.connectMaxRetries}.`,
        )
        return
      } catch (error) {
        this.connected = false
        this.sharedConnectionState.connected = false
        this.lastConnectionError = toErrorMessage(error)
        this.sharedConnectionState.lastConnectionError = this.lastConnectionError

        this.logger.error(
          `Database connection attempt ${attempt}/${this.connectMaxRetries} failed for ${this.formatDatabaseTarget()}: ${this.lastConnectionError}`,
        )

        if (attempt < this.connectMaxRetries) {
          await sleep(this.connectRetryDelayMs)
        }
      }
    }

    throw new Error(
      `Unable to connect to database ${this.formatDatabaseTarget()} after ${this.connectMaxRetries} attempts. Last error: ${this.lastConnectionError}`,
    )
  }

  private async forceReconnect(operationName: string, errorMessage: string) {
    this.connected = false
    this.lastConnectionError = errorMessage
    this.sharedConnectionState.connected = false
    this.sharedConnectionState.lastConnectionError = errorMessage
    this.sharedConnectionState.connectPromise = null

    try {
      await this.$disconnect()
    } catch (disconnectError) {
      this.logger.warn(
        `Prisma disconnect before reconnect for ${operationName} failed: ${toErrorMessage(disconnectError)}`,
      )
    }

    this.logger.log(`Reconnecting Prisma before retrying ${operationName}.`)

    this.sharedConnectionState.connectPromise = this.establishConnection().catch((error: unknown) => {
      this.sharedConnectionState.connectPromise = null
      throw error
    })

    try {
      await this.sharedConnectionState.connectPromise
      this.connected = true
      this.lastConnectionError = this.sharedConnectionState.lastConnectionError
    } catch (error) {
      this.connected = false
      this.lastConnectionError = toErrorMessage(error)
      this.sharedConnectionState.lastConnectionError = this.lastConnectionError
      throw error
    }
  }

  private formatDatabaseTarget() {
    if (this.databaseTarget) {
      const { protocol, host, port, database } = this.databaseTarget
      return `${protocol}://${host}:${port}/${database}`
    }

    return 'invalid DATABASE_URL'
  }

  private readPositiveInt(rawValue: string | undefined, fallback: number) {
    if (!rawValue) {
      return fallback
    }

    const parsedValue = Number(rawValue)
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return fallback
    }

    return Math.floor(parsedValue)
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'

type ErrorResponseBody = {
  error?: string
  message: string | string[]
  statusCode: number
}

type HttpRequestLike = {
  method?: string
  originalUrl?: string
  url?: string
}

type HttpResponseLike = {
  status: (statusCode: number) => {
    json: (body: ErrorResponseBody) => void
  }
}

const toErrorResponseBody = (exception: unknown): ErrorResponseBody => {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus()
    const response = exception.getResponse()

    if (typeof response === 'object' && response !== null) {
      return {
        message:
          'message' in response
            ? (response as { message: string | string[] }).message
            : exception.message,
        error: 'error' in response ? String((response as { error: unknown }).error) : undefined,
        statusCode,
      }
    }

    return {
      message: String(response || exception.message),
      error: exception.name,
      statusCode,
    }
  }

  return {
    message: exception instanceof Error ? exception.message : 'Internal server error',
    error: 'Internal Server Error',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  }
}

@Catch()
export class CloudBaseHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CloudBaseHttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<HttpRequestLike>()
    const response = context.getResponse<HttpResponseLike>()
    const body = toErrorResponseBody(exception)

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined
      this.logger.error(
        `${request.method} ${request.originalUrl || request.url} failed: ${body.message}`,
        stack,
      )
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl || request.url} rejected: ${body.message}`,
      )
    }

    response.status(HttpStatus.OK).json(body)
  }
}

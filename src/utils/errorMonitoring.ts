type ErrorContext = {
  area: string;
  message?: string;
  details?: Record<string, unknown>;
};

type WindowWithErrorMonitorFlag = Window & {
  __qaTrackerErrorHandlersAttached__?: boolean;
};

function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unexpected application error.',
    stack: undefined,
  };
}

export function reportAppError(error: unknown, context: ErrorContext) {
  const payload = toErrorPayload(error);

  console.error('[qa-tracker]', {
    area: context.area,
    contextMessage: context.message,
    details: context.details,
    error: payload,
  });
}

export function attachGlobalErrorHandlers() {
  if (typeof window === 'undefined') {
    return;
  }

  const monitoredWindow = window as WindowWithErrorMonitorFlag;
  if (monitoredWindow.__qaTrackerErrorHandlersAttached__) {
    return;
  }

  monitoredWindow.__qaTrackerErrorHandlersAttached__ = true;

  window.addEventListener('error', event => {
    reportAppError(event.error ?? event.message, {
      area: 'window.error',
      message: 'Unhandled runtime error reached the browser boundary.',
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', event => {
    reportAppError(event.reason, {
      area: 'window.unhandledrejection',
      message: 'Unhandled promise rejection reached the browser boundary.',
    });
  });
}

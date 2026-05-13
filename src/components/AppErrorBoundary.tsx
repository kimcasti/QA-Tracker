import React, { type ReactNode } from 'react';
import { Alert, Button, Result, Space, Typography } from 'antd';
import { reportAppError } from '../utils/errorMonitoring';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage?: string;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: undefined,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportAppError(error, {
      area: 'app.error-boundary',
      message: 'A rendering error escaped to the global application boundary.',
      details: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-3xl">
          <Result
            status="error"
            title="No pudimos seguir cargando QA Tracker"
            subTitle="La aplicacion encontro un error inesperado. Puedes recargar la pagina para reintentar."
            extra={
              <Space>
                <Button type="primary" onClick={this.handleReload}>
                  Recargar
                </Button>
              </Space>
            }
          >
            <Alert
              type="error"
              showIcon
              message="Detalle tecnico"
              description={
                <Typography.Text code>
                  {this.state.errorMessage || 'Unexpected application error.'}
                </Typography.Text>
              }
            />
          </Result>
        </div>
      </div>
    );
  }
}

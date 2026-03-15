import React, { type ReactNode } from 'react';
import { Alert, Button, Result, Space, Typography } from 'antd';

type StoryMapErrorBoundaryProps = {
  children: ReactNode;
  onRetry?: () => void;
};

type StoryMapErrorBoundaryState = {
  hasError: boolean;
  errorMessage?: string;
};

export class StoryMapErrorBoundary extends React.Component<
  StoryMapErrorBoundaryProps,
  StoryMapErrorBoundaryState
> {
  state: StoryMapErrorBoundaryState = {
    hasError: false,
    errorMessage: undefined,
  };

  static getDerivedStateFromError(error: Error): StoryMapErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected Story Map error.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Story Map boundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Result
        status="warning"
        title="No pudimos renderizar el Story Map"
        subTitle="La vista falló al procesar una tarjeta o una relación. Puedes reintentar sin perder el resto del proyecto."
        extra={
          <Space>
            <Button type="primary" onClick={this.handleRetry}>
              Reintentar
            </Button>
          </Space>
        }
      >
        <div className="mx-auto max-w-2xl">
          <Alert
            type="warning"
            showIcon
            message="Detalle técnico"
            description={
              <Typography.Text code>{this.state.errorMessage || 'Unknown error'}</Typography.Text>
            }
          />
        </div>
      </Result>
    );
  }
}

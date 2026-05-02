import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches React render errors and shows a recoverable UI instead of a blank page.
 * Wrap layout sections that depend on external state (WebSocket, stores) with this.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive">Algo salió mal</p>
            <p className="text-xs text-muted-foreground mt-1">{this.state.error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Global ErrorBoundary – catches unhandled rendering errors.
 * Displays a friendly "Oups" screen with a reload button.
 *
 * Can also be used per-route by wrapping individual route elements:
 *   <Route element={<ErrorBoundary><Page /></ErrorBoundary>} />
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // Use t prop if available, otherwise fall back to French defaults
      // (context may be broken when ErrorBoundary catches)
      const t = this.props.t || ((key, _params, fallback) => fallback || key);
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <span className="error-boundary__icon" role="img" aria-label={t('error.icon_label', {}, 'bug')}>🐛</span>
            <h2 className="error-boundary__title">{t('error.title', {}, 'Oups !')}</h2>
            <p className="error-boundary__message">
              {t('error.message', {}, 'Quelque chose s\'est mal passé.')}
            </p>
            <button
              className="error-boundary__button"
              onClick={this.handleReload}
              type="button"
            >
              {t('error.reload', {}, 'Recharger')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

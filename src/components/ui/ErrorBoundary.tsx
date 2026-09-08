import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] React app crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-red-900/20 dark:via-secondary-900 dark:to-orange-900/20 flex items-center justify-center p-6">
          <div className="max-w-lg w-full card p-8 shadow-large text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full mb-6 shadow-glow">
              <AlertTriangle className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-secondary-300 mb-2">
              The app ran into an unexpected issue. Please try the steps below.
            </p>

            <div className="mt-6 p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl text-left space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="inline-block w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0">1</span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-red-200">Check Environment Variables</p>
                  <p className="text-gray-600 dark:text-secondary-300">
                    In Vercel → Project → <strong>Settings → Environment Variables</strong>, confirm these are set:
                  </p>
                  <ul className="mt-1 list-disc list-inside font-mono text-xs bg-white/60 dark:bg-black/20 p-2 rounded-lg">
                    <li>VITE_SUPABASE_URL</li>
                    <li>VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                    After adding/changing vars, you must <strong>Redeploy</strong> (not just refresh).
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <span className="inline-block w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0">2</span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-orange-200">Check Vercel Build Logs</p>
                  <p className="text-gray-600 dark:text-secondary-300">
                    Go to <strong>Vercel → Deployments</strong>, click the latest build → <strong>Build Logs</strong> and look for any <code className="bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">ERROR</code> messages.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <span className="inline-block w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0">3</span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-yellow-200">Open Browser Console</p>
                  <p className="text-gray-600 dark:text-secondary-300">
                    Press <kbd className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded border text-xs">F12</kbd> → <strong>Console</strong> tab and check red error messages.
                  </p>
                </div>
              </div>
            </div>

            {this.state.error && (
              <details className="mt-5 text-left">
                <summary className="text-xs font-semibold text-gray-500 dark:text-secondary-400 cursor-pointer hover:text-gray-700 dark:hover:text-secondary-200">
                  ▶ Show technical error details
                </summary>
                <pre className="mt-2 p-3 bg-gray-900 text-red-300 text-xs rounded-xl overflow-auto max-h-40 font-mono">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="mt-8 btn btn-primary btn-md inline-flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

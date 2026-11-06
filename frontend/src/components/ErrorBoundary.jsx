import { Component } from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-qu-off-white p-6">
          <div className="qu-card p-8 max-w-md text-center">
            <AlertTriangle className="mx-auto mb-3 text-qu-danger" size={32} />
            <h2 className="text-lg font-bold mb-1">Something went wrong</h2>
            <p className="text-sm text-qu-text-muted mb-4">
              This page hit an unexpected error. Try reloading -- if the problem persists, check that the backend
              server is running.
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
              className="bg-qu-maroon text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-qu-maroon-mid transition-all hover:-translate-y-0.5 qu-btn-shadow"
            >
              Back to Simulator Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

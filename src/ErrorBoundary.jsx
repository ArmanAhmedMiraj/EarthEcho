import { Component } from "react";

// If a part of the page cannot load (for example a map file that was never downloaded and there is no internet),
// show a short message with a retry button, instead of letting the whole app go blank.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const { title, retry } = this.props;
    return (
      <div className="warn" role="alert">
        <p>{title}</p>
        <button type="button" className="tab" onClick={() => window.location.reload()}>{retry}</button>
      </div>
    );
  }
}

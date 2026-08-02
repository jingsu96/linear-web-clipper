import { useState, useEffect } from "react";
import { hasLinearApiKey } from "@/lib/storage";
import "./App.css";

export default function App() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    hasLinearApiKey().then(setIsConfigured);
  }, []);

  async function openSidePanel() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  if (isConfigured === null) return null;

  return (
    <div className="popup-wrapper">
      <div className="popup-card">
        <div className="card-header">
          <h1>Linear Web Clipper</h1>
        </div>
        <div className="card-content">
          {isConfigured ? (
            <>
              <div className="status-card">
                <span className="status-icon" aria-hidden="true">
                  &check;
                </span>
                <span className="status-text">Extension configured</span>
              </div>
              <div className="action-buttons">
                <button
                  type="button"
                  className="primary-button"
                  onClick={openSidePanel}
                >
                  Open Clipper
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={openSettings}
                >
                  Settings
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="status-card">
                <span className="status-icon not-configured" aria-hidden="true">
                  !
                </span>
                <span className="status-text">
                  Set up your Linear API key to get started
                </span>
              </div>
              <div className="action-buttons">
                <button
                  type="button"
                  className="primary-button"
                  onClick={openSettings}
                >
                  Open Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

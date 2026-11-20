import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { rotateAgentKey } from "../../services/deviceService";
import type { Device } from "../../types/Dashboard";
import { getErrorMessage } from "../../utils/errors";
import CopyButton from "../CopyButton";

// Where the agent should send its reports: the configured API URL, made absolute.
function apiUrl(): string {
  return new URL(import.meta.env.VITE_API_URL ?? "/api", window.location.origin).href.replace(/\/$/, "");
}

interface AgentSetupPanelProps {
  device: Device;
  // The key, if it was just created or rotated. Keys can't be read back later.
  agentKey?: string;
}

// "Connect the agent": key + install commands. Agent itself is REMAINING_WORK task B3;
// full guide in docs/agent/INSTALL.md.
function AgentSetupPanel({ device, agentKey: initialKey }: AgentSetupPanelProps) {
  const { can } = useAuth();
  const [agentKey, setAgentKey] = useState(initialKey);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rotate = async () => {
    setRotating(true);
    setError(null);
    try {
      setAgentKey((await rotateAgentKey(device.id)).agentKey);
      setConfirmRotate(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRotating(false);
    }
  };

  const keyText = agentKey ?? "<agent key>";
  const command = `python cloudops_agent.py --server ${apiUrl()} --key ${keyText}`;

  return (
    <section className="panel agent-panel" aria-labelledby="agent-title">
      <div className="panel-header">
        <h2 id="agent-title">Connect the agent</h2>
        <span className="panel-subtitle">
          {device.lastSeen ? "The agent has reported before" : "Waiting for the first report"}
        </span>
      </div>

      {agentKey ? (
        <div className="notice ok key-notice" role="status">
          <p className="notice-title">This is the only time the key is shown. Copy it now.</p>
          <div className="key-row">
            <code className="key-value">{agentKey}</code>
            <CopyButton text={agentKey} label="Copy key" />
          </div>
        </div>
      ) : (
        <p className="state-message">
          The agent key was shown when this device was added.
          {can("manageDevices") ? " Lost it? Generate a new one below." : " Ask an admin for a new one if it was lost."}
        </p>
      )}

      <ol className="setup-steps">
        <li>
          On <strong>{device.hostname}</strong>, install Python 3.10 or newer, then the agent's two libraries:
          <pre className="cmd">pip install psutil requests</pre>
        </li>
        <li>
          Download <code>cloudops_agent.py</code> from the repo's <code>agent/</code> folder and start it:
          <div className="cmd-row">
            <pre className="cmd">{command}</pre>
            <CopyButton text={command} label="Copy command" />
          </div>
        </li>
        <li>The device turns online here within a minute. Full guide: <code>docs/agent/INSTALL.md</code>.</li>
      </ol>

      {can("manageDevices") && (
        <div className="agent-actions">
          {error && <p className="field-error">{error}</p>}
          {confirmRotate ? (
            <>
              <span className="dialog-text">The current key stops working immediately.</span>
              <button type="button" className="btn" onClick={() => setConfirmRotate(false)}>
                Cancel
              </button>
              <button type="button" className="btn danger" onClick={rotate} disabled={rotating}>
                {rotating ? "Generating…" : "Generate new key"}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmRotate(true)}>
              Generate a new key
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default AgentSetupPanel;

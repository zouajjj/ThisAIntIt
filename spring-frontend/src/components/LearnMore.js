import React from 'react';

function LearnMore({ onClose }) {
  return (
    <div className="info-overlay" onClick={onClose}>
      <div className="info-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="info-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <p className="info-eyebrow">How this works</p>
        <h2 className="info-title">Why Kafka instead of a normal API call?</h2>

        <p className="info-text">
          A typical REST API is synchronous: your browser sends a request and the server
          holds the connection open until it has a full answer to send back. This app does
          something different. Hitting Generate sends a request to <code>api-service</code>,
          which doesn't call the AI model itself — it drops your question onto a Kafka topic
          (<code>user-questions</code>) and immediately replies with just a tracking ID. A
          separate process, <code>worker-service</code>, is the one actually listening to
          that topic: it picks up the message, calls the model, and writes the answer to a
          second topic (<code>chat-responses</code>). <code>api-service</code> picks that up
          and stores it, and your browser polls a small endpoint every couple of seconds
          until the answer shows up — which is exactly what the infographic you just watched
          was tracking in real time.
        </p>

        <h3 className="info-heading">Pros of this approach</h3>
        <ul className="info-list">
          <li><code>api-service</code> never blocks on a slow model response — it stays free to handle other requests while the answer is being generated.</li>
          <li>The two services scale independently: more <code>worker-service</code> instances for AI load, more <code>api-service</code> instances for HTTP traffic, without touching the other.</li>
          <li>If <code>worker-service</code> crashes mid-processing, the message is still sitting in Kafka — nothing is silently lost the way an in-flight HTTP request would be.</li>
          <li><code>api-service</code> and <code>worker-service</code> never call each other directly, so either can be redeployed without the other needing to know.</li>
        </ul>

        <h3 className="info-heading">Cons — being honest about the tradeoffs</h3>
        <ul className="info-list">
          <li>More moving parts: this setup runs a Kafka broker and a Zookeeper instance alongside the two services, versus a single server for a plain REST API.</li>
          <li>Slower for a single request: polling every 2 seconds plus the two-topic round trip adds latency a direct, synchronous call to the model wouldn't have.</li>
          <li>The frontend has to poll (or use something like WebSockets/SSE) instead of just awaiting one response — more client-side complexity.</li>
          <li>At the scale this project actually runs at — a single VM, one broker, no replication — the resilience and scaling benefits above are mostly theoretical. This pattern earns its keep under higher, bursty traffic, not here.</li>
        </ul>

        <h3 className="info-heading">Where it actually runs</h3>
        <p className="info-text">
          Zookeeper, Kafka, <code>api-service</code>, and <code>worker-service</code> all run
          as Docker containers via <code>docker-compose</code> on a single Oracle Cloud
          "Always Free" virtual machine — an Ampere A1 instance, meaning it's ARM
          (aarch64), not the more common x86. It runs <strong>Oracle Linux</strong>, Oracle's
          own RHEL-compatible distribution, which is why the setup uses{' '}
          <code>dnf</code>/<code>firewalld</code> rather than Ubuntu's <code>apt</code>/
          <code>ufw</code>. A small reverse proxy (Caddy) sits in front of{' '}
          <code>api-service</code> to provide free, auto-renewing HTTPS. It's a single node
          with no redundancy — chosen to stay entirely within Oracle's free tier rather than
          pay for a managed platform's per-service pricing.
        </p>
      </div>
    </div>
  );
}

export default LearnMore;

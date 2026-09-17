import React, { useState, useEffect, useRef } from 'react';
import { SiSpringboot, SiApachekafka } from 'react-icons/si';
import { MdBolt, MdCloudDone } from 'react-icons/md';
import LearnMore from './LearnMore';

const STEPS = [
  { label: 'Request received', desc: 'Your message hits GET /ai/generate on api-service.', Icon: SiSpringboot },
  { label: 'Queued on Kafka', desc: 'Published to the user-questions topic.', Icon: SiApachekafka },
  { label: 'Picked up by worker', desc: 'worker-service consumes it off the queue.', Icon: SiSpringboot },
  { label: 'Asking the model', desc: 'A request goes out to the AI model for a completion.', Icon: MdBolt },
  { label: 'Response published', desc: 'The answer is written back to the chat-responses topic.', Icon: SiApachekafka },
  { label: 'Delivered', desc: 'api-service hands your answer back to you.', Icon: MdCloudDone },
];

const STEP_MS = 1100;
const FAST_MS = 220;
const REVEAL_BUFFER_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Chatbot() {
  const [inputMessage, setInputMessage] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [viewState, setViewState] = useState('idle'); // idle | processing | complete
  const [showInfo, setShowInfo] = useState(false);
  const [stepStatuses, setStepStatuses] = useState(STEPS.map(() => 'pending'));

  const pollingInterval = useRef(null);
  const activeRequestId = useRef(null);
  const resolvedAnswerRef = useRef(null);
  const cancelledRef = useRef(false);
  const stepCardRefs = useRef([]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const activeIndex = stepStatuses.findIndex((s) => s === 'active');
    const targetIndex = activeIndex === -1 ? stepStatuses.lastIndexOf('done') : activeIndex;
    const el = stepCardRefs.current[targetIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [stepStatuses]);

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const pollForResponse = (requestId) => {
    pollingInterval.current = setInterval(async () => {
      if (activeRequestId.current !== requestId || cancelledRef.current) {
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`/ai/response/${requestId}`);
        if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

        const json = await res.json();

        if (json.status === 'complete') {
          stopPolling();
          resolvedAnswerRef.current = json.answer;
        }
      } catch (err) {
        stopPolling();
        if (!cancelledRef.current) {
          cancelledRef.current = true;
          setError('Lost connection while waiting for response.');
          setIsGenerating(false);
          setViewState('idle');
        }
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  // Drives the infographic on a fixed cadence for the steps we can't observe
  // directly, then holds on the last step and waits for the real Kafka
  // round trip (via resolvedAnswerRef, set by pollForResponse) before
  // revealing the answer -- so the visual always finishes before the text does.
  const runTimeline = async () => {
    setStepStatuses(['done', 'done', 'active', 'pending', 'pending', 'pending']);

    for (let i = 2; i < STEPS.length - 1; i++) {
      await sleep(resolvedAnswerRef.current ? FAST_MS : STEP_MS);
      if (cancelledRef.current) return;
      setStepStatuses((prev) => {
        const next = [...prev];
        next[i] = 'done';
        next[i + 1] = 'active';
        return next;
      });
    }

    while (!resolvedAnswerRef.current && !cancelledRef.current) {
      await sleep(300);
    }
    if (cancelledRef.current) return;

    await sleep(REVEAL_BUFFER_MS);
    if (cancelledRef.current) return;

    setStepStatuses((prev) => {
      const next = [...prev];
      next[STEPS.length - 1] = 'done';
      return next;
    });

    await sleep(350);
    if (cancelledRef.current) return;

    setResponseText(resolvedAnswerRef.current);
    setIsGenerating(false);
    setViewState('complete');
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    stopPolling();
    cancelledRef.current = false;
    resolvedAnswerRef.current = null;
    setIsGenerating(true);
    setError(null);
    setResponseText('');
    setViewState('processing');
    setStepStatuses(['active', 'pending', 'pending', 'pending', 'pending', 'pending']);

    try {
      const params = new URLSearchParams({ message: inputMessage });
      const res = await fetch(`/ai/generate?${params}`, { method: 'GET' });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const json = await res.json();

      if (!json.requestId) {
        setError('Server did not return a requestId.');
        setIsGenerating(false);
        setViewState('idle');
        return;
      }

      activeRequestId.current = json.requestId;
      pollForResponse(json.requestId);
      runTimeline();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Check console.');
      setIsGenerating(false);
      setViewState('idle');
    }
  };

  const handleBack = () => {
    cancelledRef.current = true;
    stopPolling();
    activeRequestId.current = null;
    resolvedAnswerRef.current = null;
    setIsGenerating(false);
    setError(null);
    setResponseText('');
    setInputMessage('');
    setStepStatuses(STEPS.map(() => 'pending'));
    setViewState('idle');
  };

  const renderStepCard = (step, index) => {
    const { Icon } = step;
    return (
      <div
        key={step.label}
        ref={(el) => (stepCardRefs.current[index] = el)}
        className={`step-card ${stepStatuses[index]}`}
      >
        <div className="step-icon-wrap">
          <Icon className="step-icon" />
          {stepStatuses[index] === 'done' && <span className="step-check">&#10003;</span>}
        </div>
        <p className="step-label">{step.label}</p>
        <p className="step-desc">{step.desc}</p>
      </div>
    );
  };

  return (
    <div className="chatbot-container">
      <button
        type="button"
        className={`back-btn ${viewState !== 'idle' ? 'visible' : ''}`}
        onClick={handleBack}
        aria-label="Start a new query"
      >
        &larr; New query
      </button>

      {viewState === 'idle' && (
        <>
          <h1 className="brand-heading">Ask AIn't</h1>
          <p className="brand-subheading">
            A question in, a Kafka pipeline out. Watch it move.
          </p>
        </>
      )}

      <div className={`chat-form-wrapper ${viewState !== 'idle' ? 'collapsed' : ''}`}>
        <form onSubmit={handleGenerate} className="chat-form">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message here..."
            disabled={isGenerating}
            className="chat-input"
          />
          <button type="submit" disabled={isGenerating} className="chat-btn">
            {isGenerating ? 'Working...' : 'Generate'}
          </button>
        </form>
      </div>

      {error && <div className="error-message">{error}</div>}

      {viewState === 'processing' && (
        <div className="pipeline">
          <p className="pipeline-caption">Behind the scenes</p>
          <div className="pipeline-grid">{STEPS.map(renderStepCard)}</div>
          <div className="pipeline-track">{STEPS.map(renderStepCard)}</div>
          <div className="pipeline-dots">
            {STEPS.map((step, index) => (
              <span key={step.label} className={`pipeline-dot ${stepStatuses[index]}`} />
            ))}
          </div>
        </div>
      )}

      {viewState === 'complete' && responseText && (
        <div className="response-content">
          <h3>Response</h3>
          <div className="response-text">
            {responseText.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
          <button
            type="button"
            className="learn-more-btn"
            onClick={() => setShowInfo(true)}
          >
            Learn more about how this works &rarr;
          </button>
        </div>
      )}

      {viewState === 'idle' && !error && (
        <div className="placeholder-text">Ask me a question or tell me a joke!</div>
      )}

      {showInfo && <LearnMore onClose={() => setShowInfo(false)} />}
    </div>
  );
}

export default Chatbot;

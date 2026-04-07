const { metrics } = require('@opentelemetry/api');
const { monitorEventLoopDelay, PerformanceObserver, constants: perfConstants } = require('perf_hooks');

const DEFAULT_IGNORED_PATH_PREFIXES = ['/health', '/healthz', '/readyz'];

function getGlobalState() {
  if (!global.__CAB_OBSERVABILITY__) {
    global.__CAB_OBSERVABILITY__ = {
      services: new Map()
    };
  }
  return global.__CAB_OBSERVABILITY__;
}

function sanitizeString(value, fallback) {
  if (!value) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function toOutcomeFromStatus(statusCode) {
  return Number(statusCode) >= 500 ? 'error' : 'success';
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function normalizeRoute(req) {
  const routePath = req.route && req.route.path ? String(req.route.path) : '';
  if (routePath) {
    const baseUrl = req.baseUrl ? String(req.baseUrl) : '';
    if (routePath === '/') {
      return baseUrl || '/';
    }
    return `${baseUrl}${routePath}`;
  }
  return 'UNMATCHED';
}

function shouldIgnoreRequest(req, ignoredPathPrefixes) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return ignoredPathPrefixes.some((prefix) => url.startsWith(prefix));
}

function mapGcKind(kind) {
  const gc = perfConstants || {};
  if (kind === gc.NODE_PERFORMANCE_GC_MAJOR) {
    return 'major';
  }
  if (kind === gc.NODE_PERFORMANCE_GC_MINOR) {
    return 'minor';
  }
  if (kind === gc.NODE_PERFORMANCE_GC_INCREMENTAL) {
    return 'incremental';
  }
  if (kind === gc.NODE_PERFORMANCE_GC_WEAKCB) {
    return 'weakcb';
  }
  return 'unknown';
}

function createServiceMetrics(options = {}) {
  const serviceName = sanitizeString(options.serviceName || process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME, 'unknown-service');

  const globalState = getGlobalState();
  if (globalState.services.has(serviceName)) {
    return globalState.services.get(serviceName);
  }

  const meter = metrics.getMeter('cab-booking.monitoring', '1.0.0');
  const baseAttributes = {
    service_name: serviceName
  };

  const serviceUpGauge = meter.createObservableGauge('cab_service_up', {
    description: 'Service process liveness metric'
  });

  const memoryRssGauge = meter.createObservableGauge('cab_runtime_process_resident_memory_bytes', {
    description: 'Resident set size memory'
  });

  const memoryHeapUsedGauge = meter.createObservableGauge('cab_runtime_process_heap_used_bytes', {
    description: 'Heap used memory'
  });

  const memoryHeapTotalGauge = meter.createObservableGauge('cab_runtime_process_heap_total_bytes', {
    description: 'Heap total memory'
  });

  const processUptimeGauge = meter.createObservableGauge('cab_runtime_process_uptime_seconds', {
    description: 'Process uptime in seconds'
  });

  const eventLoopLagMeanGauge = meter.createObservableGauge('cab_runtime_event_loop_lag_mean_ms', {
    description: 'Mean event loop lag'
  });

  const eventLoopLagMaxGauge = meter.createObservableGauge('cab_runtime_event_loop_lag_max_ms', {
    description: 'Max event loop lag'
  });

  const gcDurationHistogram = meter.createHistogram('cab_runtime_gc_duration_ms', {
    description: 'GC pause duration'
  });

  const gcCollectionsCounter = meter.createCounter('cab_runtime_gc_collections_total', {
    description: 'GC collections count'
  });

  const httpRequestCounter = meter.createCounter('cab_http_server_requests_total', {
    description: 'HTTP request count'
  });

  const httpDurationHistogram = meter.createHistogram('cab_http_server_duration_ms', {
    description: 'HTTP request duration'
  });

  const businessEventsCounter = meter.createCounter('cab_business_events_total', {
    description: 'Business event counter'
  });

  const dependencyRequestCounter = meter.createCounter('cab_dependency_requests_total', {
    description: 'Dependency request count'
  });

  const dependencyDurationHistogram = meter.createHistogram('cab_dependency_duration_ms', {
    description: 'Dependency latency'
  });

  const queueBacklogGauge = meter.createObservableGauge('cab_queue_backlog', {
    description: 'Queue backlog per queue name'
  });
  const outboxBacklogGauge = meter.createObservableGauge('cab_outbox_backlog', {
    description: 'Outbox backlog per outbox queue'
  });
  const kafkaConsumerLagGauge = meter.createObservableGauge('cab_kafka_consumer_lag', {
    description: 'Kafka consumer lag by group/topic/partition'
  });
  const kafkaPublishCounter = meter.createCounter('cab_kafka_publish_total', {
    description: 'Kafka publish attempts by topic and outcome'
  });
  const kafkaDlqCounter = meter.createCounter('cab_kafka_dlq_total', {
    description: 'Kafka events routed to DLQ'
  });
  const kafkaRetryCounter = meter.createCounter('cab_kafka_retry_total', {
    description: 'Kafka retry decisions for outbox/inbox processing'
  });
  const kafkaProcessingLatencyHistogram = meter.createHistogram('cab_kafka_processing_latency_ms', {
    description: 'Kafka processing latency across producer/outbox/consumer pipelines'
  });

  const queueBacklogState = new Map();
  const outboxBacklogState = new Map();
  const kafkaConsumerLagState = new Map();
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();

  serviceUpGauge.addCallback((observableResult) => {
    observableResult.observe(1, baseAttributes);
  });

  memoryRssGauge.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.rss, baseAttributes);
  });

  memoryHeapUsedGauge.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.heapUsed, baseAttributes);
  });

  memoryHeapTotalGauge.addCallback((observableResult) => {
    const usage = process.memoryUsage();
    observableResult.observe(usage.heapTotal, baseAttributes);
  });

  processUptimeGauge.addCallback((observableResult) => {
    observableResult.observe(process.uptime(), baseAttributes);
  });

  eventLoopLagMeanGauge.addCallback((observableResult) => {
    const meanMs = eventLoop.mean / 1e6;
    observableResult.observe(Number.isFinite(meanMs) ? meanMs : 0, baseAttributes);
  });

  eventLoopLagMaxGauge.addCallback((observableResult) => {
    const maxMs = eventLoop.max / 1e6;
    observableResult.observe(Number.isFinite(maxMs) ? maxMs : 0, baseAttributes);
    eventLoop.reset();
  });

  queueBacklogGauge.addCallback((observableResult) => {
    for (const [queueName, size] of queueBacklogState.entries()) {
      observableResult.observe(size, {
        ...baseAttributes,
        queue_name: queueName
      });
    }
  });

  outboxBacklogGauge.addCallback((observableResult) => {
    for (const [queueName, size] of outboxBacklogState.entries()) {
      observableResult.observe(size, {
        ...baseAttributes,
        queue_name: queueName
      });
    }
  });

  kafkaConsumerLagGauge.addCallback((observableResult) => {
    for (const [lagKey, lagInfo] of kafkaConsumerLagState.entries()) {
      observableResult.observe(lagInfo.lag, {
        ...baseAttributes,
        consumer_group: lagInfo.consumerGroup,
        topic: lagInfo.topic,
        partition: lagInfo.partition
      });
      // cleanup stale lag records to avoid cardinality growth over time
      if (Date.now() - lagInfo.updatedAt > 30 * 60 * 1000) {
        kafkaConsumerLagState.delete(lagKey);
      }
    }
  });

  if (typeof PerformanceObserver === 'function') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const gcKind = mapGcKind(entry.kind);
          gcCollectionsCounter.add(1, {
            ...baseAttributes,
            gc_kind: gcKind
          });
          gcDurationHistogram.record(entry.duration, {
            ...baseAttributes,
            gc_kind: gcKind
          });
        }
      });

      observer.observe({ entryTypes: ['gc'] });
    } catch (_error) {
      // Node runtime may disable GC performance entries.
    }
  }

  function createHttpMetricsMiddleware(middlewareOptions = {}) {
    const ignoredPathPrefixes = Array.isArray(middlewareOptions.ignoredPathPrefixes)
      ? middlewareOptions.ignoredPathPrefixes
      : DEFAULT_IGNORED_PATH_PREFIXES;

    return function httpMetricsMiddleware(req, res, next) {
      if (shouldIgnoreRequest(req, ignoredPathPrefixes)) {
        return next();
      }

      const startedAtMs = nowMs();
      res.on('finish', () => {
        const durationMs = nowMs() - startedAtMs;
        const route = normalizeRoute(req);
        const statusCode = String(res.statusCode);
        const method = sanitizeString(req.method, 'UNKNOWN').toUpperCase();

        const attributes = {
          ...baseAttributes,
          http_method: method,
          http_route: route,
          http_status_code: statusCode
        };

        httpRequestCounter.add(1, attributes);
        httpDurationHistogram.record(durationMs, attributes);
      });

      next();
    };
  }

  function recordBusinessEvent({ domain, event, outcome, attributes } = {}) {
    businessEventsCounter.add(1, {
      ...baseAttributes,
      domain: sanitizeString(domain, 'unknown'),
      event: sanitizeString(event, 'unknown'),
      outcome: sanitizeString(outcome, 'success'),
      ...(attributes || {})
    });
  }

  function setQueueBacklog(queueName, size) {
    queueBacklogState.set(sanitizeString(queueName, 'default'), Math.max(0, Number(size) || 0));
  }

  function setOutboxBacklog(queueName, size) {
    const normalizedQueue = sanitizeString(queueName, 'outbox.default');
    const normalizedSize = Math.max(0, Number(size) || 0);
    outboxBacklogState.set(normalizedQueue, normalizedSize);
    setQueueBacklog(normalizedQueue, normalizedSize);
  }

  function setKafkaConsumerLag({ consumerGroup, topic, partition, lag }) {
    const normalizedGroup = sanitizeString(consumerGroup, 'unknown-group');
    const normalizedTopic = sanitizeString(topic, 'unknown-topic');
    const normalizedPartition = String(Number.isFinite(Number(partition)) ? Number(partition) : 0);
    const normalizedLag = Math.max(0, Number(lag) || 0);
    const lagKey = `${normalizedGroup}:${normalizedTopic}:${normalizedPartition}`;

    kafkaConsumerLagState.set(lagKey, {
      consumerGroup: normalizedGroup,
      topic: normalizedTopic,
      partition: normalizedPartition,
      lag: normalizedLag,
      updatedAt: Date.now()
    });
  }

  function recordKafkaPublish({ topic, outcome = 'success', operation = 'publish', attributes }) {
    kafkaPublishCounter.add(1, {
      ...baseAttributes,
      topic: sanitizeString(topic, 'unknown-topic'),
      outcome: sanitizeString(outcome, 'success'),
      operation: sanitizeString(operation, 'publish'),
      ...(attributes || {})
    });
  }

  function recordKafkaDlq({ sourceTopic, dlqTopic, errorType = 'unknown_error', attributes }) {
    kafkaDlqCounter.add(1, {
      ...baseAttributes,
      source_topic: sanitizeString(sourceTopic, 'unknown-topic'),
      dlq_topic: sanitizeString(dlqTopic, 'unknown-topic'),
      error_type: sanitizeString(errorType, 'unknown_error'),
      ...(attributes || {})
    });
  }

  function recordKafkaRetry({ scope = 'unknown', topic, status = 'retry', reason = 'unknown', attributes }) {
    kafkaRetryCounter.add(1, {
      ...baseAttributes,
      scope: sanitizeString(scope, 'unknown'),
      topic: sanitizeString(topic, 'unknown-topic'),
      status: sanitizeString(status, 'retry'),
      reason: sanitizeString(reason, 'unknown'),
      ...(attributes || {})
    });
  }

  function recordKafkaProcessingLatency({ pipeline = 'consumer', topic, outcome = 'success', durationMs, attributes }) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      return;
    }
    kafkaProcessingLatencyHistogram.record(durationMs, {
      ...baseAttributes,
      pipeline: sanitizeString(pipeline, 'consumer'),
      topic: sanitizeString(topic, 'unknown-topic'),
      outcome: sanitizeString(outcome, 'success'),
      ...(attributes || {})
    });
  }

  function recordDependencyRequest({ dependencyType, dependencyName, operation, outcome, durationMs, attributes }) {
    const metricAttributes = {
      ...baseAttributes,
      dependency_type: sanitizeString(dependencyType, 'unknown'),
      dependency_name: sanitizeString(dependencyName, 'unknown'),
      dependency_operation: sanitizeString(operation, 'unknown'),
      outcome: sanitizeString(outcome, 'success'),
      ...(attributes || {})
    };

    dependencyRequestCounter.add(1, metricAttributes);
    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
      dependencyDurationHistogram.record(durationMs, metricAttributes);
    }
  }

  async function measureDependency(dependencyInfo, work) {
    const startedAtMs = nowMs();
    try {
      const result = await work();
      recordDependencyRequest({
        ...dependencyInfo,
        outcome: dependencyInfo?.outcome || 'success',
        durationMs: nowMs() - startedAtMs
      });
      return result;
    } catch (error) {
      recordDependencyRequest({
        ...dependencyInfo,
        outcome: 'error',
        durationMs: nowMs() - startedAtMs,
        attributes: {
          ...(dependencyInfo?.attributes || {}),
          error_type: sanitizeString(error && error.name, 'Error')
        }
      });
      throw error;
    }
  }

  const serviceMetrics = {
    serviceName,
    createHttpMetricsMiddleware,
    recordBusinessEvent,
    recordDependencyRequest,
    measureDependency,
    setQueueBacklog,
    setOutboxBacklog,
    setKafkaConsumerLag,
    recordKafkaPublish,
    recordKafkaDlq,
    recordKafkaRetry,
    recordKafkaProcessingLatency,
    recordRideCreated: (outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'ride',
        event: 'created',
        outcome,
        attributes
      }),
    recordRideStatus: (status, outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'ride',
        event: 'status_changed',
        outcome,
        attributes: {
          status: sanitizeString(status, 'unknown').toLowerCase(),
          ...(attributes || {})
        }
      }),
    recordBookingStatus: (status, outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'booking',
        event: sanitizeString(status, 'unknown'),
        outcome,
        attributes
      }),
    recordPaymentStatus: (status, outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'payment',
        event: 'status_changed',
        outcome,
        attributes: {
          status: sanitizeString(status, 'unknown').toLowerCase(),
          ...(attributes || {})
        }
      }),
    recordNotificationSend: (channel, outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'notification',
        event: 'send',
        outcome,
        attributes: {
          channel: sanitizeString(channel, 'unknown'),
          ...(attributes || {})
        }
      }),
    recordReviewCreated: (outcome = 'success', attributes) =>
      recordBusinessEvent({
        domain: 'review',
        event: 'created',
        outcome,
        attributes
      }),
    toOutcomeFromStatus
  };

  globalState.services.set(serviceName, serviceMetrics);
  return serviceMetrics;
}

module.exports = {
  createServiceMetrics,
  toOutcomeFromStatus
};

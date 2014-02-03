var nconf     = require('nconf');
var amqp      = require('amqp');
var Promise   = require('promise');
var server    = require('../../server');
var events    = require('../../queue/events');
var debug     = require('debug')('tests:events');

/** Setup events */
exports.setUp = function(callback)  {
  debug("Setting up exchanges with events.setup()");
  events.setup().then(function() {
    debug("Exchange setup completed!");
    callback();
  });
}

/** Disconnect from RabbitMQ, so we can exit the process */
exports.tearDown = function(callback) {
  debug("Disconnecting from RabbitMQ");
  events.disconnect().then(function() {
    debug("Disconnected from RabbitMQ");
    callback();
  });
}

/** Test message publication */
exports['v1/queue:task-pending'] = function(test) {
  test.expect(1);

  // Publish a message
  debug('Publishing to v1/queue:task-pending');
  events.publish('v1/queue:task-pending', {
    "version":              "0.2.0",
    "status": {
      "task_id":            "70f8926b-c4be-4604-9c33-4e9628bc31f6",
      "provisioner_id":     "jonasfj-test-aws-provisioner",
      "worker_type":        "map-this-to-my-cool-ami",
      "runs":               [],
      "state":              "pending",
      "reason":             "none",
      "routing":            "jonasfjs-precious-tasks.stupid-test.aws",
      "retries":            0,
      "priority":           2.6,
      "created":            "2014-02-01T03:22:36.356Z",
      "deadline":           "2014-03-01T03:22:36.356Z",
      "taken_until":        "1970-01-01T00:00:00.000Z"
    }
  }).then(function() {
    test.ok(true, "Message was sent, how nice");
  }, function() {
    test.ok(false, "Failed to send message!");
  }).then(function() {
    test.done();
  });
};

/** Test that invalid message publication fails */
exports['v1/queue:task-pending validation test'] = function(test) {
  test.expect(1);

  // Publish a message
  debug('Publishing to v1/queue:task-pending');
  events.publish('v1/queue:task-pending', {
    "version":              "0.2.0",
    "status": {
      "task_id":            "70f8926b-c4be-4604-9c33-4e9628bc31f6",
      "provisioner_id":     "jonasfj-test-aws-provisioner",
      "worker_type":        "map-this-to-my-cool-ami",
      "runs":               [],
      "state":              "pending",
      "reason":             "none",
      "routing":            "jonasfjs-precious-tasks.stupid-test.aws",
      "retries":            0,
      "priority":           2.6,
      "created":            "2014-02-01T03:22:36.356Z",
      "deadline":           "2014-03-01T03:22:36.356Z",
      "taken_until":        null
    }
  }).then(function() {
    test.ok(false, "Invalid message was sent, this is bad!");
  }, function() {
    test.ok(true, "Failed to send message, as expected...");
  }).then(function() {
    test.done();
  });
};

/** Test that message can be received */
exports['v1/queue:task-pending receive test'] = function(test) {
  test.expect(2);

  // Create a connection
  var conn = null;
  var connected = new Promise(function(accept, reject) {
    // Create connection
    debug("Creating new AMQP connection!");
    conn = amqp.createConnection(nconf.get('amqp'));
    conn.on('ready', accept);
  });

  var queue = null;
  var subscribed = connected.then(function() {
    return new Promise(function(accept, reject) {
      debug('Create exclusive queue');
      queue = conn.queue("test-queue", {
        passive:                    false,
        durable:                    false,
        exclusive:                  true,
        autoDelete:                 true,
        closeChannelOnUnsubscribe:  true
      }, function() {
        debug('Subscribe to messages on queue');
        queue.subscribe(function(message) {
          test.ok(message.status.task_id == '70f8926b-c4be-4604-9c33-4e9628bc31f6',
                  "Didn't get the expected message");
          queue.destroy();
          conn.destroy();
          test.done();
        });
        debug('Bind queue to exchange');
        queue.bind(
          'v1/queue:task-pending',
          '70f8926b-c4be-4604-9c33-4e9628bc31f6.#',
          function() {
            accept();
          }
        );
      });
    });
  });

  // Publish a message
  subscribed.then(function() {
    debug('Publishing to v1/queue:task-pending');
    events.publish('v1/queue:task-pending', {
      "version":              "0.2.0",
      "status": {
        "task_id":            "70f8926b-c4be-4604-9c33-4e9628bc31f6",
        "provisioner_id":     "jonasfj-test-aws-provisioner",
        "worker_type":        "map-this-to-my-cool-ami",
        "runs":               [],
        "state":              "pending",
        "reason":             "none",
        "routing":            "jonasfjs-precious-tasks.stupid-test.aws",
        "retries":            0,
        "priority":           2.6,
        "created":            "2014-02-01T03:22:36.356Z",
        "deadline":           "2014-03-01T03:22:36.356Z",
        "taken_until":        "1970-01-01T00:00:00.000Z"
      }
    }).then(function() {
      test.ok(true);
    }, function() {
      test.ok(true, "Message validation failed unexpectedly...");
    });
  });
};
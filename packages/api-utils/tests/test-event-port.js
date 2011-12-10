'use strict';

const { setTimeout } = require('api-utils/timer');
const { EventPort, open, close, pipe } = require('api-utils/event/port');
const { Loader } = require('./helpers');

exports['test events are enqueued before open'] = function(assert, done) {
  let messages = [];

  let target = EventPort.new();
  target.on('message', function onMessage(message) {
    assert.equal(this, target, 'this is a port');
    messages.push(message);
  });
  target.on('stop', function(a, b) {
    assert.equal(this, target, 'this is a port');
    assert.deepEqual([ 1, 2 ], messages,
                     'messages vere deliver in right order');
    assert.equal(a, 'a', 'first argument is correct');
    assert.equal(b, 'b', 'second arguments is correct');
    done();
  });

  let source = EventPort.new(target);
  source.emit('message', 1);
  source.emit('message', 2);

  setTimeout(function() {
    assert.equal(messages.length, 0,
                 'no messages are send until source port is open');
    open(source);
    source.emit('stop', 'a', 'b');
  }, 20);
};

exports['test events are not queued if port is open'] = function(assert, done) {
  let messages = [];
  let target = EventPort.new();
  let source = EventPort.new();
  open(source);

  target.on('message', function(message) { messages.push(message); });
  target.on('stop', function(message) {
    assert.deepEqual([], messages, 'messages were delivered');
    done();
  });

  source.emit('message', 1);
  source.emit('message', 2);

  setTimeout(function() {
    assert.equal(messages.length, 0,
                 'messages are equeued until target is set');
    pipe(source, target);
    source.emit('stop');
  });
};

require('test').run(exports);

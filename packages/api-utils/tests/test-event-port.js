'use strict';

const { setTimeout } = require('api-utils/timer');
const { EventPort, open, close, pipe, flush } = require('api-utils/event/port');
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

exports['test messages are delivered async'] = function(assert, done) {
  let target = EventPort.new();
  let source = EventPort.new(target);
  let async = false;
  open(source);

  target.on('foo', function() {
    assert.ok(async, 'foo delivered async');
    async = false;
    source.emit('bar');
    async = true;
  });
  target.on('bar', function() {
    assert.ok(async, 'bar delivered async');
    done();
  });

  source.emit('foo');
  async = true;
};

exports['test force sync delivery'] = function(assert, done) {
  let target = EventPort.new();
  let source = EventPort.new(target);
  let async = false;
  open(source);

  target.on('foo', function() {
    assert.ok(!async, 'foo delivered sync');
    source.emit('bar');
    flush(source);
    async = true;
  });
  target.on('bar', function() {
    assert.ok(!async, 'bar delivered sync');
    done();
  });

  source.emit('foo');
  flush(source);
  async = true;
};

exports['test messages queued when closed'] = function(assert, done) {
  let target = EventPort.new();
  let source = EventPort.new(target);
  let messages = [];
  open(source);

  target.on('message', function(message) messages.push(message));
  target.on('end', function() {
    assert.deepEqual([ 1, 2 ], messages, 'messages delivered on re-open');
    done();
  });
  target.on('start', function() {
    close(source);
    source.emit('message', 1);
    source.emit('message', 2);
    source.emit('end');
    setTimeout(function() {
      assert.deepEqual([], messages, 'messages are queued when closed');
      open(source);
    }, 20)
  });
  source.emit('start');
};

exports['test bidirectional pipe'] = function(assert, done) {
  let async = false;
  let messages = [];

  let contentPort = EventPort.new();
  let chromePort = EventPort.new(contentPort);
  pipe(contentPort, chromePort);

  contentPort.on('hello', function(message) {
    messages.push(message);
    contentPort.emit('hello', 'Hi chrome!');
  });
  contentPort.on('message', function(message) {
    messages.push(message);
    contentPort.emit('bye', 'Sorry I got to go, have a meeting in a sec');
    close(contentPort);
  });
  contentPort.on('bye', function(message) {
    messages.push(message);
  });

  chromePort.on('hello', function(message) {
    messages.push(message);
    chromePort.emit('message', 'How are you doing today?')
  });
  chromePort.on('bye', function(message) {
    messages.push(message);
    chromePort.emit('bye', 'ok talk to you later then');
    close(chromePort);

    assert.deepEqual([
      'Good morning content',
      'Hi chrome!',
      'How are you doing today?',
      'Sorry I got to go, have a meeting in a sec',
      'ok talk to you later then'
    ], messages, 'all messages delivered');
    done();
  });

  chromePort.emit('hello', 'Good morning content');
  async = true;

  setTimeout(function PipeIsReady() {
    open(chromePort);
    open(contentPort);
  });
};

require('test').run(exports);

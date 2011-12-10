Provides an exemplar `EventPort` object, that implements event emitter
interface. These port objects may be used to set up bidirectional
asynchronous communication pipes between them.

    const { EventPort, pipe, open, close } = require('api-utils/event/port');
    let contentPort = EventPort.new();
    contentPort.on('message', function onMessage(message) {
      console.log('chrome >>', message);
    });

When `EventPort` is instantiated with a target port, target is used as an
event target port. This means that events emitted on this port will trigger
listeners of the target.

    let chromePort = EventPort.new(contentPort);
    chromePort.on('message', function onMessage(message) {
      console.log('content <<', message)
    });
    // Emit event on `contentPort`.
    chromePort.emit('message', 'hello content');

Module provides `pipe` function, that can be used to set a new target for the
port. This is a solution for "Chicken or the egg" problem when two ports need
to form bidirectional pipe:

    pipe(contentPort, chromePort);

Very ofter port's on different sides of the bidirectional pipe can be created
at different points in time. `EventPort` is designed with that in mind, all
emitted events are queued up, until port is open:

    open(chromePort);
    // after few miliseconds
    // chrome >> 'hello content'

Remember to `open` each port that needs to deliver messages.

    open(contentPort);
    // after few miliseconds
    // content >> 'hello chrome'

Also every now and then one may need to `close` port, to swap a target for
example. Please note that all queued messages will be flushed when this happens.

    close(chromePort);

Module also exports `flush` function that will synchronously emit all the
queued up messages of the given `source` port on it's target. Most likely you
do not need to call this function, let `source.emit` do the job for you. But if
you're certain that's what you need:

    chomePort.emit('message', 'bye');
    flush(chromePort);
    // chrome >> 'bye'


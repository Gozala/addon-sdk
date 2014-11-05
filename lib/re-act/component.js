"use strict";

const { isThunk, renderThunk, thunkCache } = require("vtree/interface")
const { diff } = require("diffpatcher/diff")
const { patch } = require("diffpatcher/patch")

const getDefaultOptions = Symbol("component/options/default");
const getPendingOptions = Symbol("components/options/pending");
const options = Symbol("components/options/value");
const patchOptions = Symbol("component/options/patch!");
const resetOptions = Symbol("component/options/reset!");

const getInitialState = Symbol("component/state/init");
const pendingState = Symbol("components/state/pending");
const state = Symbol("component/state/value");
const patchState = Symbol("components/state/patch!");
const resetState = Symbol("component/state/reset!");


const construct = Symbol("component/construct");
const shouldUpdate = Symbol("component/shouldUpdate?");
const render = Symbol("component/render");
const structure = Symbol("component/structure");
const enqueueUpdate = Symbol("component/enqueueUpdate");
const update = Symbol("component/method");

const Thunk = function() {};
Thunk.isThunk = isThunk;
Thunk.render = renderThunk;
Thunk.cache = thunkCache;
Thunk.prototype[Thunk.isThunk] = true;
Thunk.prototype[Thunk.cache] = null;
exports.Thunk = Thunk;

const Component = function(options, children) {
  this[Component.construct](options, children)
};
Component.render = Symbol("component/render");
Component.construct = Symbol("component/construct");
Component.extends = Symbol("component/extends");

Component.mount = Object.create(null);
Component.mount.before = Symbol("component/mount/before");
Component.mount.after = Symbol("component/mount/after");

Component.unmount = Object.create(null);
Component.unmount.before = Symbol("component/unmount/before");

Component.update = Object.create(null);
Component.update.schedule = Symbol("component/update/schedule");
Component.update.isRequired = Symbol("component/update/required?");
Component.update.before = Symbol("component/update/before");
Component.update.commit = Symbol("component/update/commit");
Component.update.after = Symbol("component/update/after");

Component.state = Object.create(null);
Component.state.pending = Symbol("component/state/pending");
Component.state.value = Symbol("component/state/value");
Component.state.init = Symbol("component/state/init");
Component.state.reset = Symbol("component/state/reset");
Component.state.patch = Symbol("component/state/patch");

Component.options = Object.create(null);
Component.options.value = Symbol("component/options/value");
Component.options.pending = Symbol("component/options/pending");
Component.options.init = Symbol("component/options/defaults");
Component.options.reset = Symbol("component/options/reset");
Component.options.patch = Symbol("component/options/patch");
Component.options.receive = Symbol("complete/options/receive");
Component.options.received = Symbol("complete/options/received");

const Patch = channel => function(diff) {
  var present = this[channel.pending] ||
                this[channel.value];
  this[channel.reset](patch(present, diff));
};
const Reset = channel => function(present) {
  this[channel.pending] = present;
  this[Component.update.schedule](this);
};

Component.prototype = {
  constructor: Component,
  __proto__: Thunk.prototype,
  [Thunk.render](component) {
    const options = this[Component.options.value];
    const state = this[Component.state.value];
    const render = this[Component.render];
    var tree = null
    if (!component || component.__proto__ !== this.__proto__) {
      tree = render(options, state)
    } else if (component[Component.update.isRequired](options, state)) {
      const pastOptions = component[Component.options.value];
      const pastState = component[Component.state.value];

      component[Component.options.receive](options);
      component[Component.update.before](state, options);
      component[Component.options.reset](options);

      tree = render(options, state)

      component[Component.update.after](pastOptions, pastState);
    }

    return tree
  },

  [Component.construct](options, children) {
    const defaults = this[Component.options.init]();
    const settings = Object.assign({}, defaults, {children:children}, options);
    this[Component.options.reset](settings);
    this[Component.state.reset](this[Component.state.init]());

  },
  [Component.mount.before]() {
  },

  // State
  [Component.state.value]: null,
  [Component.state.pending]: null,
  [Component.state.patch]: Patch(Component.state),
  [Component.state.reset]: Reset(Component.state),
  [Component.state.init]() {
    return {}
  },

  // Options
  [Component.options.value]: null,
  [Component.options.pending]: null,
  [Component.options.patch]: Patch(Component.options),
  [Component.options.reset]: Reset(Component.options),
  [Component.options.init]() {
    return {}
  },
  [Component.options.receive]() {

  },
  // Update
  [Component.update.isRequired](options, state) {
    return options !== this[Component.options.value] ||
           state !== this[Component.state.value]
  },
  [Component.update.schedule](component) {
    component[Component.update.commit]()
  },
  [Component.update.commit]() {
    const pastOptions = this[Component.options.value];
    const options = this[Component.options.pending] || pastOptions;

    const pastState = this[Component.options.value];
    const state = this[Component.options.pending] || pastState;

    this[Component.options.value] = options;
    this[Component.options.pending] = null;

    this[Component.state.value] = state;
    this[Component.state.pending] = null;
  },
  [Component.update.before](nextOptions, nextState) {
  },
  [Component.update.after](pastOptions, pastState) {
  },

  // Render
  [Component.render]() {
    throw new Error("Component must implement method with `Compnonet.render` name");
  }
};
exports.Component = Component;

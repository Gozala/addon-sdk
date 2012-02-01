/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const xpcom = require("api-utils/xpcom");
const { Cc, Ci, Cm, Cr } = require("chrome");
const { isCIDRegistered } = Cm.QueryInterface(Ci.nsIComponentRegistrar);
const { Loader } = require("./helpers");

exports['test Unknown implements nsISupports'] = function(assert) {
  let actual = xpcom.Unknown.new();
  assert.equal(actual.QueryInterface(Ci.nsISupports),
               actual,
               'component implements nsISupports');
};

exports['test implement xpcom interfaces'] = function(assert) {
  let component = xpcom.Unknown.extend({
    interfaces: [ 'nsIWeakReference' ],
    QueryReferent: function() {}
  })

  assert.equal(component.QueryInterface(Ci.nsISupports),
               component,
               'component implements nsISupports');
  assert.equal(component.QueryInterface(Ci.nsIWeakReference),
               component,
               'component implements specified interface');

  assert.throws(function() {
    component.QueryInterface(Ci.nsIObserver);
  }, "component does not implements interface");

  let actual = component.extend({
    interfaces: [ 'nsIObserver', 'nsIRequestObserver' ],
    observe: function() {},
    onStartRequest: function() {},
    onStopRequest: function() {}
  });

  assert.equal(actual.QueryInterface(Ci.nsISupports),
               actual,
               'derived component implements nsISupports');
  assert.equal(actual.QueryInterface(Ci.nsIWeakReference),
               actual,
               'derived component implements supers interface');
  assert.equal(actual.QueryInterface(Ci.nsIObserver),
               actual.QueryInterface(Ci.nsIRequestObserver),
               'derived component implements specified interfaces');
};

exports['test implement factory without contract'] = function(assert) {
  let actual = xpcom.Factory.new({
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
    })
  });

  assert.ok(isCIDRegistered(actual.classID), 'factory is regiseterd');
  xpcom.unregister(actual);
  assert.ok(!isCIDRegistered(actual.classID), 'factory is unregistered');
};

exports['test implement xpcom factory'] = function(assert) {
  let Component = xpcom.Unknown.extend({
    interfaces: [ 'nsIObserver' ],
    get wrappedJSObject() this,
    observe: function() {}
  });

  let factory = xpcom.Factory.new({
    register: false,
    contractID: '@jetpack/test/factory;1',
    component: Component
  });

  assert.ok(!isCIDRegistered(factory.classID), 'factory is not registered');
  xpcom.register(factory);
  assert.ok(isCIDRegistered(factory.classID), 'factory is registered');

  let actual = Cc[factory.contractID].createInstance(Ci.nsIObserver);

  assert.ok(Component.isPrototypeOf(actual.wrappedJSObject),
            "createInstance returnes wrapped factory instances");
};

exports['test implement xpcom service'] = function(assert) {
  let actual = xpcom.Service.new({
    contractID: '@jetpack/test/service;1',
    register: false,
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
      interfaces: [ 'nsIObserver'],
      observe: function() {},
      name: 'my-service'
    })
  });

  assert.ok(!isCIDRegistered(actual.classID), 'component is not registered');
  xpcom.register(actual);
  assert.ok(isCIDRegistered(actual.classID), 'service is regiseterd');
  assert.ok(Cc[actual.contractID].getService(Ci.nsIObserver).observe,
            'service can be accessed via get service');
  assert.equal(Cc[actual.contractID].getService(Ci.nsIObserver).wrappedJSObject,
               actual.component,
               'wrappedJSObject is an actual component');
  xpcom.unregister(actual);
  assert.ok(!isCIDRegistered(actual.classID), 'service is unregistered');
};


function testRegister(assert, text) {

  const service = xpcom.Service.new({
    className: 'test about:boop page',
    contractID: '@mozilla.org/network/protocol/about;1?what=boop',
    register: false,
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
      interfaces: [ 'nsIAboutModule' ],
      newChannel : function(aURI) {
        var ios = Cc["@mozilla.org/network/io-service;1"].
                  getService(Ci.nsIIOService);

        var channel = ios.newChannel(
          "data:text/plain," + text,
          null,
          null
        );

        channel.originalURI = aURI;
        return channel;
      },
      getURIFlags: function(aURI) {
        return Ci.nsIAboutModule.ALLOW_SCRIPT;
      }
    })
  });

  xpcom.register(service);

  assert.equal(isCIDRegistered(service.classID), true);

  // We don't want to use Cc[contractID] here because it's immutable,
  // so it can't accept updated versions of a contractID during the
  // same application session.
  var aboutFactory = xpcom.getClass(service.contractID, Ci.nsIFactory);


  var about = aboutFactory.createInstance(null, Ci.nsIAboutModule);
  var ios = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService);
  assert.equal(
    about.getURIFlags(ios.newURI("http://foo.com", null, null)),
    Ci.nsIAboutModule.ALLOW_SCRIPT
  );

  var aboutURI = ios.newURI("about:boop", null, null);
  var channel = ios.newChannelFromURI(aboutURI);
  var iStream = channel.open();
  var siStream = Cc['@mozilla.org/scriptableinputstream;1']
                 .createInstance(Ci.nsIScriptableInputStream);
  siStream.init(iStream);
  var data = new String();
  data += siStream.read(-1);
  siStream.close();
  iStream.close();
  assert.equal(data, text);

  xpcom.unregister(service);
  assert.equal(isCIDRegistered(service.classID), false);
}

exports["test register"] = function(assert) {
  testRegister(assert, "hai2u");
};

exports["test re-register"] = function(assert) {
  testRegister(assert, "hai2u again");
};

exports["test unload"] = function(assert) {
  let loader = Loader(module);
  let sbxpcom = loader.require("xpcom");

  let Auto = sbxpcom.Factory.new({
    contractID: "@mozilla.org/test/auto-unload;1",
    className: "test auto",
    component: sbxpcom.Unknown.extend({ name: 'auto' })
  });

  let Manual = sbxpcom.Factory.new({
    contractID: "@mozilla.org/test/manual-unload;1",
    className: "test manual",
    register: false,
    unregister: false,
    component: sbxpcom.Unknown.extend({ name: 'manual' })
  });

  assert.equal(isCIDRegistered(Auto.classID), true,
                   'component registered');

  assert.equal(isCIDRegistered(Manual.classID), false,
                   'component not registered');

  sbxpcom.register(Manual)
  assert.equal(isCIDRegistered(Manual.classID), true,
                   'component was automatically registered on first instance');
  loader.unload();

  assert.equal(isCIDRegistered(Auto.classID), false,
                   'component was atumatically unregistered on unload');
  assert.equal(isCIDRegistered(Manual.classID), true,
                   'component was not automatically unregistered on unload');
  sbxpcom.unregister(Manual);
  assert.equal(isCIDRegistered(Manual.classID), false,
                   'component was manually unregistered on unload');
};

require("test").run(exports)

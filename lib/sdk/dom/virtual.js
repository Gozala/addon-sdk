"use strict";

const Node = require("vtree/vnode");
const Text = require("vtree/vtext");

var create = function(tagName, properties, children, key) {
  var node = new this();
  Node.call(node, tagName, properties, children, key, node.namespaceURI);
  return node;
}
var node = function(tagName) {
  return (properties, children, key) => {
    var node = new this();
    Node.call(node, tagName, properties, children, key, node.namespaceURI);
    return node;
  }
}

const Namespace = function() {}
Namespace.create = function(namespaceURI) {
  const VirtualNodeNS = function() {};
  VirtualNodeNS.prototype = Object.create(Node.prototype);
  VirtualNodeNS.prototype.constructor = VirtualNodeNS;
  VirtualNodeNS.prototype.namespaceURI = namespaceURI;
  VirtualNodeNS.create = create;
  VirtualNodeNS.node = node;

  const namespace = new Namespace()
  namespace.namespaceURI = namespaceURI;
  namespace.Node = VirtualNodeNS;

  return namespace;
}
Namespace.prototype = new Proxy(Namespace.prototype, {
  has: (target, name, receiver) => true,
  get: (target, name, receiver) => receiver.Node.node(name)
});


exports.Node = Node;
exports.Text = Text;
exports.Namespace = Namespace;
exports.HTML = Namespace.create("http://www.w3.org/1999/xhtml");
exports.SVG = Namespace.create("http://www.w3.org/2000/svg");
exports.XUL = Namespace.create("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
exports.XBL = Namespace.create("http://www.mozilla.org/xbl");
exports.text = text => new Text(text);

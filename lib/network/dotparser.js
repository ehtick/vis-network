/* eslint-disable no-prototype-builtins */
/* eslint-disable no-unused-vars */
/* eslint-disable no-var */

/**
 * Parse a text source containing data in DOT language into a JSON object.
 * The object contains two lists: one with nodes and one with edges.
 *
 * DOT language reference: http://www.graphviz.org/doc/info/lang.html
 *
 * DOT language attributes: http://graphviz.org/content/attrs
 * @param {string} data     Text containing a graph in DOT-notation
 * @returns {object} graph   An object containing two parameters:
 *                          {Object[]} nodes
 *                          {Object[]} edges
 *
 * -------------------------------------------
 * TODO
 * ====
 *
 * For label handling, this is an incomplete implementation. From docs (quote #3015):
 *
 * > the escape sequences "\n", "\l" and "\r" divide the label into lines, centered,
 * > left-justified, and right-justified, respectively.
 *
 * Source: http://www.graphviz.org/content/attrs#kescString
 *
 * > As another aid for readability, dot allows double-quoted strings to span multiple physical
 * > lines using the standard C convention of a backslash immediately preceding a newline
 * > character
 * > In addition, double-quoted strings can be concatenated using a '+' operator.
 * > As HTML strings can contain newline characters, which are used solely for formatting,
 * > the language does not allow escaped newlines or concatenation operators to be used
 * > within them.
 *
 * - Currently, only '\\n' is handled
 * - Note that text explicitly says 'labels'; the dot parser currently handles escape
 *   sequences in **all** strings.
 */
export function parseDOT(data) {
  dot = data;
  return parseGraph();
}

// mapping of attributes from DOT (the keys) to vis.js (the values)
var NODE_ATTR_MAPPING = {
  fontsize: "font.size",
  fontcolor: "font.color",
  labelfontcolor: "font.color",
  fontname: "font.face",
  color: ["color.border", "color.background"],
  fillcolor: "color.background",
  tooltip: "title",
  labeltooltip: "title",
};
var EDGE_ATTR_MAPPING = Object.create(NODE_ATTR_MAPPING);
EDGE_ATTR_MAPPING.color = "color.color";
EDGE_ATTR_MAPPING.style = "dashes";

// token types enumeration
var TOKENTYPE = {
  NULL: 0,
  DELIMITER: 1,
  IDENTIFIER: 2,
  UNKNOWN: 3,
};

// map with all delimiters
var DELIMITERS = {
  "{": true,
  "}": true,
  "[": true,
  "]": true,
  ";": true,
  "=": true,
  ",": true,

  "->": true,
  "--": true,
};

var dot = ""; // current dot file
var index = 0; // current index in dot file
var c = ""; // current token character in expr
var token = ""; // current token
var tokenType = TOKENTYPE.NULL; // type of the token

/**
 * Get the first character from the dot file.
 * The character is stored into the char c. If the end of the dot file is
 * reached, the function puts an empty string in c.
 */
function first() {
  index = 0;
  c = dot.charAt(0);
}

/**
 * Get the next character from the dot file.
 * The character is stored into the char c. If the end of the dot file is
 * reached, the function puts an empty string in c.
 */
function next() {
  index++;
  c = dot.charAt(index);
}

/**
 * Preview the next character from the dot file.
 * @returns {string} cNext
 */
function nextPreview() {
  return dot.charAt(index + 1);
}

/**
 * Test whether given character is alphabetic or numeric ( a-zA-Z_0-9.:# )
 * @param {string} c
 * @returns {boolean} isAlphaNumeric
 */
function isAlphaNumeric(c) {
  var charCode = c.charCodeAt(0);

  if (charCode < 47) {
    // #.
    return charCode === 35 || charCode === 46;
  }
  if (charCode < 59) {
    // 0-9 and :
    return charCode > 47;
  }
  if (charCode < 91) {
    // A-Z
    return charCode > 64;
  }
  if (charCode < 96) {
    // _
    return charCode === 95;
  }
  if (charCode < 123) {
    // a-z
    return charCode > 96;
  }

  return false;
}

/**
 * Merge all options of object b into object b
 * @param {object} a
 * @param {object} b
 * @returns {object} a
 */
function merge(a, b) {
  if (!a) {
    a = {};
  }

  if (b) {
    for (var name in b) {
      if (b.hasOwnProperty(name)) {
        a[name] = b[name];
      }
    }
  }
  return a;
}

/**
 * Set a value in an object, where the provided parameter name can be a
 * path with nested parameters. For example:
 *
 * var obj = {a: 2};
 * setValue(obj, 'b.c', 3);     // obj = {a: 2, b: {c: 3}}
 * @param {object} obj
 * @param {string} path  A parameter name or dot-separated parameter path,
 *                      like "color.highlight.border".
 * @param {*} value
 */
function setValue(obj, path, value) {
  var keys = path.split(".");
  var o = obj;
  while (keys.length) {
    var key = keys.shift();
    if (keys.length) {
      // this isn't the end point
      if (!o[key]) {
        o[key] = {};
      }
      o = o[key];
    } else {
      // this is the end point
      o[key] = value;
    }
  }
}

/**
 * Add a node to a graph object. If there is already a node with
 * the same id, their attributes will be merged.
 * @param {object} graph
 * @param {object} node
 */
function addNode(graph, node) {
  var i, len;
  var current = null;

  // find root graph (in case of subgraph)
  var graphs = [graph]; // list with all graphs from current graph to root graph
  var root = graph;
  while (root.parent) {
    graphs.push(root.parent);
    root = root.parent;
  }

  // find existing node (at root level) by its id
  if (root.nodes) {
    for (i = 0, len = root.nodes.length; i < len; i++) {
      if (node.id === root.nodes[i].id) {
        current = root.nodes[i];
        break;
      }
    }
  }

  if (!current) {
    // this is a new node
    current = {
      id: node.id,
    };
    if (graph.node) {
      // clone default attributes
      current.attr = merge(current.attr, graph.node);
    }
  }

  // add node to this (sub)graph and all its parent graphs
  for (i = graphs.length - 1; i >= 0; i--) {
    var g = graphs[i];

    if (!g.nodes) {
      g.nodes = [];
    }
    if (g.nodes.indexOf(current) === -1) {
      g.nodes.push(current);
    }
  }

  // merge attributes
  if (node.attr) {
    current.attr = merge(current.attr, node.attr);
  }
}

/**
 * Add an edge to a graph object
 * @param {object} graph
 * @param {object} edge
 */
function addEdge(graph, edge) {
  if (!graph.edges) {
    graph.edges = [];
  }
  graph.edges.push(edge);
  if (graph.edge) {
    var attr = merge({}, graph.edge); // clone default attributes
    edge.attr = merge(attr, edge.attr); // merge attributes
  }
}

/**
 * Create an edge to a graph object
 * @param {object} graph
 * @param {string | number | object} from
 * @param {string | number | object} to
 * @param {string} type
 * @param {object | null} attr
 * @returns {object} edge
 */
function createEdge(graph, from, to, type, attr) {
  var edge = {
    from: from,
    to: to,
    type: type,
  };

  if (graph.edge) {
    edge.attr = merge({}, graph.edge); // clone default attributes
  }
  edge.attr = merge(edge.attr || {}, attr); // merge attributes

  // Move arrows attribute from attr to edge temporally created in
  // parseAttributeList().
  if (attr != null) {
    if (attr.hasOwnProperty("arrows") && attr["arrows"] != null) {
      edge["arrows"] = { to: { enabled: true, type: attr.arrows.type } };
      attr["arrows"] = null;
    }
  }
  return edge;
}

/**
 * Get next token in the current dot file.
 * The token and token type are available as token and tokenType
 */
function getToken() {
  tokenType = TOKENTYPE.NULL;
  token = "";

  // skip over whitespaces
  while (c === " " || c === "\t" || c === "\n" || c === "\r") {
    // space, tab, enter
    next();
  }

  do {
    var isComment = false;

    // skip comment
    if (c === "#") {
      // find the previous non-space character
      var i = index - 1;
      while (dot.charAt(i) === " " || dot.charAt(i) === "\t") {
        i--;
      }
      if (dot.charAt(i) === "\n" || dot.charAt(i) === "") {
        // the # is at the start of a line, this is indeed a line comment
        while (c != "" && c != "\n") {
          next();
        }
        isComment = true;
      }
    }
    if (c === "/" && nextPreview() === "/") {
      // skip line comment
      while (c != "" && c != "\n") {
        next();
      }
      isComment = true;
    }
    if (c === "/" && nextPreview() === "*") {
      // skip block comment
      while (c != "") {
        if (c === "*" && nextPreview() === "/") {
          // end of block comment found. skip these last two characters
          next();
          next();
          break;
        } else {
          next();
        }
      }
      isComment = true;
    }

    // skip over whitespaces
    while (c === " " || c === "\t" || c === "\n" || c === "\r") {
      // space, tab, enter
      next();
    }
  } while (isComment);

  // check for end of dot file
  if (c === "") {
    // token is still empty
    tokenType = TOKENTYPE.DELIMITER;
    return;
  }

  // check for delimiters consisting of 2 characters
  var c2 = c + nextPreview();
  if (DELIMITERS[c2]) {
    tokenType = TOKENTYPE.DELIMITER;
    token = c2;
    next();
    next();
    return;
  }

  // check for delimiters consisting of 1 character
  if (DELIMITERS[c]) {
    tokenType = TOKENTYPE.DELIMITER;
    token = c;
    next();
    return;
  }

  // check for an identifier (number or string)
  // TODO: more precise parsing of numbers/strings (and the port separator ':')
  if (isAlphaNumeric(c) || c === "-") {
    token += c;
    next();

    while (isAlphaNumeric(c)) {
      token += c;
      next();
    }
    if (token === "false") {
      token = false; // convert to boolean
    } else if (token === "true") {
      token = true; // convert to boolean
    } else if (!isNaN(Number(token))) {
      token = Number(token); // convert to number
    }
    tokenType = TOKENTYPE.IDENTIFIER;
    return;
  }

  // check for a string enclosed by double quotes
  if (c === '"') {
    next();
    while (c != "" && (c != '"' || (c === '"' && nextPreview() === '"'))) {
      if (c === '"') {
        // skip the escape character
        token += c;
        next();
      } else if (c === "\\" && nextPreview() === "n") {
        // Honor a newline escape sequence
        token += "\n";
        next();
      } else {
        token += c;
      }
      next();
    }
    if (c != '"') {
      throw newSyntaxError('End of string " expected');
    }
    next();
    tokenType = TOKENTYPE.IDENTIFIER;
    return;
  }

  // something unknown is found, wrong characters, a syntax error
  tokenType = TOKENTYPE.UNKNOWN;
  while (c != "") {
    token += c;
    next();
  }
  throw new SyntaxError('Syntax error in part "' + chop(token, 30) + '"');
}

/**
 * Parse a graph.
 * @returns {object} graph
 */
function parseGraph() {
  var graph = {};

  first();
  getToken();

  // optional strict keyword
  if (token === "strict") {
    graph.strict = true;
    getToken();
  }

  // graph or digraph keyword
  if (token === "graph" || token === "digraph") {
    graph.type = token;
    getToken();
  }

  // optional graph id
  if (tokenType === TOKENTYPE.IDENTIFIER) {
    graph.id = token;
    getToken();
  }

  // open angle bracket
  if (token != "{") {
    throw newSyntaxError("Angle bracket { expected");
  }
  getToken();

  // statements
  parseStatements(graph);

  // close angle bracket
  if (token != "}") {
    throw newSyntaxError("Angle bracket } expected");
  }
  getToken();

  // end of file
  if (token !== "") {
    throw newSyntaxError("End of file expected");
  }
  getToken();

  // remove temporary default options
  delete graph.node;
  delete graph.edge;
  delete graph.graph;

  return graph;
}

/**
 * Parse a list with statements.
 * @param {object} graph
 */
function parseStatements(graph) {
  while (token !== "" && token != "}") {
    parseStatement(graph);
    if (token === ";") {
      getToken();
    }
  }
}

/**
 * Parse a single statement. Can be a an attribute statement, node
 * statement, a series of node statements and edge statements, or a
 * parameter.
 * @param {object} graph
 */
function parseStatement(graph) {
  // parse subgraph
  var subgraph = parseSubgraph(graph);
  if (subgraph) {
    // edge statements
    parseEdge(graph, subgraph);

    return;
  }

  // parse an attribute statement
  var attr = parseAttributeStatement(graph);
  if (attr) {
    return;
  }

  // parse node
  if (tokenType != TOKENTYPE.IDENTIFIER) {
    throw newSyntaxError("Identifier expected");
  }
  var id = token; // id can be a string or a number
  getToken();

  if (token === "=") {
    // id statement
    getToken();
    if (tokenType != TOKENTYPE.IDENTIFIER) {
      throw newSyntaxError("Identifier expected");
    }
    graph[id] = token;
    getToken();
    // TODO: implement comma separated list with "a_list: ID=ID [','] [a_list] "
  } else {
    parseNodeStatement(graph, id);
  }
}

/**
 * Parse a subgraph
 * @param {object} graph    parent graph object
 * @returns {object | null} subgraph
 */
function parseSubgraph(graph) {
  var subgraph = null;

  // optional subgraph keyword
  if (token === "subgraph") {
    subgraph = {};
    subgraph.type = "subgraph";
    getToken();

    // optional graph id
    if (tokenType === TOKENTYPE.IDENTIFIER) {
      subgraph.id = token;
      getToken();
    }
  }

  // open angle bracket
  if (token === "{") {
    getToken();

    if (!subgraph) {
      subgraph = {};
    }
    subgraph.parent = graph;
    subgraph.node = graph.node;
    subgraph.edge = graph.edge;
    subgraph.graph = graph.graph;

    // statements
    parseStatements(subgraph);

    // close angle bracket
    if (token != "}") {
      throw newSyntaxError("Angle bracket } expected");
    }
    getToken();

    // remove temporary default options
    delete subgraph.node;
    delete subgraph.edge;
    delete subgraph.graph;
    delete subgraph.parent;

    // register at the parent graph
    if (!graph.subgraphs) {
      graph.subgraphs = [];
    }
    graph.subgraphs.push(subgraph);
  }

  return subgraph;
}

/**
 * parse an attribute statement like "node [shape=circle fontSize=16]".
 * Available keywords are 'node', 'edge', 'graph'.
 * The previous list with default attributes will be replaced
 * @param {object} graph
 * @returns {string | null} keyword Returns the name of the parsed attribute
 *                                  (node, edge, graph), or null if nothing
 *                                  is parsed.
 */
function parseAttributeStatement(graph) {
  // attribute statements
  if (token === "node") {
    getToken();

    // node attributes
    graph.node = parseAttributeList();
    return "node";
  } else if (token === "edge") {
    getToken();

    // edge attributes
    graph.edge = parseAttributeList();
    return "edge";
  } else if (token === "graph") {
    getToken();

    // graph attributes
    graph.graph = parseAttributeList();
    return "graph";
  }

  return null;
}

/**
 * parse a node statement
 * @param {object} graph
 * @param {string | number} id
 */
function parseNodeStatement(graph, id) {
  // node statement
  var node = {
    id: id,
  };
  var attr = parseAttributeList();
  if (attr) {
    node.attr = attr;
  }
  addNode(graph, node);

  // edge statements
  parseEdge(graph, id);
}

/**
 * Parse an edge or a series of edges
 * @param {object} graph
 * @param {string | number} from        Id of the from node
 */
function parseEdge(graph, from) {
  while (token === "->" || token === "--") {
    var to;
    var type = token;
    getToken();

    var subgraph = parseSubgraph(graph);
    if (subgraph) {
      to = subgraph;
    } else {
      if (tokenType != TOKENTYPE.IDENTIFIER) {
        throw newSyntaxError("Identifier or subgraph expected");
      }
      to = token;
      addNode(graph, {
        id: to,
      });
      getToken();
    }

    // parse edge attributes
    var attr = parseAttributeList();

    // create edge
    var edge = createEdge(graph, from, to, type, attr);
    addEdge(graph, edge);

    from = to;
  }
}

/**
 * As explained in [1], graphviz has limitations for combination of
 * arrow[head|tail] and dir. If attribute list includes 'dir',
 * following cases just be supported.
 * 1. both or none + arrowhead, arrowtail
 * 2. forward + arrowhead (arrowtail is not affedted)
 * 3. back + arrowtail (arrowhead is not affected)
 * [1] https://www.graphviz.org/doc/info/attrs.html#h:undir_note
 *
 * This function is called from parseAttributeList() to parse 'dir'
 * attribute with given 'attr_names' and 'attr_list'.
 * @param {object} attr_names  Array of attribute names
 * @param {object} attr_list  Array of objects of attribute set
 * @returns {object} attr_list  Updated attr_list
 */
function parseDirAttribute(attr_names, attr_list) {
  var i;
  if (attr_names.includes("dir")) {
    var idx = {}; // get index of 'arrows' and 'dir'
    idx.arrows = {};
    for (i = 0; i < attr_list.length; i++) {
      if (attr_list[i].name === "arrows") {
        if (attr_list[i].value.to != null) {
          idx.arrows.to = i;
        } else if (attr_list[i].value.from != null) {
          idx.arrows.from = i;
        } else {
          throw newSyntaxError("Invalid value of arrows");
        }
      } else if (attr_list[i].name === "dir") {
        idx.dir = i;
      }
    }

    // first, add default arrow shape if it is not assigned to avoid error
    var dir_type = attr_list[idx.dir].value;
    if (!attr_names.includes("arrows")) {
      if (dir_type === "both") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { to: { enabled: true } },
        });
        idx.arrows.to = attr_list.length - 1;
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { from: { enabled: true } },
        });
        idx.arrows.from = attr_list.length - 1;
      } else if (dir_type === "forward") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { to: { enabled: true } },
        });
        idx.arrows.to = attr_list.length - 1;
      } else if (dir_type === "back") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { from: { enabled: true } },
        });
        idx.arrows.from = attr_list.length - 1;
      } else if (dir_type === "none") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: "",
        });
        idx.arrows.to = attr_list.length - 1;
      } else {
        throw newSyntaxError('Invalid dir type "' + dir_type + '"');
      }
    }

    var from_type;
    var to_type;
    // update 'arrows' attribute from 'dir'.
    if (dir_type === "both") {
      // both of shapes of 'from' and 'to' are given
      if (idx.arrows.to && idx.arrows.from) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
        attr_list.splice(idx.arrows.from, 1);

        // shape of 'to' is assigned and use default to 'from'
      } else if (idx.arrows.to) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "arrow";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // only shape of 'from' is assigned and use default for 'to'
      } else if (idx.arrows.from) {
        to_type = "arrow";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }
    } else if (dir_type === "back") {
      // given both of shapes, but use only 'from'
      if (idx.arrows.to && idx.arrows.from) {
        to_type = "";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // given shape of 'to', but does not use it
      } else if (idx.arrows.to) {
        to_type = "";
        from_type = "arrow";
        idx.arrows.from = idx.arrows.to;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // assign given 'from' shape
      } else if (idx.arrows.from) {
        to_type = "";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }

      attr_list[idx.arrows.from] = {
        attr: attr_list[idx.arrows.from].attr,
        name: attr_list[idx.arrows.from].name,
        value: {
          from: {
            enabled: true,
            type: attr_list[idx.arrows.from].value.from.type,
          },
        },
      };
    } else if (dir_type === "none") {
      var idx_arrow;
      if (idx.arrows.to) {
        idx_arrow = idx.arrows.to;
      } else {
        idx_arrow = idx.arrows.from;
      }

      attr_list[idx_arrow] = {
        attr: attr_list[idx_arrow].attr,
        name: attr_list[idx_arrow].name,
        value: "",
      };
    } else if (dir_type === "forward") {
      // given both of shapes, but use only 'to'
      if (idx.arrows.to && idx.arrows.from) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // assign given 'to' shape
      } else if (idx.arrows.to) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // given shape of 'from', but does not use it
      } else if (idx.arrows.from) {
        to_type = "arrow";
        from_type = "";
        idx.arrows.to = idx.arrows.from;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }

      attr_list[idx.arrows.to] = {
        attr: attr_list[idx.arrows.to].attr,
        name: attr_list[idx.arrows.to].name,
        value: {
          to: {
            enabled: true,
            type: attr_list[idx.arrows.to].value.to.type,
          },
        },
      };
    } else {
      throw newSyntaxError('Invalid dir type "' + dir_type + '"');
    }

    // remove 'dir' attribute no need anymore
    attr_list.splice(idx.dir, 1);
  }
  return attr_list;
}

/**
 * Parse a set with attributes,
 * for example [label="1.000", shape=solid]
 * @returns {object | null} attr
 */
function parseAttributeList() {
  var i;
  var attr = null;

  // edge styles of dot and vis
  var edgeStyles = {
    dashed: true,
    solid: false,
    dotted: [1, 5],
  };

  /**
   * Define arrow types.
   * vis currently supports types defined in 'arrowTypes'.
   * Details of arrow shapes are described in
   * http://www.graphviz.org/content/arrow-shapes
   */
  var arrowTypes = {
    dot: "circle",
    box: "box",
    crow: "crow",
    curve: "curve",
    icurve: "inv_curve",
    normal: "triangle",
    inv: "inv_triangle",
    diamond: "diamond",
    tee: "bar",
    vee: "vee",
  };

  /**
   * 'attr_list' contains attributes for checking if some of them are affected
   * later. For instance, both of 'arrowhead' and 'dir' (edge style defined
   * in DOT) make changes to 'arrows' attribute in vis.
   */
  var attr_list = new Array();
  var attr_names = new Array(); // used for checking the case.

  // parse attributes
  while (token === "[") {
    getToken();
    attr = {};
    while (token !== "" && token != "]") {
      if (tokenType != TOKENTYPE.IDENTIFIER) {
        throw newSyntaxError("Attribute name expected");
      }
      var name = token;

      getToken();
      if (token != "=") {
        throw newSyntaxError("Equal sign = expected");
      }
      getToken();

      if (tokenType != TOKENTYPE.IDENTIFIER) {
        throw newSyntaxError("Attribute value expected");
      }
      var value = token;

      // convert from dot style to vis
      if (name === "style") {
        value = edgeStyles[value];
      }

      var arrowType;
      if (name === "arrowhead") {
        arrowType = arrowTypes[value];
        name = "arrows";
        value = { to: { enabled: true, type: arrowType } };
      }

      if (name === "arrowtail") {
        arrowType = arrowTypes[value];
        name = "arrows";
        value = { from: { enabled: true, type: arrowType } };
      }

      attr_list.push({ attr: attr, name: name, value: value });
      attr_names.push(name);

      getToken();
      if (token == ",") {
        getToken();
      }
    }

    if (token != "]") {
      throw newSyntaxError("Bracket ] expected");
    }
    getToken();
  }

  /**
   * As explained in [1], graphviz has limitations for combination of
   * arrow[head|tail] and dir. If attribute list includes 'dir',
   * following cases just be supported.
   *   1. both or none + arrowhead, arrowtail
   *   2. forward + arrowhead (arrowtail is not affedted)
   *   3. back + arrowtail (arrowhead is not affected)
   * [1] https://www.graphviz.org/doc/info/attrs.html#h:undir_note
   */
  if (attr_names.includes("dir")) {
    var idx = {}; // get index of 'arrows' and 'dir'
    idx.arrows = {};
    for (i = 0; i < attr_list.length; i++) {
      if (attr_list[i].name === "arrows") {
        if (attr_list[i].value.to != null) {
          idx.arrows.to = i;
        } else if (attr_list[i].value.from != null) {
          idx.arrows.from = i;
        } else {
          throw newSyntaxError("Invalid value of arrows");
        }
      } else if (attr_list[i].name === "dir") {
        idx.dir = i;
      }
    }

    // first, add default arrow shape if it is not assigned to avoid error
    var dir_type = attr_list[idx.dir].value;
    if (!attr_names.includes("arrows")) {
      if (dir_type === "both") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { to: { enabled: true } },
        });
        idx.arrows.to = attr_list.length - 1;
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { from: { enabled: true } },
        });
        idx.arrows.from = attr_list.length - 1;
      } else if (dir_type === "forward") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { to: { enabled: true } },
        });
        idx.arrows.to = attr_list.length - 1;
      } else if (dir_type === "back") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: { from: { enabled: true } },
        });
        idx.arrows.from = attr_list.length - 1;
      } else if (dir_type === "none") {
        attr_list.push({
          attr: attr_list[idx.dir].attr,
          name: "arrows",
          value: "",
        });
        idx.arrows.to = attr_list.length - 1;
      } else {
        throw newSyntaxError('Invalid dir type "' + dir_type + '"');
      }
    }

    var from_type;
    var to_type;
    // update 'arrows' attribute from 'dir'.
    if (dir_type === "both") {
      // both of shapes of 'from' and 'to' are given
      if (idx.arrows.to && idx.arrows.from) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
        attr_list.splice(idx.arrows.from, 1);

        // shape of 'to' is assigned and use default to 'from'
      } else if (idx.arrows.to) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "arrow";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // only shape of 'from' is assigned and use default for 'to'
      } else if (idx.arrows.from) {
        to_type = "arrow";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }
    } else if (dir_type === "back") {
      // given both of shapes, but use only 'from'
      if (idx.arrows.to && idx.arrows.from) {
        to_type = "";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // given shape of 'to', but does not use it
      } else if (idx.arrows.to) {
        to_type = "";
        from_type = "arrow";
        idx.arrows.from = idx.arrows.to;
        attr_list[idx.arrows.from] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // assign given 'from' shape
      } else if (idx.arrows.from) {
        to_type = "";
        from_type = attr_list[idx.arrows.from].value.from.type;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.from].attr,
          name: attr_list[idx.arrows.from].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }

      attr_list[idx.arrows.from] = {
        attr: attr_list[idx.arrows.from].attr,
        name: attr_list[idx.arrows.from].name,
        value: {
          from: {
            enabled: true,
            type: attr_list[idx.arrows.from].value.from.type,
          },
        },
      };
    } else if (dir_type === "none") {
      var idx_arrow;
      if (idx.arrows.to) {
        idx_arrow = idx.arrows.to;
      } else {
        idx_arrow = idx.arrows.from;
      }

      attr_list[idx_arrow] = {
        attr: attr_list[idx_arrow].attr,
        name: attr_list[idx_arrow].name,
        value: "",
      };
    } else if (dir_type === "forward") {
      // given both of shapes, but use only 'to'
      if (idx.arrows.to && idx.arrows.from) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // assign given 'to' shape
      } else if (idx.arrows.to) {
        to_type = attr_list[idx.arrows.to].value.to.type;
        from_type = "";
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };

        // given shape of 'from', but does not use it
      } else if (idx.arrows.from) {
        to_type = "arrow";
        from_type = "";
        idx.arrows.to = idx.arrows.from;
        attr_list[idx.arrows.to] = {
          attr: attr_list[idx.arrows.to].attr,
          name: attr_list[idx.arrows.to].name,
          value: {
            to: { enabled: true, type: to_type },
            from: { enabled: true, type: from_type },
          },
        };
      }

      attr_list[idx.arrows.to] = {
        attr: attr_list[idx.arrows.to].attr,
        name: attr_list[idx.arrows.to].name,
        value: {
          to: { enabled: true, type: attr_list[idx.arrows.to].value.to.type },
        },
      };
    } else {
      throw newSyntaxError('Invalid dir type "' + dir_type + '"');
    }

    // remove 'dir' attribute no need anymore
    attr_list.splice(idx.dir, 1);
  }

  // parse 'penwidth'
  var nof_attr_list;
  if (attr_names.includes("penwidth")) {
    var tmp_attr_list = [];

    nof_attr_list = attr_list.length;
    for (i = 0; i < nof_attr_list; i++) {
      // exclude 'width' from attr_list if 'penwidth' exists
      if (attr_list[i].name !== "width") {
        if (attr_list[i].name === "penwidth") {
          attr_list[i].name = "width";
        }
        tmp_attr_list.push(attr_list[i]);
      }
    }
    attr_list = tmp_attr_list;
  }

  nof_attr_list = attr_list.length;
  for (i = 0; i < nof_attr_list; i++) {
    setValue(attr_list[i].attr, attr_list[i].name, attr_list[i].value);
  }

  return attr;
}

/**
 * Create a syntax error with extra information on current token and index.
 * @param {string} message
 * @returns {SyntaxError} err
 */
function newSyntaxError(message) {
  return new SyntaxError(
    message + ', got "' + chop(token, 30) + '" (char ' + index + ")",
  );
}

/**
 * Chop off text after a maximum length
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function chop(text, maxLength) {
  return text.length <= maxLength ? text : text.substr(0, 27) + "...";
}

/**
 * Execute a function fn for each pair of elements in two arrays
 * @param {Array | *} array1
 * @param {Array | *} array2
 * @param {Function} fn
 */
function forEach2(array1, array2, fn) {
  if (Array.isArray(array1)) {
    array1.forEach(function (elem1) {
      if (Array.isArray(array2)) {
        array2.forEach(function (elem2) {
          fn(elem1, elem2);
        });
      } else {
        fn(elem1, array2);
      }
    });
  } else {
    if (Array.isArray(array2)) {
      array2.forEach(function (elem2) {
        fn(array1, elem2);
      });
    } else {
      fn(array1, array2);
    }
  }
}

/**
 * Set a nested property on an object
 * When nested objects are missing, they will be created.
 * For example setProp({}, 'font.color', 'red') will return {font: {color: 'red'}}
 * @param {object} object
 * @param {string} path   A dot separated string like 'font.color'
 * @param {*} value       Value for the property
 * @returns {object} Returns the original object, allows for chaining.
 */
function setProp(object, path, value) {
  var names = path.split(".");
  var prop = names.pop();

  // traverse over the nested objects
  var obj = object;
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (!(name in obj)) {
      obj[name] = {};
    }
    obj = obj[name];
  }

  // set the property value
  obj[prop] = value;

  return object;
}

/**
 * Convert an object with DOT attributes to their vis.js equivalents.
 * @param {object} attr     Object with DOT attributes
 * @param {object} mapping
 * @returns {object}         Returns an object with vis.js attributes
 */
function convertAttr(attr, mapping) {
  var converted = {};

  for (var prop in attr) {
    if (attr.hasOwnProperty(prop)) {
      var visProp = mapping[prop];
      if (Array.isArray(visProp)) {
        visProp.forEach(function (visPropI) {
          setProp(converted, visPropI, attr[prop]);
        });
      } else if (typeof visProp === "string") {
        setProp(converted, visProp, attr[prop]);
      } else {
        setProp(converted, prop, attr[prop]);
      }
    }
  }

  return converted;
}

/**
 * Convert a string containing a graph in DOT language into a map containing
 * with nodes and edges in the format of graph.
 * @param {string} data         Text containing a graph in DOT-notation
 * @returns {object} graphData
 */
export function DOTToGraph(data) {
  // parse the DOT file
  var dotData = parseDOT(data);
  var graphData = {
    nodes: [],
    edges: [],
    options: {},
  };

  // copy the nodes
  if (dotData.nodes) {
    dotData.nodes.forEach(function (dotNode) {
      var graphNode = {
        id: dotNode.id,
        label: String(dotNode.label || dotNode.id),
      };
      merge(graphNode, convertAttr(dotNode.attr, NODE_ATTR_MAPPING));
      if (graphNode.image) {
        graphNode.shape = "image";
      }
      graphData.nodes.push(graphNode);
    });
  }

  // copy the edges
  if (dotData.edges) {
    /**
     * Convert an edge in DOT format to an edge with VisGraph format
     * @param {object} dotEdge
     * @returns {object} graphEdge
     */
    var convertEdge = function (dotEdge) {
      var graphEdge = {
        from: dotEdge.from,
        to: dotEdge.to,
      };
      merge(graphEdge, convertAttr(dotEdge.attr, EDGE_ATTR_MAPPING));

      // Add arrows attribute to default styled arrow.
      // The reason why default style is not added in parseAttributeList() is
      // because only default is cleared before here.
      if (graphEdge.arrows == null && dotEdge.type === "->") {
        graphEdge.arrows = "to";
      }

      return graphEdge;
    };

    dotData.edges.forEach(function (dotEdge) {
      var from, to;
      if (dotEdge.from instanceof Object) {
        from = dotEdge.from.nodes;
      } else {
        from = {
          id: dotEdge.from,
        };
      }

      if (dotEdge.to instanceof Object) {
        to = dotEdge.to.nodes;
      } else {
        to = {
          id: dotEdge.to,
        };
      }

      if (dotEdge.from instanceof Object && dotEdge.from.edges) {
        dotEdge.from.edges.forEach(function (subEdge) {
          var graphEdge = convertEdge(subEdge);
          graphData.edges.push(graphEdge);
        });
      }

      forEach2(from, to, function (from, to) {
        var subEdge = createEdge(
          graphData,
          from.id,
          to.id,
          dotEdge.type,
          dotEdge.attr,
        );
        var graphEdge = convertEdge(subEdge);
        graphData.edges.push(graphEdge);
      });

      if (dotEdge.to instanceof Object && dotEdge.to.edges) {
        dotEdge.to.edges.forEach(function (subEdge) {
          var graphEdge = convertEdge(subEdge);
          graphData.edges.push(graphEdge);
        });
      }
    });
  }

  // copy the options
  if (dotData.attr) {
    graphData.options = dotData.attr;
  }

  return graphData;
}

/* eslint-enable no-var */
/* eslint-enable no-unused-vars */
/* eslint-enable no-prototype-builtins */

/* eslint require-jsdoc: "off" */
/* eslint valid-jsdoc: "off" */

/**
 * TODO - add tests for:
 * ====
 *
 * - html entities
 * - html unclosed or unopened tags
 * - html tag combinations with no font defined (e.g. bold within mono)
 * - Unit tests for bad font shorthands.
 *   Currently, only "size[px] name color" is valid, always 3 items with this exact spacing.
 *   All other combinations should either be rejected as error or handled gracefully.
 */
import { expect } from "chai";
import * as util from "vis-util/esnext";
import { DataSet } from "vis-data/esnext";

import { canvasMockify } from "./canvas-mock.js";

import Label from "../lib/network/modules/components/shared/Label.js";
import NodesHandler from "../lib/network/modules/NodesHandler.js";
import Network from "../lib/network/Network.js";
import { isValidLabel } from "../lib/network/modules/components/shared/ComponentUtil.js";

/**************************************************************
 * Dummy class definitions for minimal required functionality.
 **************************************************************/

class DummyContext {
  measureText(text) {
    return {
      width: 12 * text.length,
      height: 14,
    };
  }
}

class DummyLayoutEngine {
  positionInitially() {}
}

/**************************************************************
 * End Dummy class definitions
 **************************************************************/

describe("Network Label", function () {
  /**
   * Retrieve options object from a NodesHandler instance
   *
   * NOTE: these are options at the node-level
   * @param options
   */
  function getOptions(options = {}) {
    const body = {
      functions: {},
      emitter: {
        on: function () {},
      },
    };

    const nodesHandler = new NodesHandler(
      body,
      {},
      options,
      new DummyLayoutEngine(),
    );
    //console.log(JSON.stringify(nodesHandler.options, null, 2));

    return nodesHandler.options;
  }

  /**
   * Check if the returned lines and blocks are as expected.
   *
   * All width/height fields and font info are ignored.
   * Within blocks, only the text is compared
   * @param returned
   * @param expected
   */
  function checkBlocks(returned, expected) {
    const showBlocks = () => {
      return (
        "\nreturned: " +
        JSON.stringify(returned, null, 2) +
        "\n" +
        "expected: " +
        JSON.stringify(expected, null, 2)
      );
    };

    expect(expected.lines.length).to.equal(
      returned.lines.length,
      "Number of lines does not match, " + showBlocks(),
    );

    for (let i = 0; i < returned.lines.length; ++i) {
      const retLine = returned.lines[i];
      const expLine = expected.lines[i];

      expect(retLine.blocks.length).to.equal(
        expLine.blocks.length,
        "Number of blocks does not match, " + showBlocks(),
      );
      for (let j = 0; j < retLine.blocks.length; ++j) {
        const retBlock = retLine.blocks[j];
        const expBlock = expLine.blocks[j];

        expect(retBlock.text).to.equal(
          expBlock.text,
          "Text does not match, " + showBlocks(),
        );

        expect(retBlock.mod).to.not.be.undefined;
        if (retBlock.mod === "normal" || retBlock.mod === "") {
          expect(
            expBlock.mod,
            "No mod field expected in returned, " + showBlocks(),
          ).to.be.oneOf([undefined, "normal", ""]);
        } else {
          expect(retBlock.mod).to.equal(
            expBlock.mod,
            "Mod fields do not match, line: " +
              i +
              ", block: " +
              j +
              "; ret: " +
              retBlock.mod +
              ", exp: " +
              expBlock.mod +
              "\n" +
              showBlocks(),
          );
        }
      }
    }
  }

  function checkProcessedLabels(label, text, expected) {
    const ctx = new DummyContext();

    for (const i of Object.keys(text)) {
      const ret = label._processLabelText(ctx, false, false, text[i]);
      //console.log(JSON.stringify(ret, null, 2));
      checkBlocks(ret, expected[i]);
    }
  }

  /**************************************************************
   * Test data
   **************************************************************/

  const normal_text = [
    "label text",
    "label\nwith\nnewlines",
    "OnereallylongwordthatshouldgooverwidthConstraint.maximumifdefined",
    "One really long sentence that should go over widthConstraint.maximum if defined",
    "Reallyoneenormouslylargelabel withtwobigwordsgoingoverwayovermax",
  ];

  const html_text = [
    "label <b>with</b> <code>some</code> <i>multi <b>tags</b></i>",
    "label <b>with</b> <code>some</code> \n <i>multi <b>tags</b></i>\n and newlines", // NB spaces around \n's
  ];

  const markdown_text = [
    "label *with* `some` _multi *tags*_",
    "label *with* `some` \n _multi *tags*_\n and newlines", // NB spaces around \n's
  ];

  /**************************************************************
   * Expected Results
   **************************************************************/

  const normal_expected = [
    {
      // In first item, width/height kept in for reference
      width: 120,
      height: 14,
      lines: [
        {
          width: 120,
          height: 14,
          blocks: [
            {
              text: "label text",
              width: 120,
              height: 14,
            },
          ],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "label" }],
        },
        {
          blocks: [{ text: "with" }],
        },
        {
          blocks: [{ text: "newlines" }],
        },
      ],
    },
    {
      // From here onward, changes width max width set
      lines: [
        {
          blocks: [
            {
              text: "OnereallylongwordthatshouldgooverwidthConstraint.maximumifdefined",
            },
          ],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [
            {
              text: "One really long sentence that should go over widthConstraint.maximum if defined",
            },
          ],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [
            {
              text: "Reallyoneenormouslylargelabel withtwobigwordsgoingoverwayovermax",
            },
          ],
        },
      ],
    },
  ];

  const indexWidthConstrained = 2; // index of first item that will be different with max width set

  const normal_widthConstraint_expected = normal_expected.slice(
    0,
    indexWidthConstrained,
  );
  Array.prototype.push.apply(normal_widthConstraint_expected, [
    {
      lines: [
        {
          blocks: [{ text: "Onereallylongwordthatshoul" }],
        },
        {
          blocks: [{ text: "dgooverwidthConstraint.max" }],
        },
        {
          blocks: [{ text: "imumifdefined" }],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "One really long" }],
        },
        {
          blocks: [{ text: "sentence that should" }],
        },
        {
          blocks: [{ text: "go over" }],
        },
        {
          blocks: [{ text: "widthConstraint.maximum" }],
        },
        {
          blocks: [{ text: "if defined" }],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "Reallyoneenormouslylargela" }],
        },
        {
          blocks: [{ text: "bel" }],
        },
        {
          blocks: [{ text: "withtwobigwordsgoingoverwa" }],
        },
        {
          blocks: [{ text: "yovermax" }],
        },
      ],
    },
  ]);

  const html_unchanged_expected = [
    {
      lines: [
        {
          blocks: [
            {
              text: "label <b>with</b> <code>some</code> <i>multi <b>tags</b></i>",
            },
          ],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "label <b>with</b> <code>some</code> " }],
        },
        {
          blocks: [{ text: " <i>multi <b>tags</b></i>" }],
        },
        {
          blocks: [{ text: " and newlines" }],
        },
      ],
    },
  ];

  const html_widthConstraint_unchanged = [
    {
      lines: [
        {
          blocks: [{ text: "label <b>with</b>" }],
        },
        {
          blocks: [{ text: "<code>some</code>" }],
        },
        {
          blocks: [{ text: "<i>multi" }],
        },
        {
          blocks: [{ text: "<b>tags</b></i>" }],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "label <b>with</b>" }],
        },
        {
          blocks: [{ text: "<code>some</code> " }],
        },
        {
          blocks: [{ text: " <i>multi" }],
        },
        {
          blocks: [{ text: "<b>tags</b></i>" }],
        },
        {
          blocks: [{ text: " and newlines" }],
        },
      ],
    },
  ];

  const markdown_unchanged_expected = [
    {
      lines: [
        {
          blocks: [{ text: "label *with* `some` _multi *tags*_" }],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "label *with* `some` " }],
        },
        {
          blocks: [{ text: " _multi *tags*_" }],
        },
        {
          blocks: [{ text: " and newlines" }],
        },
      ],
    },
  ];

  const markdown_widthConstraint_expected = [
    {
      lines: [
        {
          blocks: [{ text: "label *with* `some`" }],
        },
        {
          blocks: [{ text: "_multi *tags*_" }],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [{ text: "label *with* `some` " }],
        },
        {
          blocks: [{ text: " _multi *tags*_" }],
        },
        {
          blocks: [{ text: " and newlines" }],
        },
      ],
    },
  ];

  const multi_expected = [
    {
      lines: [
        {
          blocks: [
            { text: "label " },
            { text: "with", mod: "bold" },
            { text: " " },
            { text: "some", mod: "mono" },
            { text: " " },
            { text: "multi ", mod: "ital" },
            { text: "tags", mod: "boldital" },
          ],
        },
      ],
    },
    {
      lines: [
        {
          blocks: [
            { text: "label " },
            { text: "with", mod: "bold" },
            { text: " " },
            { text: "some", mod: "mono" },
            { text: " " },
          ],
        },
        {
          blocks: [
            { text: " " },
            { text: "multi ", mod: "ital" },
            { text: "tags", mod: "boldital" },
          ],
        },
        {
          blocks: [{ text: " and newlines" }],
        },
      ],
    },
  ];

  /**************************************************************
   * End Expected Results
   **************************************************************/

  before(function () {
    this.jsdom_global = canvasMockify("<div id='mynetwork'></div>");
    this.container = document.getElementById("mynetwork");
  });

  after(function () {
    this.jsdom_global();
  });

  it("parses normal text labels", function () {
    const label = new Label({}, getOptions());

    checkProcessedLabels(label, normal_text, normal_expected);
    checkProcessedLabels(label, html_text, html_unchanged_expected); // html unchanged
    checkProcessedLabels(label, markdown_text, markdown_unchanged_expected); // markdown unchanged
  });

  it("parses html labels", function () {
    const options = getOptions();
    options.font.multi = true; // TODO: also test 'html', also test illegal value here

    const label = new Label({}, options);

    checkProcessedLabels(label, normal_text, normal_expected); // normal as usual
    checkProcessedLabels(label, html_text, multi_expected);
    checkProcessedLabels(label, markdown_text, markdown_unchanged_expected); // markdown unchanged
  });

  it("parses markdown labels", function () {
    const options = getOptions();
    options.font.multi = "markdown"; // TODO: also test 'md', also test illegal value here

    const label = new Label({}, options);

    checkProcessedLabels(label, normal_text, normal_expected); // normal as usual
    checkProcessedLabels(label, html_text, html_unchanged_expected); // html unchanged
    checkProcessedLabels(label, markdown_text, multi_expected);
  });

  it("handles normal text with widthConstraint.maximum", function () {
    const options = getOptions();

    //
    // What the user would set:
    //
    //   options.widthConstraint = { minimum: 100, maximum: 200};
    //
    // No sense in adding minWdt, not used when splitting labels into lines
    //
    // This comment also applies to the usage of maxWdt in the test cases below
    //
    options.font.maxWdt = 300;

    let label = new Label({}, options);

    checkProcessedLabels(label, normal_text, normal_widthConstraint_expected);
    checkProcessedLabels(label, html_text, html_widthConstraint_unchanged); // html unchanged

    // Following is an unlucky selection, because the first line broken on the final character (space)
    // So we cheat a bit here
    options.font.maxWdt = 320;
    label = new Label({}, options);
    checkProcessedLabels(
      label,
      markdown_text,
      markdown_widthConstraint_expected,
    ); // markdown unchanged
  });

  it("handles html tags with widthConstraint.maximum", function () {
    const options = getOptions();
    options.font.multi = true;
    options.font.maxWdt = 300;

    let label = new Label({}, options);

    checkProcessedLabels(label, normal_text, normal_widthConstraint_expected);
    checkProcessedLabels(label, html_text, multi_expected);

    // Following is an unlucky selection, because the first line broken on the final character (space)
    // So we cheat a bit here
    options.font.maxWdt = 320;
    label = new Label({}, options);
    checkProcessedLabels(
      label,
      markdown_text,
      markdown_widthConstraint_expected,
    );
  });

  it("handles markdown tags with widthConstraint.maximum", function () {
    const options = getOptions();
    options.font.multi = "markdown";
    options.font.maxWdt = 300;

    const label = new Label({}, options);

    checkProcessedLabels(label, normal_text, normal_widthConstraint_expected);
    checkProcessedLabels(label, html_text, html_widthConstraint_unchanged);
    checkProcessedLabels(label, markdown_text, multi_expected);
  });

  describe("Multi-Fonts", function () {
    class HelperNode {
      constructor(network) {
        this.nodes = network.body.nodes;
      }

      fontOption(index) {
        return this.nodes[index].labelModule.fontOptions;
      }

      modBold(index) {
        return this.fontOption(index).bold;
      }
    }

    describe("Node Labels", function () {
      function createNodeNetwork(newOptions) {
        const dataNodes = [
          { id: 0, label: "<b>0</b>" },
          { id: 1, label: "<b>1</b>" },
          { id: 2, label: "<b>2</b>", group: "group1" },
          {
            id: 3,
            label: "<b>3</b>",
            font: {
              bold: { color: "green" },
            },
          },
          {
            id: 4,
            label: "<b>4</b>",
            group: "group1",
            font: {
              bold: { color: "green" },
            },
          },
        ];

        // create a network
        const container = document.getElementById("mynetwork");
        const data = {
          nodes: new DataSet(dataNodes),
          edges: [],
        };

        const options = {
          nodes: {
            font: {
              multi: true,
            },
          },
          groups: {
            group1: {
              font: { color: "red" },
            },
            group2: {
              font: { color: "white" },
            },
          },
        };

        if (newOptions !== undefined) {
          util.deepExtend(options, newOptions);
        }

        const network = new Network(container, data, options);
        return [network, data, options];
      }

      /**
       * Check that setting options for multi-font works as expected
       *
       * - using multi-font 'bold' for test, the rest should work analogously
       * - using multi-font option 'color' for test, the rest should work analogously
       */
      it("respects the font option precedence", function () {
        const [network] = createNodeNetwork();
        const h = new HelperNode(network);

        expect(h.modBold(0).color).to.equal("#343434"); // Default value
        expect(h.modBold(1).color).to.equal("#343434"); // Default value
        expect(h.modBold(2).color).to.equal("red"); // Group value overrides default
        expect(h.modBold(3).color).to.equal("green"); // Local value overrides default
        expect(h.modBold(4).color).to.equal("green"); // Local value overrides group
      });

      it("handles dynamic data and option updates", function () {
        const [network, data] = createNodeNetwork();
        const h = new HelperNode(network);

        //
        // Change some node values dynamically
        //
        data.nodes.update([
          { id: 1, group: "group2" },
          { id: 4, font: { bold: { color: "orange" } } },
        ]);

        expect(h.modBold(0).color).to.equal("#343434"); // unchanged
        expect(h.modBold(1).color).to.equal("white"); // new group value
        expect(h.modBold(3).color).to.equal("green"); // unchanged
        expect(h.modBold(4).color).to.equal("orange"); // new local value

        //
        // Change group options dynamically
        //
        network.setOptions({
          groups: {
            group1: {
              font: { color: "brown" },
            },
          },
        });

        expect(h.modBold(0).color).to.equal("#343434"); // unchanged
        expect(h.modBold(1).color).to.equal("white"); // Unchanged
        expect(h.modBold(2).color).to.equal("brown"); // New group values
        expect(h.modBold(3).color).to.equal("green"); // unchanged
        expect(h.modBold(4).color).to.equal("orange"); // unchanged

        network.setOptions({
          nodes: {
            font: {
              multi: true,
              bold: {
                color: "black",
              },
            },
          },
        });

        expect(h.modBold(0).color).to.equal("black"); // nodes default
        expect(h.modBold(1).color).to.equal("black"); // more specific bold value overrides group value
        expect(h.modBold(2).color).to.equal("black"); // idem
        expect(h.modBold(3).color).to.equal("green"); // unchanged
        expect(h.modBold(4).color).to.equal("orange"); // unchanged

        network.setOptions({
          groups: {
            group1: {
              font: { bold: { color: "brown" } },
            },
          },
        });

        expect(h.modBold(0).color).to.equal("black"); // nodes default
        expect(h.modBold(1).color).to.equal("black"); // more specific bold value overrides group value
        expect(h.modBold(2).color).to.equal("brown"); // bold group value overrides bold node value
        expect(h.modBold(3).color).to.equal("green"); // unchanged
        expect(h.modBold(4).color).to.equal("orange"); // unchanged
      });

      it("handles normal font values in default options", function () {
        const newOptions = {
          nodes: {
            font: {
              color: "purple", // Override the default value
            },
          },
        };
        const [network] = createNodeNetwork(newOptions);
        const h = new HelperNode(network);

        expect(h.modBold(0).color).to.equal("purple"); // Nodes value
        expect(h.modBold(1).color).to.equal("purple"); // Nodes value
        expect(h.modBold(2).color).to.equal("red"); // Group value overrides nodes
        expect(h.modBold(3).color).to.equal("green"); // Local value overrides all
        expect(h.modBold(4).color).to.equal("green"); // Idem
      });

      it("handles multi-font values in default options/groups", function () {
        const newOptions = {
          nodes: {
            font: {
              color: "purple", // This set value should be overridden
            },
          },
        };

        newOptions.nodes.font.bold = { color: "yellow" };
        newOptions.groups = {
          group1: {
            font: { bold: { color: "red" } },
          },
        };

        const [network, , options] = createNodeNetwork(newOptions);
        const h = new HelperNode(network);
        expect(options.nodes.font.multi).to.be.true;

        expect(h.modBold(0).color).to.equal("yellow"); // bold value
        expect(h.modBold(1).color).to.equal("yellow"); // bold value
        expect(h.modBold(2).color).to.equal("red"); // Group value overrides nodes
        expect(h.modBold(3).color).to.equal("green"); // Local value overrides all
        expect(h.modBold(4).color).to.equal("green"); // Idem
      });
    }); // Node Labels

    describe("Edge Labels", function () {
      function createEdgeNetwork(newOptions) {
        const dataNodes = [
          { id: 1, label: "1" },
          { id: 2, label: "2" },
          { id: 3, label: "3" },
          { id: 4, label: "4" },
        ];

        const dataEdges = [
          { id: 1, from: 1, to: 2, label: "<b>1</b>" },
          {
            id: 2,
            from: 1,
            to: 4,
            label: "<b>2</b>",
            font: {
              bold: { color: "green" },
            },
          },
          {
            id: 3,
            from: 2,
            to: 3,
            label: "<b>3</b>",
            font: {
              bold: { color: "green" },
            },
          },
        ];

        // create a network
        const container = document.getElementById("mynetwork");
        const data = {
          nodes: new DataSet(dataNodes),
          edges: new DataSet(dataEdges),
        };

        const options = {
          edges: {
            font: {
              multi: true,
            },
          },
        };

        if (newOptions !== undefined) {
          util.deepExtend(options, newOptions);
        }

        const network = new Network(container, data, options);
        return [network, data, options];
      }

      class HelperEdge {
        constructor(network) {
          this.edges = network.body.edges;
        }

        fontOption(index) {
          return this.edges[index].labelModule.fontOptions;
        }

        modBold(index) {
          return this.fontOption(index).bold;
        }
      }

      /**
       * Check that setting options for multi-font works as expected
       *
       * - using multi-font 'bold' for test, the rest should work analogously
       * - using multi-font option 'color' for test, the rest should work analogously
       * - edges have no groups
       */
      it("respects the font option precedence", function () {
        const [network] = createEdgeNetwork();
        const h = new HelperEdge(network);

        expect(h.modBold(1).color).to.equal("#343434"); // Default value
        expect(h.modBold(2).color).to.equal("green"); // Local value overrides default
        expect(h.modBold(3).color).to.equal("green"); // Local value overrides group
      });

      it("handles dynamic data and option updates", function () {
        const [network, data] = createEdgeNetwork();
        const h = new HelperEdge(network);

        data.edges.update([{ id: 3, font: { bold: { color: "orange" } } }]);

        expect(h.modBold(1).color).to.equal("#343434"); // unchanged
        expect(h.modBold(2).color).to.equal("green"); // unchanged
        expect(h.modBold(3).color).to.equal("orange"); // new local value

        network.setOptions({
          edges: {
            font: {
              multi: true,
              bold: {
                color: "black",
              },
            },
          },
        });

        expect(h.modBold(1).color).to.equal("black"); // more specific bold value overrides group value
        expect(h.modBold(2).color).to.equal("green"); // unchanged
        expect(h.modBold(3).color).to.equal("orange"); // unchanged
      });

      it("handles font values in default options", function () {
        const newOptions = {
          edges: {
            font: {
              color: "purple", // Override the default value
            },
          },
        };
        const [network] = createEdgeNetwork(newOptions);
        const h = new HelperEdge(network);

        expect(h.modBold(1).color).to.equal("purple"); // Nodes value
        expect(h.modBold(2).color).to.equal("green"); // Local value overrides all
        expect(h.modBold(3).color).to.equal("green"); // Idem
      });
    }); // Edge Labels

    describe("Shorthand Font Options", function () {
      const testFonts = {
        default: { color: "#343434", face: "arial", size: 14 },
        monodef: { color: "#343434", face: "monospace", size: 15 },
        font1: { color: "#010101", face: "Font1", size: 1 },
        font2: { color: "#020202", face: "Font2", size: 2 },
        font3: { color: "#030303", face: "Font3", size: 3 },
        font4: { color: "#040404", face: "Font4", size: 4 },
        font5: { color: "#050505", face: "Font5", size: 5 },
        font6: { color: "#060606", face: "Font6", size: 6 },
        font7: { color: "#070707", face: "Font7", size: 7 },
      };

      function checkFont(opt, expectedLabel) {
        const expected = testFonts[expectedLabel];

        util.forEach(expected, (item, key) => {
          expect(opt[key]).to.equal(item);
        });
      }

      function createNetwork() {
        const dataNodes = [
          { id: 1, label: "1" },
          { id: 2, label: "2", group: "group1" },
          { id: 3, label: "3", group: "group2" },
          { id: 4, label: "4", font: "5px Font5 #050505" },
        ];

        const dataEdges = [];

        // create a network
        const container = document.getElementById("mynetwork");
        const data = {
          nodes: new DataSet(dataNodes),
          edges: new DataSet(dataEdges),
        };

        const options = {
          nodes: {
            font: {
              multi: true,
              bold: "1 Font1 #010101",
              ital: "2 Font2 #020202",
            },
          },
          groups: {
            group1: {
              font: "3 Font3 #030303",
            },
            group2: {
              font: {
                bold: "4 Font4 #040404",
              },
            },
          },
        };

        const network = new Network(container, data, options);
        return [network, data];
      }

      it("handles shorthand options correctly", function () {
        const [network] = createNetwork();
        const h = new HelperNode(network);

        // NOTE: 'mono' has its own global default font and size, which will
        //       trump any other font values set.

        let opt = h.fontOption(1);
        checkFont(opt, "default");
        checkFont(opt.bold, "font1");
        checkFont(opt.ital, "font2");
        checkFont(opt.mono, "monodef"); // Mono should have defaults

        // Node 2 should be using group1 options
        opt = h.fontOption(2);
        checkFont(opt, "font3");
        checkFont(opt.bold, "font1"); // bold retains nodes default options
        checkFont(opt.ital, "font2"); // ital retains nodes default options
        expect(opt.mono.color).to.equal("#030303"); // New color
        expect(opt.mono.face).to.equal("monospace"); // own global default font
        expect(opt.mono.size).to.equal(15); // Own global default size

        // Node 3 should be using group2 options
        opt = h.fontOption(3);
        checkFont(opt, "default");
        checkFont(opt.bold, "font4");
        checkFont(opt.ital, "font2");
        checkFont(opt.mono, "monodef"); // Mono should have defaults

        // Node 4 has its own base font definition
        opt = h.fontOption(4);
        checkFont(opt, "font5");
        checkFont(opt.bold, "font1");
        checkFont(opt.ital, "font2");
        expect(opt.mono.color).to.equal("#050505"); // New color
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);
      });

      function dynamicAdd1(network, data) {
        // Add new shorthand at every level
        data.nodes.update([
          { id: 1, font: "5 Font5 #050505" },
          { id: 4, font: { bold: "6 Font6 #060606" } }, // kills node instance base font
        ]);

        network.setOptions({
          nodes: {
            font: {
              multi: true,
              ital: "4 Font4 #040404",
            },
          },
          groups: {
            group1: {
              font: {
                bold: "7 Font7 #070707", // Kills node instance base font
              },
            },
            group2: {
              font: "6 Font6 #060606", // Note: 'bold' removed by this
            },
          },
        });
      }

      function dynamicAdd2(network) {
        network.setOptions({
          nodes: {
            font: "7 Font7 #070707", // Note: this kills the font.multi, bold and ital settings!
          },
        });
      }

      it("deals with dynamic data and option updates for shorthand", function () {
        const [network, data] = createNetwork();
        const h = new HelperNode(network);
        dynamicAdd1(network, data);

        let opt = h.fontOption(1);
        checkFont(opt, "font5"); // New base font
        checkFont(opt.bold, "font1");
        checkFont(opt.ital, "font4"); // New global node default
        expect(opt.mono.color).to.equal("#050505"); // New color
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);

        opt = h.fontOption(2);
        checkFont(opt, "default");
        checkFont(opt.bold, "font7");
        checkFont(opt.ital, "font4"); // New global node default
        checkFont(opt.mono, "monodef"); // Mono should have defaults again

        opt = h.fontOption(3);
        checkFont(opt, "font6"); // New base font
        checkFont(opt.bold, "font1"); // group bold option removed, using global default node
        checkFont(opt.ital, "font4"); // New global node default
        expect(opt.mono.color).to.equal("#060606"); // New color
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);

        opt = h.fontOption(4);
        checkFont(opt, "default");
        checkFont(opt.bold, "font6");
        checkFont(opt.ital, "font4");
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);
      });

      it("deals with dynamic change of global node default", function () {
        const [network, data] = createNetwork();
        const h = new HelperNode(network);
        dynamicAdd1(network, data); // Accumulate data of dynamic add
        dynamicAdd2(network, data);

        let opt = h.fontOption(1);
        checkFont(opt, "font5"); // Node instance value
        checkFont(opt.bold, "font5"); // bold def removed from global default node
        checkFont(opt.ital, "font5"); // idem
        expect(opt.mono.color).to.equal("#050505"); // New color
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);

        opt = h.fontOption(2);
        checkFont(opt, "font7"); // global node default applies for all settings
        checkFont(opt.bold, "font7");
        checkFont(opt.ital, "font7");
        expect(opt.mono.color).to.equal("#070707");
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);

        opt = h.fontOption(3);
        checkFont(opt, "font6"); // Group base font
        checkFont(opt.bold, "font6"); // idem
        checkFont(opt.ital, "font6"); // idem
        expect(opt.mono.color).to.equal("#060606"); // idem
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);

        opt = h.fontOption(4);
        checkFont(opt, "font7"); // global node default
        checkFont(opt.bold, "font6"); // node instance bold
        checkFont(opt.ital, "font7"); // global node default
        expect(opt.mono.color).to.equal("#070707"); // idem
        expect(opt.mono.face).to.equal("monospace");
        expect(opt.mono.size).to.equal(15);
      });

      it("deals with dynamic delete of shorthand options", function () {
        const [network, data] = createNetwork();
        const h = new HelperNode(network);
        dynamicAdd1(network, data); // Accumulate data of previous dynamic steps
        dynamicAdd2(network, data); // idem

        data.nodes.update([
          { id: 1, font: null },
          { id: 4, font: { bold: null } },
        ]);

        let opt;

        /*
    // Interesting: following flagged as error in options parsing, avoiding it for that reason
    network.setOptions({
      nodes: {
        font: {
          multi: true,
          ital: null,
        }
      },
    });
*/

        network.setOptions({
          groups: {
            group1: {
              font: {
                bold: null,
              },
            },
            group2: {
              font: null,
            },
          },
        });

        // global defaults for all
        for (let n = 1; n <= 4; ++n) {
          opt = h.fontOption(n);
          checkFont(opt, "font7");
          checkFont(opt.bold, "font7");
          checkFont(opt.ital, "font7");
          expect(opt.mono.color).to.equal("#070707");
          expect(opt.mono.face).to.equal("monospace");
          expect(opt.mono.size).to.equal(15);
        }

        /*
    // Not testing following because it is an error in options parsing
    network.setOptions({
      nodes: {
        font: null
      },
    });
*/
      });
    }); // Shorthand Font Options

    it("sets and uses font.multi in group options", function () {
      /**
       * Helper function for easily accessing font options in a node
       * @param index
       */
      const fontOption = (index) => {
        const nodes = network.body.nodes;
        return nodes[index].labelModule.fontOptions;
      };

      /**
       * Helper function for easily accessing bold options in a node
       * @param index
       */
      const modBold = (index) => {
        return fontOption(index).bold;
      };

      const dataNodes = [
        { id: 1, label: "<b>1</b>", group: "group1" },
        {
          // From example 1 in #3408
          id: 6,
          label: "<i>\uf286</i> <b>\uf2cd</b> colored glyph icon",
          shape: "icon",
          group: "colored",
          icon: { color: "blue" },
          font: {
            bold: { color: "blue" },
            ital: { color: "green" },
          },
        },
      ];

      // create a network
      const container = document.getElementById("mynetwork");
      const data = {
        nodes: new DataSet(dataNodes),
        edges: [],
      };

      const options = {
        groups: {
          group1: {
            font: {
              multi: true,
              color: "red",
            },
          },
          colored: {
            // From example 1 in 3408
            icon: {
              face: "FontAwesome",
              code: "\uf2b5",
            },
            font: {
              face: "FontAwesome",
              multi: true,
              bold: { mod: "" },
              ital: { mod: "" },
            },
          },
        },
      };

      const network = new Network(container, data, options);

      expect(modBold(1).color).to.equal("red"); // Group value
      expect(fontOption(1).multi).to.be.true; // Group value
      expect(modBold(6).color).to.equal("blue"); // node instance value
      expect(fontOption(6).multi).to.be.true; // Group value

      network.setOptions({
        groups: {
          group1: {
            //font: { color: 'brown' },  // Can not just change one field, entire font object is reset
            font: {
              multi: true,
              color: "brown",
            },
          },
        },
      });

      expect(modBold(1).color).to.equal("brown"); // New value
      expect(fontOption(1).multi).to.be.true; // Group value
      expect(modBold(6).color).to.equal("blue"); // unchanged
      expect(fontOption(6).multi).to.be.true; // unchanged

      network.setOptions({
        groups: {
          group1: {
            font: null, // Remove font from group
          },
        },
      });

      // console.log("===============");
      // console.log(fontOption(1));

      expect(modBold(1).color).to.equal("#343434"); // Reverts to default
      expect(fontOption(1).multi).to.be.false; // idem
      expect(modBold(6).color).to.equal("blue"); // unchanged
      expect(fontOption(6).multi).to.be.true; // unchanged
    });

    it("compresses spaces for Multi-Font", function () {
      let options = getOptions();

      const text = [
        "Too  many    spaces     here!",
        "one two  three   four    five     six      .",
        "This thing:\n  - could be\n  - a kind\n  - of list", // multifont: 2 spaces at start line reduced to 1
      ];

      //
      // multifont disabled: spaces are preserved
      //
      let label = new Label({}, options);

      const expected = [
        {
          lines: [
            {
              blocks: [{ text: "Too  many    spaces     here!" }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [
                { text: "one two  three   four    five     six      ." },
              ],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "This thing:" }],
            },
            {
              blocks: [{ text: "  - could be" }],
            },
            {
              blocks: [{ text: "  - a kind" }],
            },
            {
              blocks: [{ text: "  - of list" }],
            },
          ],
        },
      ];

      checkProcessedLabels(label, text, expected);

      //
      // multifont disabled width maxwidth: spaces are preserved
      //
      options.font.maxWdt = 300;
      label = new Label({}, options);

      const expected_maxwidth = [
        {
          lines: [
            {
              blocks: [{ text: "Too  many    spaces" }],
            },
            {
              blocks: [{ text: "     here!" }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "one two  three   " }],
            },
            {
              blocks: [{ text: "four    five     six" }],
            },
            {
              blocks: [{ text: "      ." }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "This thing:" }],
            },
            {
              blocks: [{ text: "  - could be" }],
            },
            {
              blocks: [{ text: "  - a kind" }],
            },
            {
              blocks: [{ text: "  - of list" }],
            },
          ],
        },
      ];

      checkProcessedLabels(label, text, expected_maxwidth);

      //
      // multifont enabled: spaces are compressed
      //
      options = getOptions(options);
      options.font.multi = true;
      label = new Label({}, options);

      const expected_multifont = [
        {
          lines: [
            {
              blocks: [{ text: "Too many spaces here!" }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "one two three four five six ." }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "This thing:" }],
            },
            {
              blocks: [{ text: " - could be" }],
            },
            {
              blocks: [{ text: " - a kind" }],
            },
            {
              blocks: [{ text: " - of list" }],
            },
          ],
        },
      ];

      checkProcessedLabels(label, text, expected_multifont);

      //
      // multifont enabled with max width: spaces are compressed
      //
      options.font.maxWdt = 300;
      label = new Label({}, options);

      const expected_multifont_maxwidth = [
        {
          lines: [
            {
              blocks: [{ text: "Too many spaces" }],
            },
            {
              blocks: [{ text: "here!" }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "one two three four" }],
            },
            {
              blocks: [{ text: "five six ." }],
            },
          ],
        },
        {
          lines: [
            {
              blocks: [{ text: "This thing:" }],
            },
            {
              blocks: [{ text: " - could be" }],
            },
            {
              blocks: [{ text: " - a kind" }],
            },
            {
              blocks: [{ text: " - of list" }],
            },
          ],
        },
      ];

      checkProcessedLabels(label, text, expected_multifont_maxwidth);
    });
  }); // Multi-Fonts

  it("parses single huge word on line with preceding whitespace when max width set", function () {
    const options = getOptions();
    options.font.maxWdt = 300;
    expect(options.font.multi).to.be.false;

    /**
     * Split a string at the given location, return either first or last part
     *
     * Allows negative indexing, counting from back (ruby style)
     * @param text
     * @param pos
     * @param getFirst
     */
    const splitAt = (text, pos, getFirst) => {
      if (pos < 0) pos = text.length + pos;

      if (getFirst) {
        return text.substring(0, pos);
      } else {
        return text.substring(pos);
      }
    };

    let label = new Label({}, options);
    const longWord = "asd;lkfja;lfkdj;alkjfd;alskfj";

    const text = [
      "Mind the space!\n " + longWord,
      "Mind the empty line!\n\n" + longWord,
      "Mind the dos empty line!\r\n\r\n" + longWord,
    ];

    const expected = [
      {
        lines: [
          {
            blocks: [{ text: "Mind the space!" }],
          },
          {
            blocks: [{ text: "" }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, true) }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, false) }],
          },
        ],
      },
      {
        lines: [
          {
            blocks: [{ text: "Mind the empty" }],
          },
          {
            blocks: [{ text: "line!" }],
          },
          {
            blocks: [{ text: "" }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, true) }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, false) }],
          },
        ],
      },
      {
        lines: [
          {
            blocks: [{ text: "Mind the dos empty" }],
          },
          {
            blocks: [{ text: "line!" }],
          },
          {
            blocks: [{ text: "" }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, true) }],
          },
          {
            blocks: [{ text: splitAt(longWord, -3, false) }],
          },
        ],
      },
    ];

    checkProcessedLabels(label, text, expected);

    //
    // Multi font enabled. For current case, output should be identical to no multi font
    //
    options.font.multi = true;
    label = new Label({}, options);
    checkProcessedLabels(label, text, expected);
  });

  /**
   *
   * The test network is derived from example `network/nodeStyles/widthHeight.html`,
   * where the associated issue (i.e. widthConstraint values not copied) was most poignant.
   *
   * NOTE: boolean shorthand values for widthConstraint and heightConstraint do nothing.
   */
  it("Sets the width/height constraints in the font label options", function () {
    const nodes = [
      { id: 100, label: "node 100" },
      { id: 210, group: "group1", label: "node 210" },
      { id: 211, widthConstraint: { minimum: 120 }, label: "node 211" },
      {
        id: 212,
        widthConstraint: { minimum: 120, maximum: 140 },
        group: "group1",
        label: "node 212",
      }, // group override
      { id: 220, widthConstraint: { maximum: 170 }, label: "node 220" },
      {
        id: 200,
        font: { multi: true },
        widthConstraint: 150,
        label: "node <b>200</b>",
      },
      { id: 201, widthConstraint: 150, label: "node 201" },
      { id: 202, group: "group2", label: "node 202" },
      {
        id: 203,
        heightConstraint: { minimum: 75, valign: "bottom" },
        group: "group2",
        label: "node 203",
      }, // group override
      { id: 204, heightConstraint: 80, group: "group2", label: "node 204" }, // group override
      { id: 300, heightConstraint: { minimum: 70 }, label: "node 300" },
      {
        id: 400,
        heightConstraint: { minimum: 100, valign: "top" },
        label: "node 400",
      },
      {
        id: 401,
        heightConstraint: { minimum: 100, valign: "middle" },
        label: "node 401",
      },
      {
        id: 402,
        heightConstraint: { minimum: 100, valign: "bottom" },
        label: "node 402",
      },
    ];

    const edges = [
      { id: 1, from: 100, to: 210, label: "edge 1" },
      { id: 2, widthConstraint: 80, from: 210, to: 211, label: "edge 2" },
      { id: 3, heightConstraint: 90, from: 100, to: 220, label: "edge 3" },
      {
        id: 4,
        from: 401,
        to: 402,
        widthConstraint: { maximum: 150 },
        label: "edge 12",
      },
    ];

    const container = document.getElementById("mynetwork");
    const data = {
      nodes: nodes,
      edges: edges,
    };
    const options = {
      edges: {
        font: {
          size: 12,
        },
        widthConstraint: {
          maximum: 90,
        },
      },
      nodes: {
        shape: "box",
        margin: 10,
        widthConstraint: {
          maximum: 200,
        },
      },
      groups: {
        group1: {
          shape: "dot",
          widthConstraint: {
            maximum: 130,
          },
        },
        // Following group serves to test all font options
        group2: {
          shape: "dot",
          widthConstraint: {
            minimum: 150,
            maximum: 180,
          },
          heightConstraint: {
            minimum: 210,
            valign: "top",
          },
        },
      },
      physics: {
        enabled: false,
      },
    };
    const network = new Network(container, data, options);

    const nodes_expected = [
      { nodeId: 100, minWdt: -1, maxWdt: 200, minHgt: -1, valign: "middle" },
      { nodeId: 210, minWdt: -1, maxWdt: 130, minHgt: -1, valign: "middle" },
      { nodeId: 211, minWdt: 120, maxWdt: 200, minHgt: -1, valign: "middle" },
      { nodeId: 212, minWdt: 120, maxWdt: 140, minHgt: -1, valign: "middle" },
      { nodeId: 220, minWdt: -1, maxWdt: 170, minHgt: -1, valign: "middle" },
      { nodeId: 200, minWdt: 150, maxWdt: 150, minHgt: -1, valign: "middle" },
      { nodeId: 201, minWdt: 150, maxWdt: 150, minHgt: -1, valign: "middle" },
      { nodeId: 202, minWdt: 150, maxWdt: 180, minHgt: 210, valign: "top" },
      { nodeId: 203, minWdt: 150, maxWdt: 180, minHgt: 75, valign: "bottom" },
      { nodeId: 204, minWdt: 150, maxWdt: 180, minHgt: 80, valign: "middle" },
      { nodeId: 300, minWdt: -1, maxWdt: 200, minHgt: 70, valign: "middle" },
      { nodeId: 400, minWdt: -1, maxWdt: 200, minHgt: 100, valign: "top" },
      { nodeId: 401, minWdt: -1, maxWdt: 200, minHgt: 100, valign: "middle" },
      { nodeId: 402, minWdt: -1, maxWdt: 200, minHgt: 100, valign: "bottom" },
    ];

    // For edge labels, only maxWdt is set. We check the rest anyway, be it for
    // checking incorrect settings or for future code changes.
    //
    // There is a lot of repetitiveness here. Perhaps using a direct copy of the
    // example should be let go.
    const edges_expected = [
      { id: 1, minWdt: -1, maxWdt: 90, minHgt: -1, valign: "middle" },
      { id: 2, minWdt: 80, maxWdt: 80, minHgt: -1, valign: "middle" },
      { id: 3, minWdt: -1, maxWdt: 90, minHgt: 90, valign: "middle" },
      { id: 4, minWdt: -1, maxWdt: 150, minHgt: -1, valign: "middle" },
    ];

    const assertConstraints = (expected, fontOptions, label) => {
      expect(expected.minWdt).to.equal(
        fontOptions.minWdt,
        "Incorrect min width" + label,
      );
      expect(expected.maxWdt).to.equal(
        fontOptions.maxWdt,
        "Incorrect max width" + label,
      );
      expect(expected.minHgt).to.equal(
        fontOptions.minHgt,
        "Incorrect min height" + label,
      );
      expect(expected.valign).to.equal(
        fontOptions.valign,
        "Incorrect valign" + label,
      );
    };

    // Check nodes
    util.forEach(nodes_expected, function (expected) {
      const networkNode = network.body.nodes[expected.nodeId];
      expect(networkNode, "node not found for id: " + expected.nodeId).to.not.be
        .undefined.and.not.be.null;
      const fontOptions = networkNode.labelModule.fontOptions;

      const label = " for node id: " + expected.nodeId;
      assertConstraints(expected, fontOptions, label);
    });

    // Check edges
    util.forEach(edges_expected, function (expected) {
      const networkEdge = network.body.edges[expected.id];

      const label = " for edge id: " + expected.id;
      expect(networkEdge, "Edge not found" + label).to.not.be.undefined;

      const fontOptions = networkEdge.labelModule.fontOptions;
      assertConstraints(expected, fontOptions, label);
    });
  });

  it("deals with null labels and other awkward values", function () {
    const ctx = new DummyContext();
    let options = getOptions({});

    const checkHandling = (label, index, text) => {
      expect(() => {
        label.getTextSize(ctx, false, false);
      }).to.not.throw("Unexpected throw for " + text + " " + index);
      //label.getTextSize(ctx, false, false);  // Use this to determine the error thrown

      // There should not be a label for any of the cases
      //
      const labelVal = label.elementOptions.label;
      const validLabel = typeof labelVal === "string" && labelVal !== "";
      expect(
        !validLabel,
        "Unexpected label value '" + labelVal + "' for " + text + " " + index,
      ).to.be.true;
    };

    const nodes = [
      { id: 1 },
      { id: 2, label: null },
      { id: 3, label: undefined },
      { id: 4, label: { a: 42 } },
      { id: 5, label: ["an", "array"] },
      { id: 6, label: true },
      { id: 7, label: 3.419 },
    ];

    const edges = [
      { from: 1, to: 2, label: null },
      { from: 1, to: 3, label: undefined },
      { from: 1, to: 4, label: { a: 42 } },
      { from: 1, to: 5, label: ["an", "array"] },
      { from: 1, to: 6, label: false },
      { from: 1, to: 7, label: 2.71828 },
    ];

    // Isolate the specific call where a problem with null-label was detected
    // Following loops should plain not throw

    // Node labels
    for (let i = 0; i < nodes.length; ++i) {
      const label = new Label(null, nodes[i], false);
      checkHandling(label, i, "node");
    }

    // Edge labels
    for (let i = 0; i < edges.length; ++i) {
      const label = new Label(null, edges[i], true);
      checkHandling(label, i, "edge");
    }

    //
    // Following extracted from example 'nodeLegend', where the problem was detected.
    //
    // In the example, only `label:null` was present. The weird thing is that it fails
    // in the example, but succeeds in the unit tests.
    // Kept in for regression testing.
    const container = document.getElementById("mynetwork");
    const data = {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges),
    };

    options = {};
    new Network(container, data, options);
  });

  describe("visible function", function () {
    it("correctly determines label is not visible when label is invalid", function () {
      const invalidLabel = "";
      expect(
        isValidLabel(invalidLabel),

        "An empty string should be identified as an invalid label",
      ).to.be.false;

      const body = {
        view: {
          scale: 1,
        },
      };

      const options = {
        label: invalidLabel,
        font: {
          size: 12,
        },
        scaling: {
          label: {
            drawThreshold: 1,
          },
        },
      };

      const label = new Label(body, options);
      label.size.width = 1;
      label.size.height = 1;

      expect(
        label.visible(),
        "Label should not be visible because the label text is invalid",
      ).to.be.false;
    });
  });
});

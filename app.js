let myDiagram;
let myPalette;
function init() {
  const $ = go.GraphObject.make; // for conciseness in defining templates

  myDiagram = $(
    go.Diagram,
    "myDiagramDiv", // must name or refer to the DIV HTML element
    {
      grid: $(
        go.Panel,
        "Grid",
        $(go.Shape, "LineH", {
          stroke: "lightgray",
          strokeWidth: 0.5,
        }),
        $(go.Shape, "LineH", {
          stroke: "gray",
          strokeWidth: 0.5,
          interval: 10,
        }),
        $(go.Shape, "LineV", {
          stroke: "lightgray",
          strokeWidth: 0.5,
        }),
        $(go.Shape, "LineV", {
          stroke: "gray",
          strokeWidth: 0.5,
          interval: 10,
        })
      ),
      "draggingTool.dragsLink": true,
      "draggingTool.isGridSnapEnabled": true,
      "linkingTool.isUnconnectedLinkValid": false,
      "linkingTool.portGravity": 20,
      "relinkingTool.isUnconnectedLinkValid": true,
      "relinkingTool.portGravity": 20,
      "relinkingTool.fromHandleArchetype": $(go.Shape, "Diamond", {
        segmentIndex: 0,
        cursor: "pointer",
        desiredSize: new go.Size(8, 8),
        fill: "tomato",
        stroke: "darkred",
      }),
      "relinkingTool.toHandleArchetype": $(go.Shape, "Diamond", {
        segmentIndex: -1,
        cursor: "pointer",
        desiredSize: new go.Size(8, 8),
        fill: "darkred",
        stroke: "tomato",
      }),
      "linkReshapingTool.handleArchetype": $(go.Shape, "Diamond", {
        desiredSize: new go.Size(7, 7),
        fill: "lightblue",
        stroke: "deepskyblue",
      }),
      "rotatingTool.handleAngle": 270,
      "rotatingTool.handleDistance": 30,
      "rotatingTool.snapAngleMultiple": 15,
      "rotatingTool.snapAngleEpsilon": 15,
      "undoManager.isEnabled": true,
      "commandHandler.archetypeGroupData": { text: "Model", isGroup: true, color: "black", I: [], O: [] },
      // layout: $(go.ForceDirectedLayout, { defaultSpringLength: 10, maxIterations: 300 })
    }
  );
  myDiagram.addDiagramListener("LinkDrawn", (e) => {
    let link = e.subject;
    let to = link.toNode;
    let from = link.fromNode;
    console.log(from.data);
  })
  // when the document is modified, add a "*" to the title and enable the "Save" button
  myDiagram.addDiagramListener("Modified", (e) => {
    var button = document.getElementById("SaveButton");
    if (button) button.disabled = !myDiagram.isModified;
    var idx = document.title.indexOf("*");
    if (myDiagram.isModified) {
      if (idx < 0) document.title += "*";
    } else {
      if (idx >= 0) document.title = document.title.slice(0, idx);
    }
  });
  function makeButton(text, action, visiblePredicate) {
    return $("ContextMenuButton",
      $(go.TextBlock, text),
      { click: action },
      // don't bother with binding GraphObject.visible if there's no predicate
      visiblePredicate ? new go.Binding("visible", "", (o, e) => o.diagram ? visiblePredicate(o, e) : false).ofObject() : {});
  }
  var partContextMenu =
    $("ContextMenu",
      makeButton("Properties",
        (e, obj) => {  // OBJ is this Button
          var contextmenu = obj.part;  // the Button is in the context menu Adornment
          var part = contextmenu.adornedPart;  // the adornedPart is the Part that the context menu adorns
          // now can do something with PART, or with its data, or with the Adornment (the context menu)
          if (part instanceof go.Link) alert(linkInfo(part.data));
          else if (part instanceof go.Group) alert(groupInfo(contextmenu));
          else alert(nodeInfo(part.data));
        }),
      makeButton("Cut",
        (e, obj) => e.diagram.commandHandler.cutSelection(),
        o => o.diagram.commandHandler.canCutSelection()),
      makeButton("Copy",
        (e, obj) => e.diagram.commandHandler.copySelection(),
        o => o.diagram.commandHandler.canCopySelection()),
      makeButton("Paste",
        (e, obj) => e.diagram.commandHandler.pasteSelection(e.diagram.toolManager.contextMenuTool.mouseDownPoint),
        o => o.diagram.commandHandler.canPasteSelection(o.diagram.toolManager.contextMenuTool.mouseDownPoint)),
      makeButton("Delete",
        (e, obj) => e.diagram.commandHandler.deleteSelection(),
        o => o.diagram.commandHandler.canDeleteSelection()),
      makeButton("Undo",
        (e, obj) => e.diagram.commandHandler.undo(),
        o => o.diagram.commandHandler.canUndo()),
      makeButton("Redo",
        (e, obj) => e.diagram.commandHandler.redo(),
        o => o.diagram.commandHandler.canRedo()),
      makeButton("Group",
        (e, obj) => e.diagram.commandHandler.groupSelection(),
        o => o.diagram.commandHandler.canGroupSelection()),
      makeButton("Ungroup",
        (e, obj) => e.diagram.commandHandler.ungroupSelection(),
        o => o.diagram.commandHandler.canUngroupSelection()),
      makeButton("Add right port",
        (e, obj) => addPort("right"))
    );
  // Define a function for creating a "port" that is normally transparent.
  // The "name" is used as the GraphObject.portId, the "spot" is used to control how links connect
  // and where the port is positioned on the node, and the boolean "output" and "input" arguments
  // control whether the user can draw links from or to the port.
  function makePort(name, spot, output, input) {
    // the port is basically just a small transparent circle
    return $(go.Shape, "Circle", {
      fill: null, // not seen, by default; set to a translucent gray by showSmallPorts, defined below
      stroke: null,
      desiredSize: new go.Size(7, 7),
      alignment: spot, // align the port on the main Shape
      alignmentFocus: spot, // just inside the Shape
      portId: name, // declare this object to be a "port"
      fromSpot: spot,
      toSpot: spot, // declare where links may connect at this port
      fromLinkable: output,
      toLinkable: input, // declare whether the user may draw links to/from here
      cursor: "pointer", // show a different cursor to indicate potential link point
    });
  }

  function addPort(side, obj, e) {
    console.log(obj, e);
    myDiagram.startTransaction("addPort");
    myDiagram.selection.each(node => {
      console.log(node.data);
      // skip any selected Links
      if (!(node instanceof go.Node)) return;
      // compute the next available index number for the side
      let i = 1;
      while (node.findPort(side + i.toString()) !== node) i++;
      // now this new port name is unique within the whole Node because of the side prefix
      const name = side + i.toString();

      // get the Array of port data to be modified
      // const arr = ;
      // node.data[side].push({id: name});
      myDiagram.model.insertArrayItem(node.data[side], -1, { id: name, text: name, color: "black" });
      // console.log("adding port to ", node.data[side]);
      // if (arr) {
      //   // create a new port data object
      //   const newportdata = { id: name };
      //   // and add it to the Array of port data
      //   myDiagram.model.addArrayItem(arr, newportdata);
      // }
    });
    myDiagram.commitTransaction("addPort");
  }
  function removePort(port) {
    myDiagram.startTransaction("removePort");
    const pid = port.id;
    const arr = port.panel.itemArray;
    console.log("removing port ", pid, arr)
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].portId === pid) {
        myDiagram.model.removeArrayItem(arr, i);
        break;
      }
    }
    myDiagram.commitTransaction("removePort");
  }
  var nodeSelectionAdornmentTemplate = $(
    go.Adornment,
    "Auto",
    $(go.Shape, {
      fill: null,
      stroke: "deepskyblue",
      strokeWidth: 1.5,
      strokeDashArray: [4, 2],
    }),
    $(go.Placeholder)
  );

  var nodeResizeAdornmentTemplate = $(
    go.Adornment,
    "Spot",
    { locationSpot: go.Spot.Right },
    $(go.Placeholder),
    $(go.Shape, {
      alignment: go.Spot.TopLeft,
      cursor: "nw-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      alignment: go.Spot.Top,
      cursor: "n-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      alignment: go.Spot.TopRight,
      cursor: "ne-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),

    $(go.Shape, {
      alignment: go.Spot.Left,
      cursor: "w-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      alignment: go.Spot.Right,
      cursor: "e-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),

    $(go.Shape, {
      alignment: go.Spot.BottomLeft,
      cursor: "se-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      alignment: go.Spot.Bottom,
      cursor: "s-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      alignment: go.Spot.BottomRight,
      cursor: "sw-resize",
      desiredSize: new go.Size(6, 6),
      fill: "lightblue",
      stroke: "deepskyblue",
    })
  );

  var nodeRotateAdornmentTemplate = $(
    go.Adornment,
    { locationSpot: go.Spot.Center, locationObjectName: "ELLIPSE" },
    $(go.Shape, "Ellipse", {
      name: "ELLIPSE",
      cursor: "pointer",
      desiredSize: new go.Size(7, 7),
      fill: "lightblue",
      stroke: "deepskyblue",
    }),
    $(go.Shape, {
      geometryString: "M3.5 7 L3.5 30",
      isGeometryPositioned: true,
      stroke: "deepskyblue",
      strokeWidth: 1.5,
      strokeDashArray: [4, 2],
    })
  );

  myDiagram.nodeTemplate =
    $(go.Node, "Spot",
      { locationSpot: go.Spot.Center },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(
        go.Point.stringify
      ),
      {
        selectable: true,
        selectionAdornmentTemplate: nodeSelectionAdornmentTemplate,
      },
      {
        resizable: true,
        resizeObjectName: "PANEL",
        resizeAdornmentTemplate: nodeResizeAdornmentTemplate,
      },
      {
        rotatable: true,
        rotateAdornmentTemplate: nodeRotateAdornmentTemplate,
      },
      new go.Binding("angle").makeTwoWay(),
      // the main object is a Panel that surrounds a TextBlock with a Shape
      $(
        go.Panel,
        "Auto",
        { name: "PANEL" },
        new go.Binding("desiredSize", "size", go.Size.parse).makeTwoWay(
          go.Size.stringify
        ),
        $(
          go.Shape,
          "Rectangle", // default figure
          {
            portId: "", // the default port: if no spot on link data, use closest side
            fromLinkable: true,
            toLinkable: true,
            cursor: "pointer",
            fill: "white", // default color
            strokeWidth: 2,
          },
          new go.Binding("figure"),
          new go.Binding("fill")
        ),
        $(
          go.TextBlock,
          {
            font: "bold 11pt Helvetica, Arial, sans-serif",
            margin: 8,
            maxSize: new go.Size(260, NaN),
            wrap: go.TextBlock.WrapFit,
            editable: true,
          },
          new go.Binding("text").makeTwoWay()
        )
      ),
      // four small named ports, one on each side:
      makePort("T", go.Spot.Top, true, true),
      makePort("L", go.Spot.Left, true, true),
      makePort("R", go.Spot.Right, true, true),
      makePort("B", go.Spot.Bottom, true, true),
      {
        // handle mouse enter/leave events to show/hide the ports
        mouseEnter: (e, node) => showSmallPorts(node, true),
        mouseLeave: (e, node) => showSmallPorts(node, false),
      },
      { // this tooltip Adornment is shared by all nodes
        toolTip:
          $("ToolTip",
            $(go.TextBlock, { margin: 4 },  // the tooltip shows the result of calling nodeInfo(data)
              new go.Binding("text", "", nodeInfo))
          ),
        // this context menu Adornment is shared by all nodes
        contextMenu: partContextMenu
      }
    );
  function nodeInfo(d) {  // Tooltip info for a node data object
    var str = "Node " + d.key + ": " + d.text + "\n";
    if (d.group)
      str += "member of " + d.group;
    else
      str += "top-level node";
    return str;
  }
  function linkInfo(d) {  // Tooltip info for a link data object
    return "Link:\nfrom " + d.from + " to " + d.to;
  }
  function groupInfo(adornment) {  // takes the tooltip or context menu, not a group node data object
    var g = adornment.adornedPart;  // get the Group that the tooltip adorns
    var mems = g.memberParts.count;
    var links = 0;
    g.memberParts.each(part => {
      if (part instanceof go.Link) links++;
    });
    return "Group " + g.data.key + ": " + g.data.text + "\n" + mems + " members including " + links + " links";
  }
  function showSmallPorts(node, show) {
    node.ports.each((port) => {
      if (port.portId !== "") {
        // don't change the default port, which is the big shape
        port.fill = show ? "rgba(0,0,0,.3)" : null;
      }
    });
  }

  function BindSelection(name, yes, no) {
    return new go.Binding(name, "isSelected", function (s) {
      return s ? yes : no;
    }).ofObject();
  }
  myDiagram.linkTemplate =
    $(
      go.Link, // the whole link panel
      {
        selectable: true,
      },
      { relinkableFrom: true, relinkableTo: true, reshapable: true },
      {
        routing: go.Link.Orthogonal,
        smoothness: 0.01,
        curve: go.Link.Bezier,
        // toShortLength: 4,
      },
      new go.Binding("fromEndSegmentLength"),
      new go.Binding("toEndSegmentLength"),
      new go.Binding("points").makeTwoWay(),
      $(
        go.Shape, // the link path shape
        { isPanelMain: true, strokeWidth: 8, stroke: "transparent" },
      ),
      $(go.Shape,
        new go.Binding("strokeDashArray", "dash_array"),
        { isPanelMain: true },
        new go.Binding("stroke", "color")),
      $(
        go.Shape, // the arrowhead
        { toArrow: "Standard", stroke: "black" },
        new go.Binding("stroke", "arrow_color"),
        new go.Binding("fill", "fill_arrow")
      ),
      {
        // a mouse-over highlights the link by changing the first main path shape's stroke:
        mouseEnter: function (e, link) { link.elt(0).stroke = "rgba(0,90,156,0.3)"; },
        mouseLeave: function (e, link) { link.elt(0).stroke = "transparent"; }
      },
      $(go.TextBlock,  // the "from" label
        {
          textAlign: "center",
          text: "",
          editable: true,
          font: "bold 14px sans-serif",
          stroke: "#1967B3",
          segmentIndex: 0,
          segmentOffset: new go.Point(NaN, NaN),
          segmentOrientation: go.Link.OrientUpright
        },
        new go.Binding("text", "text")),
      $(go.TextBlock,  // the "from" label
        {
          textAlign: "center",
          text: "",
          editable: true,
          font: "bold 14px sans-serif",
          stroke: "#1967B3",
          segmentIndex: -1,
          segmentOffset: new go.Point(NaN, NaN),
          segmentOrientation: go.Link.OrientUpright
        },
        new go.Binding("text", "text")),
      $(
        go.Panel,
        "Auto",
        // new go.Binding("visible", "text==''").ofObject(),
        new go.Binding("visible", "label", function(t) { return !!t; }),
        $(
          go.Shape,
          "RoundedRectangle", // the link shape
          { fill: "white", stroke: null }
        ),

        $(
          go.TextBlock,
          {
            visible: true,
            text: "label",
            editable: true,
            textAlign: "center",
            font: "18px Roboto",
            segmentIndex: NaN,
            segmentFraction: 0.5,
          },
          new go.Binding("text", "label").makeTwoWay(),
          new go.Binding("visible", "label", function(t) { return !!t; }),
          BindSelection("stroke", "black", "black"),
          BindSelection("background", null, null)
        )
      ),
      { // this tooltip Adornment is shared by all links
        toolTip:
          $("ToolTip",
            $(go.TextBlock, { margin: 4 },  // the tooltip shows the result of calling linkInfo(data)
              new go.Binding("text", "", linkInfo))
          ),
        // the same context menu Adornment is shared by all links
        contextMenu: partContextMenu
      }
    );
  const portSize = new go.Size(8, 8);
  const portMenu =  // context menu for each port
    $("ContextMenu",
      makeButton("Swap order",
        (e, obj) => swapOrder(obj.part.adornedObject)),
      makeButton("Remove port",
        // in the click event handler, the obj.part is the Adornment;
        // its adornedObject is the port
        (e, obj) => removePort(obj.part.adornedObject)),
      makeButton("Change color",
        (e, obj) => changeColor(obj.part.adornedObject)),
      makeButton("Remove side ports",
        (e, obj) => removeAll(obj.part.adornedObject))
    );
  function highlightGroup(e, grp, show) {
    if (!grp) return;
    e.handled = true;
    if (show) {
      // cannot depend on the grp.diagram.selection in the case of external drag-and-drops;
      // instead depend on the DraggingTool.draggedParts or .copiedParts
      var tool = grp.diagram.toolManager.draggingTool;
      var map = tool.draggedParts || tool.copiedParts;  // this is a Map
      // now we can check to see if the Group will accept membership of the dragged Parts
      if (grp.canAddMembers(map.toKeySet())) {
        grp.isHighlighted = true;
        return;
      }
    }
    grp.isHighlighted = false;
  }

  // Upon a drop onto a Group, we try to add the selection as members of the Group.
  // Upon a drop onto the background, or onto a top-level Node, make selection top-level.
  // If this is OK, we're done; otherwise we cancel the operation to rollback everything.
  function finishDrop(e, grp) {
    var ok = (grp !== null
      ? grp.addMembers(grp.diagram.selection, true)
      : e.diagram.commandHandler.addTopLevelParts(e.diagram.selection, true));
    if (!ok) e.diagram.currentTool.doCancel();
  }
  myDiagram.groupTemplate =
    $(go.Group, "Table",
      {
        // selectionObjectName: "PANEL",  // selection handle goes around shape, not label
        ungroupable: true,  // enable Ctrl-Shift-G to ungroup a selected Group
        // mouseDragEnter: (e, grp, prev) => highlightGroup(e, grp, true),
        // mouseDragLeave: (e, grp, next) => highlightGroup(e, grp, false),
        computesBoundsAfterDrag: true,
        mouseDrop: finishDrop,
        handlesDragDropForMembers: true,
      },

      $(go.Panel, "Vertical",
        new go.Binding("itemArray", "I"),
        {
          column: 0,
          itemTemplate:
            $(go.Panel, "Horizontal",
              {
                margin: new go.Margin(10, 0, 0, 2),
                contextMenu: $("ContextMenu",
                  makeButton("Remove port", (e, obj) => removePort(obj.part.adornedObject)),)
              },
              $(go.TextBlock,
                {
                  font: 'bold 11pt helvetica, bold arial, sans-serif',
                  margin: new go.Margin(20, 0, 0, 0),
                  editable: true,
                  textAlign: 'center',
                  _isNodeLabel: true,
                  alignment: new go.Spot(10, 0.5, 0, 0)
                },
                new go.Binding("text").makeTwoWay(),
                new go.Binding("stroke", "color")
              ),
              $(go.Shape,
                { toLinkable: true,fromLinkable:true, strokeWidth: 0, width: 8, height: 8 },
                new go.Binding("portId", "id")),

            )
        }
      ),
      $(go.Panel, "Auto",
        { column: 1 },
        $(go.Shape, "RoundedRectangle",
          {
            fill: "white",
            strokeWidth: 3,
            stroke: "black",
            strokeWidth: 3,
          },
          // new go.Binding("stroke", "color"),
          // new go.Binding("fill", "color", go.Brush.lighten)
        ),
        $(go.TextBlock,
          {
            alignment: go.Spot.Top,
            font: "bold 19px sans-serif",
            margin: new go.Margin(4, 10, 0, 20),
            isMultiline: false,  // don't allow newlines in text
            editable: true  // allow in-place editing by user
          },
          new go.Binding("text", "text").makeTwoWay(),
          new go.Binding("stroke", "color")
        ),
        $(go.Placeholder, { alignment: go.Spot.TopLeft, padding: 50 }),
        $("SubGraphExpanderButton", { alignment: go.Spot.TopLeft }),
      ),
      $(go.Panel, "Vertical",
        new go.Binding("itemArray", "O"),
        {
          column: 2,
          itemTemplate:
            $(go.Panel,
              {
                margin: new go.Margin(10, 0, 0, 0),
                contextMenu: $("ContextMenu",
                  makeButton("Remove port", (e, obj) => removePort(obj.part.adornedObject)),)
              },
              $(go.Shape,
                { fromLinkable: true, strokeWidth: 0, width: 8, height: 8, toLinkable: true },
                new go.Binding("portId", "id")
              ),
              $(go.TextBlock,
                {
                  font: 'bold 11pt helvetica, bold arial, sans-serif',
                  margin: new go.Margin(10, 0, 0, 0),
                  editable: true,
                  textAlign: 'center',
                  _isNodeLabel: true,
                  alignment: new go.Spot(10, 0.5, 0, 0)
                },
                new go.Binding("text").makeTwoWay(),
                new go.Binding("stroke", "color")
              ),
            )
        }
      ),
      {
        minSize: new go.Size(50, 50),
        subGraphExpandedChanged: function (grp) {
          if (!grp.isSubGraphExpanded) return;
          shiftNodes(grp);
        },
        selectionChanged: function (grp) {
          grp.diagram.commit(function (diag) {
            var lay = grp.isSelected ? "Foreground" : "";
            grp.layerName = lay;
            grp.findSubGraphParts().each(function (x) { x.layerName = lay; });
          }, null);
        },
        toolTip:
          $("ToolTip",
            $(go.TextBlock, { margin: 14 },
              // bind to tooltip, not to Group.data, to allow access to Group properties
              new go.Binding("text", "", groupInfo).ofObject())
          ),
        contextMenu: $("ContextMenu",
          $("ContextMenuButton",
            $(go.TextBlock, "Add Input"),
            { click: (e, obj) => addPort("I", obj, e) }),
          $("ContextMenuButton",
            $(go.TextBlock, "Add Output"),
            { click: (e, obj) => addPort("O", obj, e) })
        )
      }
    );
  function shiftNodes(part) {
    part.ensureBounds();
    var b = part.actualBounds;
    var diagram = part.diagram;
    if (diagram === null) return;
    var overlaps = diagram.findObjectsIn(b,
      function (x) { var p = x.part; return (p.isTopLevel && p instanceof go.Node) ? p : null; },
      function (node) { return node !== part && !node.isMemberOf(part); },
      true);
    var dx = 0;
    var dy = 0;
    var shiftsXY = new go.Set();
    var shiftsX = new go.Set();
    var shiftsY = new go.Set();
    overlaps.each(function (node) {
      var r = node.actualBounds;
      if (r.contains(b.right, b.bottom)) {
        dx = Math.max(dx, b.right - r.left);
        dy = Math.max(dy, b.bottom - r.top);
        shiftsXY.add(node);
      } else if (b.contains(r.left, r.bottom)) {
        dx = Math.max(dx, b.right - r.left);
        shiftsX.add(node);
      } else if (b.contains(r.right, r.top)) {
        dy = Math.max(dy, b.bottom - r.top);
        shiftsY.add(node);
      }
    });
    if (dx > 0) diagram.moveParts(shiftsX, new go.Point(dx + 10, 0), false);
    if (dy > 0) diagram.moveParts(shiftsY, new go.Point(0, dy + 10), false);
    if (dx > 0 && dy > 0) diagram.moveParts(shiftsXY, new go.Point(dx + 10, dy + 10), false);
  }

  load(); // load an initial diagram from some JSON text

  // initialize the Palette that is on the left side of the page
  myPalette = $(
    go.Palette,
    "myPaletteDiv", // must name or refer to the DIV HTML element
    {
      maxSelectionCount: 1,
      nodeTemplateMap: myDiagram.nodeTemplateMap,
      linkTemplate: $(
        go.Link,
        { // because the GridLayout.alignment is Location and the nodes have locationSpot == Spot.Center,
          // to line up the Link in the same manner we have to pretend the Link has the same location spot
          locationSpot: go.Spot.Center,
          selectionAdornmentTemplate:
            $(go.Adornment, "Link",
              { locationSpot: go.Spot.Center },
              $(go.Shape,
                { isPanelMain: true, fill: null, stroke: "deepskyblue", strokeWidth: 0 }),
              $(go.Shape,  // the arrowhead
                { toArrow: "Standard", stroke: null })
            )
        },
        {
          selectable: true,
        },
        {
          relinkableFrom: true,
          relinkableTo: true,
          reshapable: true,
        },
        {
          // routing: go.Link.AvoidsNodes,
          curve: go.Link.None,
          corner: 5,
          toShortLength: 4,
        },
        new go.Binding("points"),
        $(
          go.Shape, // the link path shape
          { isPanelMain: true, strokeWidth: 2 },
          new go.Binding("strokeDashArray", "dash_array"),
          new go.Binding("stroke", "color")
        ),
        $(
          go.Shape, // the arrowhead
          { toArrow: "Standard", stroke: "black", fill: "black" },
          new go.Binding("stroke", "arrow_color"),
          new go.Binding("fill", "fill_arrow"),
          new go.Binding("text", "label")
        )
      ),
      model: new go.GraphLinksModel(
        [
          // specify the contents of the Palette
          {
            text: "A",
            figure: "Ellipse",
            size: "85 85",
            fill: "white",
          },
          {
            text: "IEStream",
            figure: "Rectangle",
            size: "90 65",
            fill: "white",
          }
        ],
        [
          // the Palette also has a disconnected Link, which the user can drag-and-drop
          {
            points: new go.List(/*go.Point*/).addAll([
              new go.Point(0, 0),
              new go.Point(85, 0)
            ]),
            color: "black"
          },
          {
            points: new go.List(/*go.Point*/).addAll([
              new go.Point(0, 0),
              new go.Point(85, 0)
            ]),
            color: "red",
            arrow_color: "black",
            fill_arrow: "white",
            label: "",
          },
          {
            points: new go.List(/*go.Point*/).addAll([
              new go.Point(0, 0),
              new go.Point(85, 0)
            ]),
            dash_array: [6, 3],
          }
        ]
      ),
    }
  );
}


let saveButton = document.getElementById("saveButton");
let loadButton = document.getElementById("loadButton");
loadButton.addEventListener("click", load);
saveButton.addEventListener("click", downloadModel);
// Show the diagram's model in JSON format that the user may edit
export function save() {

  saveDiagramProperties(); // do this first, before writing to JSON
  document.getElementById("mySavedModel").value = myDiagram.model.toJson();
  myDiagram.isModified = false;

  return myDiagram.model.toJson();
}

function downloadModel() {
  var blob = new Blob([myDiagram.model.toJson()],
    { type: "application/json;charset=utf-8" });
  saveAs(blob, "model.json");
}
function load() {
  let file = document.getElementById("formFile").files[0];
  var reader = new FileReader();
  if (file !== undefined) {
    reader.onloadend = function () {

      myDiagram.model = go.Model.fromJson(reader.result);

    }
    reader.readAsText(file);
  }
  else {
    myDiagram.model = go.Model.fromJson(
      document.getElementById("mySavedModel").value
    );
  }
  
  loadDiagramProperties(); // do this after the Model.modelData has been brought into memory
  
}

function saveDiagramProperties() {
  myDiagram.model.modelData.position = go.Point.stringify(
    myDiagram.position
  );
}
function loadDiagramProperties(e) {
  // set Diagram.initialPosition, not Diagram.position, to handle initialization side-effects
  var pos = myDiagram.model.modelData.position;
  if (pos) myDiagram.initialPosition = go.Point.parse(pos);
}
window.addEventListener("DOMContentLoaded", init);

document.addEventListener("drag", event => {
  console.log("dragging");
});
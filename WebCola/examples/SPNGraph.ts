///<reference path="../extern/d3v3.d.ts"/>
///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>

///<reference path="../src/layout.ts"/>
///<reference path="../src/d3adaptor.ts"/>
///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>
///<reference path="../src/gridrouter.ts"/>
///<reference path="../src/geom.ts"/>
///<reference path="../src/batch.ts"/>


import * as cola from '../index'
import * as d3scale from 'd3-scale'
import * as d3zoom from 'd3-zoom'
import * as d3color from 'd3-color'
import * as graphlibDot from 'graphlib-dot'
import {Rectangle} from "../index";
import {List} from "linq-typescript";

var width = 450,
    height = 350;

var color = d3scale.scaleOrdinal(d3scale.schemeCategory20);

function makeSVG() {
    var outer = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("pointer-events", "all");

    // define arrow markers for graph links
    outer.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 5)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5L2,0')
        .attr('stroke-width', '0px')
        .attr('fill', '#000')
        .attr('opacity', '0.9');


    var vis = <any>outer.append('g');
    var redraw = (transition) =>
        (transition ? <any>vis.transition() : <any>vis)
            .attr("transform", d3zoom.zoomTransform(vis));
    vis.zoomToFit = () => {
        var b = cola.Rectangle.empty();
        vis.selectAll("rect").each(function (d) {
            var bb = this.getBBox();
            b = b.union(new cola.Rectangle(bb.x, bb.x + bb.width, bb.y, bb.y + bb.height));
        });
        var w = b.width(), h = b.height();
        var cw = Number(outer.attr("width")), ch = Number(outer.attr("height"));
        var s = Math.min(cw / w, ch / h);
        var tx = (-b.x * s + (cw / s - w) * s / 2), ty = (-b.y * s + (ch / s - h) * s / 2);
        d3zoom.zoom().translateBy(vis, tx, ty);
        d3zoom.zoom().scaleBy(vis, s);
        redraw(true);
    }

    return vis;
}

function petriGraph() {
    const margin = 0;
    const square = 40;
    const twidth = 10;
    let transition = "transition";
    let place = "place";

    var d3cola = cola.d3adaptor(d3)
        .jaccardLinkLengths(10, 0.5)
        .avoidOverlaps(true)
        .size([width, height]);

    var svg = makeSVG();

    d3.text("graphdata/PNGraph.dot", function (f) {
        const digraph = graphlibDot.read(f);

        const nodes = [];
        const groups = [];
        let edges = [];
        var constrains = []
        let leavesCounter = 0;
        let groupsCounter = 0;

        function crowler(name) {
            const itemsgroup = [];
            const groupsGroup = [];
            let resultId = null;
            let v = null;
            let type = "node";
            let children = digraph.children(name);
            if (children.length > 0) {
                type = "subgraph";
                children.forEach(function (childname) {
                    var g = crowler(childname)
                    if (g.type == "node") {
                        itemsgroup.push(g.id);
                    } else {
                        groupsGroup.push(g.id);
                    }
                });
                v = {
                    id: groupsCounter++,
                    "name": name,
                    "leaves": itemsgroup,
                    "groups": groupsGroup,
                    "data": digraph.node(name)
                };
                groups.push(v);
            } else {
                v = digraph._nodes[name];
                v.id = leavesCounter++;
                resultId = v.id;
                v.name = name;
                nodes.push(v);
            }
            resultId = v.id;
            return {
                "type": type,
                "id": resultId,
                "name": name,
                "leaves": itemsgroup,
                "groups": groupsGroup,
                "data": digraph.node(name)
            }
        }

        digraph.children().forEach(name => crowler(name));
        const dedges = <any[]>(digraph.edges());
        for (let edge of dedges) {
            edges.push({source: digraph._nodes[edge.v].id, target: digraph._nodes[edge.w].id});
        }
        var group_types = {
            in : "public_in",
            out : "public_out",
            private : "private",
            pattern : "pattern"
        }

        console.log(groups);
        for (let group of groups) {
            // Constrains all nodes on one vertical line
            if(group.data.type == group_types.in || group.data.type == group_types.out ) {
                if(group.leaves.length >= 2) {
                    for (var i = 1; i < group.leaves.length; i++)
                    {
                        constrains.push({"axis":"x", "left":group.leaves[i-1], "right":group.leaves[i], "gap":0, "equality":"true"})
                        constrains.push({"axis":"y", "left":group.leaves[i-1], "right":group.leaves[i], "gap":50, "equality":"true"})
                    }
                }
            }
        }

        let graph = {
            nodes: nodes,
            links: edges,
            groups: groups,
            constrains: constrains
        };


        graph.nodes.forEach(function (v) {
            v.width = v.height = square;
            if(v.type == transition) {
                v.width = twidth
            }
            v.padding = 10;

        })

        graph.groups.forEach(function (g) {
            g.padding = 20;
        });
        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .groups(graph.groups)
            .constraints(graph.constrains)
            .flowLayout('x', 50)
            .jaccardLinkLengths(50)
            .start(15,15, 50, 10);
        var group = svg.selectAll(".group")
            .data(graph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", function (d, i) {
                return color(i);
            });

        var patterns = svg.selectAll(".pattern")
                                  .data(group.filter(function(d){return d.data.type == group_types.pattern && d.groups.length > 0;})[0])
                                  .enter()
                                  .append("rect")
                                  .attr("class", "pattern")
                                  .attr("rx", 8)
                                  .attr("ry", 8)
        console.log(group.filter(function(d){return d.data.type == group_types.pattern;})[0])


        var link = svg.selectAll(".link")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link");

        var node = svg.selectAll(".node")
            .data(graph.nodes)
            .enter().append("rect")
            .attr("class", "node")
            .attr("width", function (d) {
                return (d.type == transition ? twidth : d.width);
            })
            .attr("height", function (d) {
                return d.height;
            })
            .attr("rx", function (d) {
                return (d.type == transition ? 1 : 100);
            })
            .attr("ry", function (d) {
                return (d.type == transition ? 1 : 100);
            })
            .style("fill", function (d) {
                return (d.type == place ? d3color.color("white") : d3color.color("black"));
            })
            .call(d3cola.drag);

        var label = svg.selectAll(".label")
            .data(graph.nodes)
            .enter().append("text")
            .attr("class", "label")
            .text(function (d) {
                return d.name;
            });

        node.append("title")
            .text(function (d) {
                return d.name;
            });

        d3cola.on("tick", function () {
            node.each(function (d) {
                d.innerBounds = d.bounds.inflate(-margin)
            });
            group.each(function (d) {
                d.innerBounds = d.bounds.inflate(-margin)
            });

            node.attr({
                "x": function (d) {
                    return d.x - d.width / 2;
                },
                "y": function (d) {
                    return d.y - d.height / 2 ;
                }
            });

            group.attr({"x": function (d) {
                    return d.bounds.x;
                },
                "y": function (d) {
                    return d.bounds.y;
                },
                "width": function (d) {
                    return d.bounds.width();
                },
                "height": function (d) {
                    return d.bounds.height();
                }});

            patterns.each(function (d) {
                var bbs = new List<Rectangle>( d.__data__.groups.map(g=>g.bounds));
                d.setx = bbs.select(b=>b.x).min() + 40;
                d.setX = bbs.select(b=>b.X).max() - 25;
                d.sety = bbs.select(b=>b.y).min();
                d.setY = bbs.select(b=>b.Y).max();
                d.setwidth = d.setX - d.setx;
                d.setheight = d.setY - d.sety;

            });

            patterns.attr("x", function (d) {     return d.setx;     })
                   .attr("y", function (d) { return d.sety; })
                    .attr("width", function (d) { return d.setwidth; })
                    .attr("height", function (d) { return d.setheight; })

            link.each(function (d) {
                let ah = 5;
                if(d.target.type == transition) {
                    ah = 5;
                }
                d.route = cola.makeEdgeBetween(d.source.innerBounds, d.target.innerBounds, ah);
            });

            link.attr({
                'x1': function (d) {
                    return d.route.sourceIntersection.x;
                },
                "y1": function (d) {
                    return d.route.sourceIntersection.y;
                },
                "x2": function (d) {
                    return d.route.arrowStart.x;
                },
                "y2": function (d) {
                    return d.route.arrowStart.y;
                }
            });

        });

    });
}

petriGraph();

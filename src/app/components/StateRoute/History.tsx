/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable */
// @ts-nocheck
import React, { useEffect } from 'react';
// formatting findDiff return data to show the changes with colors, aligns with actions.tsx
import { diff, formatters } from 'jsondiffpatch';
import * as d3 from 'd3';
import { DefaultMargin } from '../../FrontendTypes';
import { useDispatch } from 'react-redux';
import { changeView, changeSlider, setCurrentTabInApp } from '../../slices/mainSlice';

/*
  Render's history page after history button has been selected. Allows user to traverse state history and relevant state branches.
*/

const defaultMargin: DefaultMargin = {
  top: 30,
  left: 30,
  right: 55,
  bottom: 70,
};

// Fixed node separation distances
const FIXED_NODE_HEIGHT = 100; // Vertical distance between nodes
const FIXED_NODE_WIDTH = 180; // Horizontal distance between nodes

// main function exported to StateRoute
// below we destructure the props
function History(props: Record<string, unknown>): JSX.Element {
  const {
    width: totalWidth, // from ParentSize provided in StateRoute
    height: totalHeight, // from ParentSize provided in StateRoute
    margin = defaultMargin, //default margin is used when margins aren't passed into props
    hierarchy, // from 'tabs[currentTab]' object in 'MainContainer'
    currLocation, // from 'tabs[currentTab]' object in 'MainContainer'
    snapshots, // from 'tabs[currentTab].snapshotDisplay' object in 'MainContainer'
  } = props;

  //here we are adding useSelector and useDispatch for RTK state conversion
  const dispatch = useDispatch();

  const svgRef = React.useRef(null);
  const root = JSON.parse(JSON.stringify(hierarchy)); // why do we stringify and then parse our hierarchy back to JSON? (asked 7/31/23)
  // setting the margins for the Map to render in the tab window.
  const innerWidth: number = totalWidth - margin.left - margin.right;
  const innerHeight: number = totalHeight - margin.top - margin.bottom - 60;

  function labelCurrentNode(d3root) {
    // iterates through the parents of a node and applies a color property
    if (d3root.data.index === currLocation.index) {
      // node.data aka d3root.data allows us to access associated node data. So if node.index === currLocation.index...

      let currNode = d3root; // make our input the currNode

      while (currNode.parent) {
        // while there are parent nodes
        currNode.color = '#999'; // change or give the node a color property
        currNode = currNode.parent; // change currNode to the parent
      }

      currNode.color = '#999'; // when there are no more parent nodes, change or give the last node a color property

      return d3root; // return the modified d3root
    }

    let found;

    if (!d3root.children) {
      // if root has no children array
      return found; // return undefined
    }

    d3root.children.forEach((child) => {
      // for each child node within the children array
      if (!found) {
        // if found is undefined
        found = labelCurrentNode(child); //
      }
    });
    return found; // return's the found child node
  }

  function findDiff(index) {
    // determines the difference between our current index and the index-1 snapshot and produces an html string
    const statelessCleaning = (obj: {
      //'statelessCleaning' functions in the same way as the 'statelessCleaning' function in Diff.tsx
      name?: string;
      componentData?: object;
      state?: string | any;
      stateSnaphot?: object;
      children?: any[];
    }) => {
      const newObj = { ...obj }; // duplicate our input object into a new object

      if (newObj.name === 'nameless') {
        // if our new object's name is nameless
        delete newObj.name; // delete the name property
      }
      if (newObj.componentData) {
        // if our new object has a componentData property
        delete newObj.componentData; // delete the componentData property
      }
      if (newObj.state === 'stateless') {
        // if if our new object's state is stateless
        delete newObj.state; // delete the state property
      }
      if (newObj.stateSnaphot) {
        // if our new object has a stateSnaphot propertys
        newObj.stateSnaphot = statelessCleaning(obj.stateSnaphot); // run statelessCleaning on the stateSnapshot
      }

      if (newObj.children) {
        // if our new object has a children property
        newObj.children = [];
        if (obj.children.length > 0) {
          // and if our input object's children property is non-empty, go through each children object from our input object and determine, if the object being iterated on either has a stateless state or has a children array with a non-zero amount of objects. Objects that fulfill the above that need to be cleaned through statelessCleaning. Those that are cleaned through this process are then pushed to the new object's children array.
          obj.children.forEach((element: { state?: object | string; children?: [] }) => {
            if (element.state !== 'stateless' || element.children.length > 0) {
              const clean = statelessCleaning(element);
              newObj.children.push(clean);
            }
          });
        }
      }
      return newObj; // return the cleaned state snapshot(s)
    };

    function findStateChangeObj(delta, changedState = []) {
      // function determines whether delta has resulted in a changedState. Function would return an empty array if there were no changes to state and an array of objects that changed state.
      if (!delta.children && !delta.state) {
        // if delta doesn't have a children property or a state property
        return changedState; // returns an empty array
      }

      if (delta.state && delta.state[0] !== 'stateless') {
        // ignore stateless delta objects
        changedState.push(delta.state); // and push stateful delta objects to changedState
      }

      if (!delta.children) {
        // if the delta doesn't have any children
        return changedState; // return the changedState array with any and all stateful delta objects.
      }

      Object.keys(delta.children).forEach((child) => {
        // but if the delta object did have children, we iterate through each child object
        // if (isNaN(child) === false) {
        changedState.push(...findStateChangeObj(delta.children[child])); // recursively call this function on each child object. Push every 'stateful' child into the changedState array.
        // }
      });

      return changedState; // return the changedState array with any and all stateful delta objects.
    }

    const delta = diff(
      // 'diff' function from 'jsondiffpatch' returns the difference in state between the (snapshot that occurred before the indexed snapshot) and the (indexed snapshot).
      statelessCleaning(snapshots[index - 1]),
      statelessCleaning(snapshots[index]),
    );
    const changedState = findStateChangeObj(delta); // determines if delta had any stateful changes
    const html = formatters.html.format(changedState[0]); // formats the difference into html string
    return html; // return html string
  }

  /**
   * @method makeD3Tree :Creates a new D3 Tree
   */

  const makeD3Tree = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create tree layout with fixed node separation
    const treeLayout = d3.tree().nodeSize([FIXED_NODE_WIDTH, FIXED_NODE_HEIGHT]); // Set fixed sizes between nodes

    // Calculate the tree structure
    const d3root = treeLayout(d3.hierarchy(root));

    // Calculate total required height and width
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    d3root.each((d) => {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    });

    const actualWidth = maxX - minX + FIXED_NODE_WIDTH;
    const actualHeight = maxY - minY + FIXED_NODE_HEIGHT;

    // Set SVG size to accommodate the entire tree
    svg
      .attr('width', Math.max(actualWidth + margin.left + margin.right, totalWidth))
      .attr('height', Math.max(actualHeight + margin.top + margin.bottom, totalHeight));

    // Center the root node horizontally
    const centerOffset = totalWidth / 2 - (maxX - minX) / 2;

    const g = svg.append('g').attr('transform', `translate(${centerOffset},${margin.top})`);

    // Label current node
    const currNode = labelCurrentNode(d3root);

    const link = g
      .selectAll('.link')
      .data(d3root.descendants().slice(1))
      .enter()
      .append('path')
      .attr('class', (d) => {
        return d.data.index === currLocation.index ? 'link current-link' : 'link';
      })
      .attr(
        'd',
        (d) =>
          `M${d.x},${d.y}C${d.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${
            (d.y + d.parent.y) / 2
          } ${d.parent.x},${d.parent.y}`,
      );

    const node = g
      .selectAll('.node')
      .data(d3root.descendants())
      .enter()
      .append('g')
      .attr('class', (d) => {
        const baseClass = 'node';
        const internalClass = d.children ? ' node--internal' : '';
        const activeClass = d.data.index === currLocation.index ? ' active' : '';
        return baseClass + internalClass + activeClass;
      })
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Add click handler for nodes
    node
      .on('click', (event, d) => {
        dispatch(changeView(d.data.index));
        dispatch(changeSlider(d.data.index));

        function renderToolTip() {
          const [x, y] = d3.pointer(event);
          const div = d3
            .select('.display:first-child')
            .append('div')
            .attr('class', `tooltip`)
            .attr('id', `tt-${d.data.index}`)
            .style('left', `${event.clientX - 10}px`)
            .style('top', `${event.clientY - 10}px`)
            .style('max-height', `25%`)
            .style('overflow', `scroll`);
          d3.selectAll('.tooltip').html(findDiff(d.data.index));
        }

        if (d3.selectAll('.tooltip')._groups['0'].length === 0) {
          renderToolTip(); //if there are no tooltips left in the doc, we call the function to create a new tooltip
        } else {
          if (d3.selectAll(`#tt-${d.data.index}`)._groups['0'].length === 0) {
            // if there is no tooltip with the specific id
            d3.selectAll('.tooltip').remove(); //remove any existing tooltips
            renderToolTip(); //call the function again to create a new tooltip
          }
        }
      })
      .on('mouseenter', function (event, d) {
        d3.selectAll('.tooltip').remove();
        const [x, y] = d3.pointer(event);
        if (d3.selectAll('.tooltip')._groups['0'].length === 0) {
          const div = d3
            .select('.display:first-child')
            .append('div')
            .attr('class', `tooltip`)
            .attr('id', `tt-${d.data.index}`)
            .style('left', `${event.clientX + 30}px`)
            .style('top', `${event.clientY - 75}px`)
            .style('max-height', `25%`)
            .style('overflow', `auto`)
            .on('mouseenter', function (event, d) {
              d3.select(this).interrupt(); // Interrupt any ongoing transitions
            })
            .on('mouseleave', function (event, d) {
              d3.selectAll('.tooltip').remove().style('display', 'hidden');
            });

          d3.selectAll('.tooltip').html(findDiff(d.data.index));
        }
      })
      .on('mouseleave', function (event, d) {
        if (event.relatedTarget.id !== `tt-${d.data.index}`) {
          d3.selectAll('.tooltip').transition().delay(0).remove();
        }
      });

    const tooltip = d3
      .select('.tooltip')
      .on('mousemove', function (event, d) {
        d3.select('.tooltip').style('opacity', '1');
      })
      .on('mouseleave', function (event, d) {
        d3.selectAll('.tooltip').remove();
      });

    node.append('circle').attr('r', 20);

    node
      .append('text')
      .attr('dy', '0.31em')
      .attr('text-anchor', 'middle')
      .text((d) => `${d.data.name}.${d.data.branch}`);

    return svg.node();
  };

  useEffect(() => {
    makeD3Tree();
  }, [root /*, currLocation*/]); // if the 'root' or 'currLocation' changes, re-build the D3 Tree

  useEffect(() => {
    dispatch(setCurrentTabInApp('history')); // dispatch sent at initial page load allowing changing "immer's" draft.currentTabInApp to 'webmetrics' to facilitate render.
  }, []);

  // then rendering each node in History tab to render using D3, which will share area with LegendKey
  return (
    <div className='display'>
      <svg ref={svgRef} width={totalWidth} height={totalHeight} />
    </div>
  );
}

export default History;

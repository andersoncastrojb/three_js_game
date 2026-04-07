/**
 * @file AStar.js
 * @layer Core / Math
 * @description Pure-JS A* Pathfinding algorithm for the Maze grid.
 * Zero external dependencies.
 */

import { MazeCell } from '../entities/Maze.js';

export class AStar {
  /**
   * Finds the shortest path from start to end using A* algorithm.
   * 
   * @param {number[][]} grid - The maze bitmask grid.
   * @param {{col: number, row: number}} start - The starting cell coordinates.
   * @param {{col: number, row: number}} goal - The target cell coordinates.
   * @returns {{col: number, row: number}[]} - Array of cells representing the path (excluding start), or empty array if no path.
   */
  static findPath(grid, start, goal) {
    if (!grid || grid.length === 0) return [];
    
    const rows = grid.length;
    const cols = grid[0].length;

    // Validate bounds
    if (start.row < 0 || start.row >= rows || start.col < 0 || start.col >= cols ||
        goal.row < 0 || goal.row >= rows || goal.col < 0 || goal.col >= cols) {
      return [];
    }

    // Node representation: { r, c, g, h, f, parent }
    const openSet = [];
    const closedSet = new Set();
    
    const startNode = { r: start.row, c: start.col, g: 0, h: this._heuristic(start, goal), f: 0, parent: null };
    startNode.f = startNode.g + startNode.h;
    
    openSet.push(startNode);

    const getNodeKey = (r, c) => `${r},${c}`;

    while (openSet.length > 0) {
      // Get node with lowest f score
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }
      
      const current = openSet[lowestIndex];
      
      // Goal reached
      if (current.r === goal.row && current.c === goal.col) {
        return this._reconstructPath(current);
      }
      
      // Move from open to closed
      openSet.splice(lowestIndex, 1);
      closedSet.add(getNodeKey(current.r, current.c));
      
      // Check neighbors
      const neighbors = this._getNeighbors(grid, current.r, current.c, rows, cols);
      
      for (const neighbor of neighbors) {
        if (closedSet.has(getNodeKey(neighbor.r, neighbor.c))) continue;
        
        const tentativeG = current.g + 1; // All movements cost 1
        
        let neighborNode = openSet.find(n => n.r === neighbor.r && n.c === neighbor.c);
        
        if (!neighborNode) {
          neighborNode = {
            r: neighbor.r,
            c: neighbor.c,
            g: tentativeG,
            h: this._heuristic({row: neighbor.r, col: neighbor.c}, goal),
            f: 0,
            parent: current
          };
          neighborNode.f = neighborNode.g + neighborNode.h;
          openSet.push(neighborNode);
        } else if (tentativeG < neighborNode.g) {
          // Found a better path to an existing open node
          neighborNode.g = tentativeG;
          neighborNode.f = neighborNode.g + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    return []; // No path found
  }

  /**
   * Manhattan distance heuristic.
   * @private
   */
  static _heuristic(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  /**
   * Constructs the path backwards from the goal node.
   * @private
   */
  static _reconstructPath(node) {
    const path = [];
    let current = node;
    while (current.parent !== null) {
      path.push({ col: current.c, row: current.r });
      current = current.parent;
    }
    return path.reverse();
  }

  /**
   * Returns valid, open neighbors for a given cell.
   * @private
   */
  static _getNeighbors(grid, r, c, maxRows, maxCols) {
    const neighbors = [];
    const cellMask = grid[r][c];

    // North
    if ((cellMask & MazeCell.NORTH) && r > 0) neighbors.push({ r: r - 1, c });
    // South
    if ((cellMask & MazeCell.SOUTH) && r < maxRows - 1) neighbors.push({ r: r + 1, c });
    // East
    if ((cellMask & MazeCell.EAST) && c < maxCols - 1) neighbors.push({ r, c: c + 1 });
    // West
    if ((cellMask & MazeCell.WEST) && c > 0) neighbors.push({ r, c: c - 1 });

    return neighbors;
  }
}

import { invariant } from './invariant';

interface Node {
  readonly id: string;
  readonly dependencyIds: string[];
  hasOutgoing: boolean;
  readonly task: () => Promise<void>;
}

export class Dag {
  private readonly nodes: Record<string, Node> = {};

  public get size() {
    return Object.keys(this.nodes).length;
  }

  public addNode(id: string, task: () => Promise<void>) {
    if (this.nodes[id]) {
      throw new Error(`Node ${id} already exists`);
    }
    this.nodes[id] = {
      id,
      dependencyIds: [],
      hasOutgoing: false,
      task,
    };
  }

  public addEdge(from: string, to: string) {
    invariant(from !== to, 'Cannot add edge to the same node');
    invariant(this.nodes[from], `Node ${from} does not exist`);
    invariant(this.nodes[to], `Node ${to} does not exist`);

    invariant(
      !this.hasInvalidCycle(from, to),
      `Adding edge from ${from} to ${to} would create a cycle`,
    );

    this.nodes[from].hasOutgoing = true;
    this.nodes[to].dependencyIds.push(from);
  }

  public async runTasks() {
    const tasksToRun = new Set(Object.keys(this.nodes));

    const taskPromises: Record<string, Promise<void>> = {};

    const addToTaskPromises = (nodeId: string) => {
      tasksToRun.delete(nodeId);
      this.nodes[nodeId].dependencyIds.forEach((depId) => {
        if (Object.prototype.hasOwnProperty.call(taskPromises, depId)) {
          return;
        }
        addToTaskPromises(depId);
      });
      taskPromises[nodeId] = Promise.all(
        this.nodes[nodeId].dependencyIds.map((depId) => taskPromises[depId]),
      ).then(async () => {
        await this.nodes[nodeId].task();
      });
    };

    for (const nodeId of tasksToRun) {
      addToTaskPromises(nodeId);
    }

    return Promise.all(Object.values(taskPromises));
  }

  /**
   * Check for that a path does not exist from `from` to `to`
   */
  private hasInvalidCycle(
    from: string,
    to: string,
    visited: Set<string> = new Set(),
  ): boolean {
    if (visited.has(to)) {
      return true;
    }
    if (this.nodes[from].dependencyIds.length === 0) {
      return false;
    }
    for (const depId of this.nodes[from].dependencyIds) {
      visited.add(depId);
    }
    return this.nodes[from].dependencyIds.some((depId) =>
      this.hasInvalidCycle(depId, to, visited),
    );
  }
}

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Dag } from './dag';

const makeDagEventTask = (id: string, eventLog: string[]) => () =>
  new Promise<void>((resolve) => {
    eventLog.push(`start:${id}`);
    setImmediate(() => {
      eventLog.push(`end:${id}`);
      resolve();
    });
  });

describe(Dag.name, () => {
  describe(Dag.prototype.addNode.name, () => {
    it('returns expected size', () => {
      const dag = new Dag();
      dag.addNode('a', () => Promise.resolve());
      assert.strictEqual(dag.size, 1);
      dag.addNode('b', () => Promise.resolve());
      assert.strictEqual(dag.size, 2);
      dag.addNode('c', () => Promise.resolve());
      assert.strictEqual(dag.size, 3);
    });

    it('returns false if node already exists', () => {
      const dag = new Dag();
      dag.addNode('a', () => Promise.resolve());
      assert.strictEqual(
        dag.addNode('a', () => Promise.resolve()),
        false
      );
    });
  });

  describe(Dag.prototype.addEdge.name, () => {
    it('fails on path to self', () => {
      const dag = new Dag();
      dag.addNode('a', () => Promise.resolve());
      assert.throws(() => dag.addEdge('a', 'a'));
    });

    it('detects cycle', () => {
      const dag = new Dag();
      ['a', 'b', 'c', 'd', 'e'].forEach((id) => {
        dag.addNode(id, () => Promise.resolve());
      });
      dag.addEdge('a', 'b');
      dag.addEdge('b', 'c');
      dag.addEdge('c', 'd');
      dag.addEdge('d', 'e');

      assert.throws(() => dag.addEdge('b', 'a'));
      assert.throws(() => dag.addEdge('e', 'a'));
      assert.throws(() => dag.addEdge('e', 'd'));
    });
  });

  describe(Dag.prototype.runTasks.name, () => {
    it('small linear chain', async () => {
      /**
       * a -- b -- c
       */
      const dag = new Dag();
      const tasks = ['a', 'b', 'c'];
      const events: string[] = [];
      tasks.forEach((id) => {
        dag.addNode(id, makeDagEventTask(id, events));
      });
      dag.addEdge('a', 'b');
      dag.addEdge('b', 'c');
      await dag.runTasks();
      assert.deepStrictEqual(events, [
        'start:a',
        'end:a',
        'start:b',
        'end:b',
        'start:c',
        'end:c',
      ]);
    });

    it('parallel tasks', async () => {
      /**
       * a -- b
       *   \- c
       */
      const dag = new Dag();
      const events: string[] = [];
      dag.addNode('a', makeDagEventTask('a', events));
      dag.addNode('b', makeDagEventTask('b', events));
      dag.addNode('c', makeDagEventTask('c', events));
      dag.addEdge('a', 'b');
      dag.addEdge('a', 'c');
      await dag.runTasks();
      const aEnd = events.indexOf('end:a');
      const bStart = events.indexOf('start:b');
      const bEnd = events.indexOf('end:b');
      const cStart = events.indexOf('start:c');
      const cEnd = events.indexOf('end:c');

      assert(aEnd < bStart);
      assert(aEnd < cStart);
      assert(cStart < bEnd);
      assert(bStart < cEnd);
    });

    it('multiple dependencies', async () => {
      /**
       * a -\
       * b -- d
       * c -/
       */
      const dag = new Dag();
      const events: string[] = [];
      dag.addNode('a', makeDagEventTask('a', events));
      dag.addNode('b', makeDagEventTask('b', events));
      dag.addNode('c', makeDagEventTask('c', events));
      dag.addNode('d', makeDagEventTask('d', events));
      dag.addEdge('a', 'd');
      dag.addEdge('b', 'd');
      dag.addEdge('c', 'd');
      await dag.runTasks();
      const aEnd = events.indexOf('end:a');
      const bEnd = events.indexOf('end:b');
      const cEnd = events.indexOf('end:c');
      const dStart = events.indexOf('start:d');

      assert(Math.max(aEnd, bEnd, cEnd) < dStart);
    });
  });
});

import { Dag } from './dag';

const makeDagEventTask = (id: string, eventLog: string[]) => () =>
  new Promise<void>((resolve) => {
    eventLog.push(`start:${id}`);
    setImmediate(() => {
      eventLog.push(`end:${id}`);
      resolve();
    });
  });

describe(Dag, () => {
  describe(Dag.prototype.addNode, () => {
    test('returns expected size', () => {
      const dag = new Dag();
      dag.addNode('a', () => Promise.resolve());
      expect(dag.size).toBe(1);
      dag.addNode('b', () => Promise.resolve());
      expect(dag.size).toBe(2);
      dag.addNode('c', () => Promise.resolve());
      expect(dag.size).toBe(3);
    });

    test('throws if node already exists', () => {
      const dag = new Dag();
      dag.addNode('a', () => Promise.resolve());
      expect(() => dag.addNode('a', () => Promise.resolve())).toThrow();
    });
  });

  describe(Dag.prototype.addEdge, () => {
    test('detects cycle', () => {
      const dag = new Dag();
      ['a', 'b', 'c', 'd', 'e'].forEach((id) => {
        dag.addNode(id, () => Promise.resolve());
      });
      dag.addEdge('a', 'b');
      dag.addEdge('b', 'c');
      dag.addEdge('c', 'd');
      dag.addEdge('d', 'e');

      expect(() => dag.addEdge('b', 'a')).toThrow();
      expect(() => dag.addEdge('e', 'a')).toThrow();
      expect(() => dag.addEdge('e', 'd')).toThrow();
    });
  });

  describe(Dag.prototype.runTasks, () => {
    test('small linear chain', async () => {
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
      expect(events).toMatchObject([
        'start:a',
        'end:a',
        'start:b',
        'end:b',
        'start:c',
        'end:c',
      ]);
    });

    test('parallel tasks', async () => {
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

      expect(aEnd).toBeLessThan(bStart);
      expect(aEnd).toBeLessThan(cStart);
      expect(cStart).toBeLessThan(bEnd);
      expect(bStart).toBeLessThan(cEnd);
    });

    test('multiple dependencies', async () => {
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

      expect(Math.max(aEnd, bEnd, cEnd)).toBeLessThan(dStart);
    });
  });
});

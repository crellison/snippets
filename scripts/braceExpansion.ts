/**
 * Takes whatever is in the brace and expands it to all possible combinations 
 * expand('file-{a,b,c}.jpg')
// => ['file-a.jpg', 'file-b.jpg', 'file-c.jpg']

expand('-v{,,}')
// => ['-v', '-v', '-v']

expand('file{0..2}.jpg')
// => ['file0.jpg', 'file1.jpg', 'file2.jpg']

expand('file-{a..c}.jpg')
// => ['file-a.jpg', 'file-b.jpg', 'file-c.jpg']

expand('file{2..0}.jpg')
// => ['file2.jpg', 'file1.jpg', 'file0.jpg']

expand('file{0..4..2}.jpg')
// => ['file0.jpg', 'file2.jpg', 'file4.jpg']

expand('file-{a..e..2}.jpg')
// => ['file-a.jpg', 'file-c.jpg', 'file-e.jpg']

expand('file{00..10..5}.jpg')
// => ['file00.jpg', 'file05.jpg', 'file10.jpg']

expand('{{A..C},{a..c}}')
// => ['A', 'B', 'C', 'a', 'b', 'c']

expand('ppp{,config,oe{,conf}}')
// => ['ppp', 'pppconfig', 'pppoe', 'pppoeconf']
 */

function getFirstBraceBounds(input: string): [number, number] {
  const braceStart = input.indexOf('{');
  if (braceStart === -1) return [-1, -1];

  let interiorBraceCount = 1;
  for (let i = braceStart + 1; i < input.length; i++) {
    if (input[i] === '{') interiorBraceCount++;
    if (input[i] === '}') interiorBraceCount--;
    if (interiorBraceCount === 0) return [braceStart, i];
  }
  // invalid braces
  return [-1, -1];
}

function getDotExpansions(input: string): string[] {
  const [start, end, step] = input.split('..');
  const stepVal = Number(step) || 1;
  if (Number.isNaN(Number(start))) {
    const startCode = start.charCodeAt(0);
    const endCode = end.charCodeAt(0);
    // should assert that startCode and endCode are valid characters
    // and that step leads to the direction of the start -> end
    return Array.from({
      length: Math.abs((endCode - startCode) / stepVal),
    }).map((_, i) => String.fromCharCode(startCode + i * stepVal));
  } else {
    const startVal = Number(start);
    const endVal = Number(end);
    return Array.from({ length: Math.abs((endVal - startVal) / stepVal) }).map(
      (_, i) => String(startVal + i * stepVal)
    );
  }
}

const braceMatch = /{([^}]+)}/g;
function expand(input: string): string[] {
  const [braceStart, braceEnd] = getFirstBraceBounds(input);
  if (braceStart === -1) return [input];

  let braceContent = input.slice(braceStart + 1, braceEnd);
  if (braceContent.includes('{')) {
    // recurse to get the internal expansions
  }

  if (braceContent.includes('..')) {
    const expansions = getDotExpansions(braceContent);
    return expansions.map(
      (expansion) =>
        input.substring(0, braceStart) +
        expansion +
        input.substring(braceEnd + 1)
    );
  }

  const braceGroups = braceContent.split(',');
  return braceGroups.map(
    (group) =>
      input.substring(0, braceStart) + group + input.substring(braceEnd + 1)
  );
}

console.log(expand('file-{0..2}.jpg'));
console.log(expand('file-{0..6..3}.jpg'));
console.log(expand('file-{a,c,d,f}.jpg'));
console.log(expand('file-{a..c}.jpg'));

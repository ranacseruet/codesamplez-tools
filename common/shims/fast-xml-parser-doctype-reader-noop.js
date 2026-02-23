function assertDoctypeStart(xmlData, startIndex) {
  if (!xmlData.startsWith('<!DOCTYPE', startIndex)) {
    throw new Error('Invalid Tag instead of DOCTYPE');
  }
}

export default function readDocType(xmlData, startIndex) {
  assertDoctypeStart(xmlData, startIndex);

  let angleDepth = 0;
  let quote = null;
  let inComment = false;

  for (let i = startIndex; i < xmlData.length; i += 1) {
    if (inComment) {
      if (xmlData[i] === '-' && xmlData[i + 1] === '-' && xmlData[i + 2] === '>') {
        inComment = false;
        i += 2;
      }
      continue;
    }

    if (quote) {
      if (xmlData[i] === quote) {
        quote = null;
      }
      continue;
    }

    if (xmlData[i] === '<' && xmlData[i + 1] === '!' && xmlData[i + 2] === '-' && xmlData[i + 3] === '-') {
      inComment = true;
      i += 3;
      continue;
    }

    if (xmlData[i] === '"' || xmlData[i] === "'") {
      quote = xmlData[i];
      continue;
    }

    if (xmlData[i] === '<') {
      angleDepth += 1;
      continue;
    }

    if (xmlData[i] === '>') {
      angleDepth -= 1;
      if (angleDepth === 0) {
        return { entities: {}, i };
      }
    }
  }

  throw new Error('Unclosed DOCTYPE');
}

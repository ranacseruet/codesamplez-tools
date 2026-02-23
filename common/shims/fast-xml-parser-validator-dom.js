function getErrorResult(message) {
  return {
    err: {
      msg: message || 'Invalid XML format'
    }
  };
}

export function validate(xmlData) {
  if (typeof xmlData !== 'string' || xmlData.length === 0) {
    return getErrorResult('Start tag expected.');
  }

  if (typeof DOMParser !== 'function') {
    return getErrorResult('Invalid XML format');
  }

  try {
    const doc = new DOMParser().parseFromString(xmlData, 'application/xml');
    const parserError = doc.getElementsByTagName('parsererror')[0];

    if (parserError) {
      const message = (parserError.textContent || '').trim();
      return getErrorResult(message || 'Invalid XML format');
    }

    return true;
  } catch (error) {
    return getErrorResult(error && error.message ? error.message : 'Invalid XML format');
  }
}


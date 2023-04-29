import { makeError as error }from './error.js';

export function unexpectedToken(type, occasion, filename, line) {
  const msg = `\`${type}\` encountered when ${occasion}`;
  throw error('UNEXPECTED_TOKEN', msg, {filename, line});
}

export function stripComments(input, options = {}) {
  // Default: strip unbuffered comments and leave buffered ones alone
  const stripUnbuffered = options.stripUnbuffered !== false;
  const stripBuffered = options.stripBuffered === true;
  const filename = options.filename;

  const out = [];
  // If we have encountered a comment token and are not sure if we have gotten
  // out of the comment or not
  let inComment = false;
  // If we are sure that we are in a block comment and all tokens except
  // `end-pipeless-text` should be ignored
  let inPipelessText = false;

  return input.filter(({type, line, buffer}) => {
    switch (type) {
      case 'comment':
        if (inComment) {
          unexpectedToken(
            'comment',
            'already in a comment',
            filename,
            line
          );
        } else {
          inComment = buffer ? stripBuffered : stripUnbuffered;
          return !inComment;
        }
      case 'start-pipeless-text':
        if (!inComment) return true;
        if (inPipelessText) {
          unexpectedToken(
            'start-pipeless-text',
            'already in pipeless text mode',
            filename,
            line
          );
        }
        inPipelessText = true;
        return false;
      case 'end-pipeless-text':
        if (!inComment) return true;
        if (!inPipelessText) {
          unexpectedToken(
            'end-pipeless-text',
            'not in pipeless text mode',
            filename,
            line
          );
        }
        inPipelessText = false;
        inComment = false;
        return false;
      // There might be a `text` right after `comment` but before
      // `start-pipeless-text`. Treat it accordingly.
      case 'text':
        return !inComment;
      default:
        if (inPipelessText) return false;
        inComment = false;
        return true;
    }
  });
}
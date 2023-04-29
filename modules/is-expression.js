import acorn from 'acorn';

const DEFAULT_OPTIONS = {
  throw: false,
  strict: false,
  lineComment: false
};

export function isExpression(src, options) {
  options = Object.assign({}, DEFAULT_OPTIONS, options);

  try {
    const parser = new acorn.Parser(options, src, 0);

    if (options.strict) {
      parser.strict = true;
    }

    if (!options.lineComment) {
      parser.skipLineComment = function (startSkip) {
        this.raise(this.pos, 'Line comments not allowed in an expression');
      };
    }

    parser.nextToken();
    parser.parseExpression();

    if (parser.type !== acorn.tokTypes.eof) {
      parser.unexpected();
    }
  } catch (ex) {
    if (!options.throw) {
      return false;
    }

    throw ex;
  }

  return true;
}


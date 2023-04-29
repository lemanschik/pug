import {fs, path } from './fs.js';

import walk from './walk.js';

export class load {
  constructor(ast, options) {
    options = getOptions(options);
    // clone the ast
    ast = JSON.parse(JSON.stringify(ast));
    return walk(ast, node => {
      if (node.str === undefined) {
        if (
          node.type === 'Include' ||
          node.type === 'RawInclude' ||
          node.type === 'Extends'
        ) {
          const file = node.file;
          if (file.type !== 'FileReference') {
            throw new Error('Expected file.type to be "FileReference"');
          }
          let path, str, raw;
          try {
            path = options.resolve(file.path, file.filename, options);
            file.fullPath = path;
            raw = options.read(path, options);
            str = raw.toString('utf8');
          } catch (ex) {
            ex.message += `\n    at ${node.filename} line ${node.line}`;
            throw ex;
          }
          file.str = str;
          file.raw = raw;
          if (node.type === 'Extends' || node.type === 'Include') {
            file.ast = load.string(
              str,
              Object.assign({}, options, {
                filename: path,
              })
            );
          }
        }
      }
    });
  }

  static string(src, options) {
    options = Object.assign(getOptions(options), {
      src,
    });
    const tokens = options.lex(src, options);
    const ast = options.parse(tokens, options);
    return load(ast, options);
  }

  static file(filename, options) {
    options = Object.assign(getOptions(options), {
      filename,
    });
    const str = options.read(filename).toString('utf8');
    return load.string(str, options);
  }

  static resolve(filename, source, {basedir}) {
    filename = filename.trim();
    if (filename[0] !== '/' && !source)
      throw new Error(
        'the "filename" option is required to use includes and extends with "relative" paths'
      );

    if (filename[0] === '/' && !basedir)
      throw new Error(
        'the "basedir" option is required to use includes and extends with "absolute" paths'
      );

    filename = path.join(
      filename[0] === '/' ? basedir : path.dirname(source.trim()),
      filename
    );

    return filename;
  }

  static read(filename, options) {
    return fs.readFileSync(filename);
  }

  static validateOptions(options) {
    /* istanbul ignore if */
    if (typeof options !== 'object') {
      throw new TypeError('options must be an object');
    }
    /* istanbul ignore if */
    if (typeof options.lex !== 'function') {
      throw new TypeError('options.lex must be a function');
    }
    /* istanbul ignore if */
    if (typeof options.parse !== 'function') {
      throw new TypeError('options.parse must be a function');
    }
    /* istanbul ignore if */
    if (options.resolve && typeof options.resolve !== 'function') {
      throw new TypeError('options.resolve must be a function');
    }
    /* istanbul ignore if */
    if (options.read && typeof options.read !== 'function') {
      throw new TypeError('options.read must be a function');
    }
  }
}

function getOptions(options) {
  load.validateOptions(options);
  return Object.assign(
    {
      resolve: load.resolve,
      read: load.read,
    },
    options
  );
}

/*!
 * Pug
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

import {fs, path } from './fs.js';

import attrs from './attrs.js';
import lex from './lexer.js';
import stripComments from './strip-comments.js';
import parse from './parser.js';
import load from './load.js';
import filters from './filters.js';
import link from './linker.js';
import generateCode from './code-gen.js';
import runtime from './runtime.js';
import walk from './walk.js';
import {wrap as runtimeWrap, build as runtimeBuild } from './runtime.js';
export {runtimeBuild, walk, attrs };
/**
 * Name for detection
 */

export var name = 'Pug';

/**
 * Pug runtime helpers.
 */

export {runtime};

/**
 * Template function cache.
 */

export var cache = {};

function applyPlugins(value, options, plugins, name) {
  return plugins.reduce((value, plugin) => plugin[name] ? plugin[name](value, options) : value, value);
}

function findReplacementFunc(plugins, name) {
  const eligiblePlugins = plugins.filter(plugin => plugin[name]);

  if (eligiblePlugins.length > 1) {
    throw new Error(`Two or more plugins all implement ${name} method.`);
  } else if (eligiblePlugins.length) {
    return eligiblePlugins[0][name].bind(eligiblePlugins[0]);
  }
  return null;
}

/**
 * Object for global custom filters.  Note that you can also just pass a `filters`
 * option to any other method.
 */
export var filters = {};

/**
 * Compile the given `str` of pug and return a function body.
 *
 * @param {String} str
 * @param {Object} options
 * @return {Object}
 * @api private
 */

function compileBody(str, options) {
  const debug_sources = {};
  debug_sources[options.filename] = str;
  const dependencies = [];
  const plugins = options.plugins || [];
  let ast = load.string(str, {
    filename: options.filename,
    basedir: options.basedir,
    lex(str, options) {
      const lexOptions = {};
      Object.keys(options).forEach(key => {
        lexOptions[key] = options[key];
      });
      lexOptions.plugins = plugins
        .filter(plugin => !!plugin.lex)
        .map(plugin => plugin.lex);
      const contents = applyPlugins(
        str,
        {filename: options.filename},
        plugins,
        'preLex'
      );
      return applyPlugins(
        lex(contents, lexOptions),
        options,
        plugins,
        'postLex'
      );
    },
    parse(tokens, options) {
      tokens = tokens.map(token => {
        if (token.type === 'path' && path.extname(token.val) === '') {
          return {
            type: 'path',
            loc: token.loc,
            val: `${token.val}.pug`,
          };
        }
        return token;
      });
      tokens = stripComments(tokens, options);
      tokens = applyPlugins(tokens, options, plugins, 'preParse');
      const parseOptions = {};
      Object.keys(options).forEach(key => {
        parseOptions[key] = options[key];
      });
      parseOptions.plugins = plugins
        .filter(plugin => !!plugin.parse)
        .map(plugin => plugin.parse);

      return applyPlugins(
        applyPlugins(
          parse(tokens, parseOptions),
          options,
          plugins,
          'postParse'
        ),
        options,
        plugins,
        'preLoad'
      );
    },
    resolve(filename, source, loadOptions) {
      const replacementFunc = findReplacementFunc(plugins, 'resolve');
      if (replacementFunc) {
        return replacementFunc(filename, source, options);
      }

      return load.resolve(filename, source, loadOptions);
    },
    read(filename, loadOptions) {
      dependencies.push(filename);

      let contents;

      const replacementFunc = findReplacementFunc(plugins, 'read');
      if (replacementFunc) {
        contents = replacementFunc(filename, options);
      } else {
        contents = load.read(filename, loadOptions);
      }

      debug_sources[filename] = Buffer.isBuffer(contents)
        ? contents.toString('utf8')
        : contents;
      return contents;
    },
  });
  ast = applyPlugins(ast, options, plugins, 'postLoad');
  ast = applyPlugins(ast, options, plugins, 'preFilters');

  const filtersSet = {};
  Object.keys(exports.filters).forEach(key => {
    filtersSet[key] = exports.filters[key];
  });
  if (options.filters) {
    Object.keys(options.filters).forEach(key => {
      filtersSet[key] = options.filters[key];
    });
  }
  ast = filters.handleFilters(
    ast,
    filtersSet,
    options.filterOptions,
    options.filterAliases
  );

  ast = applyPlugins(ast, options, plugins, 'postFilters');
  ast = applyPlugins(ast, options, plugins, 'preLink');
  ast = link(ast);
  ast = applyPlugins(ast, options, plugins, 'postLink');

  // Compile
  ast = applyPlugins(ast, options, plugins, 'preCodeGen');
  let js = (findReplacementFunc(plugins, 'generateCode') || generateCode)(ast, {
    pretty: options.pretty,
    compileDebug: options.compileDebug,
    doctype: options.doctype,
    inlineRuntimeFunctions: options.inlineRuntimeFunctions,
    globals: options.globals,
    self: options.self,
    includeSources: options.includeSources ? debug_sources : false,
    templateName: options.templateName,
  });
  js = applyPlugins(js, options, plugins, 'postCodeGen');

  // Debug compiler
  if (options.debug) {
    console.error(
      '\nCompiled Function:\n\n\u001b[90m%s\u001b[0m',
      js.replace(/^/gm, '  ')
    );
  }

  return {body: js, dependencies};
}

/**
 * Get the template from a string or a file, either compiled on-the-fly or
 * read from cache (if enabled), and cache the template if needed.
 *
 * If `str` is not set, the file specified in `options.filename` will be read.
 *
 * If `options.cache` is true, this function reads the file from
 * `options.filename` so it must be set prior to calling this function.
 *
 * @param {Object} options
 * @param {String=} str
 * @return {Function}
 * @api private
 */
function handleTemplateCache(options, str) {
  const key = options.filename;
  if (options.cache && exports.cache[key]) {
    return exports.cache[key];
  } else {
    if (str === undefined) str = fs.readFileSync(options.filename, 'utf8');
    const templ = exports.compile(str, options);
    if (options.cache) exports.cache[key] = templ;
    return templ;
  }
}

/**
 * Compile a `Function` representation of the given pug `str`.
 *
 * Options:
 *
 *   - `compileDebug` when `false` debugging code is stripped from the compiled
       template, when it is explicitly `true`, the source code is included in
       the compiled template for better accuracy.
 *   - `filename` used to improve errors when `compileDebug` is not `false` and to resolve imports/extends
 *
 * @param {String} str
 * @param {Options} options
 * @return {Function}
 * @api public
 */

export function compile(str, options) {
  var options = options || {};

  str = String(str);

  const parsed = compileBody(str, {
    compileDebug: options.compileDebug !== false,
    filename: options.filename,
    basedir: options.basedir,
    pretty: options.pretty,
    doctype: options.doctype,
    inlineRuntimeFunctions: options.inlineRuntimeFunctions,
    globals: options.globals,
    self: options.self,
    includeSources: options.compileDebug === true,
    debug: options.debug,
    templateName: 'template',
    filters: options.filters,
    filterOptions: options.filterOptions,
    filterAliases: options.filterAliases,
    plugins: options.plugins,
  });

  const res = options.inlineRuntimeFunctions
    ? new Function('', `${parsed.body};return template;`)()
    : runtimeWrap(parsed.body);

  res.dependencies = parsed.dependencies;

  return res;
}

/**
 * Compile a JavaScript source representation of the given pug `str`.
 *
 * Options:
 *
 *   - `compileDebug` When it is `true`, the source code is included in
 *     the compiled template for better error messages.
 *   - `filename` used to improve errors when `compileDebug` is not `true` and to resolve imports/extends
 *   - `name` the name of the resulting function (defaults to "template")
 *   - `module` when it is explicitly `true`, the source code include export module syntax
 *
 * @param {String} str
 * @param {Options} options
 * @return {Object}
 * @api public
 */

export function compileClientWithDependenciesTracked(str, options) {
  var options = options || {};

  str = String(str);
  const parsed = compileBody(str, {
    compileDebug: options.compileDebug,
    filename: options.filename,
    basedir: options.basedir,
    pretty: options.pretty,
    doctype: options.doctype,
    inlineRuntimeFunctions: options.inlineRuntimeFunctions !== false,
    globals: options.globals,
    self: options.self,
    includeSources: options.compileDebug,
    debug: options.debug,
    templateName: options.name || 'template',
    filters: options.filters,
    filterOptions: options.filterOptions,
    filterAliases: options.filterAliases,
    plugins: options.plugins,
  });

  let body = parsed.body;

  if (options.module) {
    if (options.inlineRuntimeFunctions === false) {
      body = `var pug = require("pug-runtime");${body}`;
    }
    body += ` module.exports = ${options.name || 'template'};`;
  }

  return {body, dependencies: parsed.dependencies};
}

/**
 * Compile a JavaScript source representation of the given pug `str`.
 *
 * Options:
 *
 *   - `compileDebug` When it is `true`, the source code is included in
 *     the compiled template for better error messages.
 *   - `filename` used to improve errors when `compileDebug` is not `true` and to resolve imports/extends
 *   - `name` the name of the resulting function (defaults to "template")
 *
 * @param {String} str
 * @param {Options} options
 * @return {String}
 * @api public
 */
export function compileClient(str, options) {
  return exports.compileClientWithDependenciesTracked(str, options).body;
}

/**
 * Compile a `Function` representation of the given pug file.
 *
 * Options:
 *
 *   - `compileDebug` when `false` debugging code is stripped from the compiled
       template, when it is explicitly `true`, the source code is included in
       the compiled template for better accuracy.
 *
 * @param {String} path
 * @param {Options} options
 * @return {Function}
 * @api public
 */
export function compileFile(path, options = {}) {
  options.filename = path;
  return handleTemplateCache(options);
}

/**
 * Render the given `str` of pug.
 *
 * Options:
 *
 *   - `cache` enable template caching
 *   - `filename` filename required for `include` / `extends` and caching
 *
 * @param {String} str
 * @param {Object|Function} options or fn
 * @param {Function|undefined} fn
 * @returns {String}
 * @api public
 */

export function render(str, options, fn) {
  // support callback API
  if ('function' == typeof options) {
    (fn = options), (options = undefined);
  }
  if (typeof fn === 'function') {
    let res;
    try {
      res = exports.render(str, options);
    } catch (ex) {
      return fn(ex);
    }
    return fn(null, res);
  }

  options = options || {};

  // cache requires .filename
  if (options.cache && !options.filename) {
    throw new Error('the "filename" option is required for caching');
  }

  return handleTemplateCache(options, str)(options);
}

/**
 * Render a Pug file at the given `path`.
 *
 * @param {String} path
 * @param {Object|Function} options or callback
 * @param {Function|undefined} fn
 * @returns {String}
 * @api public
 */

export function renderFile(path, options, fn) {
  // support callback API
  if ('function' == typeof options) {
    (fn = options), (options = undefined);
  }
  if (typeof fn === 'function') {
    let res;
    try {
      res = exports.renderFile(path, options);
    } catch (ex) {
      return fn(ex);
    }
    return fn(null, res);
  }

  options = options || {};

  options.filename = path;
  return handleTemplateCache(options)(options);
}

/**
 * Compile a Pug file at the given `path` for use on the client.
 *
 * @param {String} path
 * @param {Object} options
 * @returns {String}
 * @api public
 */

export function compileFileClient(path, options) {
  const key = `${path}:client`;
  options = options || {};

  options.filename = path;

  if (options.cache && exports.cache[key]) {
    return exports.cache[key];
  }

  const str = fs.readFileSync(options.filename, 'utf8');
  const out = exports.compileClient(str, options);
  if (options.cache) exports.cache[key] = out;
  return out;
}

/**
 * Express support.
 */

export function __express(path, options, fn) {
  if (
    options.compileDebug == undefined &&
    process.env.NODE_ENV === 'production'
  ) {
    options.compileDebug = false;
  }
  exports.renderFile(path, options, fn);
}
